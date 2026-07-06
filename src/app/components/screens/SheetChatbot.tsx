import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { useAuth } from "../../context/AuthContext";
import { Plus, Search, Filter, CheckCircle2, XCircle, Clock, Edit2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorSourceBadge } from "../common/ErrorSourceBadge";
import { getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import { TOPIC_FILTER_OPTIONS } from "../../constants/topicTaxonomy";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";
import {
  deleteSheetChatbotRow,
  getSheetChatbotRows,
  mergeSheetChatbotToFaq,
  updateSheetChatbotStatus,
} from "../../services/sheetChatbotApi";

const NAVY = "#003865";
const ORANGE = "#D73C01";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200 = "#FBCBB8";
const AMBER_50 = "#FFF7E6";
const AMBER_TEXT = "#B7791F";
const ALL_FILTER_VALUE = "Tất cả";

type SheetStatus = "Chờ xử lý" | "Đã duyệt" | "Cần chỉnh sửa" | "Từ chối";
type RiskLevel = "Thấp" | "Trung bình" | "Cao";
type SourceType = string;

const SHEET_STATUSES: SheetStatus[] = ["Chờ xử lý", "Đã duyệt", "Cần chỉnh sửa", "Từ chối"];
const RISK_LEVELS: RiskLevel[] = ["Thấp", "Trung bình", "Cao"];

interface SheetRow {
  id: string;
  addedAt: string;
  addedBy: string;
  question: string;
  correctAnswer: string;
  topic: string;
  source: SourceType;
  risk: RiskLevel;
  status: SheetStatus;
  notes: string;
}

const statusConfig: Record<SheetStatus, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
  "Chờ xử lý": { bg: ORANGE_50, color: ORANGE, icon: Clock },
  "Đã duyệt": { bg: "#dbeafe", color: "#2563eb", icon: CheckCircle2 },
  "Cần chỉnh sửa": { bg: "#f3e8ff", color: "#7c3aed", icon: Edit2 },
  "Từ chối": { bg: "#fee2e2", color: "#ef4444", icon: XCircle },
};

const riskConfig: Record<RiskLevel, { bg: string; color: string }> = {
  Thấp: { bg: "#EAF8F1", color: "#16a34a" },
  "Trung bình": { bg: AMBER_50, color: AMBER_TEXT },
  Cao: { bg: ORANGE_50, color: ORANGE },
};

const tableHeaderCellStyle: CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 600,
  color: "rgba(0,62,154,0.5)",
  fontSize: "11px",
  letterSpacing: "0.04em",
  borderBottom: "1px solid rgba(0,62,154,0.07)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 1,
  backgroundColor: "#f8fafc",
};

const tableFilterLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  whiteSpace: "nowrap",
};

const tableFilterControlStyle = (active: boolean): CSSProperties => ({
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "8px",
  border: active ? `1px solid ${ORANGE_200}` : "1px solid rgba(0,56,101,0.14)",
  background: active ? ORANGE_50 : "#fff",
  color: active ? ORANGE : "rgba(0,56,101,0.58)",
  cursor: "pointer",
  flexShrink: 0,
});

const tableFilterNativeSelectStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  fontSize: "11px",
  fontWeight: 600,
  fontFamily: "inherit",
  opacity: 0,
  cursor: "pointer",
  outline: "none",
  border: 0,
};

const tableFilterOptionStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  fontFamily: "inherit",
};

const actionHeaderCellStyle: CSSProperties = {
  ...tableHeaderCellStyle,
  width: "190px",
  minWidth: "190px",
};

const actionCellStyle: CSSProperties = {
  padding: "12px 14px",
  width: "190px",
  minWidth: "190px",
  whiteSpace: "nowrap",
};

const actionButtonGroupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  flexWrap: "nowrap",
  whiteSpace: "nowrap",
};

