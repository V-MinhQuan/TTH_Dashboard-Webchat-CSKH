package com.flic.automation.clients;

import com.fasterxml.jackson.databind.JsonNode;
import com.flic.automation.utils.JsonUtils;

import java.net.http.HttpHeaders;
import java.util.Optional;

/**
 * Immutable HTTP response used by the API automation clients.
 */
public record ApiResponse(int statusCode, String body, HttpHeaders headers) {

    public ApiResponse {
        body = body == null ? "" : body;
    }

    /**
     * Parses the response body as JSON and fails with a concise diagnostic when
     * an endpoint unexpectedly returns non-JSON content.
     */
    public JsonNode json() {
        try {
            return JsonUtils.mapper().readTree(body);
        } catch (Exception error) {
            throw new IllegalStateException(
                    "Response body is not valid JSON (HTTP " + statusCode + ").",
                    error
            );
        }
    }

    public Optional<String> firstHeader(String name) {
        return headers.firstValue(name);
    }
}
