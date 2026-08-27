package com.flowforge.job;

import jakarta.validation.constraints.NotBlank;

public record JobRequest(
        @NotBlank String type,
        @NotBlank String requestPayload
) {
}
