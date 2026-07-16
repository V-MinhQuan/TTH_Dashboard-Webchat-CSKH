package com.flic.automation.components;

import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Shared sidebar navigation for the activeScreen-based application shell. */
public final class SidebarComponent extends BasePage {
    private static final By ROOT = By.cssSelector("aside.app-sidebar");
    private static final By MENU_ITEMS = By.cssSelector("nav[aria-label='Điều hướng chính'] button[aria-label]");
    private static final By ACTIVE_ITEM = By.cssSelector("nav[aria-label='Điều hướng chính'] button[aria-current='page']");
    private static final By COLLAPSE = By.cssSelector("button[aria-label='Thu gọn thanh điều hướng']");
    private static final By EXPAND = By.cssSelector("button[aria-label='Mở rộng thanh điều hướng']");

    public SidebarComponent(WebDriver driver) {
        super(driver);
    }

    public boolean isVisible() {
        return isDisplayed(ROOT);
    }

    public List<String> visibleMenuLabels() {
        return all(MENU_ITEMS).stream()
            .map(element -> element.getAttribute("aria-label"))
            .filter(label -> label != null && !label.isBlank())
            .toList();
    }

    public boolean hasMenu(String label) {
        return isDisplayed(menu(label));
    }

    public void navigateTo(String label) {
        click(menu(label));
    }

    public String activeMenuLabel() {
        return visible(ACTIVE_ITEM).getAttribute("aria-label");
    }

    public boolean isCollapsed() {
        return "true".equalsIgnoreCase(visible(ROOT).getAttribute("data-collapsed"));
    }

    public void collapse() {
        if (!isCollapsed()) {
            click(COLLAPSE);
        }
    }

    public void expand() {
        if (isCollapsed()) {
            click(EXPAND);
        }
    }

    private static By menu(String label) {
        return By.xpath("//nav[@aria-label='Điều hướng chính']//button[@aria-label="
            + LocatorUtils.xpathLiteral(label) + "]");
    }
}
