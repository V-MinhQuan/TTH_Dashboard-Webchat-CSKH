package com.flic.automation.utils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;

public final class ScreenshotUtils {
    private ScreenshotUtils() { }
    public static void save(WebDriver driver, Path target) {
        try { Files.createDirectories(target.getParent()); Files.write(target, ((TakesScreenshot)driver).getScreenshotAs(OutputType.BYTES)); }
        catch(IOException error){throw new IllegalStateException("Cannot save screenshot",error);}
    }
}
