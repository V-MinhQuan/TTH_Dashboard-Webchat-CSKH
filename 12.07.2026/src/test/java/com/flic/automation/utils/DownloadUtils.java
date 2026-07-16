package com.flic.automation.utils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

public final class DownloadUtils {
    private DownloadUtils() { }
    public static void clearOwnedDirectory(Path directory) {
        try {
            if (!Files.exists(directory)) return;
            try (var paths=Files.walk(directory)) {
                paths.filter(path -> !path.equals(directory)).sorted(Comparator.reverseOrder()).forEach(path -> {
                    try { Files.deleteIfExists(path); } catch(IOException error){throw new IllegalStateException(error);}
                });
            }
        } catch(IOException error){throw new IllegalStateException("Cannot clear automation download directory",error);}
    }
}
