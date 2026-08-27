package com.flowforge.health;

import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class HealthController {

    private final DataSource dataSource;
    private final ConnectionFactory rabbitConnectionFactory;
    private final StringRedisTemplate redisTemplate;

    public HealthController(ObjectProvider<DataSource> dataSource,
                            ObjectProvider<ConnectionFactory> rabbitConnectionFactory,
                            ObjectProvider<StringRedisTemplate> redisTemplate) {
        this.dataSource = dataSource.getIfAvailable();
        this.rabbitConnectionFactory = rabbitConnectionFactory.getIfAvailable();
        this.redisTemplate = redisTemplate.getIfAvailable();
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "flowforge-backend"));
    }

    @GetMapping("/api/health/live")
    public Map<String, String> liveness() {
        return Map.of("status", "UP", "service", "flowforge-backend");
    }

    @GetMapping("/api/health/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> body = dependencyHealth();
        return ResponseEntity.status(isUp(body) ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    private Map<String, Object> dependencyHealth() {
        Map<String, Object> dependencies = new LinkedHashMap<>();
        dependencies.put("postgresql", probePostgres());
        dependencies.put("rabbitmq", probeRabbitMq());
        dependencies.put("redis", probeRedis());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", areDependenciesUp(dependencies) ? "UP" : "DOWN");
        body.put("service", "flowforge-backend");
        body.put("dependencies", dependencies);
        return body;
    }

    private String probePostgres() {
        if (dataSource == null) return "DOWN";
        try {
            new JdbcTemplate(dataSource).queryForObject("SELECT 1", Integer.class);
            return "UP";
        } catch (Exception ignored) {
            return "DOWN";
        }
    }

    private String probeRabbitMq() {
        if (rabbitConnectionFactory == null) return "DOWN";
        try (var connection = rabbitConnectionFactory.createConnection()) {
            return connection.isOpen() ? "UP" : "DOWN";
        } catch (Exception ignored) {
            return "DOWN";
        }
    }

    private String probeRedis() {
        if (redisTemplate == null) return "DOWN";
        try (var connection = redisTemplate.getConnectionFactory().getConnection()) {
            return connection.ping() != null ? "UP" : "DOWN";
        } catch (Exception ignored) {
            return "DOWN";
        }
    }

    private boolean isUp(Map<String, Object> body) {
        return "UP".equals(body.get("status"));
    }

    private boolean areDependenciesUp(Map<String, Object> dependencies) {
        return dependencies.values().stream().allMatch("UP"::equals);
    }
}
