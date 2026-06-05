import { useState, useEffect, useCallback } from "react";
import { Toaster } from "sonner";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { AIChatWidget } from "./components/AIChatWidget";
import { Overview } from "./components/screens/Overview";
import { ChannelAnalysis } from "./components/screens/ChannelAnalysis";
import { QuestionAnalysis } from "./components/screens/QuestionAnalysis";
import { KeywordAnalysis } from "./components/screens/KeywordAnalysis";
import { PerformanceAnalysis } from "./components/screens/PerformanceAnalysis";
import { MyWorkspace } from "./components/screens/MyWorkspace";
import { UrgentCenter } from "./components/screens/UrgentCenter";
import { AIMonitoring } from "./components/screens/AIMonitoring";
import { SentimentAnalysis } from "./components/screens/SentimentAnalysis";
import { AIInsights } from "./components/screens/AIInsights";
import { ChartBuilder } from "./components/screens/ChartBuilder";
import { Settings } from "./components/screens/Settings";
import { FAQ } from "./components/screens/FAQ";
import { SheetChatbot } from "./components/screens/SheetChatbot";
import { PersonalInfo } from "./components/screens/PersonalInfo";
import { FilterValues } from "./components/FilterPanel";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/screens/Login";

const defaultFilters: FilterValues = {
  dateRange: "30 ngày qua",
  channel: "Tất cả",
  topic: "Tất cả",
  conversationStatus: "Tất cả",
  aiStatus: "Tất cả",
};

function formatTime(d: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

function MainApp() {
  const { role } = useAuth();
  const [activeScreen, setActiveScreen] = useState("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState<FilterValues>(defaultFilters);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
        return <ChartBuilder onNavigate={setActiveScreen} />;
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
          {renderScreen()}
        </main>
      </div>

      <div className="print-hidden">
        <AIChatWidget />
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
