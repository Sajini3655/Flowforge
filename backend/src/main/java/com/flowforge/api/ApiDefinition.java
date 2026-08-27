package com.flowforge.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.flowforge.user.User;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "apis")
public class ApiDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private String version;

    @Column(nullable = false)
    private String basePath;

    @Column(nullable = false)
    private String backendUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApiStatus status = ApiStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    @JsonIgnore
    private User owner;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getBasePath() { return basePath; }
    public void setBasePath(String basePath) { this.basePath = basePath; }
    public String getBackendUrl() { return backendUrl; }
    public void setBackendUrl(String backendUrl) { this.backendUrl = backendUrl; }
    public ApiStatus getStatus() { return status; }
    public void setStatus(ApiStatus status) { this.status = status; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public Instant getCreatedAt() { return createdAt; }
}
