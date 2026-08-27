package com.flowforge.messaging;

import com.flowforge.job.Job;
import com.flowforge.job.JobRepository;
import com.flowforge.job.JobStatus;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.flowforge.observability.FlowForgeMetrics;
import org.springframework.beans.factory.annotation.Autowired;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

@Component
public class JobWorker {

    private static final Logger log = LoggerFactory.getLogger(JobWorker.class);
    private static final String ECHO_TYPE = "ECHO";
    private static final String TRANSIENT_FAILURE_TYPE = "TRANSIENT_FAILURE";

    private final JobRepository jobRepository;
    private final RedisJobLockService lockService;
    private final int maxAttempts;
    private final FlowForgeMetrics metrics;

    @Autowired
    public JobWorker(JobRepository jobRepository,
                     RedisJobLockService lockService,
                     @Value("${flowforge.jobs.max-attempts}") int maxAttempts,
                     FlowForgeMetrics metrics) {
        this.jobRepository = jobRepository;
        this.lockService = lockService;
        this.maxAttempts = maxAttempts;
        this.metrics = metrics == null ? FlowForgeMetrics.fallback() : metrics;
    }

    public JobWorker(JobRepository jobRepository, RedisJobLockService lockService, int maxAttempts) {
        this(jobRepository, lockService, maxAttempts, FlowForgeMetrics.fallback());
    }

    public JobProcessingOutcome execute(JobMessage message) {
        log.info("Received job message jobId={} type={}", message.jobId(), message.type());

        String lockToken;
        try {
            lockToken = lockService.acquire(message.jobId()).orElse(null);
        } catch (RuntimeException exception) {
            log.error("Redis lock unavailable; refusing job execution jobId={}", message.jobId(), exception);
            return JobProcessingOutcome.REDIS_UNAVAILABLE;
        }
        if (lockToken == null) {
            metrics.lockContention();
            log.info("Job execution lock is held by another worker jobId={}", message.jobId());
            return JobProcessingOutcome.ALREADY_HANDLED;
        }

        Timer.Sample timer = metrics.startTimer();
        try {
            Job job = jobRepository.findById(message.jobId()).orElse(null);
            if (job == null) {
                log.warn("Job message references missing jobId={}", message.jobId());
                return JobProcessingOutcome.STALE;
            }
            if (job.getStatus() == JobStatus.COMPLETED || job.getStatus() == JobStatus.FAILED) {
                log.info("Skipping terminal job jobId={} status={}", job.getId(), job.getStatus());
                return JobProcessingOutcome.ALREADY_HANDLED;
            }
            if (job.getStatus() != JobStatus.QUEUED
                    || jobRepository.claimForProcessing(job.getId(), JobStatus.QUEUED, JobStatus.PROCESSING) != 1) {
                log.info("Skipping job already being handled jobId={} status={}", job.getId(), job.getStatus());
                return JobProcessingOutcome.ALREADY_HANDLED;
            }

            job = jobRepository.findById(job.getId()).orElseThrow();
            log.info("Job processing started jobId={} type={} attempt={}",
                    job.getId(), job.getType(), job.getAttemptCount());

            if (ECHO_TYPE.equalsIgnoreCase(job.getType())) {
                job.setResult(job.getRequestPayload());
                job.setStatus(JobStatus.COMPLETED);
                jobRepository.saveAndFlush(job);
                metrics.jobCompleted();
                log.info("Job processing completed jobId={} type={}", job.getId(), job.getType());
                return JobProcessingOutcome.COMPLETED;
            }

            if (TRANSIENT_FAILURE_TYPE.equalsIgnoreCase(job.getType())) {
                String reason = "Transient job execution failed on attempt " + job.getAttemptCount();
                if (job.getAttemptCount() >= maxAttempts) {
                    job.setResult(reason);
                    job.setStatus(JobStatus.FAILED);
                    jobRepository.saveAndFlush(job);
                    metrics.jobFailed();
                    log.warn("Job permanently failed jobId={} attempt={}", job.getId(), job.getAttemptCount());
                    return JobProcessingOutcome.PERMANENT_FAILURE;
                }
                job.setResult(reason);
                job.setStatus(JobStatus.QUEUED);
                jobRepository.saveAndFlush(job);
                metrics.retryAttempt();
                log.warn("Job processing will be retried jobId={} attempt={}", job.getId(), job.getAttemptCount());
                return JobProcessingOutcome.RETRYABLE_FAILURE;
            }

            job.setResult("Unsupported job type: " + job.getType());
            job.setStatus(JobStatus.FAILED);
            jobRepository.saveAndFlush(job);
            metrics.jobFailed();
            log.warn("Job processing failed jobId={} reason=unsupported_type", job.getId());
            return JobProcessingOutcome.PERMANENT_FAILURE;
        } finally {
            metrics.stopTimer(timer);
            lockService.release(message.jobId(), lockToken);
        }
    }
}
