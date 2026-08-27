package com.flowforge.health;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import javax.sql.DataSource;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HealthControllerTest {

    @Test
    void livenessDoesNotDependOnExternalServices() {
        HealthController controller = controllerWithNoDependencies();

        assertThat(controller.liveness()).containsEntry("status", "UP");
    }

    @Test
    void readinessIsDownWhenRequiredDependenciesAreUnavailable() {
        HealthController controller = controllerWithNoDependencies();

        var response = controller.readiness();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).containsEntry("status", "DOWN");
        assertThat(response.getBody().get("dependencies"))
            .isEqualTo(Map.of("postgresql", "DOWN", "rabbitmq", "DOWN", "redis", "DOWN"));
    }

    private HealthController controllerWithNoDependencies() {
        ObjectProvider<DataSource> dataSource = provider(null);
        ObjectProvider<ConnectionFactory> rabbit = provider(null);
        ObjectProvider<StringRedisTemplate> redis = provider(null);
        return new HealthController(dataSource, rabbit, redis);
    }

    @SuppressWarnings("unchecked")
    private <T> ObjectProvider<T> provider(T value) {
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(value);
        return provider;
    }
}
