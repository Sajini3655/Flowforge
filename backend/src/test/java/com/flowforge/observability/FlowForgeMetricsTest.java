package com.flowforge.observability;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FlowForgeMetricsTest {

    @Test
    void recordsRequiredCountersAndProcessingDuration() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        FlowForgeMetrics metrics = new FlowForgeMetrics(registry);

        metrics.jobSubmitted();
        metrics.jobCompleted();
        metrics.jobFailed();
        metrics.retryAttempt();
        metrics.dlqPublication();
        metrics.outboxCreated();
        metrics.outboxPublished();
        metrics.outboxPublishFailure();
        metrics.lockAcquired();
        metrics.lockFailed();
        metrics.lockContention();
        metrics.stopTimer(metrics.startTimer());

        assertThat(registry.get("flowforge.jobs.submitted").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.jobs.completed").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.jobs.failed").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.jobs.retry.attempts").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.jobs.dlq.publications").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.outbox.events.created").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.outbox.events.published").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.outbox.events.publish.failures").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.redis.lock.acquired").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.redis.lock.failures").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.redis.lock.contention").counter().count()).isEqualTo(1);
        assertThat(registry.get("flowforge.jobs.processing.duration").timer().count()).isEqualTo(1);
    }
}
