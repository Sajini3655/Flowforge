package com.flowforge.messaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class RedisLockIT {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7.4-alpine")
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", redis::getFirstMappedPort);
        registry.add("spring.flyway.enabled", () -> "false");
        
    }

    @Autowired
    private RedisJobLockService lockService;

    @Test
    void lockAcquisitionSucceedsForFirstWorker() {
        UUID jobId = UUID.randomUUID();
        Optional<String> token = lockService.acquire(jobId);
        assertThat(token).isPresent();
    }

    @Test
    void secondAcquisitionFailsWhileLockExists() {
        UUID jobId = UUID.randomUUID();
        Optional<String> token1 = lockService.acquire(jobId);
        assertThat(token1).isPresent();

        Optional<String> token2 = lockService.acquire(jobId);
        assertThat(token2).isEmpty();
    }

    @Test
    void differentJobsCanBeLockedIndependently() {
        UUID job1 = UUID.randomUUID();
        UUID job2 = UUID.randomUUID();
        
        assertThat(lockService.acquire(job1)).isPresent();
        assertThat(lockService.acquire(job2)).isPresent();
    }

    @Test
    void correctTokenReleasesLock() {
        UUID jobId = UUID.randomUUID();
        Optional<String> token = lockService.acquire(jobId);
        assertThat(token).isPresent();
        
        lockService.release(jobId, token.get());
        
        // Now another worker can acquire it
        assertThat(lockService.acquire(jobId)).isPresent();
    }

    @Test
    void incorrectTokenCannotReleaseAnotherLock() {
        UUID jobId = UUID.randomUUID();
        Optional<String> token = lockService.acquire(jobId);
        assertThat(token).isPresent();
        
        lockService.release(jobId, "wrong-token");
        
        // Worker 2 shouldn't be able to acquire it yet
        assertThat(lockService.acquire(jobId)).isEmpty();
    }
}
