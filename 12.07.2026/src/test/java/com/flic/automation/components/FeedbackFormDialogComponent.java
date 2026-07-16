package com.flic.automation.components;

import com.flic.automation.core.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Source-backed create/edit feedback dialog used by task-oriented tests. */
public final class FeedbackFormDialogComponent extends BasePage {
    private static final By ROOT = By.cssSelector("[role='dialog'][aria-labelledby='feedback-form-title']");
    private static final By QUESTION = By.cssSelector("textarea[aria-label='Câu hỏi khách hàng']");
    private static final By ANSWER = By.cssSelector("textarea[aria-label='Câu trả lời đúng']");
    private static final By CANCEL = By.xpath("//*[@role='dialog']//button[normalize-space()='Hủy']");
    private static final By SAVE = By.xpath("//*[@role='dialog']//button[normalize-space()='Lưu phản hồi' or normalize-space()='Cập nhật phản hồi']");
    private static final By ERROR = By.cssSelector("[role='dialog'] [role='alert']");
    public FeedbackFormDialogComponent(WebDriver driver) { super(driver); }
    public boolean isOpen() { return isDisplayed(ROOT); }
    public String question() { return visible(QUESTION).getAttribute("value"); }
    public String answer() { return visible(ANSWER).getAttribute("value"); }
    public void setQuestion(String value) { type(QUESTION, value); }
    public void setAnswer(String value) { type(ANSWER, value); }
    public void save() { click(SAVE); }
    public void cancel() { click(CANCEL); waitGone(ROOT); }
    public String errorMessage() { return isDisplayed(ERROR) ? text(ERROR).trim() : ""; }
}
