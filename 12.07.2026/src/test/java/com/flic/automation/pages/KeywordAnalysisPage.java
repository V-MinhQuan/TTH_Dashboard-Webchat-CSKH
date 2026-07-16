package com.flic.automation.pages;

import com.flic.automation.components.GlobalFilterComponent;
import com.flic.automation.core.BasePage;
import com.flic.automation.utils.LocatorUtils;
import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

/** Active keyword analytics screen; unreachable FAQ prototype controls are intentionally omitted. */
public final class KeywordAnalysisPage extends BasePage {
    private static final By HEADING = By.xpath("//h1[normalize-space()='Phân tích từ khóa']");
    private static final By READY_STATE = By.xpath(
        "//h1[normalize-space()='Phân tích từ khóa']"
            + " | //*[contains(normalize-space(),'Không thể kết nối API Keywords')]"
    );
    private static final By LOAD_ERROR = By.xpath(
        "//*[contains(normalize-space(),'Không thể kết nối API Keywords')]"
    );
    private static final By RETRY = By.xpath("//button[normalize-space()='Thử lại']");
    private static final By DETAIL_GROUP_NAMES = By.xpath(
        "//h1[normalize-space()='Phân tích từ khóa']/following::div[contains(@class,'grid')"
            + " and contains(@class,'gap-5')][1]"
            + "//div[contains(@class,'border-b')]//span[contains(@class,'font-bold')]"
    );

    public KeywordAnalysisPage(WebDriver driver) {
        super(driver);
    }

    public KeywordAnalysisPage waitUntilReady() {
        visible(READY_STATE);
        return this;
    }

    public boolean isLoaded() {
        return isDisplayed(HEADING);
    }

    public boolean hasLoadError() {
        return isDisplayed(LOAD_ERROR);
    }

    public void retryLoad() {
        click(RETRY);
        waitUntilReady();
    }

    public List<String> displayedTopicGroups() {
        return all(DETAIL_GROUP_NAMES).stream().map(WebElement::getText).map(String::trim).toList();
    }

    public String topicMessageCount(String topic) {
        return text(By.xpath(
            "//h1[normalize-space()='Phân tích từ khóa']/following::div[normalize-space()="
                + LocatorUtils.xpathLiteral(topic) + "][1]/following-sibling::div[1]"
        )).trim();
    }

    public void focusTopicGroup(String topic) {
        click(By.xpath(
            "//h1[normalize-space()='Phân tích từ khóa']/following::div[normalize-space()="
                + LocatorUtils.xpathLiteral(topic) + "][1]/parent::div"
        ));
    }

    public List<String> keywordsForTopic(String topic) {
        By words = By.xpath(
            "//span[normalize-space()=" + LocatorUtils.xpathLiteral(topic) + "]"
                + "/ancestor::div[contains(@class,'overflow-hidden')][1]"
                + "//span[contains(@class,'font-medium')]"
        );
        return all(words).stream().map(WebElement::getText).map(String::trim).toList();
    }

    public WebElement failureChartSvg() {
        return chartAfter("Số tin nhắn AI phản hồi thất bại theo chủ đề");
    }

    public WebElement topicRatioChartSvg() {
        return chartAfter("Tỷ lệ số câu hỏi theo chủ đề");
    }

    public WebElement trendChartSvg() {
        return chartAfter("Xu hướng chủ đề theo thời gian");
    }

    public GlobalFilterComponent filters() {
        return new GlobalFilterComponent(driver);
    }

    private WebElement chartAfter(String title) {
        return visible(By.xpath(
            "//*[normalize-space()=" + LocatorUtils.xpathLiteral(title) + "]"
                + "/following::div[contains(@class,'recharts-responsive-container')][1]"
                + "//*[name()='svg']"
        ));
    }
}
