export type SemanticTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface SemanticColorToken {
  readonly background: string;
  readonly foreground: string;
  readonly border: string;
}

export const SEMANTIC_TOKENS: Readonly<Record<SemanticTone, SemanticColorToken>> = Object.freeze({
  neutral: Object.freeze({
    background: "var(--semantic-neutral-bg, #f1f5f9)",
    foreground: "var(--semantic-neutral-fg, #475569)",
    border: "var(--semantic-neutral-border, #cbd5e1)",
  }),
  info: Object.freeze({
    background: "var(--semantic-info-bg, #eff6ff)",
    foreground: "var(--semantic-info-fg, #1d4ed8)",
    border: "var(--semantic-info-border, #bfdbfe)",
  }),
  success: Object.freeze({
    background: "var(--semantic-success-bg, #ecfdf3)",
    foreground: "var(--semantic-success-fg, #16794f)",
    border: "var(--semantic-success-border, #a7e3c7)",
  }),
  warning: Object.freeze({
    background: "var(--semantic-warning-bg, #fff8e6)",
    foreground: "var(--semantic-warning-fg, #9a6700)",
    border: "var(--semantic-warning-border, #f4d58d)",
  }),
  danger: Object.freeze({
    background: "var(--semantic-danger-bg, #fff1f1)",
    foreground: "var(--semantic-danger-fg, #b42318)",
    border: "var(--semantic-danger-border, #f8caca)",
  }),
});

export const STATUS_TONES = Object.freeze({
  pending: "warning",
  processing: "info",
  completed: "success",
  waiting_manager: "warning",
  waiting_approval: "warning",
  approved: "success",
  rejected: "danger",
  need_edit: "warning",
  success: "success",
  failed: "danger",
  active: "success",
  inactive: "neutral",
  no_permission: "danger",
  priority_low: "neutral",
  priority_medium: "warning",
  priority_high: "danger",
} satisfies Record<string, SemanticTone>);
