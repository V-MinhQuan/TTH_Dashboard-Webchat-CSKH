package com.flic.automation.clients;

import com.flic.automation.config.ConfigManager;
import com.flic.automation.utils.JsonUtils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Thin Java {@link HttpClient} wrapper for the active FastAPI backend.
 *
 * <p>The client deliberately treats the access token as an opaque HMAC bearer
 * session. It neither decodes nor validates it as a JWT.</p>
 */
public final class ApiClient {
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    private final String baseUrl;
    private final HttpClient httpClient;

    public ApiClient() {
        this(ConfigManager.getInstance().apiUrl());
    }

    public ApiClient(String baseUrl) {
        this(
                baseUrl,
                HttpClient.newBuilder()
                        // Uvicorn in the current Docker runtime does not consume the
                        // request body after Java's clear-text HTTP/2 upgrade probe.
                        .version(HttpClient.Version.HTTP_1_1)
                        .connectTimeout(CONNECT_TIMEOUT)
                        .followRedirects(HttpClient.Redirect.NEVER)
                        .build()
        );
    }

    ApiClient(String baseUrl, HttpClient httpClient) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
    }

    public ApiResponse get(String path) {
        return get(path, null);
    }

    public ApiResponse get(String path, String bearerToken) {
        HttpRequest.Builder request = request(path).GET();
        addBearerToken(request, bearerToken);
        return send(request.build());
    }

    public ApiResponse postJson(String path, Object body) {
        return postJson(path, body, null);
    }

    public ApiResponse postJson(String path, Object body, String bearerToken) {
        HttpRequest.Builder request = request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(toJson(body)));
        addBearerToken(request, bearerToken);
        return send(request.build());
    }

    public ApiResponse options(String path, Map<String, String> headers) {
        HttpRequest.Builder request = request(path)
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody());
        Map.copyOf(headers).forEach(request::header);
        return send(request.build());
    }

    public ApiResponse login(String username, String password) {
        Map<String, String> credentials = new LinkedHashMap<>();
        credentials.put("username", Objects.requireNonNull(username, "username"));
        credentials.put("password", Objects.requireNonNull(password, "password"));
        return postJson("/api/auth/login", Map.copyOf(credentials));
    }

    /**
     * Extracts the source-defined {@code data.accessToken} HMAC bearer value.
     */
    public String accessToken(ApiResponse loginResponse) {
        String token = loginResponse.json().path("data").path("accessToken").asText("").trim();
        if (token.isEmpty()) {
            throw new IllegalStateException("Login response does not contain data.accessToken.");
        }
        return token;
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(resolve(path))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/json");
    }

    private ApiResponse send(HttpRequest request) {
        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );
            return new ApiResponse(response.statusCode(), response.body(), response.headers());
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("HTTP request was interrupted: " + request.uri(), error);
        } catch (IOException error) {
            throw new IllegalStateException("HTTP request failed: " + request.uri(), error);
        }
    }

    private URI resolve(String path) {
        String value = Objects.requireNonNull(path, "path").trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException("path must not be blank");
        }
        if (value.startsWith("http://") || value.startsWith("https://")) {
            return URI.create(value);
        }
        return URI.create(baseUrl + (value.startsWith("/") ? value : "/" + value));
    }

    private static void addBearerToken(HttpRequest.Builder request, String bearerToken) {
        if (bearerToken != null && !bearerToken.isBlank()) {
            request.header("Authorization", "Bearer " + bearerToken.trim());
        }
    }

    private static String toJson(Object body) {
        try {
            return JsonUtils.mapper().writeValueAsString(body);
        } catch (Exception error) {
            throw new IllegalArgumentException("Cannot serialize API request body.", error);
        }
    }

    private static String normalizeBaseUrl(String baseUrl) {
        String value = Objects.requireNonNull(baseUrl, "baseUrl").trim();
        if (!value.startsWith("http://") && !value.startsWith("https://")) {
            throw new IllegalArgumentException("baseUrl must use http or https");
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
