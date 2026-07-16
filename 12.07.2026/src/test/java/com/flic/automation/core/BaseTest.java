package com.flic.automation.core;

import com.flic.automation.config.ConfigManager;
import com.flic.automation.driver.DriverFactory;
import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterMethod;

/** Lazily owns one ThreadLocal browser per TestNG test invocation. */
public abstract class BaseTest {
    @AfterMethod(alwaysRun = true)
    public void closeDriver() { DriverFactory.quit(); }

    protected final WebDriver driver() {
        WebDriver existing = DriverFactory.getOrNull();
        return existing == null ? DriverFactory.create() : existing;
    }
    protected final ConfigManager config() { return ConfigManager.getInstance(); }
}
