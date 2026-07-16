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

/** Overview dashboard and its source-backed KPI/detail sections. */
public final class OverviewPage extends BasePage {
    private static final By HEADING = By.xpath("//h2[normalize-space()='Tổng quan hệ thống']");
    private static final By READY_STATE = By.xpath(
        "//h2[normalize-space()='Tổng quan hệ thống']"
            + " | //h3[normalize-space()='Chưa có dữ liệu để hiển thị']"
            + " | //h3[normalize-space()='Không thể tải dữ liệu Dashboard']"
    );
    private static final By EMPTY = By.xpath("//h3[normalize-space()='Chưa có dữ liệu để hiển thị']");
    private static final By ERROR_HEADING = By.xpath(
        "//h3[normalize-space()='Không thể tải dữ liệu Dashboard']"
    );
    private static final By ERROR_MESSAGE = By.xpath(
        "//h3[normalize-space()='Không thể tải dữ liệu Dashboard']/following-sibling::p"
    );
    private static final By RETRY = By.xpath("//button[normalize-space()='Thử lại']");
    private static final By REFRESH = By.xpath(
        "//h2[normalize-space()='Tổng quan hệ thống']/following::button[normalize-space()='Làm mới'][1]"
    );
    private static final By TOP_QUESTION_SEARCH = By.cssSelector(
        "input[aria-label='Tìm kiếm câu hỏi nổi bật']"
    );
    private static final By CLEAR_TOP_QUESTION_SEARCH = By.cssSelector(
        "button[aria-label='Xóa tìm kiếm câu hỏi nổi bật']"
    );
    private static final By TOP_QUESTIONS_TABLE = By.xpath(
        "//h3[normalize-space()='Câu hỏi nổi bật từ khách hàng']/following::table[1]"
    );
    private static final By TOP_QUESTION_ROWS = By.xpath(
        "//h3[normalize-space()='Câu hỏi nổi bật từ khách hàng']/following::table[1]//tbody/tr"
    );
    private static final By PRIORITY_ROWS = By.xpath(
        "//h3[normalize-space()='Hội thoại ưu tiên xử lý']/following::table[1]//tbody/tr"
    );
    private static final By DETAIL_DIALOG = By.cssSelector("[aria-label='Chi tiết câu hỏi nổi bật']");
    private static final By DETAIL_CLOSE = By.cssSelector("button[aria-label='Đóng chi tiết']");

    public OverviewPage(WebDriver driver) {
        super(driver);
    }

    public OverviewPage waitUntilReady() {
        visible(READY_STATE);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(HEADING);
    }

    public boolean isEmpty() {
        return isDisplayed(EMPTY);
    }

    public boolean hasLoadError() {
        return isDisplayed(ERROR_HEADING);
    }

    public String loadError() {
        return hasLoadError() && isDisplayed(ERROR_MESSAGE) ? text(ERROR_MESSAGE).trim() : "";
    }

    public void retryLoad() {
        click(RETRY);
        waitUntilReady();
    }

    public void refresh() {
        click(REFRESH);
    }

    public String kpiValue(String kpiLabel) {
        return text(kpiValueLocator(kpiLabel)).trim();
    }

    public WebElement chartSvg(String chartTitle) {
        return visible(chartSvgLocator(chartTitle));
    }

    public Dimension chartSize(String chartTitle) {
        return chartSvg(chartTitle).getSize();
    }

    public List<WebElement> topQuestionRows() {
        visible(TOP_QUESTIONS_TABLE);
        return all(TOP_QUESTION_ROWS);
    }

    public void searchTopQuestions(String query) {
        type(TOP_QUESTION_SEARCH, query);
    }

    public void clearTopQuestionSearch() {
        if (isDisplayed(CLEAR_TOP_QUESTION_SEARCH)) {
            click(CLEAR_TOP_QUESTION_SEARCH);
        }
    }

    public void openTopQuestionDetails(String question) {
        click(actionForTopQuestion(question, "Chi tiết"));
        visible(DETAIL_DIALOG);
    }

    public void closeTopQuestionDetails() {
        click(DETAIL_CLOSE);
        waitGone(DETAIL_DIALOG);
    }

    public FeedbackFormDialog openFeedbackFormForQuestion(String question) {
        click(actionForTopQuestion(question, "Thêm FAQ"));
        FeedbackFormDialog dialog = new FeedbackFormDialog(driver);
        if (!dialog.isOpen()) {
            visible(By.cssSelector("[role='dialog'][aria-labelledby='feedback-form-title']"));
        }
        return dialog;
    }

    public List<WebElement> priorityConversationRows() {
        return all(PRIORITY_ROWS);
    }

    public void processPriorityConversation(String rowId) {
        click(By.xpath(
            "//h3[normalize-space()='Hội thoại ưu tiên xử lý']/following::table[1]"
                + "//tr[.//*[normalize-space()=" + LocatorUtils.xpathLiteral(rowId) + "]]"
                + "//button[normalize-space()='Đánh dấu xử lý']"
        ));
    }

    public GlobalFilterComponent filters() {
        return new GlobalFilterComponent(driver);
    }

    private static By kpiValueLocator(String label) {
        return By.xpath(
            "//div[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]"
                + "/ancestor::div[2]/following-sibling::div/div[last()]"
        );
    }

    private static By chartSvgLocator(String title) {
        return By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(title) + "]"
                + "/following::div[contains(@class,'recharts-responsive-container')][1]"
                + "//*[name()='svg']"
        );
    }

    private static By actionForTopQuestion(String question, String action) {
        return By.xpath(
            "//h3[normalize-space()='Câu hỏi nổi bật từ khách hàng']/following::table[1]"
                + "//tr[.//*[normalize-space()=" + LocatorUtils.xpathLiteral(question) + "]]"
                + "//button[normalize-space()=" + LocatorUtils.xpathLiteral(action) + "]"
        );
    }
}
