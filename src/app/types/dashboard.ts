export interface KPIStatusSummary {
  new: number;
  open: number;
  pending: number;
  closed: number;
  unknown: number;
}

export interface KPISourceSummary {
  ZaloOA: number;
  ZaloBusiness: number;
  Facebook: number;
  ChatWidget: number;
  other: number;
  [key: string]: number; // Cho phép linh động nếu backend đổi case
}

export interface KPIMessageSummary {
  ZaloOA: number;
  ZaloBusiness: number;
  Facebook: number;
  ChatWidget: number;
  other: number;
  [key: string]: number;
}

export interface KPIDateRange {
  startDate: string;
  endDate: string;
}

export interface KPITrends {
  totalConversations: number;
  totalMessages: number;
  activeConversations: number;
  closedConversations: number;
  aiFailures: number;
}

export interface UrgentAlert {
  id: number | string;
  type: "overtime" | "ai_uncertain" | "ai_no_data";
  priority: string;
  title: string;
  customer: string;
  channel: string;
  topic: string;
  waitTime: string;
  desc: string;
}

export interface TopQuestion {
  question: string;
  topic: string;
  count: number;
  channel: string;
  trend: number;
}

export interface PriorityConversation {
  id: string;
  customer: string;
  channel: string;
  topic: string;
  wait: string;
  status: string;
  priority: string;
  isOvertime: boolean;
}

export interface DashboardKpiData {
  totalConversations: number;
  totalMessages: number;
  newCustomers: number;
  aiFailures: number;
  statusSummary: KPIStatusSummary;
  sourceSummary: KPISourceSummary;
  messageSummary: KPIMessageSummary;
  dateRange: KPIDateRange;
  trends: KPITrends;
  averageResponseTimeMinutes: number;
  urgentAlerts: UrgentAlert[];
  topQuestions: TopQuestion[];
  priorityConversations: PriorityConversation[];
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

