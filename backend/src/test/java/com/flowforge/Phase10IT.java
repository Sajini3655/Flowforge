package com.flowforge;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowforge.job.Job;
import com.flowforge.job.JobRepository;
import com.flowforge.job.JobStatus;
import com.flowforge.messaging.JobMessage;
import com.flowforge.messaging.JobProcessingOutcome;
import com.flowforge.messaging.JobWorker;
import com.flowforge.messaging.RabbitMqConfig;
import com.flowforge.outbox.OutboxEvent;
import com.flowforge.outbox.OutboxEventRepository;
import com.flowforge.user.User;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.containers.wait.strategy.Wait;

import javax.sql.DataSource;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@org.junit.jupiter.api.Disabled("Skip Phase10 until Phase 10")
class Phase10IT {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("flowforge")
            .withUsername("flowforge")
            .withPassword("flowforge");

    @Container
    static final GenericContainer<?> RABBITMQ = new GenericContainer<>("rabbitmq:3.13-management")
            .withExposedPorts(5672)
            .withEnv("RABBITMQ_DEFAULT_USER", "flowforge")
            .withEnv("RABBITMQ_DEFAULT_PASS", "flowforge")
            .waitingFor(Wait.forListeningPort());

    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7.4-alpine")
            .withExposedPorts(6379)
            .waitingFor(Wait.forListeningPort());

    @DynamicPropertySource
    static void containerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.rabbitmq.host", RABBITMQ::getHost);
        registry.add("spring.rabbitmq.port", () -> RABBITMQ.getMappedPort(5672));
        registry.add("spring.rabbitmq.username", () -> "flowforge");
        registry.add("spring.rabbitmq.password", () -> "flowforge");
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("flowforge.outbox.poll-interval-ms", () -> "100");
        registry.add("flowforge.jobs.retry-delay-ms", () -> "250");
        registry.add("flowforge.jobs.max-attempts", () -> "3");
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private JobRepository jobRepository;

    @Autowired
    private OutboxEventRepository outboxRepository;

    @Autowired
    private JobWorker worker;

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private DataSource dataSource;

    private String baseUrl() {
        return "http://localhost:" + port;
    }

    @Test
    @Order(1)
    void cleanDatabaseAppliesAllMigrationsAndExpectedSchema() {
        assertThat(jdbcTemplate.queryForObject(
                "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1", String.class))
                .isEqualTo("6");
        assertThat(tableExists("users")).isTrue();
        assertThat(tableExists("jobs")).isTrue();
        assertThat(tableExists("outbox_events")).isTrue();
        assertThat(columnExists("jobs", "idempotency_key")).isTrue();
        assertThat(columnExists("jobs", "request_fingerprint")).isTrue();
        assertThat(indexExists("uq_jobs_submitted_by_idempotency_key")).isTrue();
        assertThat(columnType("jobs", "request_payload")).isEqualTo("text");
        assertThat(columnType("jobs", "result")).isEqualTo("text");
        assertThat(columnType("outbox_events", "message_payload")).isEqualTo("text");
    }

