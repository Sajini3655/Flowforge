package com.flowforge.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowforge.observability.FlowForgeMetrics;
import com.flowforge.outbox.OutboxEventRepository;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JobIdempotencyTest {

    @Mock
    private JobRepository repository;

    @Mock
    private OutboxEventRepository outboxRepository;

    @Mock
    private FlowForgeMetrics metrics;

    private JobService service;
    private User user;

    @BeforeEach
    void setUp() {
        service = new JobService(repository, outboxRepository, new ObjectMapper(), metrics, null);
        user = new User();
        user.setEmail("user@example.com");
        user.setRole(UserRole.USER);
        authenticate(user);
    }

    @Test
    void newKeyCreatesOneJobAndOneOutboxEvent() {
        Job saved = savedJob("ECHO", "payload", user);
        when(repository.save(any(Job.class))).thenReturn(saved);
        JobRequest request = new JobRequest("ECHO", "payload");

        JobSubmissionResult result = service.createIdempotent(request, "key-1");

        assertThat(result.replayed()).isFalse();
        verify(repository).save(any(Job.class));
        verify(outboxRepository).save(any());
        verify(metrics).jobSubmitted();
        verify(metrics).outboxCreated();
    }

    @Test
    void sameKeyAndRequestReplaysWithoutCreatingAnotherOutboxEvent() {
        Job existing = savedJob("ECHO", "payload", user);
        existing.setIdempotencyKey("key-1");
        existing.setRequestFingerprint(fingerprint(new JobRequest("ECHO", "payload")));
        when(repository.findBySubmittedByAndIdempotencyKey(user, "key-1")).thenReturn(Optional.of(existing));

        JobSubmissionResult result = service.createIdempotent(new JobRequest("ECHO", "payload"), "key-1");

        assertThat(result.job()).isSameAs(existing);
        assertThat(result.replayed()).isTrue();
        verify(repository, never()).save(any());
        verify(outboxRepository, never()).save(any());
        verify(metrics).idempotencyReplay();
    }

    @Test
    void sameKeyWithDifferentRequestConflicts() {
        Job existing = savedJob("ECHO", "payload", user);
        existing.setIdempotencyKey("key-1");
        existing.setRequestFingerprint(fingerprint(new JobRequest("ECHO", "payload")));
        when(repository.findBySubmittedByAndIdempotencyKey(user, "key-1")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.createIdempotent(new JobRequest("ECHO", "different"), "key-1"))
                .isInstanceOf(IdempotencyKeyConflictException.class);

        verify(repository, never()).save(any());
        verify(outboxRepository, never()).save(any());
        verify(metrics).idempotencyConflict();
    }

    @Test
    void sameKeyIsScopedToAuthenticatedUser() {
        User otherUser = new User();
        otherUser.setEmail("other@example.com");
        otherUser.setRole(UserRole.USER);
        when(repository.findBySubmittedByAndIdempotencyKey(user, "shared-key")).thenReturn(Optional.empty());
        when(repository.save(any(Job.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.createIdempotent(new JobRequest("ECHO", "payload"), "shared-key");
        authenticate(otherUser);
        service.createIdempotent(new JobRequest("ECHO", "payload"), "shared-key");

        verify(repository).findBySubmittedByAndIdempotencyKey(user, "shared-key");
        verify(repository).findBySubmittedByAndIdempotencyKey(otherUser, "shared-key");
        verify(repository, times(2)).save(any(Job.class));
    }

    @Test
    void uniqueConstraintRaceReplaysTheCommittedWinner() {
        Job winner = savedJob("ECHO", "payload", user);
        winner.setIdempotencyKey("race-key");
        winner.setRequestFingerprint(fingerprint(new JobRequest("ECHO", "payload")));
        when(repository.findBySubmittedByAndIdempotencyKey(user, "race-key"))
                .thenReturn(Optional.empty(), Optional.of(winner));
        when(repository.save(any(Job.class))).thenThrow(new DataIntegrityViolationException("unique index"));

        JobSubmissionResult result = service.createIdempotent(new JobRequest("ECHO", "payload"), "race-key");

        assertThat(result.job()).isSameAs(winner);
        assertThat(result.replayed()).isTrue();
        verify(outboxRepository, never()).save(any());
    }

    private Job savedJob(String type, String payload, User owner) {
        Job job = new Job();
        job.setType(type);
        job.setRequestPayload(payload);
        job.setSubmittedBy(owner);
        job.setStatus(JobStatus.QUEUED);
        return job;
    }

    private String fingerprint(JobRequest request) {
        String value = request.type().length() + ":" + request.type()
                + ":" + request.requestPayload().length() + ":" + request.requestPayload();
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }

    private void authenticate(User authenticatedUser) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(authenticatedUser, null, authenticatedUser.getAuthorities()));
    }
}
