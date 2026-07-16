package com.flic.automation.utils;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

/** Operations for the source-defined flic_dashboard_auth storage key. */
public final class AuthStorageUtils {
    public static final String KEY = "flic_dashboard_auth";
    private AuthStorageUtils() { }
    public static void clear(WebDriver driver) { js(driver).executeScript("localStorage.removeItem(arguments[0]);sessionStorage.removeItem(arguments[0]);", KEY); }
    public static String local(WebDriver driver) { return read(driver, "localStorage"); }
    public static String session(WebDriver driver) { return read(driver, "sessionStorage"); }
    public static void tamperToken(WebDriver driver) {
        js(driver).executeScript("for(const s of [localStorage,sessionStorage]){const v=s.getItem(arguments[0]);if(v){const o=JSON.parse(v);o.accessToken=(o.accessToken||'')+'x';s.setItem(arguments[0],JSON.stringify(o));}}", KEY);
    }
    private static String read(WebDriver driver,String storage){Object value=js(driver).executeScript("return "+storage+".getItem(arguments[0]) || '';",KEY);return value==null?"":value.toString();}
    private static JavascriptExecutor js(WebDriver driver){return (JavascriptExecutor)driver;}
}
