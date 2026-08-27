package com.flowforge.security;

import com.flowforge.user.User;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "flowforge-test-secret-with-at-least-32-characters";

    @Test
    void generateAndParseTokenPreservesIdentityAndRole() {
        JwtService service = new JwtService(SECRET, 3_600_000);
        User user = new User();
        user.setEmail("user@example.com");

        String token = service.generateToken(user);

        assertThat(service.parseToken(token).getSubject()).isEqualTo("user@example.com");
        assertThat(service.parseToken(token).get("role", String.class)).isEqualTo("USER");
    }

    @Test
    void parseTokenRejectsExpiredToken() {
        JwtService service = new JwtService(SECRET, -1);
        User user = new User();
        user.setEmail("user@example.com");

        String token = service.generateToken(user);

        assertThatThrownBy(() -> service.parseToken(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void constructorRejectsShortSecret() {
        assertThatThrownBy(() -> new JwtService("too-short", 3_600_000))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
