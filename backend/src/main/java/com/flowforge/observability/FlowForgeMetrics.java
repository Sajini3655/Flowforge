package com.flowforge.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.Metrics;
import org.springframework.stereotype.Component;

@Component
public class FlowForgeMetrics {

    private final Counter jobsSubmitted;
    private final Counter jobsCompleted;
    private final Counter jobsFailed;
    private final Counter retryAttempts;
    private final Counter dlqPublications;
    private final Counter outboxCreated;
    private final Counter outboxPublished;
    private final Counter outboxPublishFailures;
    private final Counter lockAcquired;
    private final Counter lockFailed;
    private final Counter lockContention;
    private final Counter idempotencyReplays;
    private final Counter idempotencyConflicts;
    private final Timer jobProcessingDuration;

    public FlowForgeMetrics(MeterRegistry registry) {
        jobsSubmitted = counter(registry, "flowforge.jobs.submitted", "Jobs submitted through the API");
        jobsCompleted = counter(registry, "flowforge.jobs.completed", "Jobs completed successfully");
        jobsFailed = counter(registry, "flowforge.jobs.failed", "Jobs that failed permanently");
        retryAttempts = counter(registry, "flowforge.jobs.retry.attempts", "Retryable job attempts");
        dlqPublications = counter(registry, "flowforge.jobs.dlq.publications", "Jobs routed to the dead-letter queue");
        outboxCreated = counter(registry, "flowforge.outbox.events.created", "Outbox events created");
        outboxPublished = counter(registry, "flowforge.outbox.events.published", "Outbox events published");
        outboxPublishFailures = counter(registry, "flowforge.outbox.events.publish.failures", "Outbox publication failures");
        lockAcquired = counter(registry, "flowforge.redis.lock.acquired", "Redis lock acquisitions");
        lockFailed = counter(registry, "flowforge.redis.lock.failures", "Redis lock failures");
        lockContention = counter(registry, "flowforge.redis.lock.contention", "Redis lock contention events");
        idempotencyReplays = counter(registry, "flowforge.jobs.idempotency.replays", "Idempotent job submission replays");
        idempotencyConflicts = counter(registry, "flowforge.jobs.idempotency.conflicts", "Idempotency key conflicts");
        jobProcessingDuration = Timer.builder("flowforge.jobs.processing.duration")
                .description("Job processing duration")
                .register(registry);
    }

    public static FlowForgeMetrics fallback() {
        return new FlowForgeMetrics(Metrics.globalRegistry);
    }

    private Counter counter(MeterRegistry registry, String name, String description) {
        return Counter.builder(name).description(description).register(registry);
    }

    public void jobSubmitted() { jobsSubmitted.increment(); }
    public void jobCompleted() { jobsCompleted.increment(); }
    public void jobFailed() { jobsFailed.increment(); }
    public void retryAttempt() { retryAttempts.increment(); }
    public void dlqPublication() { dlqPublications.increment(); }
    public void outboxCreated() { outboxCreated.increment(); }
    public void outboxPublished() { outboxPublished.increment(); }
    public void outboxPublishFailure() { outboxPublishFailures.increment(); }
    public void lockAcquired() { lockAcquired.increment(); }
    public void lockFailed() { lockFailed.increment(); }
    public void lockContention() { lockContention.increment(); }
    public void idempotencyReplay() { idempotencyReplays.increment(); }
    public void idempotencyConflict() { idempotencyConflicts.increment(); }
    public Timer.Sample startTimer() { return Timer.start(); }
    public void stopTimer(Timer.Sample sample) { sample.stop(jobProcessingDuration); }
}