package com.flowforge.job;

public class InvalidIdempotencyKeyException extends RuntimeException {

    public InvalidIdempotencyKeyException() {
        super("Idempotency-Key must be between 1 and 128 characters");
    }
}