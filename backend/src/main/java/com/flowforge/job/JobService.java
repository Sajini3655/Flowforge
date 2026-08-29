package com.flowforge.job;

import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.messaging.JobMessage;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import com.flowforge.outbox.OutboxEvent;
import com.flowforge.outbox.OutboxEventRepository;
import com.flowforge.observability.CorrelationIdFilter;
import com.flowforge.observability.FlowForgeMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

@Service
public class JobService {

    private static final Logger log = LoggerFactory.getLogger(JobService.class);

    private final JobRepository repository;
    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final FlowForgeMetrics metrics;
    private final TransactionTemplate transactionTemplate;

    public JobService(JobRepository repository,
                      OutboxEventRepository outboxRepository,
                      ObjectMapper objectMapper,
                      FlowForgeMetrics metrics,
                      PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.outboxRepository = outboxRepository;
        this.objectMapper = objectMapper;
        this.metrics = metrics == null ? FlowForgeMetrics.fallback() : metrics;
        this.transactionTemplate = transactionManager == null ? null : new TransactionTemplate(transactionManager);
    }

    public List<Job> findAll() {
        User user = currentUser();
        return user.getRole() == UserRole.ADMIN
                ? repository.findAll()
                : repository.findAllBySubmittedBy(user);
    }

    public Job findById(UUID id) {
        User user = currentUser();
        Job job = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found: " + id));
        if (user.getRole() != UserRole.ADMIN && !owns(user, job.getSubmittedBy())) {
            throw new AccessDeniedException("You do not have access to this job");
        }
        return job;
    }

    @Transactional
    public Job retry(UUID id) {
        Job job = findById(id);
        if (job.getStatus() != JobStatus.FAILED) {
            throw new IllegalStateException("Only failed jobs can be retried. Current status: " + job.getStatus());
        }

        job.setStatus(JobStatus.QUEUED);
        job.setResult(null);
        job.setAttemptCount(0);
        Job savedJob = repository.save(job);

        JobMessage message = new JobMessage(
                savedJob.getId(),
                savedJob.getType(),
                savedJob.getRequestPayload(),
                savedJob.getSubmittedBy().getId(),
                MDC.get(CorrelationIdFilter.MDC_KEY));
        String messagePayload;
        try {
            messagePayload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize job message for outbox retry", e);
        }
        OutboxEvent event = new OutboxEvent(savedJob.getId(), messagePayload);
        outboxRepository.save(event);
        metrics.outboxCreated();
        log.info("job retry initiated jobId={} type={} outboxEventId={}", savedJob.getId(), savedJob.getType(), event.getId());

        return savedJob;
    }

    @Transactional
    public Job create(JobRequest request) {
        User submittedBy = currentUser();
        return createJob(request, submittedBy, null, null);
    }

    public JobSubmissionResult createIdempotent(JobRequest request, String rawIdempotencyKey) {
        User submittedBy = currentUser();
        String idempotencyKey = normalizeIdempotencyKey(rawIdempotencyKey);
        if (idempotencyKey == null) {
            return new JobSubmissionResult(create(request), false);
        }

        String fingerprint = fingerprint(request);
        Job existing = repository.findBySubmittedByAndIdempotencyKey(submittedBy, idempotencyKey).orElse(null);
        if (existing != null) {
            return existingSubmission(existing, fingerprint);
        }

        try {
            Job created = transactionTemplate == null
                    ? createJob(request, submittedBy, idempotencyKey, fingerprint)
                    : transactionTemplate.execute(status -> createJob(request, submittedBy, idempotencyKey, fingerprint));
            return new JobSubmissionResult(created, false);
        } catch (DataIntegrityViolationException race) {
            Job raced = repository.findBySubmittedByAndIdempotencyKey(submittedBy, idempotencyKey)
                    .orElseThrow(() -> race);
            return existingSubmission(raced, fingerprint);
        }
    }

    private JobSubmissionResult existingSubmission(Job existing, String fingerprint) {
        if (!fingerprint.equals(existing.getRequestFingerprint())) {
            metrics.idempotencyConflict();
            log.warn("idempotency key conflict jobId={} type={}", existing.getId(), existing.getType());
            throw new IdempotencyKeyConflictException();
        }
        metrics.idempotencyReplay();
        log.info("idempotent job replay jobId={} type={}", existing.getId(), existing.getType());
        return new JobSubmissionResult(existing, true);
    }

    private Job createJob(JobRequest request, User submittedBy, String idempotencyKey, String fingerprint) {
        Job job = new Job();
        job.setType(request.type());
        job.setRequestPayload(request.requestPayload());
        job.setStatus(JobStatus.QUEUED);
        job.setSubmittedBy(submittedBy);
        job.setIdempotencyKey(idempotencyKey);
        job.setRequestFingerprint(fingerprint);
        Job persistedJob = repository.save(job);
        
        // Create outbox event in the same transaction
        JobMessage message = new JobMessage(
            persistedJob.getId(),
            persistedJob.getType(),
            persistedJob.getRequestPayload(),
            persistedJob.getSubmittedBy().getId(),
            MDC.get(CorrelationIdFilter.MDC_KEY));
        String messagePayload;
        try {
            messagePayload = objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize job message for outbox", e);
        }
        OutboxEvent event = new OutboxEvent(persistedJob.getId(), messagePayload);
        outboxRepository.save(event);
        metrics.outboxCreated();
        metrics.jobSubmitted();
        log.info("job submitted jobId={} type={} outboxEventId={} correlationId={}",
            persistedJob.getId(), persistedJob.getType(), event.getId(),
            MDC.get(CorrelationIdFilter.MDC_KEY));
        
        return persistedJob;
    }

    private String normalizeIdempotencyKey(String rawKey) {
        if (rawKey == null) {
            return null;
        }
        String key = rawKey.trim();
        if (key.isEmpty() || key.length() > 128) {
            throw new InvalidIdempotencyKeyException();
        }
        return key;
    }

    private String fingerprint(JobRequest request) {
        String value = request.type().length() + ":" + request.type()
                + ":" + request.requestPayload().length() + ":" + request.requestPayload();
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private User currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        throw new AccessDeniedException("Authenticated user is unavailable");
    }

    private boolean owns(User user, User owner) {
        if (owner == null) {
            return false;
        }
        if (user.getId() != null && owner.getId() != null) {
            return user.getId().equals(owner.getId());
        }
        return user.getEmail() != null && user.getEmail().equalsIgnoreCase(owner.getEmail());
    }
}