    @Test
    @Order(2)
    void realApiCreatesOutboxProcessesEchoAndReplaysSafely() throws Exception {
        String token = registerAndLogin();
        HttpHeaders headers = authenticatedHeaders(token, "phase10-echo", "phase10-echo-correlation");
        String request = "{\"type\":\"ECHO\",\"requestPayload\":\"{\\\"message\\\":\\\"phase10\\\"}\"}";

        ResponseEntity<String> created = postJob(headers, request);
        JsonNode original = objectMapper.readTree(created.getBody());
        UUID jobId = UUID.fromString(original.get("id").asText());
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getHeaders().getFirst("X-Correlation-ID"))
                .isEqualTo("phase10-echo-correlation");

        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            Job job = jobRepository.findById(jobId).orElseThrow();
            assertThat(job.getStatus()).isEqualTo(JobStatus.COMPLETED);
            assertThat(job.getAttemptCount()).isEqualTo(1);
        });
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_events WHERE job_id = ?", Long.class, jobId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_events WHERE job_id = ? AND published", Long.class, jobId)).isEqualTo(1);

        ResponseEntity<String> replay = postJob(headers, request);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(objectMapper.readTree(replay.getBody()).get("id").asText())
                .isEqualTo(jobId.toString());
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE id = ?", Long.class, jobId)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM outbox_events WHERE job_id = ?", Long.class, jobId)).isEqualTo(1);

        ResponseEntity<String> conflict = postJob(headers,
                "{\"type\":\"ECHO\",\"requestPayload\":\"{\\\"message\\\":\\\"different\\\"}\"}");
        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @Order(3)
    void realRabbitDuplicateDeliveryDoesNotReexecuteTerminalJob() throws Exception {
        String token = registerAndLogin();
        HttpHeaders headers = authenticatedHeaders(token, "phase10-duplicate", "phase10-duplicate-correlation");
        String request = "{\"type\":\"ECHO\",\"requestPayload\":\"{\\\"message\\\":\\\"duplicate\\\"}\"}";
        JsonNode created = objectMapper.readTree(postJob(headers, request).getBody());
        UUID jobId = UUID.fromString(created.get("id").asText());

        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                assertThat(jobRepository.findById(jobId).orElseThrow().getStatus())
                        .isEqualTo(JobStatus.COMPLETED));
        int attemptsBefore = jobRepository.findById(jobId).orElseThrow().getAttemptCount();

        rabbitTemplate.convertAndSend(RabbitMqConfig.EXCHANGE_NAME, RabbitMqConfig.ROUTING_KEY,
                new JobMessage(jobId, "ECHO", "{\"message\":\"duplicate\"}", null,
                        "phase10-duplicate-correlation"));

        Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(jobRepository.findById(jobId).orElseThrow().getAttemptCount())
                        .isEqualTo(attemptsBefore));
        assertThat(jobRepository.findById(jobId).orElseThrow().getStatus())
                .isEqualTo(JobStatus.COMPLETED);
    }

    @Test
    @Order(4)
    void concurrentRealSubmissionsCreateOneJobAndOneOutboxEvent() throws Exception {
        String token = registerAndLogin();
        String request = "{\"type\":\"ECHO\",\"requestPayload\":\"{\\\"message\\\":\\\"concurrent\\\"}\"}";
        ExecutorService executor = Executors.newFixedThreadPool(10);
        try {
            List<Future<ResponseEntity<String>>> futures = new ArrayList<>();
            for (int i = 0; i < 10; i++) {
                int requestNumber = i;
                futures.add(executor.submit(() -> postJob(
                        authenticatedHeaders(token, "phase10-concurrent", "phase10-concurrent-" + requestNumber),
                        request)));
            }
            List<ResponseEntity<String>> responses = new ArrayList<>();
            for (Future<ResponseEntity<String>> future : futures) {
                responses.add(future.get());
            }
            assertThat(responses).allMatch(response ->
                    response.getStatusCode().equals(HttpStatus.CREATED)
                            || response.getStatusCode().equals(HttpStatus.OK));
            assertThat(responses.stream().filter(response -> response.getStatusCode()
                    .equals(HttpStatus.CREATED)).count()).isEqualTo(1);
            List<String> ids = responses.stream()
                    .map(response -> readId(response.getBody()))
                    .distinct()
                    .collect(Collectors.toList());
            assertThat(ids).hasSize(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM jobs WHERE idempotency_key = ?", Long.class,
                    "phase10-concurrent")).isEqualTo(1);
            assertThat(jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM outbox_events o JOIN jobs j ON j.id = o.job_id "
                            + "WHERE j.idempotency_key = ?", Long.class,
                    "phase10-concurrent")).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    @Order(5)
    void realRabbitRetryAndDlqFlowsRemainIntact() throws Exception {
        String token = registerAndLogin();
        JsonNode transientJob = objectMapper.readTree(postJob(
                authenticatedHeaders(token, "phase10-retry", "phase10-retry-correlation"),
                "{\"type\":\"TRANSIENT_FAILURE\",\"requestPayload\":\"{\\\"case\\\":\\\"retry\\\"}\"}").getBody());
        UUID transientId = UUID.fromString(transientJob.get("id").asText());
        Awaitility.await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> {
            Job job = jobRepository.findById(transientId).orElseThrow();
            assertThat(job.getStatus()).isEqualTo(JobStatus.FAILED);
            assertThat(job.getAttemptCount()).isEqualTo(3);
        });

        JsonNode unsupportedJob = objectMapper.readTree(postJob(
                authenticatedHeaders(token, "phase10-dlq", "phase10-dlq-correlation"),
                "{\"type\":\"UNSUPPORTED_PHASE10\",\"requestPayload\":\"{}\"}").getBody());
        UUID unsupportedId = UUID.fromString(unsupportedJob.get("id").asText());
        Awaitility.await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            Job job = jobRepository.findById(unsupportedId).orElseThrow();
            assertThat(job.getStatus()).isEqualTo(JobStatus.FAILED);
            assertThat(job.getAttemptCount()).isEqualTo(1);
        });
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM jobs WHERE id = ?", Long.class, unsupportedId)).isEqualTo(1);
    }

    @Test
    @Order(6)
    void livenessAndReadinessReflectRealDependencies() {
        ResponseEntity<String> live = restTemplate.getForEntity(baseUrl() + "/api/health/live", String.class);
        ResponseEntity<String> ready = restTemplate.getForEntity(baseUrl() + "/api/health/ready", String.class);
        assertThat(live.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ready.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ready.getBody()).contains("postgresql\":\"UP").contains("rabbitmq\":\"UP").contains("redis\":\"UP");
    }

    private ResponseEntity<String> postJob(HttpHeaders headers, String body) {
        return restTemplate.exchange(baseUrl() + "/api/jobs", HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);
    }

    private HttpHeaders authenticatedHeaders(String token, String key, String correlationId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.set("Idempotency-Key", key);
        headers.set("X-Correlation-ID", correlationId);
        headers.set("Content-Type", "application/json");
        return headers;
    }

    private String registerAndLogin() throws Exception {
        String email = "phase10-" + UUID.randomUUID() + "@example.com";
        String body = "{\"email\":\"" + email + "\",\"password\":\"Phase10-Test-Password!\"}";
        ResponseEntity<String> registration = restTemplate.postForEntity(
                baseUrl() + "/api/auth/register", new HttpEntity<>(body, jsonHeaders()), String.class);
        assertThat(registration.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        ResponseEntity<String> login = restTemplate.postForEntity(
                baseUrl() + "/api/auth/login", new HttpEntity<>(body, jsonHeaders()), String.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        return objectMapper.readTree(login.getBody()).get("token").asText();
    }

    private HttpHeaders jsonHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Content-Type", "application/json");
        return headers;
    }

    private String readId(String body) {
        try {
            return objectMapper.readTree(body).get("id").asText();
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private boolean tableExists(String table) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.tables "
                + "WHERE table_schema = 'public' AND table_name = ?", Integer.class, table) == 1;
    }

    private boolean columnExists(String table, String column) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM information_schema.columns "
                + "WHERE table_schema = 'public' AND table_name = ? AND column_name = ?",
                Integer.class, table, column) == 1;
    }

    private boolean indexExists(String index) {
        return jdbcTemplate.queryForObject("SELECT COUNT(*) FROM pg_indexes "
                + "WHERE schemaname = 'public' AND indexname = ?", Integer.class, index) == 1;
    }

    private String columnType(String table, String column) {
        return jdbcTemplate.queryForObject("SELECT data_type FROM information_schema.columns "
                + "WHERE table_schema = 'public' AND table_name = ? AND column_name = ?",
                String.class, table, column);
    }
}
