package com.flowforge.api;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/apis")
public class ApiDefinitionController {

    private final ApiDefinitionService service;

    public ApiDefinitionController(ApiDefinitionService service) {
        this.service = service;
    }

    @GetMapping
    public List<ApiDefinition> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public ApiDefinition findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiDefinition create(@Valid @RequestBody ApiDefinitionRequest request) {
        return service.create(request);
    }

    @PostMapping("/{id}/deprecate")
    public ApiDefinition deprecate(@PathVariable Long id) {
        return service.deprecate(id);
    }
}
