package com.flowforge.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowforge.messaging.JobMessage;
import com.flowforge.messaging.JobPublisher;
import com.flowforge.observability.FlowForgeMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);

    private final OutboxEventRepository outboxRepository;
    private final JobPublisher jobPublisher;
    private final ObjectMapper objectMapper;
    private final FlowForgeMetrics metrics;

    private final int batchSize;

    @Autowired
    public OutboxPublisher(OutboxEventRepository outboxRepository,
                           JobPublisher jobPublisher,
                           ObjectMapper objectMapper,
                           @Value("${flowforge.outbox.batch-size:10}") int batchSize,
                           FlowForgeMetrics metrics) {
        this.outboxRepository = outboxRepository;
        this.jobPublisher = jobPublisher;
        this.objectMapper = objectMapper;
        this.batchSize = batchSize;
        this.metrics = metrics == null ? FlowForgeMetrics.fallback() : metrics;
    }

    public OutboxPublisher(OutboxEventRepository outboxRepository,
                           JobPublisher jobPublisher,
                           ObjectMapper objectMapper,
                           int batchSize) {
        this(outboxRepository, jobPublisher, objectMapper, batchSize, FlowForgeMetrics.fallback());
    }

    /**
     * Poll for unpublished outbox events and publish them to RabbitMQ.
     * Runs every 1 second by default.
     * Processes events in batches to avoid loading too many at once.
     */
    @Scheduled(fixedDelayString = "${flowforge.outbox.poll-interval-ms:1000}")
    public void publishPendingEvents() {
        List<OutboxEvent> unpublished = outboxRepository.findUnpublished(PageRequest.of(0, batchSize));
        
        if (unpublished.isEmpty()) {
            return;
        }

        log.info("Found {} unpublished outbox events", unpublished.size());

        for (OutboxEvent event : unpublished) {
            try {
                publishEvent(event);
            } catch (Exception e) {
                metrics.outboxPublishFailure();
                log.error("Failed to publish outbox event id={}; will retry on next poll", 
                    event.getId(), e);
                // Don't mark as published; will retry on next poll
            }
        }
    }

    /**
     * Publish a single outbox event to RabbitMQ.
     * Mark as published only after successful RabbitMQ publication.
     *
     * @param event the outbox event to publish
     * @throws Exception if deserialization or publishing fails
     */
    private void publishEvent(OutboxEvent event) throws Exception {
        // Deserialize the stored JSON message back to JobMessage
        JobMessage message = objectMapper.readValue(event.getMessagePayload(), JobMessage.class);

        // Publish to RabbitMQ
        jobPublisher.publish(message);

        // Mark as published only after successful publication
        event.setPublished(true);
        event.setPublishedAt(Instant.now());
        outboxRepository.save(event);
        metrics.outboxPublished();

        log.debug("Published outbox event id={} for job id={}", event.getId(), event.getJobId());
    }
}
