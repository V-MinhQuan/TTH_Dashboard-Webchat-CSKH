import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { GlobalFilterProvider, useGlobalFilters } from "./context/GlobalFilterContext";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { LoginScreen } from "./components/screens/Login";

// AI Chat Widget tạm ẩn chờ phát triển sau
const Overview = lazy(() => import("./components/screens/Overview").then((m) => ({ default: m.Overview })));
const ChannelAnalysis = lazy(() => import("./components/screens/ChannelAnalysis").then((m) => ({ default: m.ChannelAnalysis })));
const QuestionAnalysis = lazy(() => import("./components/screens/QuestionAnalysis").then((m) => ({ default: m.QuestionAnalysis })));
const KeywordAnalysis = lazy(() => import("./components/screens/KeywordAnalysis").then((m) => ({ default: m.KeywordAnalysis })));
const PerformanceAnalysis = lazy(() => import("./components/screens/PerformanceAnalysis").then((m) => ({ default: m.PerformanceAnalysis })));
const MyWorkspace = lazy(() => import("./components/screens/MyWorkspace").then((m) => ({ default: m.MyWorkspace })));
const UrgentCenter = lazy(() => import("./components/screens/UrgentCenter").then((m) => ({ default: m.UrgentCenter })));
const AIMonitoring = lazy(() => import("./components/screens/AIMonitoring").then((m) => ({ default: m.AIMonitoring })));
const SentimentAnalysis = lazy(() => import("./components/screens/SentimentAnalysis").then((m) => ({ default: m.SentimentAnalysis })));
const AIInsights = lazy(() => import("./components/screens/AIInsights").then((m) => ({ default: m.AIInsights })));
const ChartBuilder = lazy(() => import("./components/screens/ChartBuilder").then((m) => ({ default: m.ChartBuilder })));
const Settings = lazy(() => import("./components/screens/Settings").then((m) => ({ default: m.Settings })));
const FAQ = lazy(() => import("./components/screens/FAQ").then((m) => ({ default: m.FAQ })));
const SheetChatbot = lazy(() => import("./components/screens/SheetChatbot").then((m) => ({ default: m.SheetChatbot })));
const PersonalInfo = lazy(() => import("./components/screens/PersonalInfo").then((m) => ({ default: m.PersonalInfo })));

function formatTime(d: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

const DEFAULT_SCREEN = "overview";
const VALID_SCREEN_IDS = new Set([
  "overview",
  "channel",
  "question",
  "keyword",
  "performance",
  "conversation",
  "todo",
  "ai_intervention",
  "sentiment",
  "aiinsights",
  "chartbuilder",
  "settings",
  "users",
  "profile",
  "personalinfo",
  "faq",
  "chatbot_sheet",
]);
const PATH_TO_SCREEN = new Map([
  ["/overview", "overview"],
  ["/channel", "channel"],
  ["/question", "question"],
  ["/keyword", "keyword"],
  ["/performance", "performance"],
  ["/conversation", "conversation"],
  ["/todo", "todo"],
  ["/ai-intervention", "ai_intervention"],
  ["/sentiment", "sentiment"],
  ["/ai-insights", "aiinsights"],
  ["/aiinsights", "aiinsights"],
  ["/chartbuilder", "chartbuilder"],
  ["/chart-builder", "chartbuilder"],
  ["/settings", "settings"],
  ["/users", "users"],
  ["/profile", "profile"],
  ["/personal-info", "personalinfo"],
  ["/personalinfo", "personalinfo"],
  ["/faq", "faq"],
  ["/chatbot-sheet", "chatbot_sheet"],
  ["/chatbot_sheet", "chatbot_sheet"],
]);

function normalizeScreenId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^#\/?/, "");
  return VALID_SCREEN_IDS.has(normalized) ? normalized : null;
}

function getInternalScreenFromUrl(value: string | null | undefined): string | null {
  if (!value || typeof window === "undefined") return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return (
      normalizeScreenId(url.searchParams.get("screen")) ||
      normalizeScreenId(url.searchParams.get("activeScreen")) ||
      PATH_TO_SCREEN.get(url.pathname) ||
      normalizeScreenId(url.hash) ||
      null
    );
  } catch {
    return null;
  }
}

