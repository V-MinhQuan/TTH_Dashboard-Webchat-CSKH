import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { closeConversation, getDashboardPriorityConversations } from "../../services/dashboardApi";
import type { PriorityConversation } from "../../types/dashboard";
import { getDateParamsFromFilters } from "../../utils/dateFilters";
import type { FilterValues } from "../FilterPanel";
import { ChannelLabel } from "../common/ChannelLabel";
import { TopicLabel } from "../common/TopicLabel";

const VISIBLE_LIMIT = 5;

const statusColors: Record<string, { bg: string; color: string }> = {
  "Chờ quản lý xác nhận": { bg: "#FFF4EE", color: "#D73C01" },
  "Chờ xử lý": { bg: "#FFF7E6", color: "#B7791F" },
  "Đang tư vấn": { bg: "#dbeafe", color: "#3b82f6" },
  "Đang tư vấn / Chờ phản hồi": { bg: "#dbeafe", color: "#3b82f6" },
  "Đang xử lý": { bg: "#dbeafe", color: "#3b82f6" },
  "Hoàn thành": { bg: "#EAF8F1", color: "#228A61" },
};

const priorityColors: Record<string, { bg: string; color: string; border: string }> = {
  "Ưu tiên cao": { bg: "#FFF4EE", color: "#D73C01", border: "#FBCBB8" },
  "Ưu tiên trung bình": { bg: "#FFF7E6", color: "#B7791F", border: "#FADFA8" },
  "Ưu tiên thấp": { bg: "#EAF8F1", color: "#228A61", border: "#BFEAD3" },
};

function formatWaitingSince(value?: string | null) {
  if (!value) return "Chưa xác định";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function PriorityConversationsSection({ filters }: { filters: FilterValues }) {
  const [rows, setRows] = useState<PriorityConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getDashboardPriorityConversations({
      ...getDateParamsFromFilters(filters),
      channel: filters.channel,
      topic: filters.topic,
      conversationStatus: filters.conversationStatus,
      aiStatus: filters.aiStatus,
      limit: 50,
      signal: controller.signal,
    }).then(setRows).catch((reason) => {
      if (reason?.name !== "AbortError") setError(reason?.message || "Không thể tải hội thoại ưu tiên.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, reloadVersion]);

  const visibleRows = rows.slice(0, VISIBLE_LIMIT);

  const handleProcess = async (row: PriorityConversation) => {
    if (!row.conversationId && !(row.customerId && row.source)) {
      toast.error("Không tìm thấy thông tin hội thoại để xử lý.");
      return;
    }
    try {
      setProcessingId(row.id);
      await closeConversation({
        conversationId: row.conversationId,
        customerId: row.customerId,
        source: row.source,
      });
      toast.success("Đã chuyển hội thoại sang Hoàn thành.");
      setReloadVersion((value) => value + 1);
    } catch (reason: any) {
      toast.error(reason?.message || "Lỗi khi xử lý hội thoại.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <section style={{ marginTop: "20px", backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden" }}>
      <header style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>
        <div>
          <h3 style={{ color: "#003BB9", fontSize: "14px", fontWeight: 700, margin: 0 }}>Hội thoại ưu tiên xử lý</h3>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "rgba(0,59,185,0.5)" }}>Dữ liệu trong phạm vi bộ lọc và quyền truy cập hiện tại</p>
        </div>
      </header>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead><tr style={{ backgroundColor: "#f8fafc" }}>
            {["Khách hàng", "Kênh", "Chủ đề", "Thời gian chờ", "Trạng thái", "Ưu tiên", "Hành động"].map((label) => <th key={label} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{label}</th>)}
          </tr></thead>
          <tbody>
            {(loading || error || visibleRows.length === 0) && <tr><td colSpan={7} style={{ padding: "18px 16px", color: error ? "#D73C01" : "rgba(0,59,185,0.55)", textAlign: "center", fontSize: "12px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                {loading ? <RefreshCw size={14} className="animate-spin" /> : error ? <AlertTriangle size={14} /> : null}
                {loading ? "Đang tải hội thoại ưu tiên theo bộ lọc..." : error || "Không có hội thoại ưu tiên trong phạm vi bộ lọc hiện tại."}
                {error && <button type="button" onClick={() => setReloadVersion((value) => value + 1)} style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: "#003BB9", borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Thử lại</button>}
              </span>
            </td></tr>}
            {!loading && !error && visibleRows.map((row) => {
              const statusStyle = statusColors[row.status] || { bg: "#f1f5f9", color: "#64748b" };
              const priorityStyle = priorityColors[row.priority] || { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" };
              return <tr key={row.id} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "#f8fafc"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}>
                <td className="flic-td-left" style={{ padding: "12px 16px", color: "#003BB9", fontWeight: 500 }}>{row.customerDisplayName || row.customer}</td>
                <td style={{ padding: "12px 16px" }}><ChannelLabel channel={row.channel} /></td>
                <td style={{ padding: "12px 16px" }}><TopicLabel topic={row.topic} badge={false} /></td>
                <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.7)", whiteSpace: "nowrap" }}>{formatWaitingSince(row.messageAt)}</td>
                <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: statusStyle.bg, color: statusStyle.color, fontWeight: 500, whiteSpace: "nowrap" }}>{row.status}</span></td>
                <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", backgroundColor: priorityStyle.bg, color: priorityStyle.color, fontWeight: 600, border: `1px solid ${priorityStyle.border}`, whiteSpace: "nowrap" }}>{row.priority}</span></td>
                <td style={{ padding: "12px 16px" }}>
                  <button type="button" onClick={() => handleProcess(row)} disabled={processingId !== null} style={{ padding: "4px 9px", borderRadius: "7px", border: "none", background: "#003BB9", color: "#fff", cursor: processingId !== null ? "not-allowed" : "pointer", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", opacity: processingId !== null && processingId !== row.id ? 0.55 : 1 }}>
                    {processingId === row.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Xử lý
                  </button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