const actionButtonBaseStyle: CSSProperties = {
  padding: "3px 9px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "10px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

function uniqueSortedText(values: unknown[]) {
  const uniqueValues = new Set<string>();
  values.forEach((value) => {
    const text = String(value || "").trim();
    if (text) uniqueValues.add(text);
  });
  return Array.from(uniqueValues).sort((left, right) => left.localeCompare(right, "vi-VN"));
}

function FilterableHeader({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const active = value !== ALL_FILTER_VALUE;
  return (
    <div style={tableFilterLabelStyle}>
      <span>{label}</span>
      <label
        data-print-hidden="true"
        title={active ? `Đang lọc: ${value}` : `Lọc theo ${label}`}
        style={tableFilterControlStyle(active)}
      >
        <Filter size={11} aria-hidden="true" />
        <select
          aria-label={`Lọc thư viện phản hồi theo ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          style={tableFilterNativeSelectStyle}
        >
          <option value={ALL_FILTER_VALUE} style={tableFilterOptionStyle}>{ALL_FILTER_VALUE}</option>
          {options.map((option) => (
            <option key={option} value={option} style={tableFilterOptionStyle}>{option}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function displayFailureSource(source: string) {
  const definition = getAiFailureDefinition(source);
  if (definition) return definition.label;
  if (source.trim().toLocaleLowerCase("vi-VN") === "nhân viên đề xuất") return "Chưa phân loại lỗi AI";
  return source;
}

function errorOriginForRow(row: Pick<SheetRow, "addedBy" | "source">): "ai" | "staff" | "system" {
  const addedBy = row.addedBy.toLocaleLowerCase("vi-VN");
  if (addedBy.includes("ai") || addedBy.includes("tự động")) return "ai";
  if (addedBy.includes("hệ thống")) return "system";
  return "staff";
}

function formatAddedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  if (sameDay) return `${time} hôm nay`;
  if (isYesterday) return `Hôm qua ${time}`;
  return date.toLocaleDateString("vi-VN");
}

export function SheetChatbot() {
  const { role, user } = useAuth();
  const currentUserName = role === "manager" ? "Admin FLIC" : user?.name || "Thu Trang";
  const apiRole = role === "manager" ? "manager" : "staff";
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SheetRow | null>(null);

  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState(ALL_FILTER_VALUE);
  const [filterSource, setFilterSource] = useState(ALL_FILTER_VALUE);
  const [filterStatus, setFilterStatus] = useState(ALL_FILTER_VALUE);
  const [filterRisk, setFilterRisk] = useState(ALL_FILTER_VALUE);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SheetRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getSheetChatbotRows({
        page: 1,
        pageSize: 500,
        role: apiRole,
        addedBy: apiRole === "manager" ? undefined : currentUserName,
      });
      setRows(response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải thư viện phản hồi";
      setLoadError(message);
      setRows([]);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [apiRole, currentUserName]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const autoEditQ = localStorage.getItem("edit_chatbot_question");
    if (autoEditQ && rows.length > 0 && !isLoading) {
      setSearch(autoEditQ);
      localStorage.removeItem("edit_chatbot_question");
      const rowToEdit = rows.find(r => r.question.toLowerCase().includes(autoEditQ.toLowerCase()) || autoEditQ.toLowerCase().includes(r.question.toLowerCase()));
      if (rowToEdit) {
        setEditingRow(rowToEdit);
        setShowAddModal(true);
      }
    }
  }, [rows, isLoading]);

  const visibleRows = useMemo(
    () => rows.filter((row) => role === "manager" || row.addedBy === currentUserName),
    [currentUserName, role, rows],
  );
  const topicOptions = useMemo<readonly string[]>(
    () => TOPIC_FILTER_OPTIONS.map((option) => option.label),
    [],
  );
  const sourceOptions = useMemo(
    () => uniqueSortedText(visibleRows.map((row) => displayFailureSource(row.source))),
    [visibleRows],
  );

  useEffect(() => {
    if (filterTopic !== ALL_FILTER_VALUE && !topicOptions.includes(filterTopic)) {
      setFilterTopic(ALL_FILTER_VALUE);
    }
  }, [filterTopic, topicOptions]);

  useEffect(() => {
    if (filterSource !== ALL_FILTER_VALUE && !sourceOptions.includes(filterSource)) {
      setFilterSource(ALL_FILTER_VALUE);
    }
  }, [filterSource, sourceOptions]);

  const filtered = visibleRows.filter(r => {
    const sourceLabel = displayFailureSource(r.source);
    const matchSearch = r.question.toLowerCase().includes(search.toLowerCase()) ||
      r.topic.toLowerCase().includes(search.toLowerCase()) ||
      r.addedBy.toLowerCase().includes(search.toLowerCase());
    const matchTopic = filterTopic === ALL_FILTER_VALUE || r.topic === filterTopic;
    const matchSource = filterSource === ALL_FILTER_VALUE || sourceLabel === filterSource;
    const matchStatus = filterStatus === ALL_FILTER_VALUE || r.status === filterStatus;
    const matchRisk = filterRisk === ALL_FILTER_VALUE || r.risk === filterRisk;
    return matchSearch && matchTopic && matchSource && matchStatus && matchRisk;
  });

  const updateStatus = async (id: string, status: SheetStatus) => {
    try {
      if (status === "Đã duyệt") {
        await mergeSheetChatbotToFaq(id, currentUserName);
        await loadRows();
        toast.success("Đã cập nhật trạng thái dữ liệu chatbot");
        return;
      }

      const updated = await updateSheetChatbotStatus(id, status);
      setRows(prev => prev.map(row => row.id === updated.id ? updated : row));
      toast.success("Đã cập nhật trạng thái dữ liệu chatbot");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái dữ liệu chatbot");
    }
  };

  const handleDeleteRejected = async (row: SheetRow) => {
    if (row.status !== "Từ chối") return;
    setDeleteTarget(row);
  };

  const confirmDeleteRejected = async () => {
    if (!deleteTarget) return;

    try {
      setDeletingId(deleteTarget.id);
      await deleteSheetChatbotRow(deleteTarget.id);
      setRows((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Đã xóa phản hồi bị từ chối khỏi database.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa phản hồi khỏi database.");
    } finally {
      setDeletingId(null);
    }
  };

  const closeSheetModal = () => {
    setShowAddModal(false);
    setEditingRow(null);
  };

  const kpiCounts = {
    total: filtered.length,
    pending: filtered.filter(r => r.status === "Chờ xử lý").length,
    approved: filtered.filter(r => r.status === "Đã duyệt").length,
    rejected: filtered.filter(r => r.status === "Từ chối").length,
  };

  return (
    <div style={{ padding: "24px", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", gap: "20px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, marginBottom: "4px" }}>
            {role === "manager" ? "Quản lý thư viện phản hồi" : "Thư viện phản hồi của tôi"}
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)", margin: 0 }}>
            {role === "manager" ? "Quản lý, duyệt và cập nhật các phản hồi do nhân viên đề xuất để bổ sung vào kho tri thức của chatbot." : "Các phản hồi bạn đã đề xuất để bổ sung vào kho tri thức của chatbot."}
          </p>
        </div>
        <button
          onClick={() => { setEditingRow(null); setShowAddModal(true); }}
          style={{ padding: "9px 18px", borderRadius: "10px", backgroundColor: NAVY, color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}
        >
          <Plus size={15} /> Thêm phản hồi
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "#fff", borderRadius: "10px", padding: "8px 14px", border: "1px solid rgba(0,62,154,0.1)", flex: 1, minWidth: "200px" }}>
          <Search size={15} style={{ color: "rgba(0,62,154,0.4)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo câu hỏi, chủ đề, nhân viên..." style={{ border: "none", outline: "none", fontSize: "13px", color: NAVY, width: "100%", background: "transparent" }} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: "48px", textAlign: "center", color: "rgba(0,62,154,0.5)", fontSize: "13px" }}>Đang tải thư viện phản hồi từ database...</div>
      ) : (
        <>
          {/* KPI Summary – horizontal inline layout */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: "Tổng dữ liệu", value: rows.length, color: NAVY },
              { label: "Chờ xử lý", value: kpiCounts.pending, color: ORANGE },
              { label: "Đã duyệt", value: kpiCounts.approved, color: "#2563eb" },
              { label: "Từ chối", value: kpiCounts.rejected, color: "#ef4444" },
            ].map(kpi => (
              <div
                key={kpi.label}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  border: "1px solid rgba(0,62,154,0.07)",
                  borderLeft: `4px solid ${kpi.color}`,
                  boxShadow: "0 2px 8px rgba(0,62,154,0.05)",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <span style={{ fontSize: "26px", fontWeight: 700, color: kpi.color, lineHeight: 1, flexShrink: 0 }}>
                  {kpi.value}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "rgba(0,62,154,0.6)", lineHeight: 1.3, alignSelf: "center" }}>
                  {kpi.label}
                </span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,62,154,0.07)", overflow: "hidden", flex: 1, minHeight: 0 }}>
            <div style={{ overflow: "auto", height: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc" }}>
                    <th style={tableHeaderCellStyle}>Thời gian thêm</th>
                    <th style={tableHeaderCellStyle}>Người thêm</th>
                    <th style={tableHeaderCellStyle}>Câu hỏi</th>
                    <th style={tableHeaderCellStyle}>Câu trả lời đúng</th>
                    <th style={tableHeaderCellStyle}>
                      <FilterableHeader label="Chủ đề" value={filterTopic} options={topicOptions} onChange={setFilterTopic} />
                    </th>
                    <th style={tableHeaderCellStyle}>
                      <FilterableHeader label="Nguồn" value={filterSource} options={sourceOptions} onChange={setFilterSource} />
                    </th>
                    <th style={tableHeaderCellStyle}>
                      <FilterableHeader label="Mức rủi ro" value={filterRisk} options={RISK_LEVELS} onChange={setFilterRisk} />
                    </th>
                    <th style={tableHeaderCellStyle}>
                      <FilterableHeader label="Trạng thái" value={filterStatus} options={SHEET_STATUSES} onChange={setFilterStatus} />
                    </th>
                    <th style={actionHeaderCellStyle}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(loadError || filtered.length === 0) && (
                    <tr>
                      <td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "rgba(0,62,154,0.4)", fontSize: "13px" }}>
                        {loadError || "Không có dữ liệu phù hợp"}
                      </td>
                    </tr>
                  )}
                  {!loadError && filtered.map(row => {
                    const sc = statusConfig[row.status] || { bg: "#f1f5f9", color: "#64748b", icon: Clock };
                    const rc = riskConfig[row.risk] || riskConfig["Thấp"];
                    const StatusIcon = sc.icon;
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid rgba(0,62,154,0.04)" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "#f8fafc"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"}
                      >
                        <td style={{ padding: "12px 14px", color: "rgba(0,62,154,0.55)", whiteSpace: "nowrap" }}>{formatAddedAt(row.addedAt)}</td>
                        <td style={{ padding: "12px 14px", color: NAVY, fontWeight: 600, whiteSpace: "nowrap" }}>{row.addedBy}</td>
                        <td className="flic-td-left" style={{ padding: "12px 14px", maxWidth: "200px" }}>
                          <div style={{ color: NAVY, fontWeight: 500, lineHeight: 1.4, fontSize: "12px" }}>{row.question}</div>
                        </td>
                        <td className="flic-td-left" style={{ padding: "12px 14px", maxWidth: "200px" }}>
                          <div style={{ color: "rgba(0,62,154,0.7)", lineHeight: 1.4, fontSize: "12px" }}>{row.correctAnswer.slice(0, 80)}{row.correctAnswer.length > 80 ? "..." : ""}</div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: "#eff6ff", color: "#3b82f6", whiteSpace: "nowrap" }}>{row.topic}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "10px", color: "rgba(0,62,154,0.6)", whiteSpace: "nowrap" }}>{displayFailureSource(row.source)}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: rc.bg, color: rc.color, fontWeight: 600 }}>{row.risk}</span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", backgroundColor: sc.bg, color: sc.color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", whiteSpace: "nowrap" }}>
                            <StatusIcon size={10} /> {row.status}
                          </span>
                        </td>
                        <td style={actionCellStyle}>
                          {role === "manager" ? (
                            <div style={actionButtonGroupStyle}>
                              {row.status === "Chờ xử lý" || row.status === "Cần chỉnh sửa" ? (
                                <>
                                  <button onClick={() => updateStatus(row.id, "Đã duyệt")} style={{ ...actionButtonBaseStyle, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a" }}>Duyệt</button>
                                  <button onClick={() => { setEditingRow(row); setShowAddModal(true); }} style={{ ...actionButtonBaseStyle, border: "1px solid #e9d5ff", background: "#faf5ff", color: "#7c3aed" }}>Chỉnh sửa</button>
                                  <button onClick={() => updateStatus(row.id, "Từ chối")} style={{ ...actionButtonBaseStyle, border: "1px solid rgba(0,62,154,0.12)", background: "#f8fafc", color: "#64748b" }}>Từ chối</button>
                                </>
                              ) : row.status === "Từ chối" ? (
                                <>
                                  <button
                                    aria-label={`Hoàn tác phản hồi ${row.id} về trạng thái Chờ xử lý`}
                                    title="Đưa về Chờ xử lý"
                                    onClick={() => void updateStatus(row.id, "Chờ xử lý")}
                                    style={{ ...actionButtonBaseStyle, width: "28px", height: "24px", padding: 0, border: `1px solid ${NAVY}20`, background: "#eff6ff", color: NAVY, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                  >
                                    <RotateCcw size={13} />
                                  </button>
                                  <button
                                    aria-label={`Xóa phản hồi ${row.id}`}
                                    title="Xóa khỏi database"
                                    onClick={() => void handleDeleteRejected(row)}
                                    style={{ ...actionButtonBaseStyle, width: "28px", height: "24px", padding: 0, border: "1px solid #fecaca", background: "#fff1f2", color: "#dc2626", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              ) : (
                                <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>—</span>
                              )}
                            </div>
                          ) : (
                            <div style={actionButtonGroupStyle}>
                              {row.status === "Cần chỉnh sửa" ? (
                                <button onClick={() => { setEditingRow(row); setShowAddModal(true); }} style={{ ...actionButtonBaseStyle, border: `1px solid #e9d5ff`, background: "#faf5ff", color: "#7c3aed" }}>Chỉnh sửa</button>
                              ) : (
                                <span style={{ fontSize: "11px", color: "rgba(0,62,154,0.4)" }}>{row.status}</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <FeedbackFormDialog
          open
          mode={editingRow ? "edit" : "create"}
          editingId={editingRow?.id}
          prefillData={editingRow ? {
            question: editingRow.question,
            answer: editingRow.correctAnswer,
            topic: editingRow.topic,
            source: editingRow.source,
            risk: editingRow.risk,
            status: editingRow.status,
            notes: editingRow.notes,
          } : undefined}
          onClose={closeSheetModal}
          onSaved={(saved) => {
            setRows((current) => editingRow
              ? current.map((row) => row.id === saved.id ? saved : row)
              : [saved, ...current]);
            setEditingRow(null);
          }}
        />
      )}

      {deleteTarget && (
        <div
          role="presentation"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !deletingId) setDeleteTarget(null);
          }}
          style={{ position: "fixed", inset: 0, zIndex: 320, display: "grid", placeItems: "center", padding: "16px", background: "rgba(0,56,101,0.48)" }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="delete-feedback-title" style={{ width: "min(460px, 100%)", borderRadius: "16px", background: "#fff", padding: "22px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "14px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#fff1f2", color: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Trash2 size={18} />
              </div>
              <div>
                <h3 id="delete-feedback-title" style={{ margin: "0 0 6px", color: NAVY, fontSize: "17px" }}>Xóa phản hồi bị từ chối?</h3>
                <p style={{ margin: 0, color: "rgba(0,56,101,0.68)", fontSize: "13px", lineHeight: 1.5 }}>
                  Phản hồi này sẽ bị xóa vĩnh viễn khỏi database.
                </p>
              </div>
            </div>
            <div style={{ borderRadius: "10px", border: "1px solid rgba(0,56,101,0.08)", background: "#f8fafc", padding: "10px 12px", color: NAVY, fontSize: "12px", fontWeight: 600, lineHeight: 1.45, marginBottom: "18px" }}>
              {deleteTarget.question}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(deletingId)}
                style={{ padding: "9px 15px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.16)", background: "#fff", color: NAVY, cursor: deletingId ? "not-allowed" : "pointer", fontWeight: 600 }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteRejected()}
                disabled={Boolean(deletingId)}
                style={{ padding: "9px 16px", borderRadius: "8px", border: 0, background: deletingId ? "#fca5a5" : "#dc2626", color: "#fff", cursor: deletingId ? "not-allowed" : "pointer", fontWeight: 700 }}
              >
                {deletingId ? "Đang xóa..." : "Xóa khỏi database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
