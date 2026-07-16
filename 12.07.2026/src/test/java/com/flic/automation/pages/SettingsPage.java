package com.flic.automation.pages;

import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Settings screen, including source-defined profile and password sections. */
public class SettingsPage extends BasePage {
    private static final By ROOT = By.xpath("//*[normalize-space()='Thông tin tài khoản' or normalize-space()='Thông tin người dùng']");
    public SettingsPage(WebDriver driver) { super(driver); }
    public SettingsPage waitUntilReady() { visible(ROOT); waitGone(By.xpath("//*[contains(normalize-space(),'Đang tải thông tin tài khoản')]") ); return this; }
    public String name() { return inputAfter("Họ và tên").getAttribute("value"); }
    public String email() { return inputAfter("Email").getAttribute("value"); }
    public String displayedRole() { return inputAfter("Vai trò").getAttribute("value"); }
    public void setEmail(String value) { type(inputLocator("Email"), value); }
    public void setPhone(String value) { type(inputLocator("Số điện thoại"), value); }
    public void saveProfile() { click(By.xpath("//button[normalize-space()='Lưu thông tin']")); }
    public void enterCurrentPassword(String value) { type(passwordInput(1), value); }
    public void enterNewPassword(String value) { type(passwordInput(2), value); }
    public void confirmNewPassword(String value) { type(passwordInput(3), value); }
    public void requestPasswordChange() { click(By.xpath("//button[contains(normalize-space(),'Đổi mật khẩu')]")); }
    private org.openqa.selenium.WebElement inputAfter(String label) { return visible(inputLocator(label)); }
    private static By inputLocator(String label) { return By.xpath("//label[normalize-space()=" + LocatorUtils.xpathLiteral(label) + "]/following-sibling::input"); }
    private static By passwordInput(int index) { return By.xpath("(//h3[normalize-space()='Đổi mật khẩu']/following::input[@type='password'])[" + index + "]"); }
}
