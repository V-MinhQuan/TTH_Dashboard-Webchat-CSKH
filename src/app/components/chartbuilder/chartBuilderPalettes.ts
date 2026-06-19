import type { ChartTheme } from "../../types/chartBuilder";

export const CHART_BUILDER_PALETTES: Record<ChartTheme, string[]> = {
  flic: [
    "#003865",
    "#ED5206",
    "#D73C01",
    "#1565C0",
    "#228A61",
    "#F59E0B",
    "#42A5F5",
  ],
  navy: ["#003865", "#1565C0", "#42A5F5", "#0F6C8D", "#5B8DB8", "#8BB9D9"],
  warm: ["#D73C01", "#ED5206", "#F59E0B", "#C24173", "#E76F51", "#F4A261"],
  monochrome: ["#003865", "#245679", "#507999", "#7C9CB8", "#A8C1D6", "#D2E0EC"],
};

export const CHART_BUILDER_PALETTE_LABELS: Record<ChartTheme, string> = {
  flic: "FLIC Brand",
  navy: "Xanh Navy",
  warm: "Gam màu ấm",
  monochrome: "Đơn sắc",
};

export function getChartBuilderPalette(theme: ChartTheme): string[] {
  return CHART_BUILDER_PALETTES[theme] || CHART_BUILDER_PALETTES.flic;
}

export function paletteColor(theme: ChartTheme, index: number): string {
  const palette = getChartBuilderPalette(theme);
  return palette[index % palette.length] || CHART_BUILDER_PALETTES.flic[0];
}
