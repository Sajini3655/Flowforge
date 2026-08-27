package com.flowforge.messaging;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.flowforge.observability.FlowForgeMetrics;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class RedisJobLockService {

    private static final Logger log = LoggerFactory.getLogger(RedisJobLockService.class);

    private static final String KEY_PREFIX = "flowforge:job-lock:";
    private static final DefaultRedisScript<Long> RELEASE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('get', KEYS[1]) == ARGV[1] then "
                    + "return redis.call('del', KEYS[1]) else return 0 end",
            Long.class);

    private final StringRedisTemplate redisTemplate;
    private final Duration lockTtl;
    private final FlowForgeMetrics metrics;

    @Autowired
    public RedisJobLockService(StringRedisTemplate redisTemplate,
                               @Value("${flowforge.job-lock.ttl-ms}") long lockTtlMs,
                               FlowForgeMetrics metrics) {
        if (lockTtlMs <= 0) {
            throw new IllegalArgumentException("flowforge.job-lock.ttl-ms must be positive");
        }
        this.redisTemplate = redisTemplate;
        this.lockTtl = Duration.ofMillis(lockTtlMs);
        this.metrics = metrics == null ? FlowForgeMetrics.fallback() : metrics;
    }

    public RedisJobLockService(StringRedisTemplate redisTemplate, long lockTtlMs) {
        this(redisTemplate, lockTtlMs, FlowForgeMetrics.fallback());
    }

    public Optional<String> acquire(UUID jobId) {
        String token = UUID.randomUUID().toString();
        boolean acquired;
        try {
            acquired = Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent(lockKey(jobId), token, lockTtl));
        } catch (RuntimeException exception) {
            metrics.lockFailed();
            log.error("redis lock acquisition failed jobId={}", jobId, exception);
            throw exception;
        }
        if (acquired) metrics.lockAcquired();
        else metrics.lockContention();
        return acquired ? Optional.of(token) : Optional.empty();
    }

    public void release(UUID jobId, String token) {
        try {
            redisTemplate.execute(RELEASE_SCRIPT, List.of(lockKey(jobId)), token);
            log.info("redis lock released jobId={}", jobId);
        } catch (RuntimeException exception) {
            metrics.lockFailed();
            log.error("redis lock release failed jobId={}", jobId, exception);
            throw exception;
        }
    }

    String lockKey(UUID jobId) {
        return KEY_PREFIX + jobId;
    }
}
