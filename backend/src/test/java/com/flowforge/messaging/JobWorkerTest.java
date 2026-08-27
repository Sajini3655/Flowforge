package com.flowforge.messaging;

import com.flowforge.job.Job;
import com.flowforge.job.JobRepository;
import com.flowforge.job.JobStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class JobWorkerTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private RedisJobLockService lockService;

    private JobWorker worker;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        worker = new JobWorker(jobRepository, lockService, 3);
    }

    @Test
    void echoJobTransitionsToCompletedAndStoresPayload() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "ECHO", "hello flowforge");
        List<JobStatus> persistedStatuses = new ArrayList<>();
        doAnswer(invocation -> {
            persistedStatuses.add(job.getStatus());
            return job;
        }).when(jobRepository).saveAndFlush(job);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        claim(jobId, job);

        worker.execute(new JobMessage(jobId, "ECHO", "ignored", UUID.randomUUID()));

        verify(jobRepository).claimForProcessing(jobId, JobStatus.QUEUED, JobStatus.PROCESSING);
        assertThat(persistedStatuses).containsExactly(JobStatus.COMPLETED);
        assertThat(job.getResult()).isEqualTo("hello flowforge");
        assertThat(job.getStatus()).isEqualTo(JobStatus.COMPLETED);
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void unsupportedJobTypeTransitionsToFailedWithSafeReason() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "UNKNOWN", "payload");
        List<JobStatus> persistedStatuses = new ArrayList<>();
        doAnswer(invocation -> {
            persistedStatuses.add(job.getStatus());
            return job;
        }).when(jobRepository).saveAndFlush(job);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        claim(jobId, job);

        worker.execute(new JobMessage(jobId, "UNKNOWN", "payload", UUID.randomUUID()));

        verify(jobRepository).claimForProcessing(jobId, JobStatus.QUEUED, JobStatus.PROCESSING);
        assertThat(persistedStatuses).containsExactly(JobStatus.FAILED);
        assertThat(job.getResult()).isEqualTo("Unsupported job type: UNKNOWN");
        assertThat(job.getStatus()).isEqualTo(JobStatus.FAILED);
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void missingJobIsNotCreatedOrPersisted() {
        UUID jobId = UUID.randomUUID();
        when(jobRepository.findById(jobId)).thenReturn(Optional.empty());
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));

        worker.execute(new JobMessage(jobId, "ECHO", "payload", UUID.randomUUID()));

        verify(jobRepository, never()).saveAndFlush(any(Job.class));
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void transientFailureReturnsRetryableAndResetsToQueued() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "TRANSIENT_FAILURE", "payload");
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        claim(jobId, job);

        JobProcessingOutcome outcome = worker.execute(new JobMessage(jobId, "TRANSIENT_FAILURE", "payload", null));

        assertThat(outcome).isEqualTo(JobProcessingOutcome.RETRYABLE_FAILURE);
        assertThat(job.getAttemptCount()).isEqualTo(1);
        assertThat(job.getStatus()).isEqualTo(JobStatus.QUEUED);
        assertThat(job.getResult()).contains("attempt 1");
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void transientFailureAtMaximumAttemptsBecomesPermanentFailure() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "TRANSIENT_FAILURE", "payload");
        job.setAttemptCount(2);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        claim(jobId, job);

        JobProcessingOutcome outcome = worker.execute(new JobMessage(jobId, "TRANSIENT_FAILURE", "payload", null));

        assertThat(outcome).isEqualTo(JobProcessingOutcome.PERMANENT_FAILURE);
        assertThat(job.getAttemptCount()).isEqualTo(3);
        assertThat(job.getStatus()).isEqualTo(JobStatus.FAILED);
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void terminalJobIsNotExecutedAgain() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "ECHO", "payload");
        job.setStatus(JobStatus.COMPLETED);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));

        assertThat(worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isEqualTo(JobProcessingOutcome.ALREADY_HANDLED);
        verify(jobRepository, never()).claimForProcessing(any(), any(), any());
        verify(jobRepository, never()).saveAndFlush(any(Job.class));
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void processingJobIsNotClaimedAgain() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "ECHO", "payload");
        job.setStatus(JobStatus.PROCESSING);
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));

        assertThat(worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isEqualTo(JobProcessingOutcome.ALREADY_HANDLED);
        verify(jobRepository, never()).claimForProcessing(any(), any(), any());
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void lockUnavailablePreventsExecution() {
        UUID jobId = UUID.randomUUID();
        when(lockService.acquire(jobId)).thenReturn(Optional.empty());

        assertThat(worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isEqualTo(JobProcessingOutcome.ALREADY_HANDLED);
        verify(jobRepository, never()).findById(any());
        verify(jobRepository, never()).claimForProcessing(any(), any(), any());
    }

    @Test
    void redisFailurePreventsExecutionAndReturnsInfrastructureOutcome() {
        UUID jobId = UUID.randomUUID();
        when(lockService.acquire(jobId)).thenThrow(new IllegalStateException("redis unavailable"));

        assertThat(worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isEqualTo(JobProcessingOutcome.REDIS_UNAVAILABLE);
        verify(jobRepository, never()).findById(any());
        verify(jobRepository, never()).claimForProcessing(any(), any(), any());
    }

    @Test
    void failedPostgresClaimReleasesLockWithoutExecution() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "ECHO", "payload");
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        when(jobRepository.claimForProcessing(jobId, JobStatus.QUEUED, JobStatus.PROCESSING)).thenReturn(0);

        assertThat(worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isEqualTo(JobProcessingOutcome.ALREADY_HANDLED);
        verify(jobRepository, never()).saveAndFlush(any(Job.class));
        verify(lockService).release(jobId, "lock-token");
    }

    @Test
    void executionExceptionStillReleasesLock() {
        UUID jobId = UUID.randomUUID();
        Job job = job(jobId, "ECHO", "payload");
        when(lockService.acquire(jobId)).thenReturn(Optional.of("lock-token"));
        when(jobRepository.findById(jobId)).thenReturn(Optional.of(job));
        claim(jobId, job);
        doThrow(new IllegalStateException("database unavailable"))
                .when(jobRepository).saveAndFlush(job);

        assertThatThrownBy(() -> worker.execute(new JobMessage(jobId, "ECHO", "payload", null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("database unavailable");
        verify(lockService).release(jobId, "lock-token");
    }

    private void claim(UUID jobId, Job job) {
        org.mockito.Mockito.when(jobRepository.claimForProcessing(jobId, JobStatus.QUEUED, JobStatus.PROCESSING))
                .thenAnswer(invocation -> {
                    job.setStatus(JobStatus.PROCESSING);
                    job.setAttemptCount(job.getAttemptCount() + 1);
                    return 1;
                });
    }

    private Job job(UUID id, String type, String payload) {
        Job job = new Job();
        org.springframework.test.util.ReflectionTestUtils.setField(job, "id", id);
        job.setType(type);
        job.setRequestPayload(payload);
        return job;
    }
}
