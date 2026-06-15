import re

with open('src/app/components/screens/AIInsights.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find where the `return (` starts inside AIInsights
idx = content.find('  return (')
if idx != -1:
    jsx_content = content[idx:]
    
    top_part = """import React, { useState, useEffect } from "react";
import { Brain, AlertTriangle, CheckCircle, XCircle, HelpCircle, ShieldAlert, TrendingUp, ChevronDown, ChevronUp, FilePlus2, Clock, Table2, Activity } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ChartCard } from "../ChartCard";
import { FilterPanel, FilterValues } from "../FilterPanel";
import { toast } from "sonner";

const NAVY    = "#003865";
const ORANGE  = "#D73C01";
const CTA     = "#ED5206";
const CTA_SOFT= "#F36C2E";
const ORANGE_50 = "#FFF4EE";
const ORANGE_200= "#FBCBB8";
const AMBER_50  = "#FFF7E6";
const AMBER_100 = "#FADFA8";
const AMBER_TEXT= "#B7791F";
const RED_50    = "#FFF1F1";
const RED_100   = "#F8CACA";
const RED_TEXT  = "#B42318";

type FailReason = "Không tìm thấy dữ liệu" | "Không hiểu intent" | "AI không chắc chắn" | "Câu hỏi ngoài phạm vi" | "AI có nguy cơ tự tạo thông tin" | "AI trả lời sai" | string;

const failReasonColor: Record<FailReason, string> = {
  "Không tìm thấy dữ liệu": ORANGE,
  "Không hiểu intent": "#8b5cf6",
  "AI không chắc chắn": AMBER_TEXT,
  "Câu hỏi ngoài phạm vi": "#64748b",
  "AI có nguy cơ tự tạo thông tin": RED_TEXT,
  "AI trả lời sai": RED_TEXT,
};

const priorityColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: ORANGE_50,  color: ORANGE },
  "Ưu tiên trung bình": { bg: AMBER_50,  color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#EAF8F1",  color: "#228A61" },
};

const impactColor: Record<string, { bg: string; color: string }> = {
  "Ưu tiên cao":         { bg: RED_50,    color: RED_TEXT },
  "Ưu tiên trung bình": { bg: AMBER_50, color: AMBER_TEXT },
  "Ưu tiên thấp":        { bg: "#f1f5f9", color: "#64748b" },
};

interface AIInsightsProps {
  filters: FilterValues;
  onFiltersChange: (f: FilterValues) => void;
  onNavigate: (s: string) => void;
}

export function AIInsights({ filters, onFiltersChange, onNavigate }: AIInsightsProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [qualityMetrics, setQualityMetrics] = useState<any>({ total_messages: 0, success_rate: 0, failure_count: 0, hallucination_count: 0, avg_confidence: 0 });
  const [staffActivity, setStaffActivity] = useState<any>({ reported_errors: 0, pending_review: 0 });
  const [failureTrend, setFailureTrend] = useState<any[]>([]);
  const [failureByTopic, setFailureByTopic] = useState<any[]>([]);
  const [failedConversations, setFailedConversations] = useState<any[]>([]);
  const [staffReportedErrors, setStaffReportedErrors] = useState<any[]>([]);
  const [suggestedFAQs, setSuggestedFAQs] = useState<any[]>([]);

  useEffect(() => {
    let queryParams = new URLSearchParams();
    if (filters.dateRange) queryParams.set("dateRange", filters.dateRange);
    if (filters.channel) queryParams.set("channel", filters.channel);
    if (filters.topic) queryParams.set("topic", filters.topic);
    const qs = queryParams.toString();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [qmRes, saRes, ftRes, fbtRes, fcRes, sreRes, sfRes] = await Promise.all([
          fetch(`/api/analytics/ai/quality-metrics?${qs}`),
          fetch(`/api/analytics/ai/staff-activity?${qs}`),
          fetch(`/api/analytics/ai/failure-trend?${qs}`),
          fetch(`/api/analytics/ai/failure-by-topic?${qs}`),
          fetch(`/api/analytics/ai/failed-conversations?${qs}`),
          fetch(`/api/analytics/ai/staff-reported-errors?${qs}`),
          fetch(`/api/analytics/ai/suggested-faqs?${qs}`)
        ]);
        
        const [qm, sa, ft, fbt, fc, sre, sf] = await Promise.all([
          qmRes.json(), saRes.json(), ftRes.json(), fbtRes.json(), fcRes.json(), sreRes.json(), sfRes.json()
        ]);
        
        if (qm.success) setQualityMetrics(qm.data);
        if (sa.success) setStaffActivity(sa.data);
        if (ft.success) setFailureTrend(ft.data);
        if (fbt.success) setFailureByTopic(fbt.data);
        if (fc.success) setFailedConversations(fc.data.records.map((r: any) => ({
          id: r.id, question: r.textContent || "Không có nội dung", aiAnswer: r.sentimentReason || "Không có câu trả lời AI",
          topic: r.detectedTopics?.[0] || "Khác", channel: r.source || "Unknown", failReason: r.issueType || "Không xác định",
          confidence: r.issueConfidence || 0, impact: "Ưu tiên cao", kbSuggestion: r.issueReason || "Cần bổ sung kiến thức"
        })));
        if (sre.success) setStaffReportedErrors(sre.data.records.map((r: any) => ({
          id: r.id, time: r.messageAt || "Hôm nay", staff: "Admin", channel: r.source || "Unknown",
          topic: r.detectedTopics?.[0] || "Khác", question: r.textContent || "", aiAnswer: r.sentimentReason || "",
          reason: r.issueType || "AI trả lời sai", impact: "Ưu tiên trung bình", status: "Chờ quản lý xác nhận"
        })));
        if (sf.success) setSuggestedFAQs(sf.data);
      } catch (err) {
        toast.error("Lỗi khi tải dữ liệu Phân tích AI");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters]);

  const handleAddFaq = async (question: string, topic: string) => {
    try {
      const res = await fetch("/api/sheet-chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          correctAnswer: "Đang cập nhật...",
          topic,
          source: "Phân tích AI"
        })
      });
      if (res.ok) {
        toast.success("Đã thêm FAQ thành công vào Sheet Chatbot");
      } else {
        toast.error("Thêm FAQ thất bại");
      }
    } catch (e) {
      toast.error("Lỗi khi thêm FAQ");
    }
  };

"""
    
    # We also need to replace the static metric values with dynamic ones
    # For KPI row 1:
    jsx_content = re.sub(
        r'value: "86,5%"',
        r'value: `${qualityMetrics.success_rate}%`',
        jsx_content
    )
    jsx_content = re.sub(
        r'value: "215"',
        r'value: qualityMetrics.failure_count.toString()',
        jsx_content
    )
    jsx_content = re.sub(
        r'value: "19"',
        r'value: qualityMetrics.hallucination_count.toString()',
        jsx_content
    )
    jsx_content = re.sub(
        r'value: "84%"',
        r'value: `${qualityMetrics.avg_confidence.toFixed(1)}%`',
        jsx_content
    )
    
    # For KPI row 2:
    jsx_content = re.sub(
        r'value: "47"',
        r'value: staffActivity.reported_errors.toString()',
        jsx_content
    )
    jsx_content = re.sub(
        r'value: "12"',
        r'value: staffActivity.pending_review.toString()',
        jsx_content
    )
    # The others we can leave static or mock if we didn't add API for them
    
    # Update handleAddFaq call in the button
    jsx_content = re.sub(
        r'onClick=\{\(\) => toast\.success\("Đã thêm FAQ đề xuất"\)\}',
        r'onClick={() => handleAddFaq(conv.question, conv.topic)}',
        jsx_content
    )
    jsx_content = re.sub(
        r'onClick=\{\(\) => toast\.success\("Đã thêm vào FAQ đề xuất"\)\}',
        r'onClick={() => handleAddFaq(conv.question, conv.topic)}',
        jsx_content
    )
    jsx_content = re.sub(
        r'onClick=\{\(\) => toast\.success\("Đã bổ sung dữ liệu AI"\)\}',
        r'onClick={() => handleAddFaq(faq.question, faq.topic)}',
        jsx_content
    )

    with open('src/app/components/screens/AIInsights.tsx', 'w', encoding='utf-8') as f:
        f.write(top_part + jsx_content)
