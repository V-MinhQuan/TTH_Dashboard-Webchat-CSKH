package com.flic.automation.utils;

import com.flic.automation.pages.ActivityHistoryPage.ActivityRow;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.testng.Assert;

/** Semantic DOM assertions shared by charts, tables and status components. */
public final class SourceBackedUiAssertions {
    private static final Pattern NUMBER = Pattern.compile("-?\\d+(?:[.,]\\d+)?");
    private SourceBackedUiAssertions() { }

    public static boolean pageContains(WebDriver driver, String text) { return driver.getPageSource().contains(text); }
    public static boolean hasLoadError(WebDriver driver) { return containsAny(driver, "Không thể tải", "Đã xảy ra lỗi", "Thử lại"); }
    public static boolean hasEmptyStateOrZeroData(WebDriver driver) { return containsAny(driver, "Không có dữ liệu", "Chưa có dữ liệu", "Không có kết quả") || hasZeroKpi(driver); }
    public static boolean loadingOrMeaningfulContent(WebDriver driver) { return containsAny(driver, "Đang tải", "Tổng hội thoại", "Không có dữ liệu", "Không thể tải"); }
    public static boolean hasZeroKpi(WebDriver driver) { return driver.findElements(By.xpath("//*[normalize-space()='0' or normalize-space()='0%']")).stream().anyMatch(WebElement::isDisplayed); }
    public static boolean hasBlankApplicationShell(WebDriver driver) { return driver.findElements(By.cssSelector("main")).stream().filter(WebElement::isDisplayed).allMatch(e -> e.getText().isBlank()); }
    public static boolean hasConfirmationDialog(WebDriver driver) { return driver.findElements(By.cssSelector("[role='dialog']")).stream().anyMatch(WebElement::isDisplayed); }
    public static boolean hasDialogOrDetailPanel(WebDriver driver) { return hasConfirmationDialog(driver) || driver.findElements(By.cssSelector("[aria-label*='Chi tiết']")).stream().anyMatch(WebElement::isDisplayed); }

    public static String latestToast(WebDriver driver) {
        List<WebElement> toasts = driver.findElements(By.cssSelector("[data-sonner-toast], [role='status'], [role='alert']"));
        return toasts.stream().filter(WebElement::isDisplayed).map(WebElement::getText).filter(value -> !value.isBlank()).reduce((a, b) -> b).orElse("").trim();
    }

    public static void assertTableHasHeaders(WebDriver driver, List<String> expected) {
        String headers = driver.findElements(By.cssSelector("table thead th")).stream().filter(WebElement::isDisplayed).map(WebElement::getText).reduce("", (a,b) -> a + " " + b).toUpperCase(Locale.ROOT);
        for (String header : expected) Assert.assertTrue(headers.contains(header.toUpperCase(Locale.ROOT)), "Missing table header: " + header + "; actual=" + headers);
    }

    public static boolean everyTableRowContains(WebDriver driver, String text) {
        List<WebElement> rows = driver.findElements(By.cssSelector("table tbody tr")).stream().filter(WebElement::isDisplayed).filter(row -> !row.getText().contains("Không có dữ liệu")).toList();
        return !rows.isEmpty() && rows.stream().allMatch(row -> row.getText().toLowerCase(Locale.ROOT).contains(text.toLowerCase(Locale.ROOT)));
    }

    public static void openFirstTableRow(WebDriver driver) {
        List<WebElement> rows = driver.findElements(By.cssSelector("table tbody tr"));
        if (rows.isEmpty()) throw new AssertionError("No table row available");
        rows.get(0).click();
    }

    public static void assertNumericText(String text) { Assert.assertTrue(NUMBER.matcher(text.replace(" ", "")).find(), "Expected numeric text, got: " + text); }
    public static String dashboardDataFingerprint(WebDriver driver) { return driver.findElement(By.cssSelector("main")).getText().replaceAll("\\s+", " ").trim(); }

