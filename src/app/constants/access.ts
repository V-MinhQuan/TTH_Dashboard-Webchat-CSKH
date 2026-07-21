import type { Role } from "../context/AuthContext";

const STAFF_SCREENS = new Set([
  "overview",
  "channel",
  "keyword",
  "sentiment",
  "aiinsights",
  "chartbuilder",
  "chatbot_sheet",
  "settings",
  "profile",
  "personalinfo",
  "activity_history",
]);

export function canAccessScreen(role: Role, screen: string) {
  return role === "manager" || (role === "staff" && STAFF_SCREENS.has(screen));
}
