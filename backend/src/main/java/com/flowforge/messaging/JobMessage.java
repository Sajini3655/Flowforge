package com.flowforge.messaging;

import java.util.UUID;

public record JobMessage(
        UUID jobId,
        String type,
        String requestPayload,
                UUID submittedBy,
                String correlationId
) {
        public JobMessage(UUID jobId, String type, String requestPayload, UUID submittedBy) {
                this(jobId, type, requestPayload, submittedBy, null);
        }
}
