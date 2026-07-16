package com.flic.automation.pages;

import com.flic.automation.components.FeedbackFormDialogComponent;
import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

public final class FeedbackLibraryPage extends BasePage {
    private static final By TITLE = By.xpath("//h1[contains(normalize-space(),'thư viện phản hồi')]");
    private static final By LOADING = By.xpath("//*[contains(normalize-space(),'Đang tải thư viện phản hồi')]");
    private static final By SEARCH = By.cssSelector("input[placeholder='Tìm theo câu hỏi, chủ đề, nhân viên...']");
    private static final By ADD = By.xpath("//button[contains(normalize-space(),'Thêm phản hồi')]");
    private static final By ROWS = By.cssSelector("table tbody tr");
    public FeedbackLibraryPage(WebDriver driver) { super(driver); }
    public FeedbackLibraryPage waitUntilReady() { visible(TITLE); waitGone(LOADING); return this; }
    public boolean isLoaded() { return isDisplayed(TITLE); }
    public void search(String value) { type(SEARCH, value); }
    public void filterStatus(String value) { selectFilter("Trạng thái", value); }
    public void filterChannel(String value) { selectFilter("Kênh", value); }
    public List<String> filters(String label) { return new Select(visible(filter(label))).getOptions().stream().map(WebElement::getText).map(String::trim).toList(); }
    public void openCreateDialog() { click(ADD); visible(By.cssSelector("[role='dialog']")); }
    public void openEditDialog(String id) { click(action("Chỉnh sửa phản hồi ", id)); }
    public FeedbackFormDialogComponent form() { return new FeedbackFormDialogComponent(driver); }
    public void approve(String id) { click(action("Duyệt phản hồi ", id)); }
    public void reject(String id) { click(action("Từ chối phản hồi ", id)); }
    public void requestDelete(String id) { click(action("Xóa phản hồi ", id)); }
    public void cancelDelete() { click(By.xpath("//*[@role='dialog']//button[normalize-space()='Hủy']")); }
    public void confirmDelete() { click(By.xpath("//*[@role='dialog']//button[contains(normalize-space(),'Xóa')]")); }
    public void delete(String id) { requestDelete(id); confirmDelete(); }
    public void deleteByMarker(String marker) { search(marker); List<WebElement> rows = all(ROWS); if (!rows.isEmpty()) { String id = rowId(rows.get(0)); if (!id.isBlank()) delete(id); } }
    public void create(String question, String answer) { openCreateDialog(); form().setQuestion(question); form().setAnswer(answer); form().save(); }
    public boolean hasRow(String id) { return isDisplayed(row(id)); }
    public String rowText(String id) { return visible(row(id)).getText(); }
    public List<WebElement> rows() { return all(ROWS).stream().filter(WebElement::isDisplayed).toList(); }
    public String firstAvailableChannel() {
        List<String> values = filters("Kênh").stream().filter(v -> !v.startsWith("Tất cả")).toList();
        if (values.isEmpty()) throw new org.testng.SkipException("Không có kênh phản hồi trong dữ liệu hiện tại");
        return values.get(0);
    }
    private void selectFilter(String label, String value) { selectByVisibleText(filter(label), value); }
    private static By filter(String label) { return By.cssSelector("select[aria-label='Lọc thư viện phản hồi theo " + label + "']"); }
    private static By action(String prefix, String id) { return By.cssSelector("button[aria-label=" + cssString(prefix + id) + "]"); }
    private static By row(String id) { return By.xpath("//tbody/tr[.//button[contains(@aria-label," + LocatorUtils.xpathLiteral(id) + ")]]"); }
    private static String rowId(WebElement row) { List<WebElement> buttons=row.findElements(By.cssSelector("button[aria-label]")); if(buttons.isEmpty()) return ""; return buttons.get(0).getAttribute("aria-label").replaceAll("^.* ", ""); }
    private static String cssString(String value) { return "'" + value.replace("'", "\\'") + "'"; }
}