function getInitialActiveScreen() {
  if (typeof window === "undefined") return DEFAULT_SCREEN;
  const params = new URLSearchParams(window.location.search);
  return (
    getInternalScreenFromUrl(params.get("returnUrl")) ||
    getInternalScreenFromUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`) ||
    DEFAULT_SCREEN
  );
}

function ScreenTransitionLoading() {
  return (
    <div style={{ minHeight: "100%", padding: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes screenLoaderSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", color: "#003865" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: "3px solid rgba(0,56,101,0.12)",
            borderTopColor: "#ED5206",
            animation: "screenLoaderSpin 0.8s linear infinite",
          }}
        />
        <div style={{ fontSize: "13px", fontWeight: 700 }}>Đang tải dữ liệu...</div>
      </div>
    </div>
  );
}

function MainApp() {
  const { role } = useAuth();
  const {
    appliedFilters: filters,
    applyFilters: setFilters,
    resetFilters,
  } = useGlobalFilters();
  const [activeScreen, setActiveScreen] = useState(getInitialActiveScreen);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [screenSwitching, setScreenSwitching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => formatTime(new Date()));

  const triggerRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(formatTime(new Date()));
    }, 1200);
  }, []);

  const handleNavigate = useCallback((nextScreen: string) => {
    if (nextScreen === activeScreen) return;
    resetFilters();
    setActiveScreen(nextScreen);
  }, [activeScreen, resetFilters]);

  useEffect(() => {
    const interval = setInterval(triggerRefresh, 1800000);
    return () => clearInterval(interval);
  }, [triggerRefresh]);

  useEffect(() => {
    setScreenSwitching(true);
    const timer = window.setTimeout(() => setScreenSwitching(false), 220);

    try {
      localStorage.setItem("dashboard_activeScreen", activeScreen);
    } catch { }

    return () => window.clearTimeout(timer);
  }, [activeScreen]);

  if (!role) {
    return <LoginScreen />;
  }

  const baseProps = {
    filters,
    onFiltersChange: setFilters,
    onNavigate: handleNavigate,
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "overview":
        return <Overview {...baseProps} isRefreshing={isRefreshing} lastUpdated={lastUpdated} onManualRefresh={triggerRefresh} />;
      case "channel":
        return <ChannelAnalysis {...baseProps} />;
      case "question":
        return <QuestionAnalysis {...baseProps} />;
      case "keyword":
        return <KeywordAnalysis {...baseProps} />;
      // case "performance": // Tạm ẩn trang Hiệu suất
      //   return <PerformanceAnalysis {...baseProps} />;
      case "conversation":
        return <MyWorkspace filters={filters} />;
      case "todo":
        return <UrgentCenter filters={filters} />;
      case "ai_intervention":
        return <AIMonitoring filters={filters} />;
      case "sentiment":
        return <SentimentAnalysis {...baseProps} />;
      case "aiinsights":
        return <AIInsights {...baseProps} />;
      case "chartbuilder":
        return <ChartBuilder {...baseProps} />;
      case "settings":
      case "users":
        return <Settings defaultSection={activeScreen === "users" ? "users" : "profile"} />;
      case "profile":
        return <Settings defaultSection="profile" />;
      case "personalinfo":
        return <PersonalInfo onNavigate={handleNavigate} />;
      case "faq":
        return <FAQ />;
      case "chatbot_sheet":
        return <SheetChatbot />;
      default:
        return <Overview {...baseProps} isRefreshing={isRefreshing} lastUpdated={lastUpdated} onManualRefresh={triggerRefresh} />;
    }
  };

  const isFullHeight = activeScreen === "conversation" || activeScreen === "todo" || activeScreen === "ai_intervention" || activeScreen === "chartbuilder" || activeScreen === "chatbot_sheet" || activeScreen === "faq" || activeScreen === "personalinfo";

  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#f4f6fa",
      }}
    >
      <div className="print-hidden" style={{ display: "flex" }}>
        <Sidebar
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      <div className="app-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div className="print-hidden">
          <Header
            activeScreen={activeScreen}
            onNavigate={handleNavigate}
          />
        </div>
        <main
          className="app-main"
          style={{
            flex: 1,
            overflowY: isFullHeight ? "hidden" : "auto",
            overflowX: "hidden",
          }}
        >
          {screenSwitching ? (
            <ScreenTransitionLoading />
          ) : (
            <Suspense fallback={<ScreenTransitionLoading />}>
              {renderScreen()}
            </Suspense>
          )}
        </main>
      </div>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "'Inter', sans-serif",
            fontSize: "13px",
            borderRadius: "12px",
          },
        }}
        offset="80px"
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GlobalFilterProvider>
        <SettingsProvider>
          <MainApp />
        </SettingsProvider>
      </GlobalFilterProvider>
    </AuthProvider>
  );
}
