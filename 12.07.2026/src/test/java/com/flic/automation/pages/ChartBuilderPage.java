package com.flic.automation.pages;

import com.flic.automation.core.BasePage;
import com.flic.automation.utils.DomUtils;
import com.flic.automation.utils.LocatorUtils;
import java.time.LocalDate;
import java.util.List;
import org.openqa.selenium.Alert;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

/** Chart Builder workspace, catalog, preview, saved configs, and exports. */
public final class ChartBuilderPage extends BasePage {
    private static final By ROOT = By.cssSelector(".chart-builder-shell");
    private static final By DATA_PANEL = By.cssSelector("aside[aria-label='Trường dữ liệu']");
    private static final By SETTINGS_PANEL = By.cssSelector("aside[aria-label='Cài đặt biểu đồ']");
    private static final By OPEN_DATA = By.cssSelector("button[aria-label='Mở trường dữ liệu']");
    private static final By CLOSE_DATA = By.cssSelector("button[aria-label='Đóng trường dữ liệu']");
    private static final By OPEN_SETTINGS = By.cssSelector("button[aria-label='Mở cài đặt biểu đồ']");
    private static final By CLOSE_SETTINGS = By.cssSelector("button[aria-label='Đóng cài đặt']");
    private static final By TITLE = By.cssSelector("input[aria-label='Tiêu đề biểu đồ']");
    private static final By DATASET = By.xpath(
        "//aside[@aria-label='Trường dữ liệu']//span[normalize-space()='Bộ dữ liệu phân tích']"
            + "/following-sibling::select"
    );
    private static final By FIELD_SEARCH = By.cssSelector("input[placeholder='Tìm trường dữ liệu...']");
    private static final By SAVE = By.xpath("//button[normalize-space()='Lưu biểu đồ']");
    private static final By RESET = By.xpath("//button[normalize-space()='Đặt lại']");
    private static final By BACK = By.xpath("//button[normalize-space()='Dashboard']");
    private static final By SAVE_DIALOG = By.cssSelector(
        "[role='dialog'][aria-labelledby='chart-save-title']"
    );
    private static final By SAVE_NAME = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='chart-save-title']"
            + "//span[normalize-space()='Tên cấu hình']/following-sibling::input"
    );
    private static final By SAVE_DESCRIPTION = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='chart-save-title']"
            + "//span[normalize-space()='Mô tả']/following-sibling::textarea"
    );
    private static final By SAVE_CONFIRM = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='chart-save-title']"
            + "//button[normalize-space()='Lưu biểu đồ']"
    );
    private static final By PREVIEW = By.id("chart-builder-export-area");
    private static final By PREVIEW_STATE = By.cssSelector(
        "#chart-builder-export-area [data-preview-state]"
    );
    private static final By PREVIEW_SVG = By.cssSelector("#chart-builder-export-area svg.recharts-surface");
    private static final By REFRESH_PREVIEW = By.cssSelector(
        ".chart-builder-export-actions button[title='Làm mới biểu đồ']"
    );
    private static final By EXPORT_PNG = By.xpath(
        "//div[contains(@class,'chart-builder-export-actions')]//button[normalize-space()='PNG']"
    );
    private static final By EXPORT_PDF = By.xpath(
        "//div[contains(@class,'chart-builder-export-actions')]//button[normalize-space()='PDF']"
    );
    private static final By DATE_RANGE = By.xpath(
        "//div[contains(@class,'chart-builder-date-scope')]"
            + "//span[normalize-space()='Phạm vi dữ liệu']/following-sibling::select"
    );
    private static final By DATE_FROM = By.xpath(
        "//div[contains(@class,'chart-builder-date-custom')]//span[normalize-space()='Từ ngày']"
            + "/following-sibling::input"
    );
    private static final By DATE_TO = By.xpath(
        "//div[contains(@class,'chart-builder-date-custom')]//span[normalize-space()='Đến ngày']"
            + "/following-sibling::input"
    );
    private static final By VALIDATION_MESSAGES = By.cssSelector(
        "#chart-builder-export-area [data-preview-state='invalid'] li"
    );
    private static final By FIELD_LABELS = By.cssSelector(".chart-builder-field-card strong");
    private static final By SAVED_CONFIGS = By.cssSelector(".chart-builder-saved-item");
    private static final By SAVE_CANCEL = By.xpath("//*[@role='dialog' and @aria-labelledby='chart-save-title']//button[normalize-space()='Hủy']");

    public ChartBuilderPage(WebDriver driver) {
        super(driver);
    }

    public ChartBuilderPage waitUntilCatalogReady() {
        visible(ROOT);
        visible(DATA_PANEL);
        waitGone(By.xpath("//*[normalize-space()='Đang tải bộ dữ liệu...']"));
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(ROOT);
    }

    public void openDataPanel() {
        if (!isDisplayed(DATA_PANEL)) {
            click(OPEN_DATA);
        }
        visible(DATA_PANEL);
    }

    public void closeDataPanel() {
        if (isDisplayed(CLOSE_DATA)) {
            click(CLOSE_DATA);
        }
    }

    public void openSettings() {
        if (!isDisplayed(SETTINGS_PANEL)) {
            click(OPEN_SETTINGS);
        }
        visible(SETTINGS_PANEL);
    }

    public void closeSettings() {
        if (isDisplayed(CLOSE_SETTINGS)) {
            click(CLOSE_SETTINGS);
        }
    }

    public void selectDataset(String label) {
        openDataPanel();
        selectByVisibleText(DATASET, label);
    }

    public List<String> dataSourceOptions() {
        openDataPanel();
        return new Select(visible(DATASET)).getOptions().stream().map(WebElement::getText).map(String::trim).filter(v -> !v.isBlank()).toList();
    }

    public String selectedDataSource() { openDataPanel(); return new Select(visible(DATASET)).getFirstSelectedOption().getText().trim(); }

    public void selectFirstAvailableDataSource() {
        List<String> options = dataSourceOptions();
        String first = options.stream().filter(v -> !v.toLowerCase().contains("chọn")).findFirst().orElseThrow(() -> new org.testng.SkipException("Chart catalog không có data source"));
        selectDataset(first);
    }

    public void selectAnotherAvailableDataSource() {
        String current = selectedDataSource();
        String another = dataSourceOptions().stream().filter(v -> !v.equals(current) && !v.toLowerCase().contains("chọn")).findFirst().orElseThrow(() -> new org.testng.SkipException("Cần ít nhất hai data source"));
        selectDataset(another);
    }

    public List<String> availableFieldLabels() { openDataPanel(); return all(FIELD_LABELS).stream().filter(WebElement::isDisplayed).map(WebElement::getText).map(String::trim).filter(v -> !v.isBlank()).toList(); }

    public List<String> visibleSlotLabels() {
        return all(By.cssSelector(".chart-builder-drop-zone strong, .chart-builder-drop-zone-label, .chart-builder-field-slot-badges span")).stream().filter(WebElement::isDisplayed).map(WebElement::getText).map(String::trim).filter(v -> !v.isBlank()).distinct().toList();
    }

    public void selectFirstDimensionOnly() { if (selectedDataSource().isBlank()) selectFirstAvailableDataSource(); addFirstCapableField("Trục X"); }

    public void selectMinimalValidConfiguration(String chartType) {
        selectFirstAvailableDataSource();
        selectChartType(chartType);
        addFirstCapableField("Trục X");
        addFirstCapableField("Giá trị Y");
    }

    public void selectAnotherMetric() {
        List<WebElement> metricBadges = all(By.cssSelector(".chart-builder-field-slot-badges span[title^='Giá trị Y:']"));
        if (metricBadges.size() < 2) throw new org.testng.SkipException("Data source hiện tại không có metric thứ hai");
        WebElement badge=metricBadges.get(1); WebElement card=badge.findElement(By.xpath("ancestor::div[contains(@class,'chart-builder-field-card')]"));
        card.findElement(By.cssSelector("button.chart-builder-field-item")).click();
        card.findElement(By.xpath(".//div[contains(@class,'chart-builder-field-actions')]//button[normalize-space()='Giá trị Y']")).click();
    }

    public void searchField(String query) {
        openDataPanel();
        type(FIELD_SEARCH, query);
    }

    public void selectField(String fieldLabel) {
        openDataPanel();
        click(fieldCard(fieldLabel));
    }

    public void addFieldToSlot(String fieldLabel, String slotLabel) {
        openDataPanel();
        WebElement card = visible(fieldCardContainer(fieldLabel));
        WebElement fieldButton = card.findElement(By.cssSelector("button.chart-builder-field-item"));
        if (!"true".equalsIgnoreCase(fieldButton.getAttribute("aria-expanded"))) {
            fieldButton.click();
        }
        click(By.xpath(
            "//div[contains(@class,'chart-builder-field-card')]"
                + "[.//strong[normalize-space()=" + LocatorUtils.xpathLiteral(fieldLabel) + "]]"
                + "//div[contains(@class,'chart-builder-field-actions')]"
                + "//button[normalize-space()=" + LocatorUtils.xpathLiteral(slotLabel) + "]"
        ));
    }

    public void removeField(String fieldLabel) {
        click(By.xpath("//button[@aria-label="
            + LocatorUtils.xpathLiteral("Xóa " + fieldLabel) + "]"));
    }

    public void selectChartType(String chartTypeLabel) {
        openSettings();
        click(By.xpath("//button[@title=" + LocatorUtils.xpathLiteral(chartTypeLabel) + "]"));
    }

    public void setTitle(String title) {
        type(TITLE, title);
    }

    public void selectDateRange(String range) {
        selectByVisibleText(DATE_RANGE, range);
    }

    public void setCustomDateRange(LocalDate from, LocalDate to) {
        selectDateRange("Tùy chỉnh");
        DomUtils.setReactInputValue(visible(DATE_FROM), from.toString());
        DomUtils.setReactInputValue(visible(DATE_TO), to.toString());
    }

    public String previewState() {
        WebElement state = visible(PREVIEW_STATE);
        return state.getAttribute("data-preview-state");
    }

    public List<String> validationMessages() {
        return all(VALIDATION_MESSAGES).stream().map(WebElement::getText).map(String::trim).toList();
    }

    public WebElement previewSvg() {
        return visible(PREVIEW_SVG);
    }

    public Dimension previewSize() {
        return visible(PREVIEW).getSize();
    }

    public void refreshPreview() {
        click(REFRESH_PREVIEW);
    }

    public void reset() {
        click(RESET);
    }

    public void openSaveDialog() {
        click(SAVE);
        visible(SAVE_DIALOG);
    }

    public boolean saveDialogIsOpen() { return isDisplayed(SAVE_DIALOG); }
    public void cancelSaveDialog() { click(SAVE_CANCEL); waitGone(SAVE_DIALOG); }
    public int savedConfigCount() { openDataPanel(); return all(SAVED_CONFIGS).size(); }

    public void saveConfig(String name, String description) {
        openSaveDialog();
        type(SAVE_NAME, name);
        type(SAVE_DESCRIPTION, description);
        click(SAVE_CONFIRM);
        waitGone(SAVE_DIALOG);
    }

    public boolean hasSavedConfig(String name) {
        openDataPanel();
        return isDisplayed(savedConfig(name));
    }

    public void applySavedConfig(String name) {
        openDataPanel();
        click(savedConfigAction(name, "Áp dụng"));
    }

    public void deleteSavedConfig(String name) {
        openDataPanel();
        click(savedConfigAction(name, "Xóa"));
        Alert alert = driver.switchTo().alert();
        alert.accept();
    }

    public void exportPng() {
        click(EXPORT_PNG);
    }

    public void exportPdf() {
        click(EXPORT_PDF);
    }

    public void backToDashboard() {
        click(BACK);
    }

    private static By fieldCard(String label) {
        return By.xpath(
            "//div[contains(@class,'chart-builder-field-card')]"
                + "[.//strong[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]]"
                + "//button[contains(@class,'chart-builder-field-item')]"
        );
    }

    private static By fieldCardContainer(String label) {
        return By.xpath(
            "//div[contains(@class,'chart-builder-field-card')]"
                + "[.//strong[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]]"
        );
    }

    private static By savedConfig(String name) {
        return By.xpath(
            "//div[contains(@class,'chart-builder-saved-item')]"
                + "[.//div[contains(@class,'chart-builder-saved-item-name') and normalize-space()="
                + LocatorUtils.xpathLiteral(name) + "]]"
        );
    }

    private static By savedConfigAction(String name, String action) {
        return By.xpath(
            "//div[contains(@class,'chart-builder-saved-item')]"
                + "[.//div[contains(@class,'chart-builder-saved-item-name') and normalize-space()="
                + LocatorUtils.xpathLiteral(name) + "]]"
                + "//button[normalize-space()=" + LocatorUtils.xpathLiteral(action) + "]"
        );
    }

    private void addFirstCapableField(String slot) {
        openDataPanel();
        List<WebElement> badges=all(By.cssSelector(".chart-builder-field-slot-badges span[title^='" + slot + ":']"));
        if (badges.isEmpty()) throw new org.testng.SkipException("Không có field phù hợp cho " + slot);
        WebElement card=badges.get(0).findElement(By.xpath("ancestor::div[contains(@class,'chart-builder-field-card')]"));
        WebElement toggle=card.findElement(By.cssSelector("button.chart-builder-field-item"));
        if(!"true".equalsIgnoreCase(toggle.getAttribute("aria-expanded"))) toggle.click();
        card.findElement(By.xpath(".//div[contains(@class,'chart-builder-field-actions')]//button[normalize-space()=" + LocatorUtils.xpathLiteral(slot) + "]")).click();
    }
}
