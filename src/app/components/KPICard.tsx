import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";

const NAVY   = "#003865";
const ORANGE = "#D73C01";   // warning accent only
const CTA    = "#ED5206";

// Soft backgrounds/borders for warning cards
const WARN_ICON_BG  = "#FFF4EE";   // soft orange
const WARN_BORDER   = "#FBCBB8";   // pale orange border

// Soft backgrounds for change badges
const POSITIVE_BG   = "#EAF8F1";  // green soft
const POSITIVE_TEXT = "#228A61";
const NEGATIVE_BG   = "#FFF1F1";  // red soft
const NEGATIVE_TEXT = "#B42318";  // softer red text

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  isWarning?: boolean;
  color?: string;
  subtitle?: string;
}

export function KPICard({ title, value, change, changeLabel, icon: Icon, isWarning, color, subtitle }: KPICardProps) {
  const valueColor = color || NAVY;

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px 22px",
        boxShadow: "0 2px 10px rgba(0,62,154,0.06)",
        cursor: "default",
        transition: "box-shadow 0.2s ease",
        border: "1px solid rgba(0,62,154,0.07)",
        /* Warning card: left accent border only — no full orange background */
        borderLeft: isWarning ? `4px solid ${ORANGE}` : "1px solid rgba(0,62,154,0.07)",
        position: "relative",
        overflow: "hidden",
        
        display: "flex",
        justifyContent: "space-between",
        alignItems: "stretch",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,62,154,0.11)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 10px rgba(0,62,154,0.06)";
      }}
    >
      {/* Left Column: Icon (top) and Label (bottom) */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", minHeight: "72px" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "50%",
            /* Warning icon bg: soft orange; normal: soft navy */
            backgroundColor: isWarning ? WARN_ICON_BG : `${NAVY}0f`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} style={{ color: isWarning ? ORANGE : NAVY }} strokeWidth={1.5} />
        </div>
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "rgba(0,62,154,0.6)", lineHeight: 1.3 }}>{title}</div>
          {(subtitle || changeLabel) && (
            <div style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)", marginTop: "3px" }}>{subtitle || changeLabel}</div>
          )}
        </div>
      </div>

      {/* Right Column: Badge (top) and Value (bottom) */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", height: "100%", minHeight: "72px" }}>
        {change !== undefined ? (
          <span
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "20px",
              /* Softer badge backgrounds */
              backgroundColor: change > 0 ? POSITIVE_BG : change < 0 ? NEGATIVE_BG : "#f1f5f9",
              color: change > 0 ? POSITIVE_TEXT : change < 0 ? NEGATIVE_TEXT : "#64748b",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {change > 0 ? <TrendingUp size={11} style={{ marginRight: "3px" }} /> : change < 0 ? <TrendingDown size={11} style={{ marginRight: "3px" }} /> : <Minus size={11} style={{ marginRight: "3px" }} />}
            {Math.abs(change)}%
          </span>
        ) : (
          <div style={{ height: "18px" }} />
        )}
        <div style={{ fontSize: "26px", fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
      </div>
    </div>
  );
}
