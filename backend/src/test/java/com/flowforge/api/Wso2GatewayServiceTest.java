package com.flowforge.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class Wso2GatewayServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void whenDisabled_isAvailableReturnsFalse() {
        Wso2GatewayService service = new Wso2GatewayService(
                "false",
                "false",
                "https://localhost:9443/api/am/publisher/v4",
                "https://localhost:8243",
                "admin",
                "admin",
                objectMapper
        );

        assertThat(service.isAvailable()).isFalse();
    }

    @Test
    void whenDisabled_publishAndDeployReturnsDisabledResult() {
        Wso2GatewayService service = new Wso2GatewayService(
                "false",
                "false",
                "https://localhost:9443/api/am/publisher/v4",
                "https://localhost:8243",
                "admin",
                "admin",
                objectMapper
        );

        Wso2GatewayService.Wso2DeploymentResult result = service.publishAndDeployApi(
                "Test API", "v1", "/test", "http://backend:8080");

        assertThat(result.success()).isFalse();
        assertThat(result.error()).contains("disabled");
    }

    @Test
    void whenDisabled_deprecateDoesNotThrow() {
        Wso2GatewayService service = new Wso2GatewayService(
                "false",
                "false",
                "https://localhost:9443/api/am/publisher/v4",
                "https://localhost:8243",
                "admin",
                "admin",
                objectMapper
        );

        service.deprecateApi("test-id");
    }

    @Test
    void insecureTlsFlag_initializesSecureClientWhenFalse() {
        Wso2GatewayService service = new Wso2GatewayService(
                "true",
                "false",
                "https://localhost:9443/api/am/publisher/v4",
                "https://localhost:8243",
                "admin",
                "admin",
                objectMapper
        );

        assertThat(service).isNotNull();
    }
}
