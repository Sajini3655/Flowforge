package com.flowforge.security;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class JwksController {

    private final JwtService jwtService;

    public JwksController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @GetMapping("/api/.well-known/jwks.json")
    public Map<String, Object> keys() {
        return Map.of("keys", List.of(jwtService.publicJwk()));
    }
}