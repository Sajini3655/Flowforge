package com.flowforge.messaging;

import com.flowforge.job.Job;
import com.flowforge.job.JobRepository;
import com.flowforge.job.JobStatus;
import com.flowforge.outbox.OutboxEventRepository;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import com.flowforge.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.awaitility.Awaitility;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class MessagingIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @Container
    static RabbitMQContainer rabbitmq = new RabbitMQContainer("rabbitmq:3.13-management").withStartupTimeout(java.time.Duration.ofMinutes(6));

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
        registry.add("spring.rabbitmq.host", rabbitmq::getHost);
        registry.add("spring.rabbitmq.port", rabbitmq::getAmqpPort);
        registry.add("spring.rabbitmq.username", rabbitmq::getAdminUsername);
        registry.add("spring.rabbitmq.password", rabbitmq::getAdminPassword);
        registry.add("spring.rabbitmq.listener.simple.auto-startup", () -> "true");
        registry.add("spring.task.scheduling.enabled", () -> "true");
        // Decrease retry delay for faster tests
        registry.add("flowforge.jobs.retry-delay-ms", () -> "100");
    }

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    private User testUser;

    @BeforeEach
    void setUp() {
        outboxEventRepository.deleteAll();
        jobRepository.deleteAll();
        
        Optional<User> u = userRepository.findByEmailIgnoreCase("messaging@example.com");
        if (u.isEmpty()) {
            testUser = new User();
            testUser.setEmail("messaging@example.com");
            testUser.setRole(UserRole.USER);
            testUser.setPasswordHash("dummy");
            testUser = userRepository.save(testUser);
        } else {
            testUser = u.get();
        }
    }

    @Test
    void endToEndJobProcessingSuccessfullyCompletes() {
        Job job = new Job();
        job.setSubmittedBy(testUser);
        job.setType("ECHO"); 
        job.setRequestPayload("{\"test\":\"data\"}");
        job.setStatus(JobStatus.QUEUED);
        job = jobRepository.save(job);

        com.flowforge.outbox.OutboxEvent event = new com.flowforge.outbox.OutboxEvent();
        event.setJobId(job.getId());
        event.setMessagePayload("{\"jobId\":\"" + job.getId() + "\", \"type\":\"ECHO\", \"payload\":\"{\\\"test\\\":\\\"data\\\"}\"}");
        event.setPublished(false);
        outboxEventRepository.save(event);

        Job finalJob = job;
        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> {
                    Job dbJob = jobRepository.findById(finalJob.getId()).orElseThrow();
                    assertThat(dbJob.getStatus()).isEqualTo(JobStatus.COMPLETED);
                });
    }

    @Test
    void unsupportedJobTypeFollowsFailurePathAndReachesDlq() {
        // Clear DLQ first
        while (rabbitTemplate.receive("flowforge.job.dlq") != null) {}

        Job job = new Job();
        job.setSubmittedBy(testUser);
        job.setType("UNSUPPORTED"); // Invalid type
        job.setRequestPayload("{}");
        job.setStatus(JobStatus.QUEUED);
        job = jobRepository.save(job);

        com.flowforge.outbox.OutboxEvent event = new com.flowforge.outbox.OutboxEvent();
        event.setJobId(job.getId());
        event.setMessagePayload("{\"jobId\":\"" + job.getId() + "\", \"type\":\"UNSUPPORTED\", \"payload\":\"{}\"}");
        event.setPublished(false);
        outboxEventRepository.save(event);

        Job finalJob = job;
        // Step 1: wait for job to reach FAILED status (without touching the DLQ)
        Awaitility.await()
                .atMost(Duration.ofSeconds(15))
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> {
                    Job dbJob = jobRepository.findById(finalJob.getId()).orElseThrow();
                    assertThat(dbJob.getStatus()).isEqualTo(JobStatus.FAILED);
                });

        // Step 2: after FAILED is confirmed, check DLQ once.
        // rabbitTemplate.receive() is a destructive read — polling it inside Awaitility
        // would consume the message on one iteration and leave nothing for the next.
        Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .pollInterval(Duration.ofMillis(500))
                .untilAsserted(() -> {
                    Message msg = rabbitTemplate.receive("flowforge.job.dlq");
                    assertThat(msg).isNotNull();
                });
    }
}
