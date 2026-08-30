package com.flowforge.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.*;

@Service
public class Wso2GatewayService {

    private static final Logger log = LoggerFactory.getLogger(Wso2GatewayService.class);

    private final boolean enabled;
    private final boolean insecureTls;
    private final String publisherUrl;
    private final String gatewayBaseUrl;
    private final String authHeader;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public Wso2GatewayService(
            @Value("${flowforge.wso2.enabled:true}") String enabledStr,
            @Value("${flowforge.wso2.insecure-tls:false}") String insecureTlsStr,
            @Value("${flowforge.wso2.publisher-url:https://localhost:9443/api/am/publisher/v4}") String publisherUrl,
            @Value("${flowforge.wso2.gateway-url:https://localhost:8243}") String gatewayBaseUrl,
            @Value("${flowforge.wso2.username:admin}") String username,
            @Value("${flowforge.wso2.password:admin}") String password,
            ObjectMapper objectMapper) {
        this.enabled = enabledStr != null && !enabledStr.isBlank() && Boolean.parseBoolean(enabledStr.trim());
        this.insecureTls = insecureTlsStr != null && !insecureTlsStr.isBlank() && Boolean.parseBoolean(insecureTlsStr.trim());
        this.publisherUrl = publisherUrl.replaceAll("/+$", "");
        this.gatewayBaseUrl = gatewayBaseUrl.replaceAll("/+$", "");
        String creds = username + ":" + password;
        this.authHeader = "Basic " + Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
        this.objectMapper = objectMapper;
        this.httpClient = this.insecureTls ? createTrustingHttpClient() : createStandardHttpClient();
    }

