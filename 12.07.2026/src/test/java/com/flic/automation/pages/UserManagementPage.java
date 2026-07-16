package com.flic.automation.pages;

import com.flic.automation.core.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import java.util.List;

public final class UserManagementPage extends BasePage {
    private static final By TITLE = By.xpath("//*[normalize-space()='Quản lý người dùng' or normalize-space()='Người dùng & phân quyền']");
    private static final By SEARCH = By.cssSelector("input[placeholder='Tìm theo tên, email...']");
    private static final By ADD = By.xpath("//button[contains(normalize-space(),'Thêm người dùng')]");
    public UserManagementPage(WebDriver driver) { super(driver); }
    public UserManagementPage waitUntilReady() { if (isDisplayed(TITLE)) visible(TITLE); return this; }
    public boolean isAccessDenied() { return !isDisplayed(ADD) || driver.getPageSource().contains("không có quyền"); }
    public void search(String value) { type(SEARCH, value); }
    public void openCreateDialog() { click(ADD); }
    public void fillCreateForm(String email, String password, String role) {
        type(By.cssSelector("input[placeholder='VD: nguyenvana']"), "auto" + System.nanoTime());
        type(By.cssSelector("input[placeholder='Nhập họ tên']"), "Automation User");
        type(By.cssSelector("input[placeholder='Nhập email']"), email);
        type(By.cssSelector("input[placeholder='Tối thiểu 6 ký tự']"), password);
        selectByVisibleText(By.xpath("//*[@role='dialog']//select"), role.equalsIgnoreCase("manager") ? "Quản lý CSKH" : "Nhân viên CSKH");
    }
    public void submit() { click(By.xpath("//*[@role='dialog']//button[contains(normalize-space(),'Thêm người dùng')]")); }
    public void cancelCreate() { click(By.xpath("//*[@role='dialog']//button[normalize-space()='Hủy']")); }
    public List<WebElement> rows() { return all(By.cssSelector("table tbody tr")).stream().filter(WebElement::isDisplayed).toList(); }
}
