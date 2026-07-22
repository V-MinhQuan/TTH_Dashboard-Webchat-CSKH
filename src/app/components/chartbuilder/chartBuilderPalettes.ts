import type { ChartTheme } from "../../types/chartBuilder";
import { CHANNEL_COLORS, TOPIC_COLORS, channelColorForLabel } from "../../colors";

export const CHART_BUILDER_PALETTES: Record<ChartTheme, string[]> = {
  flic: [
    "#003865",
    "#008C95",
    "#42A5F5",
    "#D73C01",
    "#7C3AED",
    "#16A34A",
    "#EAB308",
    "#E11D48",
  ],
  navy: ["#0F4C75", "#2563EB", "#0891B2", "#14B8A6", "#6366F1", "#64748B"],
  warm: ["#C2410C", "#EA580C", "#F59E0B", "#CA8A04", "#BE123C", "#9F1239"],
  monochrome: ["#003865", "#285A7A", "#507999", "#7898AE", "#9CB2C2", "#C2D0DA"],
};

const AUTO_PALETTE_COLORS = new Set(
  [
    ...Object.values(CHART_BUILDER_PALETTES).flat(),
    "#ED5206",
    "#1565C0",
    "#F36C2E",
    "#0F6C8D",
    "#F59E0B",
    "#507999",
  ]
    .map((color) => color.toLowerCase()),
);

export const CHART_BUILDER_PALETTE_LABELS: Record<ChartTheme, string> = {
  flic: "FLIC cân bằng",
  navy: "Xanh hiện đại",
  warm: "Tông ấm",
  monochrome: "Xanh đơn sắc",
};

export function getChartBuilderPalette(theme: ChartTheme): string[] {
  return CHART_BUILDER_PALETTES[theme] || CHART_BUILDER_PALETTES.flic;
}

export function semanticChartColor(value: unknown): string | null {
  const label = String(value ?? "").trim();
  if (!label) return null;
  if (CHANNEL_COLORS[label]) return CHANNEL_COLORS[label];
  const channelColor = channelColorForLabel(label);
  if (channelColor !== "#64748B") return channelColor;
  if (TOPIC_COLORS[label]) return TOPIC_COLORS[label];

  const normalized = label.toLocaleLowerCase("vi");
  if (normalized === "cần phản hồi") return "#F97316";
  if (normalized === "không cần phản hồi") return "#16A34A";
  if (normalized.includes("tích cực")) return "#16A34A";
  if (normalized.includes("trung tính")) return "#EAB308";
  if (normalized.includes("tiêu cực")) return "#DC2626";
  if (normalized === "có") return "#2563EB";
  if (normalized === "không") return "#94A3B8";
  return null;
}

export function paletteColor(theme: ChartTheme, index: number): string {
  const palette = getChartBuilderPalette(theme);
  return palette[index % palette.length] || CHART_BUILDER_PALETTES.flic[0];
}

export function isChartBuilderPaletteColor(
  color: string | null | undefined,
): boolean {
  return Boolean(color && AUTO_PALETTE_COLORS.has(color.toLowerCase()));
}
