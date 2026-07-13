import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare, MessageCircle, CheckCircle, XCircle, AlertTriangle,
  Eye, Plus, RefreshCw, Search, X, Loader2
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
  ResponsiveContainer, Legend, ReferenceLine,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";
import { useSettings } from "../../context/SettingsContext";

// Import các types, services và components mới
import {
  getDashboardKpi,
  getDashboardKpiComparison,
  getDashboardPriorityConversations,
  getDashboardTopQuestions,
  getDashboardUrgentAlerts,
  closeConversation,
  type CloseConversationTarget,
} from "../../services/dashboardApi";
import { DashboardKpiData, TopQuestion, PriorityConversation, UrgentAlert } from "../../types/dashboard";
import { LoadingState } from "../common/LoadingState";
import { ErrorState } from "../common/ErrorState";
import { EmptyState } from "../common/EmptyState";
import { TopicLabel } from "../common/TopicLabel";
import { ChannelChartTick, ChannelLabel } from "../common/ChannelLabel";
import { KpiCard } from "../dashboard/KpiCard";
import { SourceChart } from "../dashboard/SourceChart";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import { getDateParamsFromFilters } from "../../utils/dateFilters";
import { mapTopicToGroupId } from "../../constants/topicTaxonomy";
import { getSheetChatbotDuplicates } from "../../services/sheetChatbotApi";
import { CHANNEL_COLORS } from "../../colors";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const CHART_COLORS = [NAVY, "#ED5206", "#1565C0", ORANGE, "#42A5F5", "#F36C2E"];

function viNum(n: number) {
  return n.toLocaleString("vi-VN");
}

function normalizeSourceForCompare(source?: string) {
  const normalized = String(source || "").trim().toLowerCase().replace(/\s+/g, "");
  const aliases: Record<string, string> = {
    fb: "facebook",
    messenger: "facebook",
    zalo: "zalooa",
    "zalo-oa": "zalooa",
    zalooa: "zalooa",
    zalobiz: "zalobusiness",
    zalobusiness: "zalobusiness",
    chatwidget: "chatwidget",
    website: "chatwidget",
    web: "chatwidget",
  };
  return aliases[normalized] || normalized;
}

function normalizeQuestionSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

const PRIORITY_RETRY_DELAYS_MS = [0, 5000, 10000, 20000] as const;
const PRIORITY_CONVERSATION_LIMIT = 5;
const DETAIL_RETRY_DELAYS_MS = [0, 5000, 10000] as const;

type PriorityLoadState = "loading" | "retrying" | "ready" | "error";
type DetailLoadState = "loading" | "retrying" | "ready" | "error";

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function calcTrend(currentValue: number, previousValue: number) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}



const statusColors: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: "#D73C01" },
  "Chờ xử lý": { bg: "#FFF7E6", color: "#B7791F" },
  "Đang tư vấn": { bg: "#dbeafe", color: "#3b82f6" },
  "Đang tư vấn / Chờ phản hồi": { bg: "#dbeafe", color: "#3b82f6" },
  // Legacy alias
  "Đang xử lý": { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành": { bg: "#EAF8F1", color: "#228A61" },
};

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  "Ưu tiên cao": { bg: "#FFF4EE", color: "#D73C01", border: "#FBCBB8" },
  "Ưu tiên trung bình": { bg: "#FFF7E6", color: "#B7791F", border: "#FADFA8" },
  "Ưu tiên thấp": { bg: "#EAF8F1", color: "#228A61", border: "#BFEAD3" },
};

interface OverviewProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (screen: string) => void;
  isRefreshing?: boolean;
  lastUpdated?: string;
  onManualRefresh?: () => void;
}

