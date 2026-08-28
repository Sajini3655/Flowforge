package com.flowforge.observability;

import com.flowforge.security.JwtService;
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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
@ActiveProfiles("test")
class ObservabilityIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.datasource.driver-class-name", postgres::getDriverClassName);
        registry.add("spring.flyway.enabled", () -> "true");
        registry.add("spring.flyway.url", postgres::getJdbcUrl);
        registry.add("spring.flyway.user", postgres::getUsername);
        registry.add("spring.flyway.password", postgres::getPassword);
        registry.add("management.endpoints.web.exposure.include", () -> "*");
        registry.add("management.endpoint.prometheus.enabled", () -> "true");
        registry.add("management.prometheus.metrics.export.enabled", () -> "true");
    }

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private FlowForgeMetrics flowForgeMetrics;

    @Test
    void prometheusEndpointExposesMetricsWithoutAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/prometheus", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotBlank();
        assertThat(response.getBody()).contains("jvm_memory_used_bytes");
    }

    @Test
    void customBusinessMetricsAreExportedToPrometheus() {
        flowForgeMetrics.jobSubmitted();
        flowForgeMetrics.jobCompleted();
        flowForgeMetrics.lockAcquired();

        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/prometheus", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        assertThat(body).contains("flowforge_jobs_submitted_total");
        assertThat(body).contains("flowforge_jobs_completed_total");
        assertThat(body).contains("flowforge_redis_lock_acquired_total");
    }

    @Test
    void livenessAndReadinessProbesAreAvailable() {
        ResponseEntity<String> live = restTemplate.getForEntity("/api/health/live", String.class);
        assertThat(live.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(live.getBody()).contains("\"status\":\"UP\"");

        ResponseEntity<String> ready = restTemplate.getForEntity("/api/health/ready", String.class);
        assertThat(ready.getStatusCode()).isNotNull();
        assertThat(ready.getBody()).contains("postgresql");
    }

    @Test
    void correlationIdIsPropagatedOrGenerated() {
        String clientCorrelationId = "test-corr-" + UUID.randomUUID();
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Correlation-ID", clientCorrelationId);

        ResponseEntity<String> withId = restTemplate.exchange("/api/health/live", HttpMethod.GET, new HttpEntity<>(headers), String.class);
        assertThat(withId.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(withId.getHeaders().getFirst("X-Correlation-ID")).isEqualTo(clientCorrelationId);

        ResponseEntity<String> withoutId = restTemplate.getForEntity("/api/health/live", String.class);
        assertThat(withoutId.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(withoutId.getHeaders().getFirst("X-Correlation-ID")).isNotBlank();
    }
}
