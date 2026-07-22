import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { getDashboardTopQuestionDetails, getDashboardTopQuestions } from "../../services/dashboardApi";
import { getSheetChatbotDuplicates } from "../../services/sheetChatbotApi";
import type { TopQuestion } from "../../types/dashboard";
import { getDateParamsFromFilters } from "../../utils/dateFilters";
import type { FilterValues } from "../FilterPanel";
import { FeedbackFormDialog } from "../feedback/FeedbackFormDialog";

const NAVY = "#003865";
const BLUE = "#003BB9";
const ORANGE = "#D73C01";
const DETAIL_PAGE_SIZE = 10;

function viNum(value: number) {
  return value.toLocaleString("vi-VN");
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi-VN").trim();
}

export function TopQuestionsSection({ filters }: { filters: FilterValues }) {
  const [rows, setRows] = useState<TopQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("ok");
  const [statusMessage, setStatusMessage] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [feedbackQuestion, setFeedbackQuestion] = useState<TopQuestion | null>(null);
  const [checkingFaqId, setCheckingFaqId] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<TopQuestion | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailPage, setDetailPage] = useState(1);
  const [detailRows, setDetailRows] = useState<Array<{ question: string; count: number }>>([]);
  const [detailPagination, setDetailPagination] = useState({ page: 1, pageSize: DETAIL_PAGE_SIZE, total: 0, totalPages: 0 });
  const [detailTotalCount, setDetailTotalCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getDashboardTopQuestions({
      ...getDateParamsFromFilters(filters),
      channel: filters.channel,
      topic: filters.topic,
      limit: 50,
      signal: controller.signal,
    }).then((result) => {
      setRows(result.topQuestions);
      setStatus(result.topQuestionsStatus);
      setStatusMessage(result.topQuestionsMessage);
    }).catch((reason) => {
      if (reason?.name !== "AbortError") setError(reason?.message || "Không thể tải câu hỏi nổi bật.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [filters, reloadVersion]);

  const visibleRows = useMemo(() => {
    const keyword = normalizeSearch(search);
    if (!keyword) return rows.slice(0, 5);
    return rows.filter((row) => normalizeSearch(row.question).includes(keyword));
  }, [rows, search]);

  const openDetails = useCallback((question: TopQuestion) => {
    setSelectedQuestion(question);
    setDetailSearch("");
    setDetailPage(1);
    setDetailRows([]);
    setDetailTotalCount(question.count);
    setDetailError("");
  }, []);

  const openFaq = useCallback(async (question: TopQuestion) => {
    try {
      setCheckingFaqId(question.question);
      const duplicates = await getSheetChatbotDuplicates(question.question, 0.8, 1);
      if (duplicates.length > 0) {
        toast.info("Đã tồn tại trong thư viện phản hồi");
        return;
      }
      setFeedbackQuestion(question);
    } catch (reason: any) {
      toast.error(reason?.message || "Lỗi kiểm tra thư viện phản hồi");
    } finally {
      setCheckingFaqId(null);
    }
  }, []);

  useEffect(() => {
    if (!selectedQuestion) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const dateParams = getDateParamsFromFilters(filters);
        const result = await getDashboardTopQuestionDetails({
          question: selectedQuestion.question,
          startDate: dateParams.startDate!,
          endDate: dateParams.endDate!,
          channel: filters.channel,
          topic: filters.topic,
          search: detailSearch,
          page: detailPage,
          pageSize: DETAIL_PAGE_SIZE,
          signal: controller.signal,
        });
        setDetailRows(result.records);
        setDetailPagination(result.pagination);
        setDetailTotalCount(result.totalCount);
        if (result.pagination.page !== detailPage) setDetailPage(result.pagination.page || 1);
      } catch (reason: any) {
        if (reason?.name !== "AbortError") {
          setDetailRows([]);
          setDetailError(reason?.message || "Không thể tải chi tiết câu hỏi nổi bật.");
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }, detailSearch.trim() ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [selectedQuestion, detailPage, detailSearch, filters]);

  return <>
    <section style={{ backgroundColor: "#fff", borderRadius: "16px", border: "1px solid rgba(0,59,185,0.07)", boxShadow: "0 2px 10px rgba(0,59,185,0.05)", overflow: "hidden", marginBottom: "24px" }}>
      <header style={{ padding: "16px 22px", borderBottom: "1px solid rgba(0,59,185,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
        <h3 style={{ color: BLUE, fontSize: "14px", fontWeight: 700, margin: 0 }}>Câu hỏi nổi bật từ khách hàng</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <label style={{ width: "min(320px, 64vw)", display: "flex", alignItems: "center", gap: "8px", border: "1px solid rgba(0,59,185,0.12)", background: "#fff", borderRadius: "10px", padding: "7px 10px", color: "rgba(0,59,185,0.48)" }}>
            <Search size={14} aria-hidden="true" />
            <input aria-label="Tìm kiếm câu hỏi nổi bật" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm câu hỏi nổi bật..." style={{ minWidth: 0, flex: 1, border: "none", outline: "none", color: NAVY, fontSize: "12px", background: "transparent" }} />
            {search && <button type="button" aria-label="Xóa tìm kiếm câu hỏi nổi bật" onClick={() => setSearch("")} style={{ border: "none", background: "transparent", color: "rgba(0,59,185,0.42)", cursor: "pointer", padding: "2px", display: "flex" }}><X size={13} /></button>}
          </label>
          <button type="button" onClick={() => setReloadVersion((value) => value + 1)} disabled={loading} style={{ fontSize: "12px", color: BLUE, border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", padding: "7px 12px", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.6 : 1 }}><RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Làm mới</button>
        </div>
      </header>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead><tr style={{ backgroundColor: "#f8fafc" }}>{["STT", "Câu hỏi tổng quát", "Số lượng", "Hành động"].map((label) => <th key={label} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "rgba(0,59,185,0.5)", fontSize: "11px", letterSpacing: "0.04em", borderBottom: "1px solid rgba(0,59,185,0.06)" }}>{label}</th>)}</tr></thead>
        <tbody>
          {(loading || error || status === "ai_overloaded" || visibleRows.length === 0) && <tr><td colSpan={4} style={{ padding: "18px 16px", color: error || status === "ai_overloaded" ? ORANGE : "rgba(0,59,185,0.55)", fontWeight: 600 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : error ? <AlertTriangle size={14} /> : null}
              {loading ? "Đang tải câu hỏi nổi bật theo bộ lọc..." : error || (status === "ai_overloaded" ? statusMessage || "Hệ thống AI hiện đang quá tải." : rows.length === 0 ? "Database chưa có câu hỏi khách hàng phù hợp trong bộ lọc hiện tại." : "Không tìm thấy câu hỏi nổi bật phù hợp với từ khóa.")}
              {error && <button type="button" onClick={() => setReloadVersion((value) => value + 1)} style={{ border: "1px solid rgba(0,59,185,0.18)", background: "#fff", color: BLUE, borderRadius: "7px", padding: "4px 9px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Thử lại</button>}
            </span>
          </td></tr>}
          {!loading && !error && status !== "ai_overloaded" && visibleRows.map((question, index) => <tr key={`${question.question}-${index}`} style={{ borderBottom: "1px solid rgba(0,59,185,0.04)" }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "#f8fafc"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}>
            <td style={{ padding: "12px 16px", color: "rgba(0,59,185,0.3)", fontWeight: 700, fontSize: "12px" }}>#{index + 1}</td>
            <td
              className="flic-td-left"
              style={{
                padding: "12px 16px",
                color: "#F36C2E",
                fontWeight: 600,
                maxWidth: "520px",
                lineHeight: 1.45,
              }}
            >
              {question.question}
            </td>
            <td style={{ padding: "12px 16px", fontWeight: 700, color: BLUE }}>{viNum(question.count)}</td>
            <td style={{ padding: "12px 16px" }}><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => openDetails(question)} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.2)", background: "#f8fafc", color: BLUE, cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px" }}><Eye size={10} /> Chi tiết</button>
              <button type="button" onClick={() => openFaq(question)} disabled={checkingFaqId === question.question} style={{ padding: "4px 9px", borderRadius: "7px", border: "1px solid rgba(0,59,185,0.15)", background: "#fff", color: "rgba(0,59,185,0.65)", cursor: checkingFaqId === question.question ? "not-allowed" : "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "3px", opacity: checkingFaqId === question.question ? 0.6 : 1 }}>{checkingFaqId === question.question ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />} Thêm FAQ</button>
            </div></td>
          </tr>)}
        </tbody>
      </table></div>
    </section>

    {feedbackQuestion && <FeedbackFormDialog open mode="create" prefillData={{ question: feedbackQuestion.question, answer: "", topic: feedbackQuestion.topic, notes: `Nguồn: Câu hỏi nổi bật; kênh: ${feedbackQuestion.channel}` }} onClose={() => setFeedbackQuestion(null)} />}

    {selectedQuestion && <div onClick={() => setSelectedQuestion(null)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div role="dialog" aria-modal="true" aria-label="Chi tiết câu hỏi nổi bật" onClick={(event) => event.stopPropagation()} style={{ width: "min(760px, 100%)", height: "min(760px, calc(100vh - 40px))", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <header style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,59,185,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexShrink: 0 }}><div><h3 style={{ margin: 0, color: NAVY, fontSize: "16px", fontWeight: 700 }}>Chi tiết câu hỏi nổi bật</h3><div style={{ marginTop: "4px", color: "rgba(0,59,185,0.55)", fontSize: "12px" }}>Tổng số câu hỏi liên quan: <strong>{viNum(detailTotalCount || selectedQuestion.count)}</strong></div></div><button type="button" onClick={() => setSelectedQuestion(null)} aria-label="Đóng chi tiết" style={{ border: "none", background: "transparent", color: "rgba(0,59,185,0.55)", cursor: "pointer", padding: "4px" }}><X size={18} /></button></header>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0, overflow: "hidden" }}>
          <div style={{ border: "1px solid rgba(0,59,185,0.08)", background: "#f8fafc", borderRadius: "12px", padding: "14px 16px", flexShrink: 0 }}><div style={{ color: "rgba(0,59,185,0.55)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "6px" }}>Câu hỏi tổng quát</div><div style={{ color: NAVY, fontSize: "15px", fontWeight: 700, lineHeight: 1.45 }}>{selectedQuestion.question}</div></div>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", border: "1px solid rgba(0,59,185,0.12)", borderRadius: "10px", padding: "9px 12px", flexShrink: 0 }}><Search size={15} style={{ color: "rgba(0,59,185,0.45)" }} /><input aria-label="Tìm trong câu hỏi liên quan" value={detailSearch} onChange={(event) => { setDetailSearch(event.target.value); setDetailPage(1); }} placeholder="Tìm trong danh sách câu hỏi liên quan..." style={{ border: "none", outline: "none", flex: 1, color: NAVY, fontSize: "13px" }} /></label>
          <div style={{ border: "1px solid rgba(0,59,185,0.08)", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", color: "rgba(0,59,185,0.55)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>Các câu hỏi liên quan</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{detailLoading ? <div style={{ padding: "18px 14px", color: "rgba(0,59,185,0.55)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}><Loader2 size={15} className="animate-spin" /> Đang tải dữ liệu chi tiết...</div> : detailError ? <div style={{ padding: "18px 14px", color: ORANGE, fontSize: "13px" }}>{detailError}</div> : detailRows.length === 0 ? <div style={{ padding: "18px 14px", color: "rgba(0,59,185,0.55)", fontSize: "13px" }}>Không tìm thấy câu hỏi phù hợp với bộ lọc.</div> : detailRows.map((row, index) => <div key={`${row.question}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", padding: "12px 14px", borderTop: index === 0 ? "none" : "1px solid rgba(0,59,185,0.06)", alignItems: "start" }}><div style={{ color: NAVY, fontSize: "13px", lineHeight: 1.45 }}>{row.question}</div><span style={{ fontSize: "12px", fontWeight: 700, color: ORANGE, background: "#FFF4EE", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{viNum(row.count)}</span></div>)}</div>
            <footer style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,59,185,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexShrink: 0 }}><span style={{ fontSize: "11px", color: "rgba(0,59,185,0.55)" }}>{detailPagination.total > 0 ? `${(detailPagination.page - 1) * DETAIL_PAGE_SIZE + 1}–${Math.min(detailPagination.page * DETAIL_PAGE_SIZE, detailPagination.total)} / ${viNum(detailPagination.total)} dòng` : "0 dòng"}</span><div style={{ display: "flex", alignItems: "center", gap: "8px" }}><button type="button" disabled={detailLoading || detailPagination.page <= 1} onClick={() => setDetailPage((page) => Math.max(1, page - 1))}>‹</button><span style={{ fontSize: "12px", fontWeight: 700, color: NAVY }}>Trang {detailPagination.page}/{Math.max(detailPagination.totalPages, 1)}</span><button type="button" disabled={detailLoading || detailPagination.page >= detailPagination.totalPages} onClick={() => setDetailPage((page) => page + 1)}>›</button></div></footer>
          </div>
        </div>
      </div>
    </div>}
  </>;
}
