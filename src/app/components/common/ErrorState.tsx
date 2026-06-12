import { AlertTriangle, RefreshCw } from "lucide-react";

const NAVY = "#003865";
const RED_TEXT = "#B42318";
const RED_BG = "#FFF1F1";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
        backgroundColor: "#fff",
        borderRadius: "16px",
        border: "1px solid rgba(0,56,101,0.08)",
        margin: "24px",
        boxShadow: "0 2px 8px rgba(0,56,101,0.05)"
      }}
    >
      <div
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          backgroundColor: RED_BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "18px"
        }}
      >
        <AlertTriangle size={28} style={{ color: RED_TEXT }} />
      </div>
      
      <h3 style={{ fontSize: "16px", fontWeight: 700, color: NAVY, margin: "0 0 8px 0" }}>
        Không thể tải dữ liệu Dashboard
      </h3>
      
      <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)", maxWidth: "400px", margin: "0 0 20px 0", lineHeight: 1.5 }}>
        {message || "Đã xảy ra lỗi khi kết nối với máy chủ API. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."}
      </p>
      
      <button
        onClick={onRetry}
        style={{
          padding: "10px 22px",
          borderRadius: "8px",
          border: "none",
          background: NAVY,
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 12px rgba(0,56,101,0.15)",
          transition: "background 0.2s"
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#1565C0";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = NAVY;
        }}
      >
        <RefreshCw size={14} /> Thử lại
      </button>
    </div>
  );
}
