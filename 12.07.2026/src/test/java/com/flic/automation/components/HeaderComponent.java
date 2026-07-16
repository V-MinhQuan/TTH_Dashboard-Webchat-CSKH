package com.flic.automation.components;

import com.flic.automation.core.BasePage;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

/** Header controls shared by all authenticated screens. */
public final class HeaderComponent extends BasePage {
    private static final By ROOT = By.cssSelector("header");
    private static final By SCREEN_LABEL = By.cssSelector("header > div:first-of-type > span");
    private static final By NOTIFICATIONS = By.xpath("//header//button[.//*[contains(@class,'lucide-bell')]]");
    private static final By AVATAR = By.xpath("//header//button[.//*[contains(@class,'lucide-chevron-down')]]");
    private static final By NOTIFICATION_PANEL = By.xpath("//header//*[normalize-space()='Thông báo hệ thống']");
    private static final By PERSONAL_INFO = By.xpath("//header//div[normalize-space()='Thông tin cá nhân']");
    private static final By ACTIVITY_HISTORY = By.xpath("//header//div[normalize-space()='Lịch sử hoạt động']");
    private static final By SETTINGS = By.xpath(
        "//header//div[normalize-space()='Cài đặt' or normalize-space()='Cài đặt cá nhân']"
    );
    private static final By LOGOUT_MENU = By.xpath("//header//div[normalize-space()='Đăng xuất']");
    private static final By LOGOUT_DIALOG = By.xpath("//*[normalize-space()='Xác nhận đăng xuất']");
    private static final By LOGOUT_CANCEL = By.xpath("//button[normalize-space()='Hủy']");
    private static final By LOGOUT_CONFIRM = By.xpath("//button[normalize-space()='Đăng xuất']");

    public HeaderComponent(WebDriver driver) {
        super(driver);
    }

    public boolean isVisible() {
        return isDisplayed(ROOT);
    }

    public String currentScreenLabel() {
        return text(SCREEN_LABEL).trim();
    }

    public void openNotifications() {
        click(NOTIFICATIONS);
    }

    public boolean notificationsAreOpen() {
        return isDisplayed(NOTIFICATION_PANEL);
    }

    public void openAvatarMenu() {
        click(AVATAR);
    }

    public void openPersonalInfo() {
        ensureAvatarMenuOpen();
        click(PERSONAL_INFO);
    }

    public void openActivityHistory() {
        ensureAvatarMenuOpen();
        click(ACTIVITY_HISTORY);
    }

    public void openSettings() {
        ensureAvatarMenuOpen();
        click(SETTINGS);
    }

    public void requestLogout() {
        ensureAvatarMenuOpen();
        click(LOGOUT_MENU);
        visible(LOGOUT_DIALOG);
    }

    public void cancelLogout() {
        click(LOGOUT_CANCEL);
        waitGone(LOGOUT_DIALOG);
    }

    public void confirmLogout() {
        click(LOGOUT_CONFIRM);
    }

    private void ensureAvatarMenuOpen() {
        if (!isDisplayed(PERSONAL_INFO)) {
            openAvatarMenu();
        }
    }
}
