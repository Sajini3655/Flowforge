package com.flowforge.outbox;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "outbox_events")
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID jobId;

    @Column(nullable = false, columnDefinition = "TEXT")
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    private String messagePayload;

    @Column(nullable = false)
    private boolean published = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column
    private Instant publishedAt;

    // Constructors
    public OutboxEvent() {}

    public OutboxEvent(UUID jobId, String messagePayload) {
        this.jobId = jobId;
        this.messagePayload = messagePayload;
        this.published = false;
    }

    // Getters and Setters
    public UUID getId() { return id; }

    public void setId(UUID id) { this.id = id; }

    public UUID getJobId() { return jobId; }
    public void setJobId(UUID jobId) { this.jobId = jobId; }

    public String getMessagePayload() { return messagePayload; }
    public void setMessagePayload(String messagePayload) { this.messagePayload = messagePayload; }

    public boolean isPublished() { return published; }
    public void setPublished(boolean published) { this.published = published; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }
}
