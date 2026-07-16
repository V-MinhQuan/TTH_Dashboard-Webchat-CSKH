package com.flic.automation.utils;

public final class LocatorUtils {
    private LocatorUtils() { }
    public static String xpathLiteral(String value) {
        if (!value.contains("'")) return "'" + value + "'";
        if (!value.contains("\"")) return "\"" + value + "\"";
        String[] parts = value.split("'", -1);
        return "concat('" + String.join("',\"'\",'", parts) + "')";
    }
}
