/**
 * StatusBadge – Req #13 (Semantic status colors)
 *
 * Uses shared CSS classes from globals.css (.semantic-badge--*)
 * so colors are driven by CSS custom properties (overrideable).
 * Includes text label + dot indicator for accessibility (not color-only).
 */
import type { HTMLAttributes } from "react";
import { getStatusDefinition } from "../../constants/terminology";
import type { SemanticTone } from "../../styles/semanticTokens";

const TONE_MODIFIER: Record<SemanticTone, string> = {
  success: "success",
  warning: "warning",
  danger:  "danger",
  info:    "info",
  neutral: "neutral",
};

/** Small dot indicator so status is not conveyed by color alone */
const DOT_CHAR = "●";

export interface StatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  status: string;
  label?: string;
  /** Show leading dot indicator (default: true) */
  showDot?: boolean;
}

export function StatusBadge({ status, label, showDot = true, className, style, ...props }: StatusBadgeProps) {
  const definition = getStatusDefinition(status);
  const tone: SemanticTone = definition?.tone ?? "neutral";
  const modifier = TONE_MODIFIER[tone];
  const displayLabel = label ?? definition?.label ?? status;

  return (
    <span
      data-tone={tone}
      data-status={status}
      className={`semantic-badge semantic-badge--${modifier}${className ? ` ${className}` : ""}`}
      title={displayLabel}
      style={style}
      {...props}
    >
      {showDot && (
        <span aria-hidden="true" style={{ fontSize: "8px", opacity: 0.7 }}>
          {DOT_CHAR}
        </span>
      )}
      {displayLabel}
    </span>
  );
}
