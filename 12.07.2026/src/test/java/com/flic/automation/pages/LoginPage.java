package com.flic.automation.pages;

import com.flic.automation.core.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Username/password login screen. */
public final class LoginPage extends BasePage {
    private static final By TITLE = By.xpath(
        "//h1[normalize-space()='Hệ thống phân tích Web Chatbot CSKH FLIC']"
    );
    private static final By USERNAME = By.cssSelector("input[placeholder='Nhập tên đăng nhập']");
    private static final By PASSWORD = By.cssSelector("input[placeholder='Nhập mật khẩu']");
    private static final By REMEMBER = By.xpath(
        "//label[contains(normalize-space(.),'Ghi nhớ đăng nhập')]//input[@type='checkbox']"
    );
    private static final By PASSWORD_TOGGLE = By.xpath(
        "//input[@placeholder='Nhập mật khẩu']/following-sibling::button[@type='button']"
    );
    private static final By SUBMIT = By.xpath("//button[normalize-space()='Đăng nhập']");
    private static final By ERROR = By.xpath("//button[normalize-space()='Đăng nhập']/preceding-sibling::div[1]");

    public LoginPage(WebDriver driver) {
        super(driver);
    }

    public LoginPage open(String baseUrl) {
        driver.get(baseUrl);
        visible(TITLE);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(TITLE) && isDisplayed(USERNAME) && isDisplayed(PASSWORD);
    }

    public LoginPage enterUsername(String username) {
        type(USERNAME, username);
        return this;
    }

    public LoginPage enterPassword(String password) {
        type(PASSWORD, password);
        return this;
    }

    public LoginPage setRememberLogin(boolean remember) {
        WebElement checkbox = visible(REMEMBER);
        if (checkbox.isSelected() != remember) {
            checkbox.click();
        }
        return this;
    }

    public LoginPage togglePasswordVisibility() {
        click(PASSWORD_TOGGLE);
        return this;
    }

    public String passwordInputType() {
        return visible(PASSWORD).getAttribute("type");
    }

    public void submit() {
        click(SUBMIT);
    }

    public void submitWithEnter() {
        visible(PASSWORD).sendKeys(Keys.ENTER);
    }

    public boolean isSubmitting() {
        WebElement submit = visible(SUBMIT);
        return !submit.isEnabled() || submit.getText().contains("Đang đăng nhập");
    }

    public String errorMessage() {
        return isDisplayed(ERROR) ? text(ERROR).trim() : "";
    }

    public void login(String username, String password, boolean remember) {
        enterUsername(username)
            .enterPassword(password)
            .setRememberLogin(remember)
            .submit();
    }
}
