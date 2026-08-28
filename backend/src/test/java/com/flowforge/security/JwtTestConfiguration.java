package com.flowforge.security;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import java.security.KeyPair;
import java.security.KeyPairGenerator;

@TestConfiguration
public class JwtTestConfiguration {

    @Bean
    JwtService jwtService() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        return new JwtService(keyPair, 3_600_000, "https://auth.flowforge.local", "flowforge-api", "flowforge-test-1");
    }
}
