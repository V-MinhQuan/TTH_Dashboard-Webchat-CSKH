package com.flic.automation.components;

import com.flic.automation.core.BasePage;
import com.flic.automation.utils.DomUtils;
import com.flic.automation.utils.LocatorUtils;
import java.time.LocalDate;
import java.util.List;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Shared global filter panel backed by GlobalFilterContext. */
public final class GlobalFilterComponent extends BasePage {
    private static final By ROOT = By.cssSelector("[data-testid='global-filter-collapse-container']");
    private static final By TOGGLE = By.cssSelector(
        "[data-testid='global-filter-collapse-container'] [role='button'][aria-label='Bộ lọc dữ liệu']"
    );
    private static final By DATE_RANGE = By.cssSelector("select[aria-label='Khoảng thời gian']");
    private static final By DATE_FROM = By.cssSelector("input[aria-label='Từ ngày']");
    private static final By DATE_TO = By.cssSelector("input[aria-label='Đến ngày']");
    private static final By CHANNEL = By.cssSelector("select[aria-label='Kênh']");
    private static final By TOPIC = By.cssSelector("select[aria-label='Chủ đề']");
    private static final By RESET = By.cssSelector(".filter-panel__reset");
    private static final By APPLY = By.cssSelector("button[aria-label='Áp dụng bộ lọc']");
    private static final By CHIPS = By.cssSelector("button[aria-label^='Xóa bộ lọc ']");
    private static final By EXPORT_TOGGLE = By.cssSelector(".filter-panel__export");
    private static final By EXPORT_MENU = By.cssSelector("[data-testid='global-filter-export-menu']");
    private static final By EXPORT_PDF = menuItem("Xuất PDF (toàn trang)");
    private static final By EXPORT_PNG = menuItem("Xuất hình ảnh PNG");
    private static final By EXPORT_XLSX = menuItem("Xuất Excel (XLSX)");

    public GlobalFilterComponent(WebDriver driver) {
        super(driver);
    }

    public boolean isVisible() {
        return isDisplayed(ROOT);
    }

    public boolean isExpanded() {
        return "true".equalsIgnoreCase(visible(TOGGLE).getAttribute("aria-expanded"));
    }

    public void expand() {
        if (!isExpanded()) {
            click(TOGGLE);
        }
    }

    public void collapse() {
        if (isExpanded()) {
            click(TOGGLE);
        }
    }

    public void selectDateRange(String label) {
        expand();
        selectByVisibleText(DATE_RANGE, label);
    }

    public void setCustomDateRange(LocalDate from, LocalDate to) {
        selectDateRange("Tùy chỉnh");
        DomUtils.setReactInputValue(visible(DATE_FROM), from.toString());
        DomUtils.setReactInputValue(visible(DATE_TO), to.toString());
    }

    public void setRawCustomDates(String from, String to) {
        selectDateRange("Tùy chỉnh");
        DomUtils.setReactInputValue(visible(DATE_FROM), from == null ? "" : from);
        DomUtils.setReactInputValue(visible(DATE_TO), to == null ? "" : to);
    }

    public boolean customDateInputsVisible() { return isDisplayed(DATE_FROM) && isDisplayed(DATE_TO); }
    public String customDateFrom() { return visible(DATE_FROM).getAttribute("value"); }
    public String customDateTo() { return visible(DATE_TO).getAttribute("value"); }

    public List<String> optionTexts(String label) {
        By locator = selectLocator(label);
        return new Select(visible(locator)).getOptions().stream().map(WebElement::getText).map(String::trim).toList();
    }

    public String defaultValueForChip(String label) {
        return switch (label) {
            case "Kênh", "Chủ đề" -> "Tất cả";
            case "Thời gian" -> "30 ngày qua";
            default -> "";
        };
    }

    public String selectedValueForChip(String label) {
        return switch (label) {
            case "Kênh" -> selectedChannel();
            case "Chủ đề" -> selectedTopic();
            case "Thời gian" -> selectedDateRange();
            default -> throw new IllegalArgumentException("Unknown filter: " + label);
        };
    }

    public void removeFirstChip() {
        List<WebElement> chips = all(CHIPS);
        if (chips.isEmpty()) throw new IllegalStateException("No active filter chip");
        chips.get(0).click();
    }

    public void removeFirstChip(String label) {
        List<WebElement> matching=all(By.cssSelector("button[aria-label^='Xóa bộ lọc " + label + ":']"));
        if(matching.isEmpty()) throw new IllegalStateException("No active chip for " + label);
        matching.get(0).click();
    }

    public void selectChannel(String channel) {
        expand();
        selectByVisibleText(CHANNEL, channel);
    }

    public void selectTopic(String topic) {
        expand();
        selectByVisibleText(TOPIC, topic);
    }

    public String selectedDateRange() {
        return selectedOption(DATE_RANGE);
    }

    public String selectedChannel() {
        return selectedOption(CHANNEL);
    }

    public String selectedTopic() {
        return selectedOption(TOPIC);
    }

    public void apply() {
        click(APPLY);
    }

    public void reset() {
        expand();
        click(RESET);
    }

    public List<String> activeChips() {
        return all(CHIPS).stream().map(WebElement::getText).map(String::trim).toList();
    }

    public void removeChip(String label, String value) {
        click(By.xpath("//button[@aria-label="
            + LocatorUtils.xpathLiteral("Xóa bộ lọc " + label + ": " + value) + "]"));
    }

    public void openExportMenu() {
        if (!isDisplayed(EXPORT_MENU)) {
            click(EXPORT_TOGGLE);
        }
        visible(EXPORT_MENU);
    }

    public boolean exportMenuIsOpen() {
        return isDisplayed(EXPORT_MENU);
    }

    public void exportPdf() {
        openExportMenu();
        click(EXPORT_PDF);
    }

    public void exportPng() {
        openExportMenu();
        click(EXPORT_PNG);
    }

    public void exportXlsx() {
        openExportMenu();
        click(EXPORT_XLSX);
    }

    private String selectedOption(By locator) {
        WebElement select = visible(locator);
        return select.findElement(By.cssSelector("option:checked")).getText().trim();
    }

    private static By selectLocator(String label) {
        return switch (label) {
            case "Kênh" -> CHANNEL;
            case "Chủ đề" -> TOPIC;
            case "Thời gian", "Khoảng thời gian" -> DATE_RANGE;
            default -> throw new IllegalArgumentException("Unknown filter: " + label);
        };
    }

    private static By menuItem(String label) {
        return By.xpath("//*[@data-testid='global-filter-export-menu']//button[normalize-space()="
            + LocatorUtils.xpathLiteral(label) + "]");
    }
}
