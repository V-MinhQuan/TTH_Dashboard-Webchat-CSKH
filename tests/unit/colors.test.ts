import { describe, expect, it } from "vitest";

import { CHANNEL_COLORS, TOPIC_COLORS, channelColorForLabel } from "../../src/app/colors";
import { TOPIC_TAXONOMY, topicColorForLabel } from "../../src/app/constants/topicTaxonomy";

describe("semantic channel and topic colors", () => {
  it("keeps canonical channel colors distinct", () => {
    const colors = [
      CHANNEL_COLORS.ZaloOA,
      CHANNEL_COLORS.ZaloBusiness,
      CHANNEL_COLORS.ChatWidget,
      CHANNEL_COLORS.Facebook,
    ];

    expect(new Set(colors).size).toBe(colors.length);
    expect(CHANNEL_COLORS.Facebook).toBe("#008C95");
    expect(CHANNEL_COLORS.ChatWidget).toBe("#D73C01");
    expect(channelColorForLabel("Zalo OA")).toBe(CHANNEL_COLORS.ZaloOA);
    expect(channelColorForLabel("website")).toBe(CHANNEL_COLORS.ChatWidget);
  });

  it("keeps canonical topic colors distinct and aligned with the taxonomy", () => {
    const canonicalTopics = ["Sát hạch CNTT", "TOEIC", "MOS", "Học Tiếng Anh", "Học Tin học"];
    const colors = canonicalTopics.map((topic) => TOPIC_COLORS[topic]);

    expect(new Set(colors).size).toBe(colors.length);
    expect(TOPIC_COLORS.TOEIC).toBe("#0B7285");
    expect(TOPIC_COLORS.MOS).toBe("#E86A92");
    expect(
      Object.fromEntries(TOPIC_TAXONOMY.filter((topic) => topic.id !== "khac").map((topic) => [topic.label, topic.color])),
    ).toEqual(Object.fromEntries(canonicalTopics.map((topic) => [topic, TOPIC_COLORS[topic]])));
    expect(topicColorForLabel("Tin học / MOS / IC3")).toBe(TOPIC_COLORS.MOS);
    expect(topicColorForLabel("VSTEP")).toBe(TOPIC_COLORS["Học Tiếng Anh"]);
  });
});