    public static void assertGrowthIndicatorsUseSemanticColors(WebDriver driver) {
        List<WebElement> indicators = driver.findElements(By.xpath("//*[contains(normalize-space(),'%') and (contains(normalize-space(),'+') or contains(normalize-space(),'-'))]"));
        Assert.assertFalse(indicators.isEmpty(), "No growth indicator found");
        for (WebElement element : indicators) Assert.assertFalse(element.getCssValue("color").isBlank(), "Growth indicator has no computed color");
    }

    public static double channelPercentageTotal(WebDriver driver) { return percentageTotal(driver); }
    public static double sentimentPercentageTotal(WebDriver driver) { return percentageTotal(driver); }

    public static void assertKeywordCountsDescending(WebDriver driver) {
        List<Integer> counts = new ArrayList<>();
        for (WebElement row : driver.findElements(By.cssSelector("table tbody tr"))) {
            Matcher matcher = NUMBER.matcher(row.getText());
            int last = Integer.MIN_VALUE; while (matcher.find()) last = Integer.parseInt(matcher.group().replace(".", "").replace(",", ""));
            if (last != Integer.MIN_VALUE) counts.add(last);
        }
        List<Integer> sorted = counts.stream().sorted(Comparator.reverseOrder()).toList();
        Assert.assertEquals(counts, sorted, "Keyword counts are not descending");
    }

    public static void assertVietnameseTextWithoutMojibake(WebDriver driver) {
        String text = driver.findElement(By.tagName("body")).getText();
        Assert.assertFalse(Pattern.compile("Ã.|Ä.|á»|â€").matcher(text).find(), "Mojibake detected in rendered Vietnamese text");
    }

    public static String textMatching(WebDriver driver, String fragment) {
        List<WebElement> matches = driver.findElements(By.xpath("//*[contains(normalize-space()," + LocatorUtils.xpathLiteral(fragment) + ")]"));
        return matches.stream().filter(WebElement::isDisplayed).map(WebElement::getText).findFirst().orElse("");
    }

    public static String waitForTextChange(WebDriver driver, String previous) {
        final String[] current = {previous};
        WaitUtils.until(() -> { current[0] = textMatching(driver, "Cập nhật lúc"); return !current[0].equals(previous); }, Duration.ofSeconds(15), "Refresh timestamp did not change");
        return current[0];
    }

    public static void assertActivityRowsHaveActionEntityAndTime(List<ActivityRow> rows) {
        Assert.assertFalse(rows.isEmpty(), "No activity rows");
        rows.forEach(row -> Assert.assertTrue(row.cells().size() >= 3 && !row.compactText().isBlank(), "Activity row lacks action/entity/time: " + row.compactText()));
    }

    public static boolean activityTimesDescending(List<ActivityRow> rows) {
        if (rows.size() < 2) return !rows.isEmpty();
        List<String> values = rows.stream().map(ActivityRow::compactText).toList();
        return !values.get(0).equals(values.get(values.size() - 1));
    }

    private static double percentageTotal(WebDriver driver) {
        List<Double> values = driver.findElements(By.xpath("//*[contains(normalize-space(),'%')]")).stream().filter(WebElement::isDisplayed)
                .map(WebElement::getText).map(SourceBackedUiAssertions::percentage).filter(value -> value >= 0).limit(4).toList();
        if (values.isEmpty()) throw new AssertionError("No visible percentage values");
        return values.stream().mapToDouble(Double::doubleValue).sum();
    }

    private static double percentage(String text) { Matcher m=Pattern.compile("(\\d+(?:[.,]\\d+)?)\\s*%").matcher(text); return m.find()?Double.parseDouble(m.group(1).replace(',','.')):-1; }
    private static boolean containsAny(WebDriver driver, String... values) { String source=driver.getPageSource(); for(String value:values) if(source.contains(value)) return true; return false; }
}
