package com.flowforge.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.outbox.OutboxEvent;
import com.flowforge.outbox.OutboxEventRepository;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobServiceTest {

    @Mock
    private JobRepository repository;

    @Mock
    private OutboxEventRepository outboxRepository;

    @InjectMocks
    private JobService service;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    private User authenticatedUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setRole(role);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        return user;
    }

    @Test
    void createMapsRequestQueuesJobAndSavesIt() throws Exception {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        JobRequest request = new JobRequest("REPORT", "{\"projectId\":123}");
        Job savedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(savedJob, "id", jobId);
        savedJob.setType("REPORT");
        savedJob.setRequestPayload("{\"projectId\":123}");
        savedJob.setSubmittedBy(submitter);
        when(repository.save(any(Job.class))).thenReturn(savedJob);

        Job result = service.create(request);

        assertThat(result).isSameAs(savedJob);
        ArgumentCaptor<Job> jobCaptor = ArgumentCaptor.forClass(Job.class);
        verify(repository).save(jobCaptor.capture());
        Job persistedJob = jobCaptor.getValue();
        assertThat(persistedJob.getType()).isEqualTo("REPORT");
        assertThat(persistedJob.getRequestPayload()).isEqualTo("{\"projectId\":123}");
        assertThat(persistedJob.getStatus()).isEqualTo(JobStatus.QUEUED);
        assertThat(persistedJob.getSubmittedBy()).isSameAs(submitter);
        
        ArgumentCaptor<OutboxEvent> outboxCaptor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(outboxCaptor.capture());
        OutboxEvent outboxEvent = outboxCaptor.getValue();
        assertThat(outboxEvent.getJobId()).isEqualTo(jobId);
        assertThat(outboxEvent.isPublished()).isFalse();
        assertThat(outboxEvent.getMessagePayload()).contains("REPORT");
        assertThat(outboxEvent.getMessagePayload()).contains("projectId");
    }

    @Test
    void findAllReturnsRepositoryResults() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        List<Job> jobs = List.of(new Job());
        when(repository.findAll()).thenReturn(jobs);

        List<Job> result = service.findAll();

        assertThat(result).isSameAs(jobs);
        verify(repository).findAll();
    }

    @Test
    void findAllForUserUsesSubmitterQuery() {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        List<Job> jobs = List.of(new Job());
        when(repository.findAllBySubmittedBy(submitter)).thenReturn(jobs);

        assertThat(service.findAll()).isSameAs(jobs);
        verify(repository).findAllBySubmittedBy(submitter);
    }

    @Test
    void findByIdWhenFoundReturnsJob() {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        UUID jobId = UUID.randomUUID();
        Job job = new Job();
        job.setSubmittedBy(submitter);
        when(repository.findById(jobId)).thenReturn(Optional.of(job));

        Job result = service.findById(jobId);

        assertThat(result).isSameAs(job);
        verify(repository).findById(jobId);
    }

    @Test
    void findByIdWhenNotFoundThrowsResourceNotFoundException() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        UUID jobId = UUID.randomUUID();
        when(repository.findById(jobId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(jobId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Job not found: " + jobId);
        verify(repository).findById(jobId);
    }

    @Test
    void findByIdAllowsAdminToAccessAnyJob() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        UUID jobId = UUID.randomUUID();
        Job job = new Job();
        when(repository.findById(jobId)).thenReturn(Optional.of(job));

        assertThat(service.findById(jobId)).isSameAs(job);
    }

    @Test
    void findByIdRejectsAnotherUser() {
        authenticatedUser("other@example.com", UserRole.USER);
        UUID jobId = UUID.randomUUID();
        User submitter = new User();
        submitter.setEmail("owner@example.com");
        Job job = new Job();
        job.setSubmittedBy(submitter);
        when(repository.findById(jobId)).thenReturn(Optional.of(job));

        assertThatThrownBy(() -> service.findById(jobId))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void createSavesJobBeforeCreatingOutboxEvent() throws Exception {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        Job savedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(savedJob, "id", jobId);
        savedJob.setType("REPORT");
        savedJob.setRequestPayload("payload");
        savedJob.setSubmittedBy(submitter);
        when(repository.save(any(Job.class))).thenReturn(savedJob);

        service.create(new JobRequest("REPORT", "payload"));

        var order = inOrder(repository, outboxRepository);
        order.verify(repository).save(any(Job.class));
        order.verify(outboxRepository).save(any(OutboxEvent.class));
    }

    @Test
    void createStoresOutboxEventInTransaction() throws Exception {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        Job savedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(savedJob, "id", jobId);
        savedJob.setType("REPORT");
        savedJob.setRequestPayload("payload");
        savedJob.setSubmittedBy(submitter);
        when(repository.save(any(Job.class))).thenReturn(savedJob);

        service.create(new JobRequest("REPORT", "payload"));

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent event = captor.getValue();
        assertThat(event.getJobId()).isEqualTo(jobId);
        assertThat(event.isPublished()).isFalse();
    }

    @Test
    void createOutboxEventIsNotPublishedInitially() throws Exception {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        Job savedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(savedJob, "id", jobId);
        savedJob.setType("ECHO");
        savedJob.setRequestPayload("{\"message\":\"test\"}");
        savedJob.setSubmittedBy(submitter);
        when(repository.save(any(Job.class))).thenReturn(savedJob);

        service.create(new JobRequest("ECHO", "{\"message\":\"test\"}"));

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent event = captor.getValue();
        assertThat(event.isPublished()).isFalse();
        assertThat(event.getPublishedAt()).isNull();
    }

    @Test
    void retryFailedJobQueuesJobAndSavesOutboxEvent() throws Exception {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        Job failedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(failedJob, "id", jobId);
        failedJob.setType("ECHO");
        failedJob.setRequestPayload("{\"message\":\"retry-test\"}");
        failedJob.setStatus(JobStatus.FAILED);
        failedJob.setResult("Permanent failure");
        failedJob.setAttemptCount(3);
        failedJob.setSubmittedBy(submitter);

        when(repository.findById(jobId)).thenReturn(Optional.of(failedJob));
        when(repository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Job retried = service.retry(jobId);

        assertThat(retried.getStatus()).isEqualTo(JobStatus.QUEUED);
        assertThat(retried.getResult()).isNull();
        assertThat(retried.getAttemptCount()).isEqualTo(0);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent event = captor.getValue();
        assertThat(event.getJobId()).isEqualTo(jobId);
        assertThat(event.isPublished()).isFalse();
    }

    @Test
    void retryNonFailedJobThrowsIllegalStateException() {
        User submitter = authenticatedUser("user@example.com", UserRole.USER);
        Job completedJob = new Job();
        UUID jobId = UUID.randomUUID();
        org.springframework.test.util.ReflectionTestUtils.setField(completedJob, "id", jobId);
        completedJob.setType("ECHO");
        completedJob.setRequestPayload("{}");
        completedJob.setStatus(JobStatus.COMPLETED);
        completedJob.setSubmittedBy(submitter);

        when(repository.findById(jobId)).thenReturn(Optional.of(completedJob));

        assertThatThrownBy(() -> service.retry(jobId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Only failed jobs can be retried");
    }
}
