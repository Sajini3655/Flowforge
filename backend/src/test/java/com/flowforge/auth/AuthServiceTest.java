package com.flowforge.auth;

import com.flowforge.security.JwtService;
import com.flowforge.user.User;
import com.flowforge.user.UserRepository;
import com.flowforge.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtService jwtService;

    @Mock
    private Authentication authentication;

    @InjectMocks
    private AuthService service;

    @Test
    void registerHashesPasswordAndReturnsSafeUser() {
        RegisterRequest request = new RegisterRequest("User@Example.com", "password123");
        when(userRepository.existsByEmailIgnoreCase("user@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("bcrypt-hash");
        User savedUser = new User();
        savedUser.setEmail("user@example.com");
        savedUser.setPasswordHash("bcrypt-hash");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        AuthenticatedUserResponse result = service.register(request);

        assertThat(result.email()).isEqualTo("user@example.com");
        assertThat(result.role()).isEqualTo(UserRole.USER);
        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        assertThat(userCaptor.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
        verify(passwordEncoder).encode("password123");
    }

    @Test
    void registerRejectsDuplicateEmail() {
        when(userRepository.existsByEmailIgnoreCase("user@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.register(new RegisterRequest("user@example.com", "password123")))
                .isInstanceOf(DuplicateUserException.class);
    }

    @Test
    void loginAuthenticatesUserAndReturnsToken() {
        LoginRequest request = new LoginRequest("user@example.com", "password123");
        User user = new User();
        user.setEmail("user@example.com");
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authentication);
        when(authentication.getPrincipal()).thenReturn(user);
        when(jwtService.generateToken(user)).thenReturn("signed-token");

        AuthResponse result = service.login(request);

        assertThat(result.token()).isEqualTo("signed-token");
        assertThat(result.user().email()).isEqualTo("user@example.com");
        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
    }
}
