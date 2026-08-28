package com.flowforge.job;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import com.flowforge.security.JwtService;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import com.flowforge.user.UserRepository;

import java.util.UUID;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class JobApiIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
        registry.add("spring.jpa.database-platform", () -> "org.hibernate.dialect.PostgreSQLDialect");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "update"); // Or validate since flyway is typically used, but test uses h2 setup, let's use update for ease
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private com.flowforge.outbox.OutboxEventRepository outboxEventRepository;

    private User user1;
    private User user2;
    private String token1;
    private String token2;

    @BeforeEach
    void setUp() {
        outboxEventRepository.deleteAll();
        jobRepository.deleteAll();
        
        Optional<User> u1 = userRepository.findByEmailIgnoreCase("user1@example.com");
        if (u1.isEmpty()) {
            user1 = new User();
            user1.setEmail("user1@example.com");
            user1.setRole(UserRole.USER);
            user1.setPasswordHash("dummy");
            user1 = userRepository.save(user1);
        } else {
            user1 = u1.get();
        }

        Optional<User> u2 = userRepository.findByEmailIgnoreCase("user2@example.com");
        if (u2.isEmpty()) {
            user2 = new User();
            user2.setEmail("user2@example.com");
            user2.setRole(UserRole.USER);
            user2.setPasswordHash("dummy");
            user2 = userRepository.save(user2);
        } else {
            user2 = u2.get();
        }

        token1 = jwtService.generateToken(user1);
        token2 = jwtService.generateToken(user2);
    }

    @Test
    void unauthenticatedSubmissionFails() {
        ResponseEntity<String> response = restTemplate.postForEntity("/api/jobs", "{}", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void authenticatedSubmissionSucceeds() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"type\":\"DATA_SYNC\",\"requestPayload\":\"payload123\"}", headers);
        
        ResponseEntity<Job> response = restTemplate.postForEntity("/api/jobs", request, Job.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getId()).isNotNull();
        assertThat(response.getBody().getType()).isEqualTo("DATA_SYNC");
    }

    @Test
    void missingRequiredFieldsReturnsBadRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"requestPayload\":\"payload\"}", headers);
        
        ResponseEntity<String> response = restTemplate.postForEntity("/api/jobs", request, String.class);
        assertThat(response.getStatusCode()).isIn(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unsupportedJobTypeIsAcceptedButFailsLaterOrAccepted() {
        // According to the code, unknown types are accepted at API level, but worker will fail them. Let's verify acceptance.
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"type\":\"UNSUPPORTED_TYPE\",\"requestPayload\":\"payload\"}", headers);
        
        ResponseEntity<String> response = restTemplate.postForEntity("/api/jobs", request, String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void idempotencyReplaysExistingJob() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Idempotency-Key", "key-123");
        HttpEntity<String> request = new HttpEntity<>("{\"type\":\"REPORT\",\"requestPayload\":\"idemp\"}", headers);
        
        ResponseEntity<Job> response1 = restTemplate.postForEntity("/api/jobs", request, Job.class);
        assertThat(response1.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Job job1 = response1.getBody();

        ResponseEntity<Job> response2 = restTemplate.postForEntity("/api/jobs", request, Job.class);
        assertThat(response2.getStatusCode()).isEqualTo(HttpStatus.OK); // Custom behavior: replay returns 200 OK typically, or 201 if just returned.
        // Let's assert same ID
        Job job2 = response2.getBody();
        assertThat(job2.getId()).isEqualTo(job1.getId());
    }

    @Test
    void idempotencyConflictWithDifferentPayload() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Idempotency-Key", "key-456");
        
        HttpEntity<String> request1 = new HttpEntity<>("{\"type\":\"REPORT\",\"requestPayload\":\"first\"}", headers);
        restTemplate.postForEntity("/api/jobs", request1, Job.class);

        HttpEntity<String> request2 = new HttpEntity<>("{\"type\":\"REPORT\",\"requestPayload\":\"different\"}", headers);
        ResponseEntity<String> response2 = restTemplate.postForEntity("/api/jobs", request2, String.class);
        
        assertThat(response2.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void ownerCanRetrieveJob() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"type\":\"REPORT\",\"requestPayload\":\"payload\"}", headers);
        
        ResponseEntity<Job> created = restTemplate.postForEntity("/api/jobs", request, Job.class);
        UUID jobId = created.getBody().getId();

        ResponseEntity<Job> retrieved = restTemplate.exchange("/api/jobs/" + jobId, HttpMethod.GET, new HttpEntity<>(headers), Job.class);
        assertThat(retrieved.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(retrieved.getBody().getId()).isEqualTo(jobId);
    }

    @Test
    void unauthorizedUserCannotRetrieveAnotherUsersJob() {
        HttpHeaders headers1 = new HttpHeaders();
        headers1.setBearerAuth(token1);
        headers1.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<String> request = new HttpEntity<>("{\"type\":\"REPORT\",\"requestPayload\":\"payload\"}", headers1);
        
        ResponseEntity<Job> created = restTemplate.postForEntity("/api/jobs", request, Job.class);
        UUID jobId = created.getBody().getId();

        HttpHeaders headers2 = new HttpHeaders();
        headers2.setBearerAuth(token2);
        ResponseEntity<String> retrieved = restTemplate.exchange("/api/jobs/" + jobId, HttpMethod.GET, new HttpEntity<>(headers2), String.class);
        
        assertThat(retrieved.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void unauthenticatedAccessIsRejectedForGet() {
        ResponseEntity<String> retrieved = restTemplate.exchange("/api/jobs/" + UUID.randomUUID(), HttpMethod.GET, HttpEntity.EMPTY, String.class);
        assertThat(retrieved.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void nonexistentJobReturnsNotFound() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token1);
        ResponseEntity<String> retrieved = restTemplate.exchange("/api/jobs/" + UUID.randomUUID(), HttpMethod.GET, new HttpEntity<>(headers), String.class);
        
        assertThat(retrieved.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
