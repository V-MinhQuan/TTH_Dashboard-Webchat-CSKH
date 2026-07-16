package com.flic.automation.utils;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.Actions;
import org.testng.Assert;

public final class ChartAssertions {
    private ChartAssertions() { }
    public static void assertSvgHasSize(WebElement svg) { Dimension size=svg.getSize(); Assert.assertTrue(size.width>0 && size.height>0, "Chart SVG has no geometry"); }
    public static void assertEveryVisibleChartHasGeometry(WebDriver driver) { List<WebElement> charts=driver.findElements(By.cssSelector("svg.recharts-surface, canvas")); Assert.assertFalse(charts.isEmpty()); charts.stream().filter(WebElement::isDisplayed).forEach(ChartAssertions::assertSvgHasSize); }
    public static void assertTooltipOnFirstRenderableChart(WebDriver driver) { WebElement target=driver.findElements(By.cssSelector("svg.recharts-surface *[class*='recharts-']")).stream().filter(WebElement::isDisplayed).findFirst().orElseThrow(() -> new AssertionError("No renderable chart point")); new Actions(driver).moveToElement(target).perform(); Assert.assertTrue(driver.findElements(By.cssSelector(".recharts-tooltip-wrapper")).stream().anyMatch(WebElement::isDisplayed)); }
    public static void assertLegendHasLabels(WebDriver driver) { Assert.assertTrue(driver.findElements(By.cssSelector(".recharts-legend-item-text")).stream().anyMatch(e -> e.isDisplayed() && !e.getText().isBlank())); }
    public static void assertXAxisHasLabels(WebDriver driver) { Assert.assertTrue(driver.findElements(By.cssSelector(".recharts-xAxis .recharts-cartesian-axis-tick-value")).stream().anyMatch(WebElement::isDisplayed)); }
    public static void assertLegendColorsMatchSeries(WebDriver driver) { Set<String> legends=colors(driver.findElements(By.cssSelector(".recharts-legend-item svg *[fill], .recharts-legend-item svg *[stroke]"))); Set<String> series=colors(driver.findElements(By.cssSelector(".recharts-layer[fill], .recharts-layer[stroke], .recharts-sector, .recharts-line-curve"))); legends.retainAll(series); Assert.assertFalse(legends.isEmpty(), "Legend colors do not match chart series"); }
    private static Set<String> colors(List<WebElement> elements){Set<String> out=new HashSet<>(); for(WebElement e:elements){String fill=e.getCssValue("fill"),stroke=e.getCssValue("stroke"); if(!fill.isBlank()&&!fill.equals("none"))out.add(fill); if(!stroke.isBlank()&&!stroke.equals("none"))out.add(stroke);} return out;}
}
