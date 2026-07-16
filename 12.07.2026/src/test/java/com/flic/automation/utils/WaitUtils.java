package com.flic.automation.utils;

import java.time.Duration;
import java.util.function.BooleanSupplier;
import java.util.concurrent.locks.LockSupport;
import org.openqa.selenium.TimeoutException;

public final class WaitUtils {
    private WaitUtils() { }
    public static void until(BooleanSupplier condition, Duration timeout, String message) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (condition.getAsBoolean()) return;
            LockSupport.parkNanos(Duration.ofMillis(100).toNanos());
            if (Thread.currentThread().isInterrupted()) throw new IllegalStateException("Wait interrupted");
        }
        throw new TimeoutException(message);
    }
}