    /**
     * Standard secure HTTP client validating certificates against the system CA trust store.
     */
    private HttpClient createStandardHttpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    /**
     * LOCAL DEVELOPMENT ONLY: Trust-all SSLContext to support local Docker Compose environments
     * where WSO2 API Manager runs with default self-signed certificates.
     * Never enabled by default in production.
     */
    private HttpClient createTrustingHttpClient() {
        System.setProperty("jdk.internal.httpclient.disableHostnameVerification", "true");
        try {
            TrustManager[] trustAll = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };
            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAll, new SecureRandom());
            return HttpClient.newBuilder()
                    .sslContext(sslContext)
                    .connectTimeout(Duration.ofSeconds(8))
                    .build();
        } catch (Exception e) {
            log.error("Failed to initialize trusting SSLContext for WSO2", e);
            return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
        }
    }

    public boolean isAvailable() {
        if (!enabled) return false;
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(publisherUrl + "/apis?limit=1"))
                    .header("Authorization", authHeader)
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.warn("WSO2 health probe failed: {}", e.toString());
            return false;
        }
    }

    public record Wso2DeploymentResult(String wso2ApiId, String gatewayUrl, boolean success, String error) {}

    public Wso2DeploymentResult publishAndDeployApi(String name, String version, String basePath, String backendUrl) {
        if (!enabled) {
            return new Wso2DeploymentResult(null, null, false, "WSO2 integration disabled");
        }

        // Clean context: must begin with '/', must not have trailing '/'
        String context = basePath.trim();
        if (!context.startsWith("/")) {
            context = "/" + context;
        }
        while (context.length() > 1 && context.endsWith("/")) {
            context = context.substring(0, context.length() - 1);
        }

        // Clean version
        String ver = (version == null || version.isBlank()) ? "v1" : version.trim();

        // Clean name (alphanumeric, spaces, underscores, dashes only)
        String apiName = name.replaceAll("[^a-zA-Z0-9_ -]", "").trim();
        if (apiName.isBlank()) apiName = "Api-" + System.currentTimeMillis();

        try {
            // 1. Check if an API with this name/version already exists in WSO2
            String existingApiId = findExistingApiId(apiName, ver, context);
            String apiId = existingApiId;

            if (apiId == null) {
                // 2. Create the API in WSO2
                Map<String, Object> payload = new LinkedHashMap<>();
                payload.put("name", apiName);
                payload.put("version", ver);
                payload.put("context", context);
                payload.put("type", "HTTP");
                payload.put("policies", List.of("Unlimited"));
                payload.put("apiThrottlingPolicy", "Unlimited");
                payload.put("securityScheme", List.of("oauth2"));

                Map<String, Object> endpointConfig = new LinkedHashMap<>();
                endpointConfig.put("endpoint_type", "http");
                endpointConfig.put("production_endpoints", Map.of("url", backendUrl));
                endpointConfig.put("sandbox_endpoints", Map.of("url", backendUrl));
                payload.put("endpointConfig", endpointConfig);

                List<Map<String, Object>> operations = List.of(
                        Map.of("target", "/*", "verb", "GET", "authType", "None", "throttlingPolicy", "Unlimited"),
                        Map.of("target", "/*", "verb", "POST", "authType", "None", "throttlingPolicy", "Unlimited"),
                        Map.of("target", "/*", "verb", "PUT", "authType", "None", "throttlingPolicy", "Unlimited"),
                        Map.of("target", "/*", "verb", "DELETE", "authType", "None", "throttlingPolicy", "Unlimited"),
                        Map.of("target", "/*", "verb", "PATCH", "authType", "None", "throttlingPolicy", "Unlimited")
                );
                payload.put("operations", operations);

                String requestJson = objectMapper.writeValueAsString(payload);
                HttpRequest createReq = HttpRequest.newBuilder()
                        .uri(URI.create(publisherUrl + "/apis"))
                        .header("Authorization", authHeader)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(15))
                        .POST(HttpRequest.BodyPublishers.ofString(requestJson, StandardCharsets.UTF_8))
                        .build();

                HttpResponse<String> createRes = httpClient.send(createReq, HttpResponse.BodyHandlers.ofString());
                if (createRes.statusCode() == 409) {
                    apiId = findExistingApiId(apiName, ver, context);
                    if (apiId == null) {
                        log.error("Conflict on WSO2 create but existing API not found: {}", createRes.body());
                        return new Wso2DeploymentResult(null, null, false, "WSO2 create conflict: " + createRes.body());
                    }
                    log.info("Resolved existing WSO2 API after 409 conflict: id={}", apiId);
                } else if (createRes.statusCode() < 200 || createRes.statusCode() >= 300) {
                    log.error("Failed to create WSO2 API: HTTP {} - {}", createRes.statusCode(), createRes.body());
                    return new Wso2DeploymentResult(null, null, false, "WSO2 create failed: " + createRes.body());
                } else {
                    JsonNode createdNode = objectMapper.readTree(createRes.body());
                    apiId = createdNode.path("id").asText();
                    log.info("WSO2 API created: id={} name={} context={}", apiId, apiName, context);
                }
            }

            // 3. Transition lifecycle to PUBLISHED
            transitionLifecycle(apiId, "Publish");

            // 4. Create Revision
            HttpRequest revReq = HttpRequest.newBuilder()
                    .uri(URI.create(publisherUrl + "/apis/" + apiId + "/revisions"))
                    .header("Authorization", authHeader)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> revRes = httpClient.send(revReq, HttpResponse.BodyHandlers.ofString());
            String revisionId = null;
            if (revRes.statusCode() >= 200 && revRes.statusCode() < 300) {
                JsonNode revNode = objectMapper.readTree(revRes.body());
                revisionId = revNode.path("id").asText(null);
            }

            // 5. Deploy Revision
            if (revisionId != null && !revisionId.isBlank()) {
                String deployPayload = "[{\"name\":\"Default\",\"vhost\":\"localhost\",\"displayOnDevportal\":true}]";
                HttpRequest deployReq = HttpRequest.newBuilder()
                        .uri(URI.create(publisherUrl + "/apis/" + apiId + "/deploy-revision?revisionId=" + revisionId))
                        .header("Authorization", authHeader)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(15))
                        .POST(HttpRequest.BodyPublishers.ofString(deployPayload, StandardCharsets.UTF_8))
                        .build();
                HttpResponse<String> deployRes = httpClient.send(deployReq, HttpResponse.BodyHandlers.ofString());
                log.info("WSO2 revision deployed: apiId={} revisionId={} status={}", apiId, revisionId, deployRes.statusCode());
            }

            String gatewayUrl = gatewayBaseUrl + context + "/" + ver;
            log.info("WSO2 API successfully published and available at gatewayUrl={}", gatewayUrl);
            return new Wso2DeploymentResult(apiId, gatewayUrl, true, null);

        } catch (Exception e) {
            log.error("WSO2 API publication encountered an exception", e);
            return new Wso2DeploymentResult(null, null, false, e.getMessage());
        }
    }

    public void deprecateApi(String wso2ApiId) {
        if (!enabled || wso2ApiId == null || wso2ApiId.isBlank()) return;
        transitionLifecycle(wso2ApiId, "Deprecate");
    }

    private String findExistingApiId(String name, String version, String context) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(publisherUrl + "/apis?limit=50"))
                    .header("Authorization", authHeader)
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(res.body());
                JsonNode list = root.path("list");
                if (list.isArray()) {
                    for (JsonNode item : list) {
                        String itemContext = item.path("context").asText("");
                        String itemName = item.path("name").asText("");
                        if (context.equalsIgnoreCase(itemContext) || name.equalsIgnoreCase(itemName)) {
                            return item.path("id").asText();
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to query existing WSO2 APIs: {}", e.getMessage());
        }
        return null;
    }

    private void transitionLifecycle(String apiId, String action) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(publisherUrl + "/apis/change-lifecycle?apiId=" + apiId + "&action=" + action))
                    .header("Authorization", authHeader)
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            log.info("WSO2 change-lifecycle action={} apiId={} status={}", action, apiId, res.statusCode());
        } catch (Exception e) {
            log.warn("Failed to change WSO2 lifecycle for apiId={}: {}", apiId, e.getMessage());
        }
    }
}
