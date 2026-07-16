package com.flic.automation.pages;

import com.flic.automation.components.GlobalFilterComponent;
import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openqa.selenium.By;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Channel analytics dashboard. */
public final class ChannelAnalysisPage extends BasePage {
    private static final Pattern HEATMAP_VALUE = Pattern.compile(":\\s*(\\d+)\\s+lỗi$");
    private static final By HEADING = By.xpath("//h2[normalize-space()='Phân tích theo kênh']");
    private static final By READY_STATE = By.xpath(
        "//h2[normalize-space()='Phân tích theo kênh']"
            + " | //*[normalize-space()='Chưa có dữ liệu kênh để hiển thị']"
            + " | //*[contains(normalize-space(),'Không thể tải dữ liệu Kênh')]"
    );
    private static final By EMPTY = By.xpath(
        "//*[normalize-space()='Chưa có dữ liệu kênh để hiển thị']"
    );
    private static final By LOAD_ERROR = By.xpath(
        "//*[contains(normalize-space(),'Không thể tải dữ liệu Kênh')]"
    );
    private static final By HEATMAP_CHANNEL = By.xpath(
        "//label[normalize-space()='KÊNH']/following-sibling::select"
    );
    private static final By HEATMAP_TOPIC = By.xpath(
        "//label[normalize-space()='CHỦ ĐỀ']/following-sibling::select"
    );
    private static final By OPEN_BUILDER = By.xpath(
        "//button[normalize-space()='Mở Trình tạo biểu đồ']"
    );
    private static final By AI_SUGGESTION = By.xpath(
        "//span[starts-with(normalize-space(),'AI Phân tích:')]/ancestor::div[2]"
    );

    public ChannelAnalysisPage(WebDriver driver) {
        super(driver);
    }

    public ChannelAnalysisPage waitUntilReady() {
        visible(READY_STATE);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(HEADING);
    }

    public boolean isEmpty() {
        return isDisplayed(EMPTY);
    }

    public boolean hasLoadError() {
        return isDisplayed(LOAD_ERROR);
    }

    public String channelTotal(String channel) {
        return text(By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(channel) + "]"
                + "/ancestor::div[2]//span[normalize-space()='Tổng hội thoại']"
                + "/following-sibling::span"
        )).trim();
    }

    public String channelAiFailure(String channel) {
        return metricForChannel(channel, "AI phản hồi thất bại");
    }

    public String channelPending(String channel) {
        return metricForChannel(channel, "Chờ xử lý");
    }

    public void selectHeatmapChannel(String channel) {
        selectByVisibleText(HEATMAP_CHANNEL, channel);
    }

    public void selectHeatmapTopic(String topic) {
        selectByVisibleText(HEATMAP_TOPIC, topic);
    }

    public int heatmapValue(String channel, String topic) {
        String title = visible(heatmapCell(channel, topic)).getAttribute("title");
        Matcher matcher = HEATMAP_VALUE.matcher(title == null ? "" : title);
        if (!matcher.find()) {
            throw new IllegalStateException("Không đọc được giá trị heatmap từ: " + title);
        }
        return Integer.parseInt(matcher.group(1));
    }

    public void openAiSuggestion(String channel) {
        click(By.xpath(
            "//h3[normalize-space()='Chi tiết dữ liệu theo kênh']/following::table[1]"
                + "//tr[.//*[normalize-space()=" + LocatorUtils.xpathLiteral(channel) + "]]"
                + "//button[@title='Gợi ý AI']"
        ));
        visible(AI_SUGGESTION);
    }

    public String aiSuggestionText() {
        return text(AI_SUGGESTION).trim();
    }

    public void openChartBuilder() {
        click(OPEN_BUILDER);
    }

    public WebElement chartSvg(String title) {
        return visible(By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(title) + "]"
                + "/following::div[contains(@class,'recharts-responsive-container')][1]"
                + "//*[name()='svg']"
        ));
    }

    public Dimension chartSize(String title) {
        return chartSvg(title).getSize();
    }

    public GlobalFilterComponent filters() {
        return new GlobalFilterComponent(driver);
    }

    private String metricForChannel(String channel, String metricLabel) {
        return text(By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(channel) + "]"
                + "/ancestor::div[3]//div[normalize-space()="
                + LocatorUtils.xpathLiteral(metricLabel) + "]/preceding-sibling::div"
        )).trim();
    }

    private static By heatmapCell(String channel, String topic) {
        return By.xpath("//div[starts-with(@title,"
            + LocatorUtils.xpathLiteral(channel + " × " + topic + ":") + ")]");
    }
}
