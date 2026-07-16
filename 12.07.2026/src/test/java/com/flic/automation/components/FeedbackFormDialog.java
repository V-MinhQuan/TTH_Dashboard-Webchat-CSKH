package com.flic.automation.components;

import com.flic.automation.core.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Shared create/edit response form used by several screens. */
public final class FeedbackFormDialog extends BasePage {
    private static final By ROOT = By.cssSelector("[role='dialog'][aria-labelledby='feedback-form-title']");
    private static final By TITLE = By.id("feedback-form-title");
    private static final By QUESTION = By.cssSelector("textarea[aria-label='Câu hỏi khách hàng']");
    private static final By ANSWER = By.cssSelector("textarea[aria-label='Câu trả lời đúng']");
    private static final By TOPIC = By.cssSelector("select[aria-label='Chủ đề']");
    private static final By CHANNEL = By.cssSelector("select[aria-label='Kênh']");
    private static final By RISK = By.cssSelector("select[aria-label='Mức rủi ro']");
    private static final By NOTES = By.cssSelector("textarea[aria-label='Ghi chú nội bộ']");
    private static final By ERROR = By.cssSelector(
        "[role='dialog'][aria-labelledby='feedback-form-title'] [role='alert']"
    );
    private static final By CLOSE = By.cssSelector("button[aria-label='Đóng form phản hồi']");
    private static final By CANCEL = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='feedback-form-title']//button[normalize-space()='Hủy']"
    );
    private static final By SAVE = By.xpath(
        "//*[@role='dialog' and @aria-labelledby='feedback-form-title']//button["
            + "normalize-space()='Lưu phản hồi' or normalize-space()='Cập nhật phản hồi']"
    );

    public FeedbackFormDialog(WebDriver driver) {
        super(driver);
    }

    public boolean isOpen() {
        return isDisplayed(ROOT);
    }

    public String title() {
        return text(TITLE).trim();
    }

    public void setQuestion(String value) {
        type(QUESTION, value);
    }

    public void setAnswer(String value) {
        type(ANSWER, value);
    }

    public void selectTopic(String value) {
        selectByVisibleText(TOPIC, value);
    }

    public void selectChannel(String value) {
        selectByVisibleText(CHANNEL, value);
    }

    public void selectRisk(String value) {
        selectByVisibleText(RISK, value);
    }

    public void setNotes(String value) {
        type(NOTES, value);
    }

    public String errorMessage() {
        return isDisplayed(ERROR) ? text(ERROR).trim() : "";
    }

    public boolean saveIsEnabled() {
        return visible(SAVE).isEnabled();
    }

    public void save() {
        click(SAVE);
    }

    public void cancel() {
        click(CANCEL);
        waitGone(ROOT);
    }

    public void close() {
        click(CLOSE);
        waitGone(ROOT);
    }
}
