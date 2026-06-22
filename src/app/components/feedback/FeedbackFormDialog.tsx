import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { AI_FAILURE_TAXONOMY, getAiFailureDefinition } from "../../constants/aiFailureTaxonomy";
import { useAuth } from "../../context/AuthContext";
import {
  createSheetChatbotRow,
  getSheetChatbotDuplicates,
  updateSheetChatbotRow,
  type SheetChatbotRiskLevel,
  type SheetChatbotRow,
  type SheetChatbotStatus,
} from "../../services/sheetChatbotApi";

export type FeedbackFormMode = "create" | "edit";

export interface FeedbackPrefillData {
  question?: string;
  answer?: string;
  topic?: string;
  keyword?: string;
  source?: string;
  conversationId?: string | number;
  messageId?: string | number;
  notes?: string;
  risk?: SheetChatbotRiskLevel;
  status?: SheetChatbotStatus;
}

interface FeedbackFormDialogProps {
  open: boolean;
  mode: FeedbackFormMode;
  editingId?: string;
  prefillData?: FeedbackPrefillData;
  onClose: () => void;
  onSaved?: (row: SheetChatbotRow) => void | Promise<void>;
}

interface FeedbackFormState {
  question: string;
  answer: string;
  topic: string;
  keyword: string;
  source: string;
  conversationId: string;
  messageId: string;
  notes: string;
  risk: SheetChatbotRiskLevel;
  status: SheetChatbotStatus;
}

const STAFF_SOURCE = "Nhân viên đề xuất";
const DEFAULT_SOURCE = STAFF_SOURCE;

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function initialForm(prefill?: FeedbackPrefillData): FeedbackFormState {
  const source = getAiFailureDefinition(prefill?.source)?.apiValue
    ?? (prefill?.source === STAFF_SOURCE ? STAFF_SOURCE : DEFAULT_SOURCE);
  return {
    question: text(prefill?.question),
    answer: text(prefill?.answer),
    topic: text(prefill?.topic) || "Chưa xác định",
    keyword: text(prefill?.keyword),
    source,
    conversationId: text(prefill?.conversationId),
    messageId: text(prefill?.messageId),
    notes: text(prefill?.notes),
    risk: prefill?.risk ?? "Trung bình",
    status: prefill?.status ?? "Chờ xử lý",
  };
}

function normalizeQuestion(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("vi-VN").replace(/\s+/g, " ").trim();
}

function buildNotes(form: FeedbackFormState) {
  const metadata = [
    form.keyword ? `keyword: ${form.keyword}` : "",
    form.conversationId ? `conversationId: ${form.conversationId}` : "",
    form.messageId ? `messageId: ${form.messageId}` : "",
  ].filter(Boolean);
  return [form.notes, ...metadata].filter(Boolean).join("\n");
}

const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(0,56,101,0.16)",
  borderRadius: "8px",
  padding: "9px 11px",
  color: "#003865",
  background: "#fff",
  font: "inherit",
};

const labelStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  color: "#003865",
  fontSize: "12px",
  fontWeight: 600,
};

