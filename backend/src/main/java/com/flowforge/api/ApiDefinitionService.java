package com.flowforge.api;

import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.user.User;
import com.flowforge.user.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ApiDefinitionService {

    private static final Logger log = LoggerFactory.getLogger(ApiDefinitionService.class);

    private final ApiDefinitionRepository repository;
    private final Wso2GatewayService wso2GatewayService;

    @Autowired
    public ApiDefinitionService(ApiDefinitionRepository repository, Wso2GatewayService wso2GatewayService) {
        this.repository = repository;
        this.wso2GatewayService = wso2GatewayService;
    }

    public ApiDefinitionService(ApiDefinitionRepository repository) {
        this(repository, null);
    }

    public List<ApiDefinition> findAll() {
        User user = currentUser();
        return user.getRole() == UserRole.ADMIN
                ? repository.findAll()
                : repository.findAllByOwner(user);
    }

    public ApiDefinition create(ApiDefinitionRequest request) {
        User owner = currentUser();

        String name = request.name() != null ? request.name().trim() : "";
        if (name.isBlank()) {
            throw new IllegalArgumentException("API name must not be blank");
        }

        String version = request.version() != null ? request.version().trim() : "";
        if (version.isBlank()) {
            throw new IllegalArgumentException("API version must not be blank");
        }

        String basePath = request.basePath() != null ? request.basePath().trim() : "";
        if (!basePath.startsWith("/")) {
            basePath = "/" + basePath;
        }
        basePath = basePath.replaceAll("/+$", "");
        if (basePath.isBlank()) {
            basePath = "/api";
        }

        String backendUrl = request.backendUrl() != null ? request.backendUrl().trim() : "";
        if (!backendUrl.startsWith("http://") && !backendUrl.startsWith("https://")) {
            throw new IllegalArgumentException("Backend URL must start with http:// or https://");
        }

        if (repository.existsByNameIgnoreCase(name)) {
            throw new IllegalArgumentException("An API with name '" + name + "' already exists");
        }
        if (repository.existsByBasePath(basePath)) {
            throw new IllegalArgumentException("An API with base path '" + basePath + "' already exists");
        }

        ApiDefinition api = new ApiDefinition();
        api.setName(name);
        api.setDescription(request.description());
        api.setVersion(version);
        api.setBasePath(basePath);
        api.setBackendUrl(backendUrl);
        api.setOwner(owner);

        if (wso2GatewayService != null) {
            Wso2GatewayService.Wso2DeploymentResult result = wso2GatewayService.publishAndDeployApi(
                    name, version, basePath, backendUrl);
            if (result.success()) {
                api.setWso2ApiId(result.wso2ApiId());
                api.setGatewayUrl(result.gatewayUrl());
                api.setStatus(ApiStatus.PUBLISHED);
                log.info("API {} deployed to WSO2 gateway at {}", name, result.gatewayUrl());
            } else {
                log.warn("WSO2 publication skipped or failed for {}: {}", name, result.error());
                api.setStatus(ApiStatus.DRAFT);
            }
        } else {
            api.setStatus(ApiStatus.DRAFT);
        }

        return repository.save(api);
    }

    public ApiDefinition deprecate(Long id) {
        ApiDefinition api = findById(id);
        api.setStatus(ApiStatus.DEPRECATED);
        if (wso2GatewayService != null && api.getWso2ApiId() != null) {
            wso2GatewayService.deprecateApi(api.getWso2ApiId());
        }
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
