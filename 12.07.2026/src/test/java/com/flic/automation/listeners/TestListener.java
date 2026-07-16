package com.flic.automation.listeners;

import com.aventstack.extentreports.ExtentReports;
import com.aventstack.extentreports.ExtentTest;
import com.aventstack.extentreports.reporter.ExtentSparkReporter;
import com.flic.automation.config.ConfigManager;
import com.flic.automation.driver.DriverFactory;
import com.flic.automation.utils.ScreenshotUtils;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.logging.LogType;
import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

/** TestNG/Extent listener with per-TC failure evidence. */
public final class TestListener implements ITestListener {
    private static final Pattern TC_ID = Pattern.compile("([A-Z]+-TC-\\d+)");
    private static final ExtentReports EXTENT = reports();
    private static final ThreadLocal<ExtentTest> TESTS = new ThreadLocal<>();

    @Override public void onTestStart(ITestResult result) { TESTS.set(EXTENT.createTest(description(result))); }
    @Override public void onStart(ITestContext context) {
        for (String directory : new String[]{"target/evidence", "target/screenshots", "target/downloads", "target/extent-report", "target/surefire-reports"}) {
            try { Files.createDirectories(Path.of(directory)); } catch (IOException error) { throw new IllegalStateException("Cannot create report directory: " + directory, error); }
        }
    }
    @Override public void onTestSuccess(ITestResult result) { if(TESTS.get()!=null) TESTS.get().pass("PASS"); }
    @Override public void onTestSkipped(ITestResult result) { if(TESTS.get()!=null) TESTS.get().skip(result.getThrowable()); }
    @Override public void onTestFailure(ITestResult result) { if(TESTS.get()!=null) TESTS.get().fail(result.getThrowable()); capture(result); }
    @Override public void onFinish(ITestContext context) { EXTENT.flush(); TESTS.remove(); }

    private static void capture(ITestResult result) {
        String description=description(result); Matcher matcher=TC_ID.matcher(description); String tcId=matcher.find()?matcher.group(1):result.getMethod().getMethodName();
        Path folder=Path.of("target","evidence",tcId,DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS").format(LocalDateTime.now()));
        try {
            Files.createDirectories(folder); WebDriver driver=DriverFactory.getOrNull();
            if(driver!=null){ ScreenshotUtils.save(driver,folder.resolve("screenshot.png")); Files.writeString(folder.resolve("page-source.html"),driver.getPageSource(),StandardCharsets.UTF_8); writeConsole(driver,folder.resolve("browser-console.log")); }
            else { writeNoBrowserEvidence(folder); }
            String url=driver==null?"N/A":driver.getCurrentUrl();
            String failure="TC: "+description+"\nURL: "+url+"\nBrowser: "+ConfigManager.getInstance().browser()+"\nTime: "+LocalDateTime.now()+"\nFailure: "+String.valueOf(result.getThrowable());
            Files.writeString(folder.resolve("failure.txt"),failure,StandardCharsets.UTF_8);
        } catch(Exception ignored){ /* Evidence failure must not mask the product failure. */ }
    }

    private static void writeConsole(WebDriver driver,Path target) throws IOException { StringBuilder text=new StringBuilder(); try{driver.manage().logs().get(LogType.BROWSER).forEach(entry->text.append(entry).append(System.lineSeparator()));}catch(Exception error){text.append("Browser console unsupported: ").append(error.getMessage());} Files.writeString(target,text,StandardCharsets.UTF_8); }
    private static void writeNoBrowserEvidence(Path folder) throws IOException {
        BufferedImage image=new BufferedImage(900,160,BufferedImage.TYPE_INT_RGB); Graphics2D graphics=image.createGraphics();
        graphics.setColor(Color.WHITE); graphics.fillRect(0,0,image.getWidth(),image.getHeight()); graphics.setColor(Color.DARK_GRAY);
        graphics.drawString("API/ML test failure - no browser session was created.",30,70); graphics.drawString("See failure.txt and Surefire XML for request assertion evidence.",30,100); graphics.dispose();
        ImageIO.write(image,"png",folder.resolve("screenshot.png").toFile());
        Files.writeString(folder.resolve("page-source.html"),"<!doctype html><meta charset=\"utf-8\"><title>Not applicable</title><p>API/ML test: no browser page source.</p>",StandardCharsets.UTF_8);
        Files.writeString(folder.resolve("browser-console.log"),"API/ML test: no browser console.\n",StandardCharsets.UTF_8);
    }
    private static String description(ITestResult result){String description=result.getMethod().getDescription();return description==null||description.isBlank()?result.getMethod().getMethodName():description;}
    private static ExtentReports reports(){ExtentSparkReporter reporter=new ExtentSparkReporter("target/extent-report/index.html");ExtentReports reports=new ExtentReports();reports.attachReporter(reporter);reports.setSystemInfo("Base URL",ConfigManager.getInstance().baseUrl());reports.setSystemInfo("Browser",ConfigManager.getInstance().browser());return reports;}
}
