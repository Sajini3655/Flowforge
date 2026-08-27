package com.flowforge.job;

public record JobSubmissionResult(Job job, boolean replayed) {
}