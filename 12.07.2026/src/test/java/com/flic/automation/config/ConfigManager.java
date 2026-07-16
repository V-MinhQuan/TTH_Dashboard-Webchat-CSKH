package com.flic.automation.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;
import java.util.Properties;

/** Immutable, precedence-aware test configuration. */
public final class ConfigManager {
    private static final ConfigManager INSTANCE = new ConfigManager();
    private final Properties fileValues = new Properties();

    private ConfigManager() {
        try (InputStream stream = ConfigManager.class.getClassLoader()
                .getResourceAsStream("config.properties")) {
            if (stream != null) {
                fileValues.load(stream);
            }
        } catch (IOException error) {
            throw new IllegalStateException("Cannot read config.properties", error);
        }
    }

    public static ConfigManager getInstance() { return INSTANCE; }

    public String baseUrl() { return value("base.url", "FLIC_BASE_URL", "http://127.0.0.1:5173"); }
    public String apiUrl() { return value("api.url", "FLIC_API_URL", "http://127.0.0.1:5000"); }
    public String mlUrl() { return value("ml.url", "FLIC_ML_URL", "http://127.0.0.1:8001"); }
    public String browser() { return value("browser", "FLIC_BROWSER", "chrome").toLowerCase(Locale.ROOT); }
    public boolean headless() { return bool("headless", "FLIC_HEADLESS", true); }
    public String managerUsername() { return value("manager.username", "FLIC_MANAGER_USERNAME", ""); }
    public String managerPassword() { return value("manager.password", "FLIC_MANAGER_PASSWORD", ""); }
    public String staffUsername() { return value("staff.username", "FLIC_STAFF_USERNAME", ""); }
    public String staffPassword() { return value("staff.password", "FLIC_STAFF_PASSWORD", ""); }
    public String conversationId() { return value("conversation.id", "FLIC_CONVERSATION_ID", ""); }
    public String unknownConversationId() { return value("unknown.conversation.id", "FLIC_UNKNOWN_CONVERSATION_ID", "AUTO_NOT_FOUND"); }
    public String emptyChannel() { return value("empty.channel", "FLIC_EMPTY_CHANNEL", ""); }
    public String emptyTopic() { return value("empty.topic", "FLIC_EMPTY_TOPIC", ""); }
    public String feedbackSearchSeed() { return value("feedback.search.seed", "FLIC_FEEDBACK_SEARCH_SEED", ""); }
    public String existingUserEmail() { return value("existing.user.email", "FLIC_EXISTING_USER_EMAIL", ""); }
    public String pendingFeedbackId() { return value("pending.feedback.id", "FLIC_PENDING_FEEDBACK_ID", ""); }
    public String editableFeedbackId() { return value("editable.feedback.id", "FLIC_EDITABLE_FEEDBACK_ID", ""); }
    public String existingAutomationChart() { return value("existing.automation.chart", "FLIC_EXISTING_AUTOMATION_CHART", ""); }
    public String activityMarker(String tcId) { return value("activity.marker." + tcId.toLowerCase(Locale.ROOT), "FLIC_ACTIVITY_MARKER", ""); }
    public String managerUsernameRequired() { return required(managerUsername(), "FLIC_MANAGER_USERNAME"); }
    public String managerPasswordRequired() { return required(managerPassword(), "FLIC_MANAGER_PASSWORD"); }
    public String staffUsernameRequired() { return required(staffUsername(), "FLIC_STAFF_USERNAME"); }
    public String staffPasswordRequired() { return required(staffPassword(), "FLIC_STAFF_PASSWORD"); }
    public boolean allowDestructiveTests() {
        String commandAlias = System.getProperty("allowDestructiveTests");
        return commandAlias == null ? bool("allow.destructive.tests", "FLIC_ALLOW_DESTRUCTIVE_TESTS", false) : Boolean.parseBoolean(commandAlias);
    }
    public Path downloadDir() { return Path.of(value("download.dir", "FLIC_DOWNLOAD_DIR", "target/downloads")).toAbsolutePath().normalize(); }
    public Duration explicitWait() { return Duration.ofSeconds(integer("explicit.wait.seconds", "FLIC_EXPLICIT_WAIT_SECONDS", 15)); }
    public Duration pageLoadTimeout() { return Duration.ofSeconds(integer("page.load.timeout.seconds", "FLIC_PAGE_LOAD_TIMEOUT_SECONDS", 30)); }

    private String value(String property, String environment, String fallback) {
        String systemValue = System.getProperty(property);
        if (systemValue == null) {
            systemValue = System.getProperty(environment);
        }
        if (systemValue != null) return systemValue.trim();
        String environmentValue = System.getenv(environment);
        if (environmentValue != null) return environmentValue.trim();
        return fileValues.getProperty(property, fallback).trim();
    }

    private boolean bool(String property, String environment, boolean fallback) {
        return Boolean.parseBoolean(value(property, environment, Boolean.toString(fallback)));
    }

    private int integer(String property, String environment, int fallback) {
        try {
            return Integer.parseInt(value(property, environment, Integer.toString(fallback)));
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("Invalid integer configuration: " + property, error);
        }
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new org.testng.SkipException("Thiếu dữ liệu bắt buộc: " + name + ". Xem REQUIRED_TEST_INFORMATION.md.");
        }
        return value;
    }
}
