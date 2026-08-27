package com.flowforge.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowforge.messaging.JobMessage;
import com.flowforge.messaging.JobPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OutboxPublisherTest {

    @Mock
    private OutboxEventRepository outboxRepository;

    @Mock
    private JobPublisher jobPublisher;

    private OutboxPublisher publisher;
    private ObjectMapper objectMapper;

    private UUID jobId;
    private UUID eventId;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
            publisher = new OutboxPublisher(outboxRepository, jobPublisher, objectMapper, 10);
        jobId = UUID.randomUUID();
        eventId = UUID.randomUUID();
    }

    @Test
    void publishPendingEvents_publishesUnpublishedEvents() throws Exception {
        // Given
        JobMessage message = new JobMessage(jobId, "ECHO", "{\"message\":\"test\"}", UUID.randomUUID());
        String messagePayload = objectMapper.writeValueAsString(message);
        
        OutboxEvent event = new OutboxEvent(jobId, messagePayload);
        event.setId(eventId);

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event));

        // When
        publisher.publishPendingEvents();

        // Then
        verify(jobPublisher).publish(any(JobMessage.class));
        verify(outboxRepository).save(any(OutboxEvent.class));
        assertTrue(event.isPublished());
        assertNotNull(event.getPublishedAt());
    }

    @Test
    void publishPendingEvents_markEventAsPublishedAfterSuccessfulPublication() throws Exception {
        // Given
        JobMessage message = new JobMessage(jobId, "ECHO", "{\"message\":\"test\"}", UUID.randomUUID());
        String messagePayload = objectMapper.writeValueAsString(message);
        
        OutboxEvent event = new OutboxEvent(jobId, messagePayload);
        event.setId(eventId);

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event));

        // When
        publisher.publishPendingEvents();

        // Then
        verify(outboxRepository).save(argThat(e -> e.isPublished() && e.getPublishedAt() != null));
    }

    @Test
    void publishPendingEvents_doesNotMarkAsPublishedIfPublicationFails() throws Exception {
        // Given
        JobMessage message = new JobMessage(jobId, "ECHO", "{\"message\":\"test\"}", UUID.randomUUID());
        String messagePayload = objectMapper.writeValueAsString(message);
        
        OutboxEvent event = new OutboxEvent(jobId, messagePayload);
        event.setId(eventId);

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event));
        doThrow(new RuntimeException("RabbitMQ unavailable"))
                .when(jobPublisher).publish(any(JobMessage.class));

        // When
        publisher.publishPendingEvents();

        // Then
        assertFalse(event.isPublished());
        assertNull(event.getPublishedAt());
        verify(outboxRepository, never()).save(any(OutboxEvent.class));
    }

    @Test
    void publishPendingEvents_handlesEmptyUnpublishedList() {
        // Given
        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of());

        // When
        publisher.publishPendingEvents();

        // Then
        verify(jobPublisher, never()).publish(any(JobMessage.class));
        verify(outboxRepository, never()).save(any(OutboxEvent.class));
    }

    @Test
    void publishPendingEvents_continuesProcessingAfterOneEventFails() throws Exception {
        // Given
        JobMessage message1 = new JobMessage(jobId, "ECHO", "{\"message\":\"test1\"}", UUID.randomUUID());
        String messagePayload1 = objectMapper.writeValueAsString(message1);
        OutboxEvent event1 = new OutboxEvent(jobId, messagePayload1);
        event1.setId(UUID.randomUUID());

        UUID jobId2 = UUID.randomUUID();
        JobMessage message2 = new JobMessage(jobId2, "ECHO", "{\"message\":\"test2\"}", UUID.randomUUID());
        String messagePayload2 = objectMapper.writeValueAsString(message2);
        OutboxEvent event2 = new OutboxEvent(jobId2, messagePayload2);
        event2.setId(UUID.randomUUID());

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event1, event2));
        
        // First event fails, second succeeds
        doThrow(new RuntimeException("RabbitMQ error"))
                .doNothing()
                .when(jobPublisher).publish(any(JobMessage.class));

        // When
        publisher.publishPendingEvents();

        // Then
        verify(jobPublisher, times(2)).publish(any(JobMessage.class));
        // Second event should be marked as published
        assertTrue(event2.isPublished());
        // First event should not be published
        assertFalse(event1.isPublished());
    }

    @Test
    void publishPendingEvents_deserializesJobMessageCorrectly() throws Exception {
        // Given
        UUID submittedBy = UUID.randomUUID();
        JobMessage originalMessage = new JobMessage(jobId, "ECHO", "{\"message\":\"test\"}", submittedBy);
        String messagePayload = objectMapper.writeValueAsString(originalMessage);
        
        OutboxEvent event = new OutboxEvent(jobId, messagePayload);
        event.setId(eventId);

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event));

        // When
        publisher.publishPendingEvents();

        // Then
        verify(jobPublisher).publish(argThat(msg -> 
            msg.jobId().equals(jobId) &&
            msg.type().equals("ECHO") &&
            msg.requestPayload().equals("{\"message\":\"test\"}") &&
            msg.submittedBy().equals(submittedBy)
        ));
    }

    @Test
    void publishPendingEvents_setsPublishedAtTimestamp() throws Exception {
        // Given
        JobMessage message = new JobMessage(jobId, "ECHO", "{\"message\":\"test\"}", UUID.randomUUID());
        String messagePayload = objectMapper.writeValueAsString(message);
        
        OutboxEvent event = new OutboxEvent(jobId, messagePayload);
        event.setId(eventId);

        when(outboxRepository.findUnpublished(any(Pageable.class))).thenReturn(List.of(event));
        Instant beforePublish = Instant.now();

        // When
        publisher.publishPendingEvents();

        // Then
        Instant afterPublish = Instant.now();
        assertTrue(event.isPublished());
        assertNotNull(event.getPublishedAt());
        assertTrue(!event.getPublishedAt().isBefore(beforePublish));
        assertTrue(!event.getPublishedAt().isAfter(afterPublish.plusSeconds(1)));
    }
}
