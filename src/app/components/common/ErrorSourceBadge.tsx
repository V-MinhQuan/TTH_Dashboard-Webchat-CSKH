/**
 * ErrorSourceBadge – Req #14 (Nguồn gốc lỗi sai)
 *
 * Visually distinct from status and severity badges.
 * Uses the canonical AI_FAILURE_TAXONOMY from terminology.ts.
 * CSS classes defined in globals.css (.error-source-badge--*)
 */
import type { HTMLAttributes } from "react";
import { AlertTriangle, HelpCircle, Database, XCircle, Info, AlertOctagon, Server, MoreHorizontal } from "lucide-react";

/** Maps AI failure taxonomy label → CSS modifier + icon */
const TAXONOMY_CONFIG: Record<string, { modifier: string; icon: typeof AlertTriangle }> = {
  "Không tìm thấy dữ liệu":     { modifier: "no-data",         icon: Database },
  "Câu trả lời sai":            { modifier: "wrong",           icon: XCircle },
  "Thông tin không chính xác":  { modifier: "inaccurate",      icon: AlertTriangle },
  "Không hiểu câu hỏi":         { modifier: "not-understood",  icon: HelpCircle },
  "Thiếu thông tin":            { modifier: "missing",         icon: Info },
  "Lỗi nguồn tri thức":         { modifier: "kb",              icon: AlertOctagon },
  "Lỗi hệ thống":               { modifier: "system",          icon: Server },
  "Khác":                       { modifier: "other",           icon: MoreHorizontal },
};

export interface ErrorSourceBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** AI failure taxonomy label (from TERMINOLOGY.AI_FAILURE_TAXONOMY) */
  source: string;
  /** Show icon alongside label */
  showIcon?: boolean;
}

export function ErrorSourceBadge({ source, showIcon = true, style, className, ...props }: ErrorSourceBadgeProps) {
  const config = TAXONOMY_CONFIG[source];
  const modifier = config?.modifier ?? "other";
  const Icon = config?.icon ?? MoreHorizontal;

  return (
    <span
      className={`error-source-badge error-source-badge--${modifier}${className ? ` ${className}` : ""}`}
      title={source}
      style={style}
      {...props}
    >
      {showIcon && <Icon size={11} aria-hidden="true" />}
      {source || "Không xác định"}
    </span>
  );
}
