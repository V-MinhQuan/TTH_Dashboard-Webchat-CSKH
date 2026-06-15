import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { defaultFilterValues, FilterValues } from "./components/FilterPanel";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/screens/Login";

const AIChatWidget = lazy(() => import("./components/AIChatWidget").then((m) => ({ default: m.AIChatWidget })));
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
  const [activeScreen, setActiveScreen] = useState(() => {
    try {
      const saved = localStorage.getItem("dashboard_activeScreen");
      return saved || "overview";
    } catch {
      return "overview";
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(defaultFilterValues);
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

  useEffect(() => {
    const interval = setInterval(triggerRefresh, 1800000);
    return () => clearInterval(interval);
  }, [triggerRefresh]);

  useEffect(() => {
    setScreenSwitching(true);
    const timer = window.setTimeout(() => setScreenSwitching(false), 220);
    
    try {
      localStorage.setItem("dashboard_activeScreen", activeScreen);
    } catch {}

    return () => window.clearTimeout(timer);
  }, [activeScreen]);

  if (!role) {
    return <LoginScreen />;
  }

  const baseProps = {
    filters,
    onFiltersChange: setFilters,
    onNavigate: setActiveScreen,
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
      case "performance":
        return <PerformanceAnalysis {...baseProps} />;
      case "conversation":
        return <MyWorkspace />;
      case "todo":
        return <UrgentCenter />;
      case "ai_intervention":
        return <AIMonitoring />;
      case "sentiment":
        return <SentimentAnalysis {...baseProps} />;
      case "aiinsights":
        return <AIInsights {...baseProps} />;
      case "chartbuilder":
        return <ChartBuilder {...baseProps} />;
      case "settings":
      case "users":
        return <Settings defaultSection={activeScreen === "users" ? "users" : "notifications"} />;
      case "profile":
        return <Settings defaultSection="profile" />;
      case "personalinfo":
        return <PersonalInfo onNavigate={setActiveScreen} />;
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
          onNavigate={setActiveScreen}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      <div className="app-content" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div className="print-hidden">
          <Header
            activeScreen={activeScreen}
            onNavigate={setActiveScreen}
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

      <div className="print-hidden">
        <Suspense fallback={null}>
          <AIChatWidget />
        </Suspense>
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
      <MainApp />
    </AuthProvider>
  );
}
