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
  conversationId?: number;
  type: "overtime" | "ai_uncertain" | "ai_no_data";
  priority: string;
  title: string;
  customer: string;
  channel: string;
  topic: string;
  waitTime: string;
  desc: string;
  raw_source?: string;
}

export interface TopQuestion {
  question: string;
  topic: string;
  count: number;
  channel: string;
  trend: number | null;
  relatedQuestions?: Array<{
    question: string;
    count: number;
  }>;
  sourceQuestionCount?: number;
  aiGenerated?: boolean;
}

export interface PriorityConversation {
  id: string;
  conversationId?: number;
  customerId?: string;
  customerName?: string | null;
  phoneNumber?: string | null;
  customerDisplayName?: string;
  source?: string;
  customer: string;
  channel: string;
  topic: string;
  wait: string;
  status: string;
  priority: string;
  isOvertime: boolean;
}

export interface DailyTrend {
  date: string;
  total: number;
  processed?: number;
  unprocessed?: number;
  [key: string]: string | number | undefined;
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
  topQuestionsStatus?: "ok" | "ai_overloaded" | "fallback" | "stale" | string;
  topQuestionsMessage?: string;
  priorityConversations: PriorityConversation[];
  dailyTrends: DailyTrend[];
}

export interface ChannelSummary {
  channel: string;
  source: string;
  total: number;
  unresolved: number;
  ai_ok: number;
  ai_fail: number;
  avg_time: number;
  satisfaction: number;
  negative: number;
}

export interface ChannelTrendRow {
  date: string;
  [channel: string]: string | number;
}

export interface ChannelStatusRow {
  channel: string;
  "Chờ xử lý": number;
  "Đang xử lý": number;
  "Hoàn thành": number;
}

export interface ChannelHeatmapCell {
  channel: string;
  source: string;
  topic: string;
  value: number;
}

export interface ChannelAnalyticsData {
  channels: ChannelSummary[];
  trend: ChannelTrendRow[];
  statusByChannel: ChannelStatusRow[];
  heatmap: ChannelHeatmapCell[];
  topics: string[];
  channelsList: string[];
  dateRange: {
    startDate: string;
    endDate: string;
    granularity: string;
  };
}

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
