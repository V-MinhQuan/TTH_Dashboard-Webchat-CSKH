import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Globe,
  Hash,
  FileText,
  Heart,
  Bot,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { ImageWithFallback } from "./figma/ImageWithFallback";
import flicLogoCircle from "../../assets/flic-logo-circle.png";
import flicLogoLong from "../../assets/flic-logo-long.png";
import "../../styles/globals.css";

const NAVY = "#003865";
const SIDEBAR_BG = "#EBF2FF";
/* Active nav item: keep orange as the CTA identity per brand spec */
const ACTIVE_BG = "#D73C01";

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeScreen, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { role } = useAuth();

  const managerMenuItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "channel", label: "Kênh", icon: Globe },
    { id: "aiinsights", label: "Hiệu suất AI", icon: Bot },
    { id: "keyword", label: "Từ khóa nổi bật", icon: Hash },
    { id: "sentiment", label: "Phân tích cảm xúc", icon: Heart },
    // { id: "performance", label: "Hiệu suất", icon: TrendingUp }, // Tạm ẩn
    { id: "chartbuilder", label: "Biểu đồ", icon: BarChart2 },
    { id: "chatbot_sheet", label: "Thư viện phản hồi", icon: FileText },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ];

  const staffMenuItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "aiinsights", label: "Hiệu suất AI", icon: Bot },
    { id: "sentiment", label: "Phân tích cảm xúc", icon: Heart },
    { id: "chatbot_sheet", label: "Thư viện phản hồi", icon: FileText },
    { id: "settings", label: "Cài đặt", icon: Settings },
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
      className="app-sidebar flex flex-col h-full relative overflow-hidden"
      data-collapsed={collapsed ? "true" : "false"}
    >
      {/* Logo area */}
      <div
        style={{ borderBottom: "1px solid rgba(0,56,101,0.1)", minHeight: "72px" }}
        className="flex items-center justify-center px-3"
      >
        <div data-testid="sidebar-logo-frame" className="sidebar-logo-frame" style={{
          backgroundColor: collapsed ? "transparent" : "#fff",
          borderRadius: collapsed ? "50%" : "12px",
          padding: collapsed ? "0" : "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: collapsed ? "46px" : "100%",
          height: collapsed ? "46px" : "50px",
          boxShadow: collapsed ? "none" : "0 2px 8px rgba(0,56,101,0.08)",
          overflow: "hidden",
        }}>
          {collapsed ? (
            <ImageWithFallback
              src={flicLogoCircle}
              alt="Logo FLIC"
              style={{
                width: "46px",
                height: "46px",
                objectFit: "cover",
                borderRadius: "50%",
              }}
            />
          ) : (
            <ImageWithFallback
              src={flicLogoLong}
              alt="Logo FLIC"
              style={{ width: "100%", height: "auto", maxHeight: "40px", objectFit: "contain" }}
            />
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Điều hướng chính" className="flex-1 py-4 px-2 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {!collapsed && (
          <div className="sidebar-expanded-content" style={{ color: NAVY, opacity: 0.4, fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", padding: "0 10px", marginBottom: "8px" }}>
            MENU CHÍNH
          </div>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              data-active={isActive ? "true" : "false"}
              className="sidebar-nav-item"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: collapsed ? "10px 0" : "9px 10px",
                borderRadius: "10px",
                marginBottom: "2px",
                backgroundColor: isActive ? ACTIVE_BG : "transparent",
                color: isActive ? "#fff" : NAVY,
                transition: "all 0.15s ease",
                cursor: "pointer",
                border: "none",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
              {!collapsed && (
                <span className="sidebar-expanded-content" style={{ fontSize: "13px", fontWeight: isActive ? 600 : 500, whiteSpace: "nowrap" }}>
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
          <div className="sidebar-expanded-content" style={{ color: "rgba(0,56,101,0.35)", fontSize: "10px", marginBottom: "10px", lineHeight: 1.6 }}>
            <div>© 2026 FLIC Education</div>
            <div>v2.4.1 — Vận hành AI</div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          aria-expanded={!collapsed}
          className="sidebar-collapse-button"
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
        >
          {collapsed ? <ChevronRight size={15} aria-hidden="true" /> : <><ChevronLeft size={15} aria-hidden="true" /><span className="sidebar-expanded-content" style={{ fontSize: "12px", fontWeight: 500 }}>Thu gọn</span></>}
        </button>
      </div>
    </aside>
  );
}
