import { useEffect, useMemo, useState } from "react";
import { Search, CheckCircle, Target, Activity, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { AddSheetModal } from "./SheetChatbot";
import { createSheetChatbotRow } from "../../services/sheetChatbotApi";
import { closeConversation } from "../../services/dashboardApi";
import {
  getConversationDetail,
  getConversations,
  type ConversationDetailRecord,
  type ConversationListRecord,
  type ConversationMessage,
} from "../../services/conversationApi";

const NAVY = "#003BB9";
const LIGHT_NAVY = "#EBF2FF";
const AMBER_50 = "#FFF7E6";
const AMBER_TEXT = "#B7791F";
const RED_50 = "#FFF1F1";
const RED_TEXT = "#B42318";

const statusColors: Record<string, { bg: string; color: string }> = {
  "Đang xử lý": { bg: AMBER_50, color: AMBER_TEXT },
  "Chờ xử lý": { bg: "#f3e8ff", color: "#7c3aed" },
  "Hoàn thành": { bg: "#EAF8F1", color: "#16a34a" },
  "Chưa xác định": { bg: RED_50, color: RED_TEXT },
};

interface WorkspaceTask extends ConversationListRecord {
  displayId: string;
  displayName: string;
  avatar: string;
  statusLabel: string;
  timeLabel: string;
  topicLabel: string;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Không có thời gian trong database";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());
}

function mapStatus(status: string) {
  if (status === "closed") return "Hoàn thành";
  if (status === "open") return "Đang xử lý";
  if (status === "new") return "Chờ xử lý";
  return "Chưa xác định";
}

function toTask(row: ConversationListRecord): WorkspaceTask {
  const name = row.customer_name || row.customer_id || "Không có tên khách hàng trong database";
  const firstChar = name.trim().charAt(0).toUpperCase() || "?";
  return {
    ...row,
    displayId: `HT-${row.id}`,
    displayName: name,
    avatar: firstChar,
    statusLabel: mapStatus(row.status),
    timeLabel: formatDateTime(row.updated_at || row.created_at),
    topicLabel: row.source ? `Nguồn: ${row.source}` : "Không có nguồn trong database",
  };
}

function isHostMessage(message: ConversationMessage) {
  return message.fromHost === true || message.fromHost === 1;
}

export function MyWorkspace() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeDetail, setActiveDetail] = useState<ConversationDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [showSheetModal, setShowSheetModal] = useState(false);

  const activeTask = tasks.find((task) => task.id === activeTaskId) || tasks[0] || null;

  const stats = useMemo(() => {
    const closed = tasks.filter((task) => task.status === "closed").length;
    return {
      total: tasks.length,
      closed,
      waiting: tasks.filter((task) => task.status !== "closed").length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter((task) =>
      [task.displayName, task.customer_id, task.source, task.displayId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [search, tasks]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const response = await getConversations({ page: 1, pageSize: 50, search: search || undefined });
      const mapped = response.records.map(toTask);
      setTasks(mapped);
      setActiveTaskId((current) => current && mapped.some((task) => task.id === current) ? current : mapped[0]?.id ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải danh sách hội thoại");
      setTasks([]);
      setActiveTaskId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!activeTask) {
      setActiveDetail(null);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      try {
        const detail = await getConversationDetail(activeTask.id);
        if (!cancelled) setActiveDetail(detail);
      } catch (error) {
        if (!cancelled) {
          setActiveDetail(null);
          toast.error(error instanceof Error ? error.message : "Không thể tải chi tiết hội thoại");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activeTask?.id]);

  const messages = activeDetail?.messages ?? [];
  const lastCustomerMessage = [...messages].reverse().find((message) => !isHostMessage(message));

  const handleSend = () => {
    if (!replyText.trim()) return;
    toast.info("Chưa có API gửi phản hồi khách hàng trong backend hiện tại.");
  };

  const handleCloseConversation = async () => {
    if (!activeTask) return;
    try {
      await closeConversation(activeTask.customer_id, activeTask.source);
      toast.success("Đã đánh dấu hội thoại là đã xử lý trong database");
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đóng hội thoại");
    }
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 72px)", backgroundColor: "#f8fafc", overflow: "hidden" }}>
      <div style={{ width: "280px", borderRight: "1px solid #e2e8f0", backgroundColor: "#fff", padding: "20px", display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>Hôm nay của bạn</h2>
          <p style={{ fontSize: "13px", color: "#64748b" }}>{formatDateLabel()}</p>
        </div>

        <div style={{ padding: "16px", backgroundColor: LIGHT_NAVY, borderRadius: "12px", border: "1px solid rgba(0,56,101,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: NAVY, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600 }}>NV</div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{user?.name || "Nhân viên CSKH"}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Dữ liệu hội thoại từ database</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "8px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: NAVY }}>{stats.closed}</div>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>Đã xử lý</div>
            </div>
            <div style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "8px", textAlign: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: AMBER_TEXT }}>{stats.waiting}</div>
              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>Đang chờ</div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Target size={14} /> Phạm vi công việc
          </h3>
          <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.6 }}>
            Đang hiển thị {stats.total} hội thoại mới nhất từ bảng hội thoại. Các chỉ số chưa có cột dữ liệu trong DB sẽ không được hiển thị thay thế bằng số ước lượng.
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <Activity size={14} /> Hoạt động gần đây
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.slice(-3).reverse().map((message) => (
              <div key={message.messageId} style={{ display: "flex", gap: "12px" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", width: "42px", flexShrink: 0, paddingTop: "2px" }}>{formatDateTime(message.sentAt).split(" ")[0]}</div>
                <div style={{ fontSize: "12px", color: "#475569", borderLeft: "2px solid #e2e8f0", paddingLeft: "12px", paddingBottom: "12px" }}>{isHostMessage(message) ? "Nhân viên/AI phản hồi" : "Khách hàng gửi tin nhắn"}</div>
              </div>
            ))}
            {!detailLoading && messages.length === 0 && (
              <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>Chưa có message trong database cho hội thoại đang chọn.</div>
            )}
          </div>
        </div>
      </div>

      <div style={{ width: "340px", borderRight: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px" }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <Search size={16} color="#94a3b8" style={{ position: "absolute", left: "12px", top: "10px" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo khách hàng hoặc nguồn..."
              style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: "8px", border: "1px solid #e2e8f0", outline: "none", fontSize: "13px", boxSizing: "border-box", backgroundColor: "#fff" }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 20px 12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {loading && <div style={{ padding: "24px", color: "#64748b", fontSize: "13px", textAlign: "center" }}>Đang tải hội thoại từ database...</div>}
          {!loading && filteredTasks.length === 0 && <div style={{ padding: "24px", color: "#64748b", fontSize: "13px", textAlign: "center" }}>Không có hội thoại phù hợp trong database.</div>}
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setActiveTaskId(task.id)}
              style={{
                padding: "14px", borderRadius: "10px", cursor: "pointer",
                backgroundColor: activeTask?.id === task.id ? "#fff" : "transparent",
                border: activeTask?.id === task.id ? `1px solid ${NAVY}40` : "1px solid transparent",
                boxShadow: activeTask?.id === task.id ? "0 4px 12px rgba(0,56,101,0.05)" : "none",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: LIGHT_NAVY, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>
                    {task.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{task.displayName}</div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{task.displayId}</div>
                  </div>
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8", textAlign: "right" }}>{task.timeLabel}</div>
              </div>
              <div style={{ fontSize: "13px", color: "#475569", marginBottom: "8px" }}>{task.topicLabel}</div>
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: statusColors[task.statusLabel]?.bg || "#f1f5f9", color: statusColors[task.statusLabel]?.color || "#64748b", fontWeight: 600 }}>
                {task.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
        {!activeTask ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: "13px" }}>Chưa có hội thoại để hiển thị.</div>
        ) : (
          <>
            <div style={{ height: "64px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: LIGHT_NAVY, color: NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", fontWeight: 600 }}>
                  {activeTask.avatar}
                </div>
                <div>
                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: NAVY, margin: 0 }}>{activeTask.displayName}</h2>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{activeTask.customer_id} · {activeTask.source}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", backgroundColor: statusColors[activeTask.statusLabel]?.bg || "#f1f5f9", color: statusColors[activeTask.statusLabel]?.color || "#64748b", fontWeight: 600 }}>
                  {activeTask.statusLabel}
                </span>
                <button onClick={() => setShowSheetModal(true)} style={{ padding: "7px 12px", borderRadius: "6px", backgroundColor: "#fff", border: `1px solid ${NAVY}20`, color: NAVY, fontSize: "12px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                  <FileText size={13} /> Sheet Chatbot
                </button>
                <button onClick={() => void handleCloseConversation()} style={{ padding: "7px 14px", borderRadius: "6px", backgroundColor: "#fff", border: "1px solid #e2e8f0", color: "#475569", fontSize: "13px", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle size={14} /> Đánh dấu đã xử lý
                </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              {detailLoading && <div style={{ alignSelf: "center", fontSize: "12px", color: "#94a3b8" }}>Đang tải message từ database...</div>}
              {!detailLoading && messages.length === 0 && <div style={{ alignSelf: "center", fontSize: "12px", color: "#94a3b8" }}>Database chưa có message cho hội thoại này.</div>}
              {messages.map((message) => {
                const host = isHostMessage(message);
                return (
                  <div key={message.messageId} style={{ display: "flex", gap: "12px", maxWidth: "80%", alignSelf: host ? "flex-end" : "flex-start", flexDirection: host ? "row-reverse" : "row" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: host ? NAVY : LIGHT_NAVY, flexShrink: 0 }} />
                    <div>
                      <div style={{ backgroundColor: host ? NAVY : "#f1f5f9", padding: "12px 16px", borderRadius: host ? "12px 0 12px 12px" : "0 12px 12px 12px", fontSize: "13px", color: host ? "#fff" : "#334155", lineHeight: 1.5 }}>
                        {message.textContent || "Message không có nội dung trong database"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", textAlign: host ? "right" : "left" }}>{formatDateTime(message.sentAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "20px", borderTop: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "12px" }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập phản hồi của bạn..."
                    style={{ width: "100%", border: "none", outline: "none", backgroundColor: "transparent", resize: "none", fontSize: "13px", minHeight: "40px", fontFamily: "inherit" }}
                  />
                </div>
                <button
                  onClick={handleSend}
                  style={{ width: "48px", height: "48px", borderRadius: "12px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showSheetModal && activeTask && (
        <AddSheetModal
          prefillQuestion={lastCustomerMessage?.textContent || activeTask.topicLabel}
          onClose={() => setShowSheetModal(false)}
          onSave={async (data) => {
            await createSheetChatbotRow({
              ...data,
              addedBy: user?.name || "Nhân viên",
            });
            toast.success("Đã thêm dữ liệu vào Sheet Chatbot");
          }}
        />
      )}
    </div>
  );
}
