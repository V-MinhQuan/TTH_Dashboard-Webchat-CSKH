import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  MessageCircle,
  Globe,
  Hash,
  FileText,
  Heart,
  Bot,
  BarChart2,
  Settings,
  User,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

import { ImageWithFallback } from "./figma/ImageWithFallback";
import flicLogo from "../../imports/435df5554caef6f0afbf.jpg";

const NAVY      = "#003865";
const SIDEBAR_BG = "#EBF2FF";
/* Active nav item: keep orange as the CTA identity per brand spec */
const ACTIVE_BG  = "#D73C01";

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeScreen, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { role } = useAuth();

  const managerMenuItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "channel", label: "Kênh", icon: Globe },
    { id: "conversation", label: "Hội thoại", icon: MessageCircle },
    { id: "aiinsights", label: "Phân tích AI", icon: Bot },
    { id: "keyword", label: "Keywords", icon: Hash },
    { id: "sentiment", label: "Cảm xúc", icon: Heart },
    { id: "chartbuilder", label: "Biểu đồ", icon: BarChart2 },
    { id: "chatbot_sheet", label: "Sheet Chatbot", icon: FileText },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ];

  const staffMenuItems = [
    { id: "conversation", label: "Hội thoại", icon: MessageCircle },
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "chatbot_sheet", label: "Sheet Chatbot", icon: FileText },
    { id: "performance", label: "Hiệu suất", icon: TrendingUp },
    { id: "profile", label: "Hồ sơ", icon: User },
  ];

  const menuItems = role === "manager" ? managerMenuItems : staffMenuItems;

  return (
    <aside
      style={{
        width: collapsed ? "68px" : "220px",
        backgroundColor: SIDEBAR_BG,
        borderRight: "1px solid rgba(0,56,101,0.1)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        flexShrink: 0,
      }}
      className="flex flex-col h-full relative overflow-hidden"
    >
      {/* Logo area */}
      <div
        style={{ borderBottom: "1px solid rgba(0,56,101,0.1)", minHeight: "72px" }}
        className="flex items-center justify-center px-3"
      >
        <div style={{
          backgroundColor: "#fff",
          borderRadius: "10px",
          padding: collapsed ? "6px" : "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: collapsed ? "42px" : "100%",
          height: collapsed ? "42px" : "50px",
          boxShadow: "0 2px 8px rgba(0,56,101,0.08)",
        }}>
          <ImageWithFallback
            src={flicLogo}
            alt="FLIC AI Logo"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {!collapsed && (
          <div style={{ color: NAVY, opacity: 0.4, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", padding: "0 10px", marginBottom: "8px" }}>
            MENU CHÍNH
          </div>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          const isHovered = hoveredItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              title={collapsed ? item.label : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: collapsed ? "10px 0" : "9px 10px",
                borderRadius: "10px",
                marginBottom: "2px",
                backgroundColor: isActive
                  ? ACTIVE_BG
                  : isHovered
                  ? "rgba(0,56,101,0.08)"
                  : "transparent",
                color: isActive ? "#fff" : NAVY,
                transition: "all 0.15s ease",
                cursor: "pointer",
                border: "none",
                outline: "none",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
              {!collapsed && (
                <span style={{ fontSize: "13px", fontWeight: isActive ? 600 : 500, whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
              {isActive && !collapsed && (
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(255,255,255,0.8)",
                    marginLeft: "auto",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(0,56,101,0.1)", padding: "14px 12px" }}>
        {!collapsed && (
          <div style={{ color: "rgba(0,56,101,0.35)", fontSize: "10px", marginBottom: "10px", lineHeight: 1.6 }}>
            <div>© 2026 FLIC Education</div>
            <div>v2.4.1 — Vận hành AI</div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "7px",
            borderRadius: "8px",
            backgroundColor: "rgba(0,56,101,0.08)",
            color: NAVY,
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            opacity: 0.7,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,56,101,0.14)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(0,56,101,0.08)"; }}
        >
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span style={{ fontSize: "12px", fontWeight: 500 }}>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  );
}
