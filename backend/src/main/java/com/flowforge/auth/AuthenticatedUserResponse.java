package com.flowforge.auth;

import com.flowforge.user.User;
import com.flowforge.user.UserRole;

import java.time.Instant;
import java.util.UUID;

public record AuthenticatedUserResponse(
        UUID id,
        String email,
        UserRole role,
        Instant createdAt
) {
    public static AuthenticatedUserResponse from(User user) {
        return new AuthenticatedUserResponse(user.getId(), user.getEmail(), user.getRole(), user.getCreatedAt());
    }
}
