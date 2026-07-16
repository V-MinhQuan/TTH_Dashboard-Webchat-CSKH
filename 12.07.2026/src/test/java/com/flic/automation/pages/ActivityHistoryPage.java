package com.flic.automation.pages;

import com.flic.automation.core.BasePage;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public final class ActivityHistoryPage extends BasePage {
    private static final By TITLE = By.xpath("//h1[normalize-space()='Lịch sử hoạt động']");
    private static final By SEARCH = By.cssSelector("input[placeholder='Tìm kiếm theo hành động, nội dung...']");
    private static final By ROWS = By.cssSelector("table tbody tr");
    public ActivityHistoryPage(WebDriver driver) { super(driver); }
    public ActivityHistoryPage waitUntilReady() { if (isDisplayed(TITLE)) visible(TITLE); return this; }
    public boolean isLoaded() { return isDisplayed(TITLE); }
    public void search(String value) { type(SEARCH, value == null ? "" : value); }
    public List<ActivityRow> visibleActivities() { return all(ROWS).stream().filter(WebElement::isDisplayed).map(ActivityRow::new).toList(); }
    public record ActivityRow(WebElement element) {
        public String compactText() { return element.getText().replaceAll("\\s+", " ").trim(); }
        public List<WebElement> cells() { return element.findElements(By.cssSelector("td")); }
    }
}
