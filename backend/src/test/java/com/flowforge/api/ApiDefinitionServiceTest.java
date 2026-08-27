package com.flowforge.api;

import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiDefinitionServiceTest {

    @Mock
    private ApiDefinitionRepository repository;

    @InjectMocks
    private ApiDefinitionService service;

    private User authenticatedUser(String email, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setRole(role);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        return user;
    }

    @Test
    void createMapsRequestAndSavesApi() {
        User owner = authenticatedUser("admin@example.com", UserRole.ADMIN);
        ApiDefinitionRequest request = new ApiDefinitionRequest(
                "Report API",
                "Generates reports",
                "v1",
                "/reports",
                "http://reports"
        );
        ApiDefinition savedApi = new ApiDefinition();
        savedApi.setName("Report API");
        when(repository.save(org.mockito.ArgumentMatchers.any(ApiDefinition.class))).thenReturn(savedApi);

        ApiDefinition result = service.create(request);

        assertThat(result).isSameAs(savedApi);
        ArgumentCaptor<ApiDefinition> apiCaptor = ArgumentCaptor.forClass(ApiDefinition.class);
        verify(repository).save(apiCaptor.capture());
        ApiDefinition persistedApi = apiCaptor.getValue();
        assertThat(persistedApi.getName()).isEqualTo("Report API");
        assertThat(persistedApi.getDescription()).isEqualTo("Generates reports");
        assertThat(persistedApi.getVersion()).isEqualTo("v1");
        assertThat(persistedApi.getBasePath()).isEqualTo("/reports");
        assertThat(persistedApi.getBackendUrl()).isEqualTo("http://reports");
        assertThat(persistedApi.getStatus()).isEqualTo(ApiStatus.DRAFT);
        assertThat(persistedApi.getOwner()).isSameAs(owner);
    }

    @Test
    void findAllReturnsRepositoryResults() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        List<ApiDefinition> apis = List.of(new ApiDefinition());
        when(repository.findAll()).thenReturn(apis);

        List<ApiDefinition> result = service.findAll();

        assertThat(result).isSameAs(apis);
        verify(repository).findAll();
    }

    @Test
    void findAllForUserUsesOwnerQuery() {
        User owner = authenticatedUser("user@example.com", UserRole.USER);
        List<ApiDefinition> apis = List.of(new ApiDefinition());
        when(repository.findAllByOwner(owner)).thenReturn(apis);

        assertThat(service.findAll()).isSameAs(apis);
        verify(repository).findAllByOwner(owner);
    }

    @Test
    void findByIdAllowsAdminToAccessAnyApi() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        ApiDefinition api = new ApiDefinition();
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(api));

        assertThat(service.findById(1L)).isSameAs(api);
        verify(repository).findById(1L);
    }

    @Test
    void findByIdAllowsOwnerToAccessApi() {
        User owner = authenticatedUser("user@example.com", UserRole.USER);
        ApiDefinition api = new ApiDefinition();
        api.setOwner(owner);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(api));

        assertThat(service.findById(1L)).isSameAs(api);
    }

    @Test
    void findByIdRejectsAnotherUser() {
        authenticatedUser("other@example.com", UserRole.USER);
        User owner = new User();
        owner.setEmail("owner@example.com");
        ApiDefinition api = new ApiDefinition();
        api.setOwner(owner);
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(api));

        assertThatThrownBy(() -> service.findById(1L))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void findByIdWhenMissingThrowsNotFound() {
        authenticatedUser("admin@example.com", UserRole.ADMIN);
        when(repository.findById(1L)).thenReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> service.findById(1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
