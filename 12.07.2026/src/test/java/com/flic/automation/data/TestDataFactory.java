package com.flic.automation.data;

import java.time.Instant;
import java.util.Locale;

public final class TestDataFactory {
    private TestDataFactory() { }
    public static String marker(String tcId) { return "AUTO_" + tcId.replace('-', '_').toUpperCase(Locale.ROOT) + "_" + Instant.now().toEpochMilli(); }
    public static String email(String tcId) { return marker(tcId).toLowerCase(Locale.ROOT) + "@example.test"; }
}
