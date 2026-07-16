package com.flic.automation.utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WrapsDriver;
import org.openqa.selenium.WebElement;

public final class DomUtils {
    private DomUtils() { }
    public static void setReactInputValue(WebElement input, String value) {
        input.clear();
        input.sendKeys(value);
        Object driver = input instanceof WrapsDriver wrapped ? wrapped.getWrappedDriver() : null;
        if (driver instanceof JavascriptExecutor js) {
            js.executeScript("arguments[0].dispatchEvent(new Event('input',{bubbles:true}));" +
                    "arguments[0].dispatchEvent(new Event('change',{bubbles:true}));", input);
        }
    }
}
