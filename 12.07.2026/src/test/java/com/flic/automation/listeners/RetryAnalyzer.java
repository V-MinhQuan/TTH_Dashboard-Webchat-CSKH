package com.flic.automation.listeners;

import java.util.concurrent.atomic.AtomicInteger;
import org.openqa.selenium.NoSuchSessionException;
import org.openqa.selenium.SessionNotCreatedException;
import org.openqa.selenium.WebDriverException;
import org.testng.IRetryAnalyzer;
import org.testng.ITestResult;

/** Retries one identified WebDriver/infrastructure failure; never retries assertions. */
public final class RetryAnalyzer implements IRetryAnalyzer {
    private final AtomicInteger attempts = new AtomicInteger();
    @Override public boolean retry(ITestResult result) {
        Throwable failure = result.getThrowable();
        String message = failure == null || failure.getMessage() == null ? "" : failure.getMessage().toLowerCase();
        boolean infrastructureFailure = failure instanceof NoSuchSessionException
                || failure instanceof SessionNotCreatedException
                || failure instanceof WebDriverException
                    && (message.contains("disconnected") || message.contains("browser not reachable"));
        return infrastructureFailure && attempts.getAndIncrement() < 1;
    }
}
