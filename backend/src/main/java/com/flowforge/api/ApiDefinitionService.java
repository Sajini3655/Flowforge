package com.flowforge.api;

import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ApiDefinitionService {

    private final ApiDefinitionRepository repository;

    public ApiDefinitionService(ApiDefinitionRepository repository) {
        this.repository = repository;
    }

    public List<ApiDefinition> findAll() {
        User user = currentUser();
        return user.getRole() == UserRole.ADMIN
                ? repository.findAll()
                : repository.findAllByOwner(user);
    }

    public ApiDefinition create(ApiDefinitionRequest request) {
        User owner = currentUser();
        ApiDefinition api = new ApiDefinition();
        api.setName(request.name());
        api.setDescription(request.description());
        api.setVersion(request.version());
        api.setBasePath(request.basePath());
        api.setBackendUrl(request.backendUrl());
        api.setOwner(owner);
        return repository.save(api);
    }

    public ApiDefinition findById(Long id) {
        User user = currentUser();
        ApiDefinition api = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("API not found: " + id));
        if (user.getRole() != UserRole.ADMIN && !owns(user, api.getOwner())) {
            throw new AccessDeniedException("You do not have access to this API");
        }
        return api;
    }

    private User currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof User user) {
            return user;
        }
        throw new AccessDeniedException("Authenticated user is unavailable");
    }

    private boolean owns(User user, User owner) {
        if (owner == null) {
            return false;
        }
        if (user.getId() != null && owner.getId() != null) {
            return user.getId().equals(owner.getId());
        }
        return user.getEmail() != null && user.getEmail().equalsIgnoreCase(owner.getEmail());
    }
}