export function FeedbackFormDialog({
  open,
  mode,
  editingId,
  prefillData,
  onClose,
  onSaved,
}: FeedbackFormDialogProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FeedbackFormState>(() => initialForm(prefillData));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const resetKey = useMemo(() => JSON.stringify({ mode, editingId, prefillData }), [editingId, mode, prefillData]);
  useEffect(() => {
    if (!open) return;
    setForm(initialForm(prefillData));
    setFormError("");
    setSaving(false);
  }, [open, resetKey]);

  if (!open) return null;

  const update = <K extends keyof FeedbackFormState>(key: K, value: FeedbackFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  };

  const handleSave = async () => {
    const question = form.question.trim();
    const answer = form.answer.trim();
    const topic = form.topic.trim();
    if (!question || !answer || !topic) {
      setFormError("Câu hỏi, câu trả lời đúng và chủ đề là bắt buộc.");
      return;
    }
    if (mode === "edit" && !editingId) {
      setFormError("Không tìm thấy mã phản hồi cần chỉnh sửa.");
      return;
    }

    try {
      setSaving(true);
      if (mode === "create") {
        const duplicates = await getSheetChatbotDuplicates(question, 0.82, 5);
        const normalized = normalizeQuestion(question);
        const exactDuplicate = duplicates.find((row) => (
          normalizeQuestion(row.question) === normalized || Number(row.similarity) >= 0.98
        ));
        if (exactDuplicate) {
          setFormError(`Phản hồi cho câu hỏi này đã tồn tại (${exactDuplicate.id}).`);
          return;
        }
      }

      const payload = {
        question,
        correctAnswer: answer,
        topic,
        source: form.source,
        risk: form.risk,
        status: form.status,
        notes: buildNotes(form),
        addedBy: user?.name || user?.username || "Không xác định",
      } as const;
      const saved = mode === "edit"
        ? await updateSheetChatbotRow(editingId!, payload)
        : await createSheetChatbotRow(payload);
      await onSaved?.(saved);
      toast.success(mode === "edit" ? "Đã cập nhật phản hồi." : "Đã thêm phản hồi.");
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Không thể lưu phản hồi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="presentation"
      onKeyDown={(event) => { if (event.key === "Escape" && !saving) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center", padding: "16px", background: "rgba(0,56,101,0.48)" }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="feedback-form-title" style={{ width: "min(620px, 100%)", maxHeight: "92vh", overflowY: "auto", borderRadius: "18px", background: "#fff", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px" }}>
          <h2 id="feedback-form-title" style={{ margin: 0, color: "#003865", fontSize: "18px" }}>
            {mode === "create" ? "Thêm phản hồi" : "Chỉnh sửa phản hồi"}
          </h2>
          <button type="button" aria-label="Đóng form phản hồi" onClick={onClose} disabled={saving} style={{ border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }}><X size={19} /></button>
        </div>

        <div style={{ display: "grid", gap: "14px" }}>
          <label style={labelStyle}>Câu hỏi khách hàng
            <textarea aria-label="Câu hỏi khách hàng" rows={2} value={form.question} onChange={(event) => update("question", event.target.value)} style={{ ...fieldStyle, resize: "vertical" }} />
          </label>
          <label style={labelStyle}>Câu trả lời đúng
            <textarea aria-label="Câu trả lời đúng" rows={4} value={form.answer} onChange={(event) => update("answer", event.target.value)} style={{ ...fieldStyle, resize: "vertical" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <label style={labelStyle}>Chủ đề
              <input aria-label="Chủ đề" value={form.topic} onChange={(event) => update("topic", event.target.value)} style={fieldStyle} />
            </label>
            <label style={labelStyle}>Từ khóa
              <input aria-label="Từ khóa" value={form.keyword} onChange={(event) => update("keyword", event.target.value)} style={fieldStyle} />
            </label>
            <label style={labelStyle}>Nguồn
              <select aria-label="Nguồn" value={form.source} onChange={(event) => update("source", event.target.value)} style={fieldStyle}>
                <option value={STAFF_SOURCE}>{STAFF_SOURCE}</option>
                {AI_FAILURE_TAXONOMY.map((item) => <option key={item.id} value={item.apiValue}>{item.label}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Mức rủi ro
              <select aria-label="Mức rủi ro" value={form.risk} onChange={(event) => update("risk", event.target.value as SheetChatbotRiskLevel)} style={fieldStyle}>
                {(["Thấp", "Trung bình", "Cao"] as const).map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label style={labelStyle}>Conversation ID
              <input aria-label="Conversation ID" value={form.conversationId} onChange={(event) => update("conversationId", event.target.value)} style={fieldStyle} />
            </label>
            <label style={labelStyle}>Message ID
              <input aria-label="Message ID" value={form.messageId} onChange={(event) => update("messageId", event.target.value)} style={fieldStyle} />
            </label>
          </div>
          <label style={labelStyle}>Ghi chú nội bộ
            <textarea aria-label="Ghi chú nội bộ" rows={2} value={form.notes} onChange={(event) => update("notes", event.target.value)} style={{ ...fieldStyle, resize: "vertical" }} />
          </label>
          {formError && <div role="alert" style={{ borderRadius: "8px", background: "#fff1f1", color: "#b42318", padding: "9px 11px", fontSize: "12px" }}>{formError}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: "9px 16px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.18)", background: "#fff", color: "#003865", cursor: "pointer" }}>Hủy</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ padding: "9px 18px", borderRadius: "8px", border: 0, background: saving ? "#94a3b8" : "#ed5206", color: "#fff", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Đang lưu..." : mode === "create" ? "Lưu phản hồi" : "Cập nhật phản hồi"}
          </button>
        </div>
      </div>
    </div>
  );
}
