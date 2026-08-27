package com.flowforge.auth;

public record AuthResponse(
        String token,
        AuthenticatedUserResponse user
) {
}
