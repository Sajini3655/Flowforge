package com.flowforge.messaging;

public enum JobProcessingOutcome {
    COMPLETED,
    RETRYABLE_FAILURE,
    PERMANENT_FAILURE,
    STALE,
    ALREADY_HANDLED,
    REDIS_UNAVAILABLE
}
