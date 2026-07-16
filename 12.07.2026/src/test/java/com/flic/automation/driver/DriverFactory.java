package com.flic.automation.driver;

import com.flic.automation.config.ConfigManager;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;
import org.openqa.selenium.PageLoadStrategy;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;
import org.openqa.selenium.logging.LogType;
import org.openqa.selenium.logging.LoggingPreferences;

/** Parallel-safe Selenium 4 driver lifecycle; binaries are resolved by Selenium Manager. */
public final class DriverFactory {
    private static final ThreadLocal<WebDriver> DRIVERS = new ThreadLocal<>();
    private static final ThreadLocal<Path> DOWNLOADS = new ThreadLocal<>();
    private DriverFactory() { }

    public static WebDriver create() {
        if (DRIVERS.get() != null) return DRIVERS.get();
        ConfigManager config = ConfigManager.getInstance();
        Path download = config.downloadDir().resolve(UUID.randomUUID().toString()).toAbsolutePath();
        download.toFile().mkdirs();
        WebDriver driver = switch (config.browser()) {
            case "edge" -> new EdgeDriver(edgeOptions(config, download));
            case "chrome" -> new ChromeDriver(chromeOptions(config, download));
            default -> throw new IllegalArgumentException("Unsupported browser: " + config.browser());
        };
        driver.manage().timeouts().pageLoadTimeout(config.pageLoadTimeout());
        DRIVERS.set(driver);
        DOWNLOADS.set(download);
        return driver;
    }

    public static WebDriver get() {
        WebDriver driver = DRIVERS.get();
        if (driver == null) throw new IllegalStateException("Driver has not been created for this thread");
        return driver;
    }

    public static WebDriver getOrNull() { return DRIVERS.get(); }
    public static Path downloadDirectory() { return DOWNLOADS.get(); }

    public static void quit() {
        WebDriver driver = DRIVERS.get();
        try { if (driver != null) driver.quit(); }
        finally { DRIVERS.remove(); DOWNLOADS.remove(); }
    }

    private static ChromeOptions chromeOptions(ConfigManager config, Path download) {
        ChromeOptions options = new ChromeOptions();
        commonArguments(options, config.headless());
        options.setPageLoadStrategy(PageLoadStrategy.NORMAL);
        options.setExperimentalOption("prefs", downloadPreferences(download));
        options.setCapability("goog:loggingPrefs", loggingPreferences());
        return options;
    }

    private static EdgeOptions edgeOptions(ConfigManager config, Path download) {
        EdgeOptions options = new EdgeOptions();
        commonArguments(options, config.headless());
        options.setPageLoadStrategy(PageLoadStrategy.NORMAL);
        options.setExperimentalOption("prefs", downloadPreferences(download));
        options.setCapability("ms:loggingPrefs", loggingPreferences());
        return options;
    }

    private static void commonArguments(org.openqa.selenium.chromium.ChromiumOptions<?> options, boolean headless) {
        options.addArguments("--window-size=1440,1000", "--disable-notifications", "--lang=vi-VN");
        if (headless) options.addArguments("--headless=new");
    }

    private static Map<String, Object> downloadPreferences(Path download) {
        Map<String, Object> preferences = new HashMap<>();
        preferences.put("download.default_directory", download.toString());
        preferences.put("download.prompt_for_download", false);
        preferences.put("safebrowsing.enabled", true);
        return Map.copyOf(preferences);
    }

    private static LoggingPreferences loggingPreferences() {
        LoggingPreferences preferences = new LoggingPreferences();
        preferences.enable(LogType.BROWSER, Level.ALL);
        preferences.enable(LogType.PERFORMANCE, Level.ALL);
        return preferences;
    }
}
