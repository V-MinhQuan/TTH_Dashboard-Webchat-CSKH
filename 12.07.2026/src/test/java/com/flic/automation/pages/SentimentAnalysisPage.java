package com.flic.automation.pages;

import com.flic.automation.components.GlobalFilterComponent;
import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Sentiment analytics, including database-changing negative-conversation actions. */
public final class SentimentAnalysisPage extends BasePage {
    private static final String POSITIVE_HEADING = "Hội thoại có cảm xúc tích cực";
    private static final String NEGATIVE_HEADING = "Hội thoại có cảm xúc tiêu cực cần xử lý";
    private static final By HEADING = By.xpath("//h2[normalize-space()='Phân tích cảm xúc']");
    private static final By POSITIVE_ROWS = rowsAfter(POSITIVE_HEADING);
    private static final By NEGATIVE_ROWS = rowsAfter(NEGATIVE_HEADING);
    private static final By REFRESH_NEGATIVE = By.cssSelector(
        "button[aria-label='Làm mới danh sách hội thoại tiêu cực']"
    );
    private static final By SELECT_ALL_NEGATIVE = By.cssSelector(
        "input[aria-label='Chọn tất cả hội thoại trên trang']"
    );
    private static final By BULK_REQUEST = By.xpath(
        "//h3[normalize-space()='" + NEGATIVE_HEADING + "']/following::button["
            + "starts-with(normalize-space(),'Đánh dấu đã xử lý')][1]"
    );
    private static final By BULK_DIALOG = By.cssSelector(
        "[role='dialog'][aria-labelledby='bulk-confirm-title']"
    );
    private static final By BULK_CONFIRMATION_TEXT = By.id("bulk-confirm-desc");
    private static final By BULK_CANCEL = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='bulk-confirm-title']//button[normalize-space()='Hủy']"
    );
    private static final By BULK_CONFIRM = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='bulk-confirm-title']//button["
            + "starts-with(normalize-space(),'Xác nhận xử lý')]"
    );

    public SentimentAnalysisPage(WebDriver driver) {
        super(driver);
    }

    public SentimentAnalysisPage waitUntilReady() {
        visible(HEADING);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(HEADING);
    }

    public String kpiValue(String label) {
        return text(By.xpath(
            "//*[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]"
                + "/ancestor::div[2]/following-sibling::div/div[last()]"
        )).trim();
    }

    public WebElement chartSvg(String title) {
        return visible(By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(title) + "]"
                + "/following::div[contains(@class,'recharts-responsive-container')][1]"
                + "//*[name()='svg']"
        ));
    }

    public Dimension chartSize(String title) {
        return chartSvg(title).getSize();
    }

    public List<WebElement> positiveRows() {
        return all(POSITIVE_ROWS);
    }

    public void nextPositivePage() {
        click(paginationButton(POSITIVE_HEADING, "Trang sau"));
    }

    public void previousPositivePage() {
        click(paginationButton(POSITIVE_HEADING, "Trang trước"));
    }

    public String positivePageIndicator() {
        return text(pageIndicator(POSITIVE_HEADING)).trim();
    }

    public List<WebElement> negativeRows() {
        return all(NEGATIVE_ROWS);
    }

    public void refreshNegativeConversations() {
        click(REFRESH_NEGATIVE);
    }

    public void selectNegativeConversation(String id) {
        click(By.xpath("//input[@aria-label="
            + LocatorUtils.xpathLiteral("Chọn hội thoại " + id) + "]"));
    }

    public void selectAllNegativeOnPage() {
        click(SELECT_ALL_NEGATIVE);
    }

    public void markNegativeProcessed(String id) {
        click(By.xpath(
            "//input[@aria-label=" + LocatorUtils.xpathLiteral("Chọn hội thoại " + id) + "]"
                + "/ancestor::tr//button[normalize-space()='Đánh dấu xử lý']"
        ));
    }

    public void requestBulkProcess() {
        click(BULK_REQUEST);
        visible(BULK_DIALOG);
    }

    public String bulkConfirmationText() {
        return text(BULK_CONFIRMATION_TEXT).trim();
    }

    public void confirmBulkProcess() {
        click(BULK_CONFIRM);
    }

    public void cancelBulkProcess() {
        click(BULK_CANCEL);
        waitGone(BULK_DIALOG);
    }

    public void nextNegativePage() {
        click(paginationButton(NEGATIVE_HEADING, "Trang sau"));
    }

    public void previousNegativePage() {
        click(paginationButton(NEGATIVE_HEADING, "Trang trước"));
    }

    public String negativePageIndicator() {
        return text(pageIndicator(NEGATIVE_HEADING)).trim();
    }

    public GlobalFilterComponent filters() {
        return new GlobalFilterComponent(driver);
    }

    private static By rowsAfter(String heading) {
        return By.xpath("//h3[normalize-space()=" + LocatorUtils.xpathLiteral(heading)
            + "]/following::table[1]//tbody/tr");
    }

    private static By paginationButton(String heading, String ariaLabel) {
        return By.xpath("//h3[normalize-space()=" + LocatorUtils.xpathLiteral(heading)
            + "]/following::button[@aria-label=" + LocatorUtils.xpathLiteral(ariaLabel) + "][1]");
    }

    private static By pageIndicator(String heading) {
        return By.xpath("//h3[normalize-space()=" + LocatorUtils.xpathLiteral(heading)
            + "]/following::span[starts-with(normalize-space(),'Trang ')][1]");
    }
}
