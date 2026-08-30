package com.flowforge.health;

import com.flowforge.api.Wso2GatewayService;
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
    private final Wso2GatewayService wso2GatewayService;

    public HealthController(ObjectProvider<DataSource> dataSource,
                            ObjectProvider<ConnectionFactory> rabbitConnectionFactory,
                            ObjectProvider<StringRedisTemplate> redisTemplate) {
        this(dataSource, rabbitConnectionFactory, redisTemplate, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public HealthController(ObjectProvider<DataSource> dataSource,
                            ObjectProvider<ConnectionFactory> rabbitConnectionFactory,
                            ObjectProvider<StringRedisTemplate> redisTemplate,
                            ObjectProvider<Wso2GatewayService> wso2GatewayService) {
        this.dataSource = dataSource != null ? dataSource.getIfAvailable() : null;
        this.rabbitConnectionFactory = rabbitConnectionFactory != null ? rabbitConnectionFactory.getIfAvailable() : null;
        this.redisTemplate = redisTemplate != null ? redisTemplate.getIfAvailable() : null;
        this.wso2GatewayService = wso2GatewayService != null ? wso2GatewayService.getIfAvailable() : null;
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
        if (wso2GatewayService != null) {
            dependencies.put("wso2", probeWso2());
        }
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

    private String probeWso2() {
        if (wso2GatewayService == null) return "DOWN";
        try {
            return wso2GatewayService.isAvailable() ? "UP" : "DOWN";
        } catch (Exception ignored) {
            return "DOWN";
        }
    }

    private boolean isUp(Map<String, Object> body) {
        return "UP".equals(body.get("status"));
    }

    private boolean areDependenciesUp(Map<String, Object> dependencies) {
        // PostgreSQL, RabbitMQ, and Redis are the core workflow execution engine dependencies
        return "UP".equals(dependencies.get("postgresql"))
                && "UP".equals(dependencies.get("rabbitmq"))
                && "UP".equals(dependencies.get("redis"));
    }
}
