package com.flic.automation.pages;

import com.flic.automation.components.FeedbackFormDialog;
import com.flic.automation.components.GlobalFilterComponent;
import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** AI performance screen and its review queue. */
public final class AiInsightsPage extends BasePage {
    private static final String FAILED_HEADING_TEXT = "Số lượng lỗi AI cần xử lý";
    private static final By ROOT = By.cssSelector("[data-export-target='true']");
    private static final By FAILED_HEADING = By.xpath(
        "//h3[normalize-space()='" + FAILED_HEADING_TEXT + "']"
    );
    private static final By FAILED_ROWS = By.xpath(
        "//h3[normalize-space()='" + FAILED_HEADING_TEXT + "']/following::table[1]//tbody/tr"
    );
    private static final By TOPIC_FILTER = By.cssSelector(
        "select[aria-label='Lọc câu hỏi AI chưa xử lý theo Chủ đề']"
    );
    private static final By REASON_FILTER = By.cssSelector(
        "select[aria-label='Lọc câu hỏi AI chưa xử lý theo Lý do lỗi AI']"
    );
    private static final By SELECT_ALL = By.cssSelector(
        "input[aria-label='Chọn tất cả hội thoại lỗi AI trên trang hiện tại']"
    );
    private static final By EXPORT = By.cssSelector("button[aria-label='Xuất dữ liệu lỗi AI']");
    private static final By BULK_REQUEST = By.xpath(
        "//*[@role='toolbar' and @aria-label='Thao tác hàng loạt lỗi AI']"
            + "//button[normalize-space()='Đánh dấu đã xử lý']"
    );
    private static final By BULK_DIALOG = By.cssSelector(
        "[role='dialog'][aria-labelledby='ai-bulk-title']"
    );
    private static final By BULK_CANCEL = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='ai-bulk-title']//button[normalize-space()='Hủy']"
    );
    private static final By BULK_CONFIRM = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='ai-bulk-title']//button["
            + "starts-with(normalize-space(),'Xác nhận')]"
    );
    private static final By LIBRARY = By.xpath("//button[normalize-space()='Xem Sheet Chatbot']");
    private static final By TOPIC_DETAIL_CLOSE = By.xpath(
        "//h3[starts-with(normalize-space(),'Chi tiết chủ đề:')]/following::button[normalize-space()='Đóng'][1]"
    );

    public AiInsightsPage(WebDriver driver) {
        super(driver);
    }

    public AiInsightsPage waitUntilReady() {
        visible(ROOT);
        visible(FAILED_HEADING);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(ROOT) && isDisplayed(FAILED_HEADING);
    }

    public String kpiValue(String label) {
        return text(By.xpath(
            "//div[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]"
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

    public List<WebElement> failedConversationRows() {
        return all(FAILED_ROWS);
    }

    public void filterFailedByTopic(String topic) {
        selectByVisibleText(TOPIC_FILTER, topic);
    }

    public void filterFailedByReason(String reason) {
        selectByVisibleText(REASON_FILTER, reason);
    }

    public void selectFailedConversation(String id) {
        click(failedCheckbox(id));
    }

    public void selectAllFailedOnPage() {
        click(SELECT_ALL);
    }

    public void markProcessed(String id) {
        click(actionForFailedRow(id, "Đánh dấu xử lý"));
    }

    public FeedbackFormDialog openFeedbackForm(String id) {
        click(actionForFailedRow(id, "Thêm FAQ"));
        return new FeedbackFormDialog(driver);
    }

    public void requestBulkProcess() {
        click(BULK_REQUEST);
        visible(BULK_DIALOG);
    }

    public void confirmBulkProcess() {
        click(BULK_CONFIRM);
    }

    public void cancelBulkProcess() {
        click(BULK_CANCEL);
        waitGone(BULK_DIALOG);
    }

    public void exportFailedConversationsXlsx() {
        click(EXPORT);
    }

    public void nextFailedPage() {
        click(By.xpath(
            "//h3[normalize-space()='" + FAILED_HEADING_TEXT + "']"
                + "/following::button[normalize-space()='Sau'][1]"
        ));
    }

    public void previousFailedPage() {
        click(By.xpath(
            "//h3[normalize-space()='" + FAILED_HEADING_TEXT + "']"
                + "/following::button[normalize-space()='Trước'][1]"
        ));
    }

    public void openTopicDetail(String topic) {
        click(By.xpath("//button[normalize-space()="
            + LocatorUtils.xpathLiteral("Xem chi tiết chủ đề " + topic) + "]"));
    }

    public void closeTopicDetail() {
        click(TOPIC_DETAIL_CLOSE);
    }

    public void openFeedbackLibrary() {
        click(LIBRARY);
    }

    public GlobalFilterComponent filters() {
        return new GlobalFilterComponent(driver);
    }

    private static By failedCheckbox(String id) {
        return By.xpath("//input[@aria-label="
            + LocatorUtils.xpathLiteral("Chọn hội thoại lỗi AI " + id) + "]");
    }

    private static By actionForFailedRow(String id, String action) {
        return By.xpath(
            "//input[@aria-label=" + LocatorUtils.xpathLiteral("Chọn hội thoại lỗi AI " + id) + "]"
                + "/ancestor::tr//button[normalize-space()=" + LocatorUtils.xpathLiteral(action) + "]"
        );
    }
}
