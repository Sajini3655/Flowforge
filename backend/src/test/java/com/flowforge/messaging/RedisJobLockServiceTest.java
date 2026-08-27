package com.flowforge.messaging;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisJobLockServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private RedisJobLockService lockService;

    @BeforeEach
    void setUp() {
        lockService = new RedisJobLockService(redisTemplate, 60_000);
    }

    @Test
    void acquireUsesAtomicSetIfAbsentWithTtlAndUniqueToken() {
        UUID jobId = UUID.randomUUID();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), eq(Duration.ofMillis(60_000))))
                .thenReturn(true);

        String firstToken = lockService.acquire(jobId).orElseThrow();
        String secondToken = lockService.acquire(jobId).orElseThrow();

        assertThat(firstToken).isNotEqualTo(secondToken);
        verify(valueOperations).setIfAbsent(
                eq("flowforge:job-lock:" + jobId), eq(firstToken), eq(Duration.ofMillis(60_000)));
        verify(valueOperations).setIfAbsent(
                eq("flowforge:job-lock:" + jobId), eq(secondToken), eq(Duration.ofMillis(60_000)));
    }

    @Test
    void acquireReturnsEmptyWhenLockAlreadyExists() {
        UUID jobId = UUID.randomUUID();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(false);

        assertThat(lockService.acquire(jobId)).isEmpty();
    }

    @Test
    void releaseUsesCompareAndDeleteScriptAndMatchingToken() {
        UUID jobId = UUID.randomUUID();
        String token = UUID.randomUUID().toString();

        lockService.release(jobId, token);

        verify(redisTemplate).execute(any(DefaultRedisScript.class),
                eq(List.of("flowforge:job-lock:" + jobId)), eq(token));
    }

    @Test
    void lockKeyUsesStableNamespaceAndJobId() {
        UUID jobId = UUID.randomUUID();

        assertThat(lockService.lockKey(jobId)).isEqualTo("flowforge:job-lock:" + jobId);
    }
}
