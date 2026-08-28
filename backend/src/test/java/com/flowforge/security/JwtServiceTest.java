package com.flowforge.security;

import com.flowforge.user.User;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    @Test
    void generateAndParseTokenPreservesIdentityAndRole() throws Exception {
        JwtService service = service(3_600_000);
        User user = new User();
        user.setEmail("user@example.com");

        String token = service.generateToken(user);

        assertThat(service.parseToken(token).getSubject()).isEqualTo("user@example.com");
        assertThat(service.parseToken(token).get("role", String.class)).isEqualTo("USER");
    }

    @Test
    void parseTokenRejectsExpiredToken() throws Exception {
        JwtService service = service(-1);
        User user = new User();
        user.setEmail("user@example.com");

        String token = service.generateToken(user);

        assertThatThrownBy(() -> service.parseToken(token))
                .isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void publicJwkContainsOnlyPublicMaterial() throws Exception {
        JwtService service = service(3_600_000);

        assertThat(service.publicJwk())
                .containsEntry("kty", "RSA")
                .containsEntry("alg", "RS256")
                .containsEntry("kid", "flowforge-dev-1")
                .doesNotContainKey("d");
    }

            @Test
            void parseTokenRejectsInvalidSignature() throws Exception {
            JwtService service = service(3_600_000);
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair other = generator.generateKeyPair();
            User user = user();
            String token = Jwts.builder().subject(user.getUsername()).issuer("https://auth.flowforge.local")
                .audience().add("flowforge-api").and().signWith(other.getPrivate(), Jwts.SIG.RS256).compact();

            assertThatThrownBy(() -> service.parseToken(token)).isInstanceOf(Exception.class);
            }

            @Test
            void parseTokenRejectsWrongIssuerAndAudience() throws Exception {
                KeyPair pair = keyPair();
                JwtService service = new JwtService(pair, 3_600_000, "https://auth.flowforge.local", "flowforge-api", "flowforge-test-1");
            User user = user();
            String wrongIssuer = Jwts.builder().subject(user.getUsername()).issuer("https://other.example")
                    .audience().add("flowforge-api").and().signWith(pair.getPrivate(), Jwts.SIG.RS256).compact();
            String wrongAudience = Jwts.builder().subject(user.getUsername()).issuer("https://auth.flowforge.local")
                    .audience().add("other-api").and().signWith(pair.getPrivate(), Jwts.SIG.RS256).compact();

            assertThatThrownBy(() -> service.parseToken(wrongIssuer)).isInstanceOf(Exception.class);
            assertThatThrownBy(() -> service.parseToken(wrongAudience)).isInstanceOf(Exception.class);
            }

            @Test
            void parseTokenRejectsMissingSubjectAndKidAndHs256() throws Exception {
            KeyPair pair = keyPair();
            JwtService service = new JwtService(pair, 3_600_000, "https://auth.flowforge.local", "flowforge-api", "flowforge-test-1");
            String missingSubject = Jwts.builder().issuer("https://auth.flowforge.local").audience().add("flowforge-api")
                .and().signWith(pair.getPrivate(), Jwts.SIG.RS256).compact();
            String missingKid = Jwts.builder().subject("user@example.com").issuer("https://auth.flowforge.local")
                .audience().add("flowforge-api").and().signWith(pair.getPrivate(), Jwts.SIG.RS256).compact();
            String hs256 = Jwts.builder().subject("user@example.com").issuer("https://auth.flowforge.local")
                .audience().add("flowforge-api").and().signWith(Keys.hmacShaKeyFor(
                    "flowforge-test-hmac-secret-at-least-32".getBytes(StandardCharsets.UTF_8))).compact();

            assertThatThrownBy(() -> service.parseToken(missingSubject)).isInstanceOf(Exception.class);
            assertThatThrownBy(() -> service.parseToken(missingKid)).isInstanceOf(Exception.class);
            assertThatThrownBy(() -> service.parseToken(hs256)).isInstanceOf(Exception.class);
            }

            private User user() {
            User user = new User();
            user.setEmail("user@example.com");
            return user;
            }

            private KeyPair keyPair() throws Exception {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
            }

    private JwtService service(long expirationMs) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        return new JwtService(keyPair, expirationMs, "https://auth.flowforge.local", "flowforge-api", "flowforge-dev-1");
    }
}
