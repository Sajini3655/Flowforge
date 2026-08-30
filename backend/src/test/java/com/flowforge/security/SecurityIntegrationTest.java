package com.flowforge.security;

import com.flowforge.api.ApiDefinitionController;
import com.flowforge.api.ApiDefinitionService;
import com.flowforge.auth.AuthController;
import com.flowforge.auth.AuthenticatedUserResponse;
import com.flowforge.auth.AuthResponse;
import com.flowforge.auth.AuthService;
import com.flowforge.auth.DuplicateUserException;
import com.flowforge.auth.RegisterRequest;
import com.flowforge.health.HealthController;
import com.flowforge.job.JobController;
import com.flowforge.job.JobService;
import com.flowforge.user.User;
import com.flowforge.user.UserRepository;
import com.flowforge.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({AuthController.class, HealthController.class, JwksController.class, ApiDefinitionController.class, JobController.class})
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtTestConfiguration.class})
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

        @Autowired
        private JwtService jwtService;

    @MockBean
    private AuthService authService;

    @MockBean
    private ApiDefinitionService apiDefinitionService;

    @MockBean
    private JobService jobService;

    @MockBean
    private UserRepository userRepository;

    @Test
    void registerIsPublicAndReturnsSafeUser() throws Exception {
        AuthenticatedUserResponse user = new AuthenticatedUserResponse(null, "user@example.com", UserRole.USER, null);
        when(authService.register(any(RegisterRequest.class))).thenReturn(user);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("user@example.com"))
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    void registerValidationFailureReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"bad\",\"password\":\"short\"}"))
                .andExpect(status().isBadRequest());

        verify(authService, never()).register(any(RegisterRequest.class));
    }

    @Test
    void registerDuplicateEmailReturnsConflict() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new DuplicateUserException("An account with that email already exists"));

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void loginIsPublicAndReturnsToken() throws Exception {
        AuthenticatedUserResponse user = new AuthenticatedUserResponse(null, "user@example.com", UserRole.USER, null);
        when(authService.login(any())).thenReturn(new AuthResponse("signed-token", user));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"user@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("signed-token"))
                .andExpect(jsonPath("$.user.email").value("user@example.com"));
    }

        @Test
        void invalidCredentialsReturnUnauthorized() throws Exception {
                when(authService.login(any())).thenThrow(new BadCredentialsException("bad credentials"));

                mockMvc.perform(post("/api/auth/login")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"email\":\"user@example.com\",\"password\":\"wrongpass\"}"))
                                .andExpect(status().isUnauthorized());
        }

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void missingTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/jobs").header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void userCannotAccessAdminApiEndpoint() throws Exception {
        mockMvc.perform(get("/api/apis"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanAccessApiEndpoint() throws Exception {
        when(apiDefinitionService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/apis"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "USER")
    void userCanAccessJobEndpoint() throws Exception {
        when(jobService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanAccessJobEndpoint() throws Exception {
        when(jobService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isOk());
    }

    @Test
    void validJwtAllowsAuthenticatedRequest() throws Exception {
        User user = new User();
        user.setEmail("user@example.com");
        String token = jwtService.generateToken(user);
        when(userRepository.findByEmailIgnoreCase("user@example.com")).thenReturn(Optional.of(user));
        when(jobService.findAll()).thenReturn(List.of());

        mockMvc.perform(get("/api/jobs").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void jwksEndpointIsPublicAndExposesKeys() throws Exception {
        mockMvc.perform(get("/api/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys").isArray())
                .andExpect(jsonPath("$.keys[0].kty").value("RSA"))
                .andExpect(jsonPath("$.keys[0].alg").value("RS256"))
                .andExpect(jsonPath("$.keys[0].d").doesNotExist());
    }

    @Test
    void malformedTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/jobs").header("Authorization", "Bearer not.a.valid.jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void invalidSignatureReturnsUnauthorized() throws Exception {
        java.security.KeyPairGenerator gen = java.security.KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        java.security.KeyPair other = gen.generateKeyPair();
        String fakeToken = io.jsonwebtoken.Jwts.builder()
                .header().keyId("flowforge-dev-1").and()
                .subject("user@example.com")
                .issuer("https://auth.flowforge.local")
                .audience().add("flowforge-api").and()
                .expiration(new java.util.Date(System.currentTimeMillis() + 60000))
                .claim("role", "USER")
                .signWith(other.getPrivate(), io.jsonwebtoken.Jwts.SIG.RS256)
                .compact();

        mockMvc.perform(get("/api/jobs").header("Authorization", "Bearer " + fakeToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "USER")
    void userRoleForbiddenFromPostApi() throws Exception {
        mockMvc.perform(post("/api/apis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"version\":\"v1\",\"basePath\":\"/test\",\"backendUrl\":\"http://backend:8080\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminRoleAllowedToPostApi() throws Exception {
        when(apiDefinitionService.create(any())).thenReturn(new com.flowforge.api.ApiDefinition());

        mockMvc.perform(post("/api/apis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"version\":\"v1\",\"basePath\":\"/test\",\"backendUrl\":\"http://backend:8080\"}"))
                .andExpect(status().isCreated());
    }
}
