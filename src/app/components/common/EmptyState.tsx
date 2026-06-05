import { FolderOpen } from "lucide-react";

const NAVY = "#003865";

interface EmptyStateProps {
  message?: string;
  subtitle?: string;
}

export function EmptyState({ message, subtitle }: EmptyStateProps) {
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
          backgroundColor: "#f4f6fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(0,56,101,0.4)",
          marginBottom: "18px"
        }}
      >
        <FolderOpen size={26} />
      </div>
      
      <h3 style={{ fontSize: "15px", fontWeight: 700, color: NAVY, margin: "0 0 6px 0" }}>
        {message || "Chưa có dữ liệu để hiển thị"}
      </h3>
      
      <p style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", maxWidth: "320px", margin: 0, lineHeight: 1.5 }}>
        {subtitle || "Khoảng thời gian bạn chọn hiện không có bản ghi hội thoại nào trong hệ thống."}
      </p>
    </div>
  );
}
