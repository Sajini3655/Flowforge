package com.flowforge.security;

import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import com.flowforge.user.UserRepository;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "flowforge.jwt.issuer=https://auth.flowforge.test",
        "flowforge.jwt.audience=flowforge-test-api",
        "flowforge.jwt.key-id=test-key-1"
})
class SecurityIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    private KeyPair maliciousKeyPair;
    private User testUser;
    private User testAdmin;

    @BeforeEach
    void setUp() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        maliciousKeyPair = generator.generateKeyPair();

        userRepository.deleteAll();

        testUser = new User();
        testUser.setEmail("user@example.com");
        testUser.setRole(UserRole.USER);
        testUser.setPasswordHash("dummy");
        testUser = userRepository.save(testUser);

        testAdmin = new User();
        testAdmin.setEmail("admin@example.com");
        testAdmin.setRole(UserRole.ADMIN);
        testAdmin.setPasswordHash("dummy");
        testAdmin = userRepository.save(testAdmin);
    }

    @Test
    void validRs256JwtIsAuthenticated() {
        String token = jwtService.generateToken(testUser);
        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isNotIn(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN);
    }

    @Test
    void expiredJwtIsRejected() {
        String token = Jwts.builder()
                .header().keyId("test-key-1").and()
                .subject(testUser.getUsername())
                .claim("role", testUser.getRole().name())
                .issuedAt(new Date(System.currentTimeMillis() - 10000))
                .expiration(new Date(System.currentTimeMillis() - 5000))
                .issuer("https://auth.flowforge.test")
                .audience().add("flowforge-test-api").and()
                .signWith(getPrivateSigningKey(), Jwts.SIG.RS256)
                .compact();

        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void invalidSignatureIsRejected() {
        String token = Jwts.builder()
                .header().keyId("test-key-1").and()
                .subject(testUser.getUsername())
                .claim("role", testUser.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .issuer("https://auth.flowforge.test")
                .audience().add("flowforge-test-api").and()
                .signWith(maliciousKeyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();

        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongIssuerIsRejected() {
        String token = Jwts.builder()
                .header().keyId("test-key-1").and()
                .subject(testUser.getUsername())
                .claim("role", testUser.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .issuer("https://wrong.issuer")
                .audience().add("flowforge-test-api").and()
                .signWith(getPrivateSigningKey(), Jwts.SIG.RS256)
                .compact();

        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongAudienceIsRejected() {
        String token = Jwts.builder()
                .header().keyId("test-key-1").and()
                .subject(testUser.getUsername())
                .claim("role", testUser.getRole().name())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 3600000))
                .issuer("https://auth.flowforge.test")
                .audience().add("wrong-audience").and()
                .signWith(getPrivateSigningKey(), Jwts.SIG.RS256)
                .compact();

        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void missingAuthorizationHeaderIsRejected() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/jobs", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void userRoleAccessToUserEndpointSucceeds() {
        String token = jwtService.generateToken(testUser);
        ResponseEntity<String> response = makeRequest("/api/jobs", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void userRoleAccessToAdminEndpointIsForbidden() {
        String token = jwtService.generateToken(testUser);
        ResponseEntity<String> response = makeRequest("/api/apis", token);
        assertThat(response.getStatusCode()).isIn(HttpStatus.FORBIDDEN, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void adminRoleAccessToAdminEndpointSucceeds() {
        String token = jwtService.generateToken(testAdmin);
        ResponseEntity<String> response = makeRequest("/api/apis", token);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void protectedEndpointCannotBeAccessedAnonymously() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/jobs", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    private ResponseEntity<String> makeRequest(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);
        return restTemplate.exchange(path, HttpMethod.GET, entity, String.class);
    }

    private java.security.PrivateKey getPrivateSigningKey() {
        try {
            java.lang.reflect.Field field = JwtService.class.getDeclaredField("signingKey");
            field.setAccessible(true);
            return (java.security.PrivateKey) field.get(jwtService);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
