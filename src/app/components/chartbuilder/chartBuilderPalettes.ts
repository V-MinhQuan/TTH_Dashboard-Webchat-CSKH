import type { ChartTheme } from "../../types/chartBuilder";

export const CHART_BUILDER_PALETTES: Record<ChartTheme, string[]> = {
  flic: [
    "#003865",
    "#ED5206",
    "#1565C0",
    "#D73C01",
    "#42A5F5",
    "#F36C2E",
    "#0F6C8D",
    "#F59E0B",
  ],
  navy: ["#003865", "#F36C2E", "#1565C0", "#ED5206", "#42A5F5", "#D73C01"],
  warm: ["#D73C01", "#003865", "#ED5206", "#1565C0", "#F36C2E", "#42A5F5"],
  monochrome: ["#003865", "#ED5206", "#507999", "#F36C2E", "#1565C0", "#D73C01"],
};

const AUTO_PALETTE_COLORS = new Set(
  Object.values(CHART_BUILDER_PALETTES)
    .flat()
    .map((color) => color.toLowerCase()),
);

export const CHART_BUILDER_PALETTE_LABELS: Record<ChartTheme, string> = {
  flic: "FLIC cam/xanh",
  navy: "Xanh chủ đạo",
  warm: "Cam chủ đạo",
  monochrome: "Cam/xanh nhẹ",
};

export function getChartBuilderPalette(theme: ChartTheme): string[] {
  return CHART_BUILDER_PALETTES[theme] || CHART_BUILDER_PALETTES.flic;
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