export function Overview({ filters, onFiltersChange, onNavigate, isRefreshing: parentRefreshing, lastUpdated: parentLastUpdated, onManualRefresh }: OverviewProps) {
  const [kpiData, setKpiData] = useState<DashboardKpiData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [localRefreshing, setLocalRefreshing] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(parentLastUpdated || "08:00");
  const [feedbackQuestion, setFeedbackQuestion] = useState<TopQuestion | null>(null);
  const [checkingFaqId, setCheckingFaqId] = useState<string | null>(null);
  const [selectedTopQuestion, setSelectedTopQuestion] = useState<TopQuestion | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [topQuestionSearch, setTopQuestionSearch] = useState("");
  const [urgentAlertRows, setUrgentAlertRows] = useState<UrgentAlert[]>([]);
  const [alertLoadState, setAlertLoadState] = useState<DetailLoadState>("loading");
  const [alertLoadError, setAlertLoadError] = useState("");
  const [topQuestionRows, setTopQuestionRows] = useState<TopQuestion[]>([]);
  const [topQuestionsStatus, setTopQuestionsStatus] = useState<string>("ok");
  const [topQuestionsMessage, setTopQuestionsMessage] = useState("");
  const [topQuestionsLoadState, setTopQuestionsLoadState] = useState<DetailLoadState>("loading");
  const [topQuestionsLoadError, setTopQuestionsLoadError] = useState("");
  const [priorityConversationRows, setPriorityConversationRows] = useState<PriorityConversation[]>([]);
  const [priorityLoadState, setPriorityLoadState] = useState<PriorityLoadState>("loading");
  const [priorityLoadError, setPriorityLoadError] = useState("");
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
  const [detailReadyFilterKey, setDetailReadyFilterKey] = useState("");
  const [trendValues, setTrendValues] = useState<DashboardKpiData["trends"] | null>(null);
  const [trendLoadState, setTrendLoadState] = useState<DetailLoadState>("loading");

  const { settings } = useSettings();

  const filterRequestKey = useMemo(() => JSON.stringify({
    dateRange: filters.dateRange,
    customDateFrom: filters.customDateFrom || "",
    customDateTo: filters.customDateTo || "",
    channel: filters.channel,
    topic: filters.topic,
    conversationStatus: filters.conversationStatus,
    aiStatus: filters.aiStatus,
  }), [
    filters.dateRange,
    filters.customDateFrom,
    filters.customDateTo,
    filters.channel,
    filters.topic,
    filters.conversationStatus,
    filters.aiStatus,
  ]);

  const isSourceEnabled = (channelName: string) => {
    if (channelName.includes("Zalo Business") && !settings.dataSourceZaloBiz) return false;
    if (channelName.includes("Facebook") && !settings.dataSourceFb) return false;
    if (channelName.includes("Zalo OA") && !settings.dataSourceZalo) return false;
    if (channelName.includes("Widget") && !settings.dataSourceWidget) return false;
    return true;
  };

  const isTopicMatched = (rowTopic: string | undefined) => {
    if (!filters.topic || filters.topic === "Tất cả") return true;
    const expectedGroupId = mapTopicToGroupId(filters.topic);
    const rowTopicId = mapTopicToGroupId(rowTopic || "");
    return rowTopicId === expectedGroupId;
  };

  const urgentAlerts = urgentAlertRows.filter(a => isSourceEnabled(a.channel || "") && isTopicMatched(a.topic));
  const topQuestions = topQuestionRows.filter(q => isTopicMatched(q.topic));
  const isTopQuestionsAiOverloaded = topQuestionsStatus === "ai_overloaded";
  const priorityConversations = priorityConversationRows.filter(c => isSourceEnabled(c.channel || "") && isTopicMatched(c.topic));
  const visiblePriorityConversations = priorityConversations.slice(0, PRIORITY_CONVERSATION_LIMIT);

  const overtimeAlerts = urgentAlerts.filter(a => a.type === "overtime");
  const aiAlerts = urgentAlerts.filter(a => a.type === "ai_uncertain" || a.type === "ai_no_data");

  const loadDashboardData = useCallback(async (isRefreshCall = false) => {
    try {
      if (isRefreshCall) {
        setLocalRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setDetailReadyFilterKey("");
      setTrendValues(null);
      setTrendLoadState("loading");

      // 1. Chuyển đổi bộ lọc ngày sang query params
      const dateParams = getDateParamsFromFilters(filters);

      // Validate khoảng ngày tùy chỉnh
      if (filters.dateRange === "Tùy chỉnh" && filters.customDateFrom && filters.customDateTo) {
        if (new Date(filters.customDateFrom) > new Date(filters.customDateTo)) {
          toast.error("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
          setLoading(false);
          setLocalRefreshing(false);
          return;
        }
      }

      // 2. Gọi API thực tế
      const data = await getDashboardKpi({
        ...dateParams,
        channel: filters.channel,
        topic: filters.topic,
        conversationStatus: filters.conversationStatus,
        aiStatus: filters.aiStatus,
        forceRefresh: isRefreshCall,
        includePriorityConversations: false,
        includeUrgentAlerts: false,
        includeTopQuestions: false,
        includeTrendComparison: false,
      });
      setKpiData(data);
      setDetailReadyFilterKey(filterRequestKey);

      const now = new Date();
      setLastUpdatedTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    } catch (err: any) {
      console.error(err);
      setDetailReadyFilterKey("");
      setError(err.message || "Không thể tải dữ liệu Dashboard. Vui lòng thử lại.");
    } finally {
      setLoading(false);
      setLocalRefreshing(false);
    }
  }, [filters, filterRequestKey]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function loadTrendComparison() {
      setTrendValues(null);

      let dateParams: ReturnType<typeof getDateParamsFromFilters>;
      try {
        dateParams = getDateParamsFromFilters(filters);
      } catch {
        setTrendLoadState("error");
        return;
      }

      if (!kpiData || detailReadyFilterKey !== filterRequestKey) {
        setTrendLoadState("loading");
        return;
      }

      for (let attempt = 0; attempt < DETAIL_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = DETAIL_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          setTrendLoadState("retrying");
          await sleep(delay);
          if (cancelled) return;
        } else {
          setTrendLoadState("loading");
        }

        activeController = new AbortController();
        try {
          const previous = await getDashboardKpiComparison({
            ...dateParams,
            channel: filters.channel,
            topic: filters.topic,
            conversationStatus: filters.conversationStatus,
            aiStatus: filters.aiStatus,
            signal: activeController.signal,
          });
          if (cancelled) return;
          setTrendValues({
            totalConversations: calcTrend(kpiData.totalConversations, previous.totalConversations),
            totalMessages: calcTrend(kpiData.totalMessages, previous.totalMessages),
            activeConversations: calcTrend(kpiData.statusSummary.pending || 0, previous.activeConversations),
            closedConversations: calcTrend(kpiData.statusSummary.closed || 0, previous.closedConversations),
            aiFailures: calcTrend(kpiData.aiFailures || 0, previous.aiFailures),
          });
          setTrendLoadState("ready");
          return;
        } catch (error: any) {
          if (cancelled || error?.name === "AbortError") return;
          if (attempt === DETAIL_RETRY_DELAYS_MS.length - 1) {
            setTrendLoadState("error");
            return;
          }
          setTrendLoadState("retrying");
        }
      }
    }

    loadTrendComparison();
    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [filters, detailRefreshVersion, detailReadyFilterKey, filterRequestKey, kpiData]);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function loadUrgentAlerts() {
      setUrgentAlertRows([]);
      setAlertLoadError("");

      let dateParams: ReturnType<typeof getDateParamsFromFilters>;
      try {
        dateParams = getDateParamsFromFilters(filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bộ lọc ngày không hợp lệ.";
        setAlertLoadState("error");
        setAlertLoadError(message);
        return;
      }

      if (detailReadyFilterKey !== filterRequestKey) {
        setAlertLoadState("loading");
        return;
      }

      for (let attempt = 0; attempt < DETAIL_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = DETAIL_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          setAlertLoadState("retrying");
          await sleep(delay);
          if (cancelled) return;
        } else {
          setAlertLoadState("loading");
        }

        activeController = new AbortController();
        try {
          const rows = await getDashboardUrgentAlerts({
            ...dateParams,
            channel: filters.channel,
            topic: filters.topic,
            conversationStatus: filters.conversationStatus,
            aiStatus: filters.aiStatus,
            signal: activeController.signal,
          });
          if (cancelled) return;
          setUrgentAlertRows(rows);
          setAlertLoadState("ready");
          setAlertLoadError("");
          return;
        } catch (error: any) {
          if (cancelled || error?.name === "AbortError") return;
          const message = error?.message || "Không thể tải cảnh báo chi tiết theo bộ lọc này.";
          setAlertLoadError(message);
          if (attempt === DETAIL_RETRY_DELAYS_MS.length - 1) {
            setAlertLoadState("error");
            return;
          }
          setAlertLoadState("retrying");
        }
      }
    }

    loadUrgentAlerts();
    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [filters, detailRefreshVersion, detailReadyFilterKey, filterRequestKey]);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function loadTopQuestions() {
      setTopQuestionRows([]);
      setTopQuestionsStatus("ok");
      setTopQuestionsMessage("");
      setTopQuestionsLoadError("");

      let dateParams: ReturnType<typeof getDateParamsFromFilters>;
      try {
        dateParams = getDateParamsFromFilters(filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bộ lọc ngày không hợp lệ.";
        setTopQuestionsLoadState("error");
        setTopQuestionsLoadError(message);
        return;
      }

      if (detailReadyFilterKey !== filterRequestKey) {
        setTopQuestionsLoadState("loading");
        return;
      }

      for (let attempt = 0; attempt < DETAIL_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = DETAIL_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          setTopQuestionsLoadState("retrying");
          await sleep(delay);
          if (cancelled) return;
        } else {
          setTopQuestionsLoadState("loading");
        }

        activeController = new AbortController();
        try {
          const data = await getDashboardTopQuestions({
            ...dateParams,
            channel: filters.channel,
            topic: filters.topic,
            forceRefresh: detailRefreshVersion > 0,
            signal: activeController.signal,
          });
          if (cancelled) return;
          setTopQuestionRows(data.topQuestions);
          setTopQuestionsStatus(data.topQuestionsStatus);
          setTopQuestionsMessage(data.topQuestionsMessage);
          setTopQuestionsLoadState("ready");
          setTopQuestionsLoadError("");
          return;
        } catch (error: any) {
          if (cancelled || error?.name === "AbortError") return;
          const message = error?.message || "Không thể tải câu hỏi nổi bật theo bộ lọc này.";
          setTopQuestionsLoadError(message);
          if (attempt === DETAIL_RETRY_DELAYS_MS.length - 1) {
            setTopQuestionsLoadState("error");
            return;
          }
          setTopQuestionsLoadState("retrying");
        }
      }
    }

    loadTopQuestions();
    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [filters, detailRefreshVersion, detailReadyFilterKey, filterRequestKey]);

  useEffect(() => {
    let cancelled = false;
    let activeController: AbortController | null = null;

    async function loadPriorityConversations() {
      setPriorityConversationRows([]);
      setPriorityLoadError("");

      let dateParams: ReturnType<typeof getDateParamsFromFilters>;
      try {
        dateParams = getDateParamsFromFilters(filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bộ lọc ngày không hợp lệ.";
        setPriorityLoadState("error");
        setPriorityLoadError(message);
        return;
      }

      if (detailReadyFilterKey !== filterRequestKey) {
        setPriorityLoadState("loading");
        return;
      }

      for (let attempt = 0; attempt < PRIORITY_RETRY_DELAYS_MS.length; attempt += 1) {
        const delay = PRIORITY_RETRY_DELAYS_MS[attempt];
        if (delay > 0) {
          setPriorityLoadState("retrying");
          await sleep(delay);
          if (cancelled) return;
        } else {
          setPriorityLoadState("loading");
        }

        activeController = new AbortController();
        try {
          const rows = await getDashboardPriorityConversations({
            ...dateParams,
            channel: filters.channel,
            topic: filters.topic,
            conversationStatus: filters.conversationStatus,
            aiStatus: filters.aiStatus,
            limit: PRIORITY_CONVERSATION_LIMIT,
            signal: activeController.signal,
          });
          if (cancelled) return;
          setPriorityConversationRows(rows);
          setPriorityLoadState("ready");
          setPriorityLoadError("");
          return;
        } catch (error: any) {
          if (cancelled || error?.name === "AbortError") return;
          const message = error?.message || "Không thể tải hội thoại ưu tiên theo bộ lọc này.";
          setPriorityLoadError(message);
          if (attempt === PRIORITY_RETRY_DELAYS_MS.length - 1) {
            setPriorityLoadState("error");
            return;
          }
          setPriorityLoadState("retrying");
        }
      }
    }

    loadPriorityConversations();
    return () => {
      cancelled = true;
      activeController?.abort();
    };
  }, [filters, detailRefreshVersion, detailReadyFilterKey, filterRequestKey]);

  const handleManualRefresh = () => {
    if (onManualRefresh) {
      onManualRefresh();
    }
    loadDashboardData(true);
    setDetailRefreshVersion((version) => version + 1);
    toast.success("Đang làm mới dữ liệu...");
  };

  const removeClosedConversationFromState = useCallback((target: CloseConversationTarget) => {
    const targetConversationId = Number(target.conversationId);
    const hasConversationId = Number.isInteger(targetConversationId) && targetConversationId > 0;
    const normalizedCustomer = String(target.customerId || "").trim();
    const normalizedSource = normalizeSourceForCompare(target.source || undefined);
    if (!hasConversationId && (!normalizedCustomer || !normalizedSource)) return;

    setKpiData((current) => {
      if (!current) return current;
      return {
        ...current,
        urgentAlerts: [],
        priorityConversations: [],
      };
    });
    setUrgentAlertRows((current) => current.filter((alert) => {
      if (hasConversationId && Number(alert.conversationId) === targetConversationId) return false;
      const alertSource = normalizeSourceForCompare(alert.raw_source || alert.channel);
      return !(String(alert.customer || "").trim() === normalizedCustomer && alertSource === normalizedSource);
    }));
    setPriorityConversationRows((current) => current.filter((conversation) => {
      if (hasConversationId && Number(conversation.conversationId) === targetConversationId) return false;
      const conversationSource = normalizeSourceForCompare(conversation.source || conversation.channel);
      return !(String(conversation.customerId || conversation.customer || "").trim() === normalizedCustomer && conversationSource === normalizedSource);
    }));
  }, []);

  const handleCloseConversation = useCallback(async (target: CloseConversationTarget) => {
    await closeConversation(target);
    removeClosedConversationFromState(target);
    loadDashboardData(true);
    setDetailRefreshVersion((version) => version + 1);
  }, [loadDashboardData, removeClosedConversationFromState]);

  const retryPriorityConversations = useCallback(() => {
    setDetailRefreshVersion((version) => version + 1);
  }, []);

  const retryDetailSections = useCallback(() => {
    setDetailRefreshVersion((version) => version + 1);
  }, []);

  const openTopQuestionDetails = (question: TopQuestion) => {
    setSelectedTopQuestion(question);
    setDetailSearch("");
  };

  const openTopQuestionFaq = async (question: TopQuestion) => {
    try {
      setCheckingFaqId(question.question);
      const duplicates = await getSheetChatbotDuplicates(question.question, 0.8, 1);
      if (duplicates && duplicates.length > 0) {
        toast.info("Đã tồn tại trong thư viện phản hồi");
        return;
      }
      setFeedbackQuestion(question);
    } catch (e: any) {
      toast.error(e.message || "Lỗi kiểm tra thư viện phản hồi");
    } finally {
      setCheckingFaqId(null);
    }
  };

  const detailQuestions = useMemo(() => {
    if (!selectedTopQuestion) return [];
    const rows = selectedTopQuestion.relatedQuestions?.length
      ? selectedTopQuestion.relatedQuestions
      : [{ question: selectedTopQuestion.question, count: selectedTopQuestion.count }];
    const needle = detailSearch.trim().toLocaleLowerCase("vi-VN");
    if (!needle) return rows;
    return rows.filter((row) => row.question.toLocaleLowerCase("vi-VN").includes(needle));
  }, [selectedTopQuestion, detailSearch]);

  const visibleTopQuestions = useMemo(() => {
    const needle = normalizeQuestionSearchText(topQuestionSearch);
    if (!needle) return topQuestions.slice(0, 5);
    return topQuestions.filter((question) => normalizeQuestionSearchText(question.question).includes(needle));
  }, [topQuestions, topQuestionSearch]);

  const isScreenRefreshing = parentRefreshing || localRefreshing;

  const dailyTrends = kpiData?.dailyTrends || [];

  const renderLoadingOrError = () => {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={() => loadDashboardData()} />;
    return null;
  };

  const nonDataState = renderLoadingOrError();

  if (nonDataState) {
    return (
      <div style={{ padding: "24px" }}>
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
        {nonDataState}
      </div>
    );
  }

  if (kpiData && kpiData.totalConversations === 0) {
    return (
      <div style={{ padding: "24px" }}>
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
        <EmptyState />
      </div>
    );
  }

  // 3. Tính toán các chỉ số phái sinh
  const activeConversations = kpiData?.statusSummary.pending || 0;

  let totalConversations = kpiData?.totalConversations || 0;
  let totalMessages = kpiData?.totalMessages || 0;

  // Lọc tổng số theo kênh đang bật
  if (kpiData) {
    const hasSourceBreakdown = Object.values(kpiData.sourceSummary).some((value) => value > 0);
    const hasMessageBreakdown = Object.values(kpiData.messageSummary).some((value) => value > 0);

    if (hasSourceBreakdown) totalConversations = 0;
    if (hasMessageBreakdown) totalMessages = 0;

    if (settings.dataSourceZaloBiz && hasSourceBreakdown) {
      totalConversations += kpiData.sourceSummary.ZaloBusiness || 0;
    }
    if (settings.dataSourceZaloBiz && hasMessageBreakdown) {
      totalMessages += kpiData.messageSummary.ZaloBusiness || 0;
    }
    if (settings.dataSourceFb && hasSourceBreakdown) {
      totalConversations += kpiData.sourceSummary.Facebook || 0;
    }
    if (settings.dataSourceFb && hasMessageBreakdown) {
      totalMessages += kpiData.messageSummary.Facebook || 0;
    }
    if (settings.dataSourceZalo && hasSourceBreakdown) {
      totalConversations += kpiData.sourceSummary.ZaloOA || 0;
    }
    if (settings.dataSourceZalo && hasMessageBreakdown) {
      totalMessages += kpiData.messageSummary.ZaloOA || 0;
    }
    if (settings.dataSourceWidget && hasSourceBreakdown) {
      totalConversations += kpiData.sourceSummary.ChatWidget || 0;
    }
    if (settings.dataSourceWidget && hasMessageBreakdown) {
      totalMessages += kpiData.messageSummary.ChatWidget || 0;
    }
  }

  const trendStatusText =
    trendLoadState === "loading"
      ? "Đang tính xu hướng..."
      : trendLoadState === "retrying"
        ? "Đang thử lại xu hướng..."
        : trendLoadState === "error"
          ? "Chưa tính được xu hướng"
          : undefined;

  const kpiList = [
    {
      title: "Tổng hội thoại",
      value: viNum(totalConversations),
      icon: MessageSquare,
      change: trendValues?.totalConversations,
      changeLabel: trendStatusText,
      isWarning: false
    },
    {
      title: "Tổng tin nhắn khách hàng",
      value: viNum(totalMessages),
      icon: MessageCircle,
      change: trendValues?.totalMessages,
      changeLabel: trendStatusText,
      isWarning: false
    },
    {
      title: "Chờ xử lý",
      value: viNum(activeConversations),
      icon: AlertTriangle,
      change: trendValues?.activeConversations,
      changeLabel: trendStatusText,
      isWarning: true
    },
    {
      title: "AI phản hồi thất bại",
      value: viNum(kpiData?.aiFailures || 0),
      icon: XCircle,
      change: trendValues?.aiFailures,
      changeLabel: trendStatusText,
      isWarning: true
    },
  ];

  // Thống kê theo kênh trên bảng phụ dưới biểu đồ
  const sourceStats = [];
  if (settings.dataSourceZaloBiz) sourceStats.push({ name: "Zalo Business", hoiday: kpiData?.sourceSummary.ZaloBusiness || 0, tinnan: kpiData?.messageSummary.ZaloBusiness || 0 });
  if (settings.dataSourceFb) sourceStats.push({ name: "Facebook", hoiday: kpiData?.sourceSummary.Facebook || 0, tinnan: kpiData?.messageSummary.Facebook || 0 });
  if (settings.dataSourceZalo) sourceStats.push({ name: "Zalo OA", hoiday: kpiData?.sourceSummary.ZaloOA || 0, tinnan: kpiData?.messageSummary.ZaloOA || 0 });
  if (settings.dataSourceWidget) sourceStats.push({ name: "Chat Widget", hoiday: kpiData?.sourceSummary.ChatWidget || 0, tinnan: kpiData?.messageSummary.ChatWidget || 0 });
  const reportGeneratedAt = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  const reportDateRange = kpiData?.dateRange?.startDate && kpiData?.dateRange?.endDate
    ? `${kpiData.dateRange.startDate} - ${kpiData.dateRange.endDate}`
    : filters.dateRange;
  const reportStatusRows = [
    { label: "Chờ xử lý", value: kpiData?.statusSummary.pending || 0, color: "#D73C01" },
    { label: "Đang tư vấn", value: kpiData?.statusSummary.open || 0, color: "#003BB9" },
    { label: "Hoàn thành", value: kpiData?.statusSummary.closed || 0, color: "#1565C0" },
  ];
  const maxStatusValue = Math.max(...reportStatusRows.map((row) => row.value), 1);
  const maxSourceValue = Math.max(...sourceStats.map((row) => row.hoiday), 1);
  const reportTrends = dailyTrends.slice(-8);
  const maxTrendValue = Math.max(...reportTrends.map((row: any) => row.total || 0), 1);
  const reportAlerts = urgentAlerts.slice(0, 6);
  const reportTopQuestions = topQuestions.slice(0, 5);
  const reportPriorityConversations = priorityConversations.slice(0, 6);
  const getExportData = async () => {
    const datasets: any[] = [];

    // 1. Tổng quan
    datasets.push({
      title: "Tổng quan KPI",
      headers: ["Chỉ số", "Giá trị"],
      rows: [
        ["Tổng hội thoại", String(kpiData?.totalConversations || 0)],
        ["Tổng tin nhắn khách hàng", String(kpiData?.totalMessages || 0)],
        ["Chờ xử lý", String(kpiData?.statusSummary?.pending || 0)],
        ["Đang tư vấn", String(kpiData?.statusSummary?.open || 0)],
        ["Hoàn thành", String(kpiData?.statusSummary?.closed || 0)],
        ["AI phản hồi thất bại", String(kpiData?.aiFailures || 0)]
      ]
    });

    // 2. Tình trạng xử lý
    datasets.push({
      title: "Tình trạng xử lý",
      headers: ["Trạng thái", "Số lượng", "Tỷ lệ (%)"],
      rows: reportStatusRows.map(r => [r.label, String(r.value), `${((r.value / maxStatusValue) * 100).toFixed(1)}%`])
    });

    // 3. Phân bổ theo kênh
    datasets.push({
      title: "Phân bổ theo kênh",
      headers: ["Kênh", "Hội thoại", "Tin nhắn"],
      rows: sourceStats.map(s => [s.name, String(s.hoiday), String(s.tinnan)])
    });

    // 4. Xu hướng 
    datasets.push({
      title: "Xu hướng hội thoại",
      headers: ["Ngày", "Tổng hội thoại"],
      rows: dailyTrends.map((d: any) => [d.date, String(d.total)])
    });

    // 5. Câu hỏi nổi bật
    // Fetch top questions with larger limit if possible, or use state
    datasets.push({
      title: "Câu hỏi nổi bật",
      headers: ["Chủ đề", "Số lượng"],
      rows: topQuestionRows.map(q => [q.question, String(q.count)])
    });

    // 6. Hội thoại ưu tiên (Fetch all pending)
    let fullPriority = priorityConversationRows;
    let loadingToastId: string | number | undefined;
    try {
      loadingToastId = toast.loading("Đang tải toàn bộ hội thoại ưu tiên...");
      let dateParams = getDateParamsFromFilters(filters);
      const rows = await getDashboardPriorityConversations({
        ...dateParams,
        channel: filters.channel,
        topic: filters.topic,
        conversationStatus: filters.conversationStatus,
        aiStatus: filters.aiStatus,
        limit: 1000,
        signal: undefined,
      });
      fullPriority = rows;
      toast.dismiss(loadingToastId);
    } catch (error) {
      if (loadingToastId) toast.dismiss(loadingToastId);
      toast.warning("Không thể tải toàn bộ hội thoại ưu tiên, sử dụng dữ liệu hiển thị.");
    }

    datasets.push({
      title: "Hội thoại ưu tiên",
      headers: ["Khách hàng", "Nội dung gần nhất", "Kênh", "Mức độ ưu tiên"],
      rows: fullPriority.map(c => [
        (c.customer || "") + (c.customerId ? ` (${c.customerId})` : ""),
        c.lastMessage || "",
        c.source || "",
        c.priority || ""
      ])
    });

    return datasets;
  };

  return (
    <div style={{ padding: "24px" }} data-export-target="true">
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Bộ lọc Panel */}
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} getExportData={getExportData} isLoading={loading || localRefreshing || alertLoadState !== "ready" || topQuestionsLoadState !== "ready" || priorityLoadState !== "ready"} />

      <div aria-hidden="true" style={{ position: "absolute", left: "-12000px", top: 0, width: "1120px", pointerEvents: "none" }}>
        <section
          data-pdf-report="overview"
          style={{
            width: "1120px",
            background: "#ffffff",
            color: "#003865",
            fontFamily: "Arial, sans-serif",
            padding: "28px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", borderBottom: "3px solid #ED5206", paddingBottom: "18px", marginBottom: "20px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", color: "#ED5206", marginBottom: "7px" }}>FLIC WEBCHAT CSKH</div>
              <h1 style={{ margin: 0, fontSize: "27px", lineHeight: 1.2, color: "#003865", fontWeight: 800 }}>Báo cáo tổng quan hệ thống</h1>
              <p style={{ margin: "7px 0 0", fontSize: "13px", color: "rgba(0,56,101,0.62)" }}>Dashboard vận hành WebChat CSKH và chất lượng chatbot AI</p>
            </div>
            <div style={{ minWidth: "260px", background: "#F8FAFC", border: "1px solid rgba(0,56,101,0.1)", borderRadius: "10px", padding: "13px 15px" }}>
              <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.5)", fontWeight: 700, textTransform: "uppercase", marginBottom: "7px" }}>Thông tin báo cáo</div>
              <div style={{ fontSize: "12px", lineHeight: 1.8, color: "#003865" }}>
                <div><strong>Ngày xuất:</strong> {reportGeneratedAt}</div>
                <div><strong>Khoảng dữ liệu:</strong> {reportDateRange}</div>
                <div><strong>Kênh:</strong> {filters.channel}</div>
                <div><strong>Chủ đề:</strong> {filters.topic}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "18px" }}>
            {[
              { label: "Tổng hội thoại", value: viNum(totalConversations), color: "#003BB9" },
              { label: "Tổng tin nhắn khách hàng", value: viNum(totalMessages), color: "#003865" },
              { label: "Chờ xử lý", value: viNum(activeConversations), color: "#D73C01" },
              { label: "AI thất bại", value: viNum(kpiData?.aiFailures || 0), color: "#B42318" },
            ].map((item) => (
              <div key={item.label} style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "10px", padding: "14px", background: "#FDFEFE" }}>
                <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.55)", fontWeight: 700, textTransform: "uppercase", marginBottom: "7px" }}>{item.label}</div>
                <div style={{ fontSize: "25px", color: item.color, fontWeight: 800, lineHeight: 1 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Xu hướng hội thoại gần đây</h2>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "9px", height: "135px", borderBottom: "1px solid rgba(0,56,101,0.12)", padding: "0 4px 8px" }}>
                {reportTrends.map((row: any, index: number) => {
                  const value = row.total || 0;
                  const height = Math.max(8, Math.round((value / maxTrendValue) * 112));
                  return (
                    <div key={`${row.date || index}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "5px" }}>
                      <div style={{ fontSize: "10px", color: "#003865", fontWeight: 700 }}>{viNum(value)}</div>
                      <div style={{ width: "100%", maxWidth: "28px", height, borderRadius: "6px 6px 0 0", background: "linear-gradient(180deg, #ED5206, #D73C01)" }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "9px", marginTop: "7px" }}>
                {reportTrends.map((row: any, index: number) => (
                  <div key={`${row.date || index}-label`} style={{ flex: 1, textAlign: "center", fontSize: "9px", color: "rgba(0,56,101,0.55)" }}>{row.date || ""}</div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Trạng thái hội thoại</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {reportStatusRows.map((row) => (
                  <div key={row.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "11px", color: "#003865", fontWeight: 700 }}>
                      <span>{row.label}</span>
                      <span>{viNum(row.value)}</span>
                    </div>
                    <div style={{ height: "9px", background: "#EEF3F8", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(4, (row.value / maxStatusValue) * 100)}%`, height: "100%", background: row.color, borderRadius: "999px" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Cảnh báo cần xử lý</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <div style={{ background: "#FFF4EE", border: "1px solid #FBCBB8", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", color: "#D73C01", fontWeight: 800 }}>{alertLoadState === "ready" ? overtimeAlerts.length : "..."}</div>
                  <div style={{ fontSize: "10px", color: "#D73C01", fontWeight: 700 }}>Chờ quá 10 giờ</div>
                </div>
                <div style={{ background: "#FFF7E6", border: "1px solid #FADFA8", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ fontSize: "22px", color: "#B7791F", fontWeight: 800 }}>{alertLoadState === "ready" ? aiAlerts.length : "..."}</div>
                  <div style={{ fontSize: "10px", color: "#B7791F", fontWeight: 700 }}>Cảnh báo AI</div>
                </div>
              </div>
              {alertLoadState !== "ready" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: alertLoadState === "error" ? ORANGE : "rgba(0,56,101,0.62)", lineHeight: 1.45, fontWeight: 700 }}>
                  {alertLoadState === "error" ? (
                    <AlertTriangle size={14} style={{ color: ORANGE }} />
                  ) : (
                    <RefreshCw size={14} style={{ color: "#003BB9", animation: "spin 1s linear infinite" }} />
                  )}
                  <span>
                    {alertLoadState === "loading" && "Đang tải cảnh báo theo bộ lọc..."}
                    {alertLoadState === "retrying" && "Đang thử tải lại cảnh báo theo bộ lọc..."}
                    {alertLoadState === "error" && (alertLoadError || "Chưa tải được cảnh báo theo bộ lọc này.")}
                  </span>
                  {alertLoadState === "error" && (
                    <button
                      type="button"
                      onClick={retryDetailSections}
                      style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: "#003BB9", borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                    >
                      Thử lại
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.62)", lineHeight: 1.45 }}>
                  Tổng cộng <strong>{urgentAlerts.length}</strong> cảnh báo đang cần theo dõi trong phạm vi bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Phân bổ theo kênh</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sourceStats.map((row) => (
                  <div key={row.name} style={{ display: "grid", gridTemplateColumns: "110px 1fr 72px", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "11px", color: "#003865", fontWeight: 700 }}>{row.name}</div>
                    <div style={{ height: "10px", background: "#EEF3F8", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(3, (row.hoiday / maxSourceValue) * 100)}%`, height: "100%", background: "#003BB9", borderRadius: "999px" }} />
                    </div>
                    <div style={{ fontSize: "11px", textAlign: "right", color: "rgba(0,56,101,0.7)" }}>{viNum(row.hoiday)} HT</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", padding: "16px", background: "#fff" }}>
              <h2 style={{ margin: "0 0 13px", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Cảnh báo nổi bật</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {alertLoadState !== "ready" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px", color: alertLoadState === "error" ? ORANGE : "rgba(0,56,101,0.62)", fontWeight: 700 }}>
                    {alertLoadState === "error" ? (
                      <AlertTriangle size={14} style={{ color: ORANGE }} />
                    ) : (
                      <RefreshCw size={14} style={{ color: "#003BB9", animation: "spin 1s linear infinite" }} />
                    )}
                    <span>
                      {alertLoadState === "loading" && "Đang tải cảnh báo nổi bật..."}
                      {alertLoadState === "retrying" && "Đang thử tải lại cảnh báo nổi bật..."}
                      {alertLoadState === "error" && (alertLoadError || "Chưa tải được cảnh báo nổi bật.")}
                    </span>
                    {alertLoadState === "error" && (
                      <button
                        type="button"
                        onClick={retryDetailSections}
                        style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: "#003BB9", borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                      >
                        Thử lại
                      </button>
                    )}
                  </div>
                ) : reportAlerts.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.55)" }}>Không có cảnh báo trong phạm vi dữ liệu này.</div>
                ) : reportAlerts.map((alert) => (
                  <div key={alert.id} style={{ borderLeft: "3px solid #D73C01", padding: "7px 9px", background: "#FFFDFB", borderRadius: "7px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "3px" }}>
                      <span style={{ fontSize: "11px", color: "#003BB9", fontWeight: 800 }}>{alert.title}</span>
                      <span style={{ fontSize: "10px", color: "#D73C01", fontWeight: 700, whiteSpace: "nowrap" }}>{alert.waitTime}</span>
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(0,56,101,0.62)" }}><ChannelLabel channel={alert.channel} badge={false} /> · <TopicLabel topic={alert.topic} badge={false} /> · ID {alert.customer}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,56,101,0.08)", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Top câu hỏi khách hàng</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["#", "Câu hỏi", "Chủ đề", "Lần"].map((h) => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "rgba(0,56,101,0.55)", fontWeight: 800 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportTopQuestions.map((question, index) => (
                    <tr key={`${question.question}-${index}`} style={{ borderTop: "1px solid rgba(0,56,101,0.06)" }}>
                      <td style={{ padding: "9px 10px", color: "rgba(0,56,101,0.45)", fontWeight: 800 }}>#{index + 1}</td>
                      <td style={{ padding: "9px 10px", color: "#003865" }}>{question.question}</td>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}><TopicLabel topic={question.topic} badge={false} /></td>
                      <td style={{ padding: "9px 10px", color: "#003BB9", fontWeight: 800 }}>{question.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ border: "1px solid rgba(0,56,101,0.1)", borderRadius: "12px", overflow: "hidden", background: "#fff" }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,56,101,0.08)", fontSize: "15px", color: "#003BB9", fontWeight: 800 }}>Hội thoại ưu tiên (hiển thị {priorityConversations.length}/{activeConversations} chờ xử lý)</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["ID", "Kênh", "Chủ đề", "Chờ", "Ưu tiên"].map((h) => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", color: "rgba(0,56,101,0.55)", fontWeight: 800 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportPriorityConversations.map((conversation) => (
                    <tr key={conversation.id} style={{ borderTop: "1px solid rgba(0,56,101,0.06)" }}>
                      <td style={{ padding: "9px 10px", color: "rgba(0,56,101,0.65)", fontFamily: "monospace" }}>{conversation.id}</td>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}><ChannelLabel channel={conversation.channel} /></td>
                      <td style={{ padding: "9px 10px" }}><TopicLabel topic={conversation.topic} badge={false} /></td>
                      <td style={{ padding: "9px 10px", color: conversation.isOvertime ? "#D73C01" : "rgba(0,56,101,0.65)", whiteSpace: "nowrap", fontWeight: conversation.isOvertime ? 800 : 600 }}>{conversation.wait}</td>
                      <td style={{ padding: "9px 10px", color: "#D73C01", whiteSpace: "nowrap", fontWeight: 800 }}>{conversation.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: "18px", paddingTop: "12px", borderTop: "1px solid rgba(0,56,101,0.1)", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(0,56,101,0.45)" }}>
            <span>Báo cáo tự động từ Dashboard WebChat CSKH FLIC</span>
            <span>Trang dữ liệu tổng quan</span>
          </div>
        </section>
      </div>

      <div style={{ backgroundColor: "transparent" }}>
        {/* Label đầu trang */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "4px", height: "22px", borderRadius: "2px", background: `linear-gradient(180deg, ${ORANGE}, #ED5206)` }} />
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#003BB9", margin: 0 }}>Tổng quan hệ thống</h2>
          </div>
          <p style={{ fontSize: "12px", color: "rgba(0,59,185,0.5)", marginLeft: "14px", marginTop: "4px" }}>Theo dõi hoạt động WebChat CSKH và chất lượng chatbot AI</p>
        </div>

        {/* Live Indicator & Làm mới thủ công */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#228A61", animation: "glowPulse 2s ease-in-out infinite" }} />
              <span style={{ fontSize: "12px", color: "#228A61", fontWeight: 600 }}>Trực tiếp</span>
            </div>
            <span style={{ fontSize: "12px", color: "rgba(0,59,185,0.5)" }}>Cập nhật gần nhất: {lastUpdatedTime} hôm nay</span>
            <span style={{ fontSize: "11px", color: "rgba(0,59,185,0.35)" }}>· Tự động cập nhật mỗi 30 phút</span>
            <span style={{ fontSize: "11px", color: "rgba(0,59,185,0.35)" }}>
            </span>
            {isScreenRefreshing && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <RefreshCw size={12} style={{ color: ORANGE, animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "11px", color: ORANGE, fontWeight: 600 }}>Đang cập nhật...</span>
              </div>
            )}
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isScreenRefreshing}
            style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid rgba(0,59,185,0.12)", background: "#fff", color: "#003BB9", cursor: isScreenRefreshing ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", opacity: isScreenRefreshing ? 0.6 : 1, flexShrink: 0 }}
          >
            <RefreshCw size={12} style={{ animation: isScreenRefreshing ? "spin 1s linear infinite" : "none" }} /> Làm mới
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px", marginBottom: "20px" }}>
          {kpiList.map((kpi) => (
            <KpiCard
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              icon={kpi.icon}
              change={kpi.change}
              changeLabel={kpi.changeLabel}
              isWarning={kpi.isWarning}
            />
          ))}
        </div>

        {/* Row biểu đồ 1: Đường xu hướng và Phân bổ kênh nguồn */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
          <ChartCard
            title="Số lượng hội thoại theo thời gian"
            onOpenBuilder={() => onNavigate("chartbuilder")}
            data={dailyTrends}
            defaultChartType="line"
            defaultAxisX="Ngày"
            supportedChartTypes={["line", "area", "bar", "hbar"]}
            baseFilters={filters}
            axisOptions={["Ngày"]}
            valueOptions={["Số hội thoại", "AI phản hồi thành công", "AI phản hồi thất bại"]}
          >
            {({ chartType, chartData, editValues }: any) => {
              const valueKey =
                editValues.values === "AI phản hồi thành công"
                  ? "ai_ok"
                  : editValues.values === "AI phản hồi thất bại"
                    ? "ai_fail"
                    : "total";

              const nameKey = "date";

              const sortedData = [...chartData];
              if (editValues.sort === "Tăng dần") {
                sortedData.sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));
              } else if (editValues.sort === "Giảm dần") {
                sortedData.sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
              } else if (editValues.sort === "A-Z") {
                sortedData.sort((a, b) => String(a[nameKey] || "").localeCompare(String(b[nameKey] || "")));
              }

              const renderChart = () => {
                if (chartType === "donut" || chartType === "pie") {
                  const pieData = sortedData
                    .filter((d) => d[valueKey] !== null)
                    .map((d) => ({ name: d[nameKey], value: d[valueKey] }));
                  return (
                    <PieChart id="pie-chart-trend">
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={chartType === "donut" ? 50 : 0}
                        outerRadius={80}
                        dataKey="value"
                        label={editValues.dataLabels}
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`pie-cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                    </PieChart>
                  );
                }

                if (chartType === "bar") {
                  return (
                    <BarChart id="bar-chart-trend" data={sortedData}>
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Bar
                        dataKey={valueKey}
                        name={
                          valueKey === "total"
                            ? "Số lượng hội thoại"
                            : valueKey === "ai_ok"
                              ? "AI phản hồi thành công"
                              : "AI phản hồi thất bại"
                        }
                        fill="#003BB9"
                        radius={[4, 4, 0, 0]}
                        label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined}
                      />

                    </BarChart>
                  );
                }

                if (chartType === "hbar") {
                  return (
                    <BarChart id="hbar-chart-trend" data={sortedData} layout="vertical">
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <YAxis dataKey={nameKey} type="category" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} width={40} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Bar
                        dataKey={valueKey}
                        name={
                          valueKey === "total"
                            ? "Số lượng hội thoại"
                            : valueKey === "ai_ok"
                              ? "AI phản hồi thành công"
                              : "AI phản hồi thất bại"
                        }
                        fill="#003BB9"
                        radius={[0, 4, 4, 0]}
                        label={editValues.dataLabels ? { position: "right", fontSize: 10 } : undefined}
                      />

                    </BarChart>
                  );
                }

                if (chartType === "area") {
                  return (
                    <AreaChart id="area-chart-trend" data={sortedData}>
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Area
                        type="monotone"
                        dataKey={valueKey}
                        name={
                          valueKey === "total"
                            ? "Số lượng hội thoại"
                            : valueKey === "ai_ok"
                              ? "AI phản hồi thành công"
                              : "AI phản hồi thất bại"
                        }
                        stroke="#003BB9"
                        fill="rgba(0,59,185,0.2)"
                        strokeWidth={2}
                        label={editValues.dataLabels}
                      />

                    </AreaChart>
                  );
                }

                // Default: line chart
                return (
                  <LineChart data={sortedData}>
                    <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Line
                      type="monotone"
                      dataKey={valueKey}
                      name={
                        valueKey === "total"
                          ? "Số lượng hội thoại"
                          : valueKey === "ai_ok"
                            ? "AI phản hồi thành công"
                            : "AI phản hồi thất bại"
                      }
                      stroke="#003BB9"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls={false}
                      label={editValues.dataLabels}
                    />

                  </LineChart>
                );
              };

              return (
                <ResponsiveContainer width="100%" height={220}>
                  {renderChart()}
                </ResponsiveContainer>
              );
            }}
          </ChartCard>

          <ChartCard
            title="Phân bổ theo kênh nguồn"
            onOpenBuilder={() => onNavigate("chartbuilder")}
            data={kpiData?.sourceSummary || {}}
            defaultChartType="donut"
            defaultAxisX="Kênh"
            baseFilters={filters}
            axisOptions={["Kênh"]}
            valueOptions={["Số hội thoại"]}
          >
            {({ chartType, chartData, editValues }: any) => {
              const normalizedData: Record<string, number> = {
                ZaloOA: 0,
                ZaloBusiness: 0,
                Facebook: 0,
                ChatWidget: 0,
              };

              Object.entries(chartData || {}).forEach(([key, value]) => {
                const k = key.toLowerCase().trim();
                const val = typeof value === "number" ? value : 0;
                if (k === "zalooa" || k === "zalo") {
                  normalizedData.ZaloOA += val;
                } else if (k === "zalobusiness" || k === "zalobiz") {
                  normalizedData.ZaloBusiness += val;
                } else if (k === "facebook" || k === "fb" || k === "messenger") {
                  normalizedData.Facebook += val;
                } else if (k === "chatwidget" || k === "website" || k === "web") {
                  normalizedData.ChatWidget += val;
                }
              });

              const listData = Object.entries(normalizedData)
                .map(([name, value]) => ({
                  name,
                  value,
                  colorKey: name,
                }))
                .filter((item) => item.value > 0);

              const total = listData.reduce((acc, curr) => acc + curr.value, 0);

              if (total === 0) {
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "220px",
                      color: "rgba(0,59,185,0.4)",
                      fontSize: "13px",
                    }}
                  >
                    Không có dữ liệu kênh nguồn
                  </div>
                );
              }

              if (editValues.sort === "Tăng dần") {
                listData.sort((a, b) => a.value - b.value);
              } else if (editValues.sort === "Giảm dần") {
                listData.sort((a, b) => b.value - a.value);
              } else if (editValues.sort === "A-Z") {
                listData.sort((a, b) => a.name.localeCompare(b.name));
              }

              const renderSourceChart = () => {
                if (chartType === "donut" || chartType === "pie") {
                  return (
                    <PieChart>
                      <Pie
                        data={listData}
                        cx="50%"
                        cy="50%"
                        innerRadius={chartType === "donut" ? 50 : 0}
                        outerRadius={80}
                        dataKey="value"
                        nameKey="name"
                        label={editValues.dataLabels}
                      >
                        {listData.map((entry) => (
                          <Cell
                            key={`cell-source-${entry.colorKey}`}
                            fill={CHANNEL_COLORS[entry.colorKey] || NAVY}
                          />
                        ))}
                      </Pie>
                      <ChartTooltip
                        formatter={(value: number, _name: string, item: any) => [
                          `${value.toLocaleString("vi-VN")} hội thoại (${((value / total) * 100).toFixed(1)}%)`,
                          `Số lượng [${item?.payload?.name || "Kênh"}]`,
                        ]}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid rgba(0,59,185,0.08)",
                          fontFamily: "sans-serif",
                          fontSize: "12px",
                        }}
                      />
                      {editValues.legend && (
                        <Legend
                          iconSize={8}
                          iconType="circle"
                          layout="horizontal"
                          verticalAlign="bottom"
                          wrapperStyle={{ width: "100%", left: 0, display: "flex", justifyContent: "center", whiteSpace: "nowrap" }}
                          formatter={(value) => (
                            <ChannelLabel channel={String(value)} badge={false} weight={400} />
                          )}
                        />
                      )}
                    </PieChart>
                  );
                }

                if (chartType === "bar") {
                  return (
                    <BarChart data={listData}>
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis dataKey="name" tick={<ChannelChartTick />} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Bar
                        dataKey="value"
                        name="Số hội thoại"
                        fill="#003BB9"
                        radius={[4, 4, 0, 0]}
                        label={editValues.dataLabels ? { position: "top", fontSize: 10 } : undefined}
                      >
                        {listData.map((entry) => (
                          <Cell
                            key={`cell-source-bar-${entry.colorKey}`}
                            fill={CHANNEL_COLORS[entry.colorKey] || NAVY}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  );
                }

                if (chartType === "hbar") {
                  return (
                    <BarChart data={listData} layout="vertical">
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <YAxis dataKey="name" type="category" tick={<ChannelChartTick />} width={80} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Bar
                        dataKey="value"
                        name="Số hội thoại"
                        fill="#003BB9"
                        radius={[0, 4, 4, 0]}
                        label={editValues.dataLabels ? { position: "right", fontSize: 10 } : undefined}
                      >
                        {listData.map((entry) => (
                          <Cell
                            key={`cell-source-hbar-${entry.colorKey}`}
                            fill={CHANNEL_COLORS[entry.colorKey] || NAVY}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  );
                }

                if (chartType === "area") {
                  return (
                    <AreaChart data={listData}>
                      <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                      <XAxis dataKey="name" tick={<ChannelChartTick />} />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                      <ChartTooltip />
                      {editValues.legend && <Legend iconSize={10} />}
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Số hội thoại"
                        stroke="#003BB9"
                        fill="rgba(0,59,185,0.2)"
                        strokeWidth={2}
                        label={editValues.dataLabels}
                      />
                    </AreaChart>
                  );
                }

                return (
                  <LineChart data={listData}>
                    <CartesianGrid stroke="rgba(0,59,185,0.06)" />
                    <XAxis dataKey="name" tick={<ChannelChartTick />} />
                    <YAxis tick={{ fontSize: 10, fill: "rgba(0,59,185,0.5)" }} />
                    <ChartTooltip />
                    {editValues.legend && <Legend iconSize={10} />}
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Số hội thoại"
                      stroke="#003BB9"
                      strokeWidth={1.5}
                      dot={false}
                      label={editValues.dataLabels}
                    />
                  </LineChart>
                );
              };

              return (
                <ResponsiveContainer width="100%" height={220}>
                  {renderSourceChart()}
                </ResponsiveContainer>
              );
            }}
          </ChartCard>
        </div>
        {/* Câu hỏi nổi bật (Top Questions) */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden", marginBottom: "24px" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi nổi bật từ khách hàng</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <label style={{ width: "min(320px, 64vw)", display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(0,59,185,0.12)", background: "#fff", borderRadius: "10px", padding: "7px 10px", color: "rgba(0,59,185,0.48)" }}>
                <Search size={14} aria-hidden="true" />
                <input
                  aria-label="Tìm kiếm câu hỏi nổi bật"
                  value={topQuestionSearch}
                  onChange={(event) => setTopQuestionSearch(event.target.value)}
                  placeholder="Tìm câu hỏi nổi bật..."
                  style={{ minWidth: 0, flex: 1, border: "none", outline: "none", color: NAVY, fontSize: "12px", background: "transparent" }}
                />
                {topQuestionSearch && (
                  <button
                    type="button"
                    aria-label="Xóa tìm kiếm câu hỏi nổi bật"
                    onClick={() => setTopQuestionSearch("")}
                    style={{ border: "none", background: "transparent", color: "rgba(0,59,185,0.42)", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                )}
              </label>
              <button onClick={handleManualRefresh} disabled={isScreenRefreshing} style={{ fontSize: "12px", color: "#003BB9", border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", padding: "7px 12px", borderRadius: "8px", cursor: isScreenRefreshing ? "not-allowed" : "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", opacity: isScreenRefreshing ? 0.6 : 1 }}>
                <RefreshCw size={12} style={{ animation: isScreenRefreshing ? "spin 1s linear infinite" : "none" }} /> Làm mới
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {["STT", "Câu hỏi tổng quát", "Số lượng", "Hành động"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topQuestionsLoadState !== "ready" ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px 16px", color: topQuestionsLoadState === "error" ? ORANGE : "rgba(0,59,185,0.62)", fontWeight: 600 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        {topQuestionsLoadState === "error" ? (
                          <AlertTriangle size={14} style={{ color: ORANGE }} />
                        ) : (
                          <RefreshCw size={14} style={{ color: "#003BB9", animation: "spin 1s linear infinite" }} />
                        )}
                        <span>
                          {topQuestionsLoadState === "loading" && "Đang tải câu hỏi nổi bật theo bộ lọc..."}
                          {topQuestionsLoadState === "retrying" && "Đang thử tải lại câu hỏi nổi bật theo bộ lọc..."}
                          {topQuestionsLoadState === "error" && (topQuestionsLoadError || "Chưa tải được câu hỏi nổi bật theo bộ lọc này.")}
                        </span>
                        {topQuestionsLoadState === "error" && (
                          <button
                            type="button"
                            onClick={retryDetailSections}
                            style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: "#003BB9", borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Thử lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : isTopQuestionsAiOverloaded ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px 16px", color: ORANGE, fontWeight: 600 }}>
                      {topQuestionsMessage || "Hệ thống AI hiện đang quá tải."}
                    </td>
                  </tr>
                ) : topQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px 16px", color: "rgba(0,59,185,0.55)" }}>
                      Database chưa có câu hỏi khách hàng phù hợp trong bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : visibleTopQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px 16px", color: "rgba(0,59,185,0.55)" }}>
                      Không tìm thấy câu hỏi nổi bật phù hợp với từ khóa.
                    </td>
                  </tr>
                ) : (
                  visibleTopQuestions.map((q, i) => (
                    <tr key={`${q.question}-${i}`} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.3)", fontWeight: 700, fontSize: "12px" }}>#{i + 1}</td>
                      <td className="flic-td-left" style={{ padding: "12px 16px", color: "#003BB9", maxWidth: "520px", lineHeight: 1.45 }}>{q.question}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#003BB9" }}>{viNum(q.count)}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button onClick={() => openTopQuestionDetails(q)} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", color: "#003BB9", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}>
                            <Eye size={10} /> Chi tiết
                          </button>
                          <button onClick={() => openTopQuestionFaq(q)} disabled={checkingFaqId === q.question} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.15)", background: "#fff", color: "rgba(0,59,185,0.65)", cursor: checkingFaqId === q.question ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px", opacity: checkingFaqId === q.question ? 0.6 : 1 }}>
                            {checkingFaqId === q.question ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Thêm FAQ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Hội thoại ưu tiên xử lý (Hiển thị tĩnh để giữ giao diện đẹp) */}
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại ưu tiên xử lý</h3>
            {/* Nút Quản lý hội thoại đã ẩn */}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  {["Khách hàng", "Kênh", "Chủ đề", "Thời gian chờ", "Trạng thái", "Ưu tiên", "Hành động"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {priorityLoadState !== "ready" && (
                  <tr>
                    <td colSpan={7} style={{ padding: "18px 16px", color: "rgba(0,59,185,0.62)", textAlign: "center", fontSize: "12px" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                        {priorityLoadState === "error" ? (
                          <AlertTriangle size={14} style={{ color: ORANGE }} />
                        ) : (
                          <RefreshCw size={14} style={{ color: "#003BB9", animation: "spin 1s linear infinite" }} />
                        )}
                        <span>
                          {priorityLoadState === "loading" && "Đang tải hội thoại ưu tiên theo bộ lọc..."}
                          {priorityLoadState === "retrying" && "Đang thử tải lại hội thoại ưu tiên theo bộ lọc..."}
                          {priorityLoadState === "error" && (priorityLoadError || "Chưa tải được hội thoại ưu tiên theo bộ lọc này.")}
                        </span>
                        {priorityLoadState === "error" && (
                          <button
                            type="button"
                            onClick={retryPriorityConversations}
                            style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: "#003BB9", borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                          >
                            Thử lại
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {priorityLoadState === "ready" && visiblePriorityConversations.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "18px 16px", color: "rgba(0,59,185,0.52)", textAlign: "center", fontSize: "12px" }}>
                      Không có hội thoại ưu tiên trong phạm vi bộ lọc hiện tại.
                    </td>
                  </tr>
                )}
                {priorityLoadState === "ready" && visiblePriorityConversations.map((conv) => {
                  const ss = statusColors[conv.status] || { bg: "#f1f5f9", color: "#64748b" };
                  const pc = priorityColors[conv.priority];
                  return (
                    <tr key={conv.id} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                    >
                      <td className="flic-td-left" style={{ padding: "12px 16px", color: "#003BB9", fontWeight: 500 }}>{conv.customer}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <ChannelLabel channel={conv.channel} />
                      </td>
                      <td style={{ padding: "12px 16px" }}><TopicLabel topic={conv.topic} badge={false} /></td>
                      <td style={{ padding: "12px 16px", color: conv.isOvertime ? ORANGE : "rgba(0,59,185,0.7)", fontWeight: conv.isOvertime ? 700 : 400, whiteSpace: "nowrap" }}>
                        {conv.isOvertime && <span style={{ marginRight: "4px" }}>⚠</span>}{conv.wait}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: ss.bg, color: ss.color, fontWeight: 500, whiteSpace: "nowrap" }}>{conv.status}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: pc.bg, color: pc.color, fontWeight: 600, border: `1px solid ${pc.border}` }}>{conv.priority}</span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={async () => {
                              try {
                                if (conv.conversationId || (conv.customerId && conv.source)) {
                                  await handleCloseConversation({
                                    conversationId: conv.conversationId,
                                    customerId: conv.customerId,
                                    source: conv.source,
                                  });
                                  toast.success("Đã chuyển hội thoại sang Hoàn thành.");
                                } else {
                                  toast.error("Không tìm thấy thông tin hội thoại để xử lý.");
                                }
                              } catch (err: any) {
                                toast.error(err.message || "Lỗi khi xử lý hội thoại.");
                              }
                            }}
                            style={{ padding: "4px 9px", borderRadius: "7px", border: "none", background: "#003BB9", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}
                          >
                            <CheckCircle size={10} /> Xử lý
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {feedbackQuestion && (
          <FeedbackFormDialog
            open
            mode="create"
            prefillData={{
              question: feedbackQuestion.question,
              answer: "",
              topic: feedbackQuestion.topic,
              notes: `Nguồn: Câu hỏi nổi bật; kênh: ${feedbackQuestion.channel}`,
            }}
            onClose={() => setFeedbackQuestion(null)}
          />
        )}
        {selectedTopQuestion && (
          <div
            onClick={() => setSelectedTopQuestion(null)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Chi tiết câu hỏi nổi bật"
              onClick={(event) => event.stopPropagation()}
              style={{ width: "min(760px, 100%)", height: "min(760px, calc(100vh - 40px))", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
            >
              <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,59,185,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, color: NAVY, fontSize: "16px", fontWeight: 700 }}>Chi tiết câu hỏi nổi bật</h3>
                  <div style={{ marginTop: "4px", color: "rgba(0,59,185,0.55)", fontSize: "12px" }}>
                    Tổng số câu hỏi liên quan: <strong>{viNum(selectedTopQuestion.count)}</strong>
                  </div>
                </div>
                <button onClick={() => setSelectedTopQuestion(null)} style={{ border: "none", background: "transparent", color: "rgba(0,59,185,0.55)", cursor: "pointer", padding: "4px" }} aria-label="Đóng chi tiết">
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0, overflow: "hidden" }}>
                <div style={{ border: "1px solid rgba(0,59,185,0.08)", background: "#f8fafc", borderRadius: "12px", padding: "14px 16px", flexShrink: 0 }}>
                  <div style={{ color: "rgba(0,59,185,0.55)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "6px" }}>
                    Câu hỏi tổng quát
                  </div>
                  <div style={{ color: NAVY, fontSize: "15px", fontWeight: 700, lineHeight: 1.45 }}>
                    {selectedTopQuestion.question}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", border: "1px solid rgba(0,59,185,0.12)", borderRadius: "10px", padding: "9px 12px", flexShrink: 0 }}>
                  <Search size={15} style={{ color: "rgba(0,59,185,0.45)" }} />
                  <input
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    placeholder="Tìm trong danh sách câu hỏi liên quan..."
                    style={{ border: "none", outline: "none", flex: 1, color: NAVY, fontSize: "13px" }}
                  />
                </div>

                <div style={{ border: "1px solid rgba(0,59,185,0.08)", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                  <div style={{ padding: "10px 14px", background: "#f8fafc", color: "rgba(0,59,185,0.55)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
                    Các câu hỏi liên quan
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {detailQuestions.length === 0 ? (
                      <div style={{ padding: "18px 14px", color: "rgba(0,59,185,0.55)", fontSize: "13px" }}>Không tìm thấy câu hỏi phù hợp.</div>
                    ) : (
                      detailQuestions.map((row, index) => (
                        <div key={`${row.question}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", padding: "12px 14px", borderTop: index === 0 ? "none" : "1px solid rgba(0,59,185,0.06)", alignItems: "start" }}>
                          <div style={{ color: NAVY, fontSize: "13px", lineHeight: 1.45 }}>{row.question}</div>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: ORANGE, background: "#FFF4EE", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>
                            {viNum(row.count)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
