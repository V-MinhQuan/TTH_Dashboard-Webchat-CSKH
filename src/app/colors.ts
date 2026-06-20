/**
 * FLIC AI Ops – Centralized Color Token System
 *
 * Rules:
 * - Use orange/red ONLY for small accents: icons, borders, badges, CTA buttons.
 * - Use soft backgrounds (orange50, red50, amber50) for warning cards / chips.
 * - Never use a full orange background on large cards.
 * - Keep NAVY as the primary structural color.
 */

// ── Brand / Structure ─────────────────────────────────────────────
export const NAVY        = "#003865";
export const SIDEBAR_BG  = "#EBF2FF";
export const WHITE       = "#FFFFFF";

// ── Primary Orange (CTA, border accents, active icons) ────────────
export const ORANGE      = "#D73C01";   // brand orange — use sparingly
export const CTA         = "#ED5206";   // primary CTA button bg
export const CTA_SOFT    = "#F36C2E";   // softer CTA / hover state

// ── Soft Orange Surfaces (backgrounds, hovers) ────────────────────
export const ORANGE_50   = "#FFF4EE";   // soft warning card bg
export const ORANGE_100  = "#FFE8DC";   // light warning bg
export const ORANGE_200  = "#FBCBB8";   // pale border
export const ORANGE_HOVER= "#FAD8C8";   // hover surface

// ── Amber (moderate warnings) ─────────────────────────────────────
export const AMBER_50    = "#FFF7E6";   // amber bg
export const AMBER_100   = "#FADFA8";   // amber border
export const AMBER_TEXT  = "#B7791F";   // amber text / icon

// ── Red (errors, critical only) ───────────────────────────────────
export const RED_50      = "#FFF1F1";   // error bg
export const RED_100     = "#F8CACA";   // error border
export const RED_TEXT    = "#B42318";   // error text / icon

// ── Green (success) ───────────────────────────────────────────────
export const GREEN       = "#228A61";
export const GREEN_SOFT  = "#EAF8F1";
export const GREEN_BORDER= "#BFEAD3";

// ── Blue (info, channel tags) ─────────────────────────────────────
export const BLUE_500    = "#1565C0";
export const BLUE_400    = "#42A5F5";
export const BLUE_SOFT   = "#EFF6FF";
export const BLUE_TEXT   = "#3B82F6";

// ── Chart accent palette ──────────────────────────────────────────
export const CHART_COLORS = [
  NAVY,
  CTA,
  "rgba(0,56,101,0.6)",
  CTA_SOFT,
  "rgba(0,56,101,0.3)",
  "#FBCBB8",
];

// ── Button styles (inline style objects) ─────────────────────────
export const BTN_PRIMARY_BG  = `linear-gradient(135deg, ${CTA} 0%, ${CTA_SOFT} 100%)`;
export const BTN_PRIMARY_SHADOW = "0 4px 12px rgba(237, 82, 6, 0.18)";

// ── Status chip palette ───────────────────────────────────────────
export const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  "AI thất bại":                        { bg: RED_50,    color: RED_TEXT,   border: RED_100    },
  "Chưa xử lý":                         { bg: ORANGE_50, color: ORANGE,     border: ORANGE_200 },
  "Cần kiểm duyệt":                     { bg: AMBER_50,  color: AMBER_TEXT, border: AMBER_100  },
  "Chờ admin xác nhận":                 { bg: ORANGE_50, color: ORANGE,     border: ORANGE_200 },
  "Đã xử lý":                           { bg: GREEN_SOFT,color: GREEN,      border: GREEN_BORDER},
  "Thành công":                          { bg: GREEN_SOFT,color: GREEN,      border: GREEN_BORDER},
  "AI thành công":                       { bg: GREEN_SOFT,color: GREEN,      border: GREEN_BORDER},
  "Hoàn thành":                          { bg: GREEN_SOFT,color: GREEN,      border: GREEN_BORDER},
  // Canonical label – Req #1
  "Đang tư vấn / Chờ phản hồi":         { bg: BLUE_SOFT, color: BLUE_TEXT,  border: "#BFDBFE" },
  // Legacy alias kept for backward compatibility (historical records / API values)
  "Đang xử lý":                         { bg: BLUE_SOFT, color: BLUE_TEXT,  border: "#BFDBFE" },
  "AI không chắc chắn":                 { bg: AMBER_50,  color: AMBER_TEXT, border: AMBER_100  },
  "Không tìm thấy dữ liệu":             { bg: ORANGE_50, color: ORANGE,     border: ORANGE_200 },
};

