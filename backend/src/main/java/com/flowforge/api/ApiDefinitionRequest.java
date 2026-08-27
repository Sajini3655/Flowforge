package com.flowforge.api;

import jakarta.validation.constraints.NotBlank;

public record ApiDefinitionRequest(
        @NotBlank String name,
        String description,
        @NotBlank String version,
        @NotBlank String basePath,
        @NotBlank String backendUrl
) {
}
