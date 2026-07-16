package com.flic.automation.clients;

import com.flic.automation.config.ConfigManager;

import java.util.List;
import java.util.Map;

/**
 * Client for the active ML service contract.
 */
public final class MlClient {
    private final ApiClient client;

    public MlClient() {
        this(ConfigManager.getInstance().mlUrl());
    }

    public MlClient(String mlUrl) {
        this.client = new ApiClient(mlUrl);
    }

    public ApiResponse health() {
        return client.get("/health");
    }

    public ApiResponse predict(List<String> texts) {
        return client.postJson("/predict", predictionBody(texts));
    }

    public ApiResponse predictEnsemble(List<String> texts) {
        return client.postJson("/predict-ensemble", predictionBody(texts));
    }

    private static Map<String, List<String>> predictionBody(List<String> texts) {
        return Map.of("texts", List.copyOf(texts));
    }
}
