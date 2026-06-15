import { useState } from "react";
import {
  ChevronDown, ChevronRight, BarChart, LineChart, PieChart, AreaChart, ArrowLeft, Save, RefreshCw, GripVertical,
  AlertTriangle, Bot, Frown, Search, Clock, User
} from "lucide-react";
import {
  BarChart as ReBarChart, Bar, LineChart as ReLineChart, Line,
  PieChart as RePieChart, Pie, Cell, AreaChart as ReAreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { useSettings } from "../../context/SettingsContext";

const NAVY = "#003865";
const ORANGE = "#D73C01";

// fieldGroups is moved inside the component to be dynamic

const chartTypeOptions = [
  { id: "bar", label: "Cột đứng", icon: BarChart },
  { id: "line", label: "Đường", icon: LineChart },
  { id: "area", label: "Vùng", icon: AreaChart },
  { id: "donut", label: "Hình khuyên (Donut)", icon: PieChart },
  { id: "pie", label: "Hình tròn", icon: PieChart },
  { id: "hbar", label: "Cột ngang", icon: BarChart },
];

const templateCards = [
  { title: "Số hội thoại theo kênh 30 ngày", desc: "Biểu đồ cột - Zalo Business / Facebook / Zalo OA / Chat Widget", icon: BarChart },
  { title: "Hội thoại chờ xử lý theo chủ đề", desc: "Biểu đồ cột ngang - TOEIC / VSTEP / Chuẩn đầu ra...", icon: AlertTriangle },
  { title: "AI thất bại theo chủ đề", desc: "Biểu đồ cột chồng - Thiếu dữ liệu / Không hiểu intent...", icon: Bot },
  { title: "Cảm xúc tiêu cực theo kênh", desc: "Biểu đồ cột - Tỷ lệ tiêu cực / kênh", icon: Frown },
  { title: "Xu hướng câu hỏi VSTEP theo tuần", desc: "Biểu đồ đường - Số câu hỏi VSTEP theo thời gian", icon: LineChart },
  { title: "Top keyword TOEIC trong tháng", desc: "Biểu đồ cột ngang - Top 10 từ khóa TOEIC", icon: Search },
  { title: "Thời gian phản hồi TB theo ngày", desc: "Biểu đồ vùng - Thời gian xử lý trung bình", icon: Clock },
  { title: "Hội thoại chờ quản lý xác nhận theo kênh", desc: "Biểu đồ cột - Chờ quản lý xác nhận / kênh / tuần", icon: User },
];

const previewData = [
  { name: "TOEIC", value: 420, ai_ok: 360, ai_fail: 60 },
  { name: "VSTEP", value: 280, ai_ok: 230, ai_fail: 50 },
  { name: "Chuẩn đầu ra", value: 350, ai_ok: 295, ai_fail: 55 },
  { name: "MOS/IC3", value: 190, ai_ok: 158, ai_fail: 32 },
  { name: "Tin học", value: 240, ai_ok: 195, ai_fail: 45 },
];

const COLORS = [NAVY, ORANGE, "rgba(0,56,101,0.6)", "rgba(215,60,1,0.6)", "rgba(0,56,101,0.3)", "rgba(215,60,1,0.3)"];

interface ChartBuilderProps {
  onNavigate: (s: string) => void;
}

export function ChartBuilder({ onNavigate }: ChartBuilderProps) {
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Chủ đề", "Hiệu suất AI"]);
  const [selectedChartType, setSelectedChartType] = useState("bar");
  const [axisX, setAxisX] = useState("Chủ đề");
  const [values, setValues] = useState("Tổng hội thoại");
  const [theme, setTheme] = useState("FLIC Brand");
  const [showLegend, setShowLegend] = useState(true);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [chartTitle, setChartTitle] = useState("Biểu đồ mới");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const { settings } = useSettings();

  const channelFields = [];
  if (settings.dataSourceZaloBiz) channelFields.push("Zalo Business");
  if (settings.dataSourceFb) channelFields.push("Facebook");
  if (settings.dataSourceZalo) channelFields.push("Zalo OA");
  if (settings.dataSourceWidget) channelFields.push("Chat Widget");

  const dynamicFieldGroups = [
    { label: "Thời gian", fields: ["Ngày", "Tuần", "Tháng", "Quý"] },
    { label: "Hội thoại", fields: ["Tổng hội thoại", "Hội thoại chờ xử lý", "Hội thoại chờ quản lý xác nhận", "Thời gian xử lý TB"] },
    { label: "Kênh", fields: channelFields },
    { label: "Chủ đề", fields: ["TOEIC", "VSTEP", "Chuẩn đầu ra", "MOS/IC3", "Tin học cơ sở", "Lịch thi", "Lệ phí"] },
    { label: "Hiệu suất AI", fields: ["Tỷ lệ AI thành công", "Tỷ lệ AI thất bại", "Tỷ lệ AI tự tạo thông tin", "Điểm tin cậy TB"] },
    { label: "Cảm xúc", fields: ["Cảm xúc tích cực", "Cảm xúc trung lập", "Cảm xúc tiêu cực", "Điểm cảm xúc TB"] },
  ];

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  const handleSaveDashboard = () => {
    toast.success("Đã lưu vào Dashboard", { description: `Biểu đồ "${chartTitle}" đã được thêm vào Tổng quan` });
  };

  // Dynamic mock datasets based on selected Axis X and Values
  const getDynamicData = () => {
    let labels: string[] = [];
    if (axisX === "Chủ đề") {
      labels = ["TOEIC", "VSTEP", "Chuẩn đầu ra", "MOS/IC3", "Tin học"];
    } else if (axisX === "Kênh") {
      labels = channelFields;
    } else if (axisX === "Ngày") {
      labels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
    } else { // Tháng
      labels = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5"];
    }

    return labels.map((label, index) => {
      const multiplier = (index + 1) * 20;
      let val = 120 + multiplier;
      let ok = Math.round(val * 0.85);
      let fail = val - ok;
      
      if (values === "AI thành công") {
        return { name: label, value: ok, "AI thành công": ok };
      } else if (values === "AI thất bại") {
        return { name: label, value: fail, "AI thất bại": fail };
      } else if (values === "Cảm xúc") {
        const pos = Math.round(val * 0.65);
        const neu = Math.round(val * 0.20);
        const neg = val - pos - neu;
        return { name: label, value: pos, "Tích cực": pos, "Trung lập": neu, "Tiêu cực": neg };
      } else { // Tổng hội thoại
        return { name: label, value: val, "Tổng hội thoại": val, "AI thành công": ok, "AI thất bại": fail };
      }
    });
  };

  const getThemeColors = () => {
    if (theme === "Xanh Navy") return ["#001C30", "#1565C0", "#42A5F5", "#7BB6FF", "#90CAF9"];
    if (theme === "Đơn sắc") return ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8"];
    if (theme === "Gam màu ấm") return ["#D73C01", "#f59e0b", "#f43f5e", "#ec4899", "#fda4af"];
    return ["#003865", "#D73C01", "#228A61", "#E5A850", "#D26767"]; // FLIC Brand
  };

  const applyTemplate = (title: string) => {
    setSelectedTemplate(title);
    setChartTitle(title);
    
    if (title === "Số hội thoại theo kênh 30 ngày") {
      setSelectedChartType("bar");
      setAxisX("Kênh");
      setValues("Tổng hội thoại");
    } else if (title === "Hội thoại chờ xử lý theo chủ đề") {
      setSelectedChartType("hbar");
      setAxisX("Chủ đề");
      setValues("Tổng hội thoại");
    } else if (title === "AI thất bại theo chủ đề") {
      setSelectedChartType("bar");
      setAxisX("Chủ đề");
      setValues("AI thất bại");
    } else if (title === "Cảm xúc tiêu cực theo kênh") {
      setSelectedChartType("bar");
      setAxisX("Kênh");
      setValues("Cảm xúc");
    } else if (title === "Xu hướng câu hỏi VSTEP theo tuần") {
      setSelectedChartType("line");
      setAxisX("Ngày");
      setValues("Tổng hội thoại");
    } else if (title === "Top keyword TOEIC trong tháng") {
      setSelectedChartType("hbar");
      setAxisX("Chủ đề");
      setValues("Tổng hội thoại");
    } else if (title === "Thời gian phản hồi TB theo ngày") {
      setSelectedChartType("area");
      setAxisX("Ngày");
      setValues("Tổng hội thoại");
    } else if (title === "Hội thoại chờ quản lý xác nhận theo kênh") {
      setSelectedChartType("bar");
      setAxisX("Kênh");
      setValues("Tổng hội thoại");
    }
    toast.success("Đã tải template thành công");
  };

  const renderPreview = () => {
    const currentData = getDynamicData();
    const themeColors = getThemeColors();
    
    // Determine drawing keys
    let renderKeys: { key: string; name: string; color: string }[] = [];
    if (values === "Cảm xúc") {
      renderKeys = [
        { key: "Tích cực", name: "Tích cực", color: theme === "Gam màu ấm" ? "#f43f5e" : "#228A61" },
        { key: "Trung lập", name: "Trung lập", color: theme === "Gam màu ấm" ? "#f59e0b" : "#E5A850" },
        { key: "Tiêu cực", name: "Tiêu cực", color: theme === "Gam màu ấm" ? "#D73C01" : "#D26767" },
      ];
    } else if (values === "AI thành công") {
      renderKeys = [{ key: "AI thành công", name: "AI trả lời thành công", color: themeColors[2] || "#228A61" }];
    } else if (values === "AI thất bại") {
      renderKeys = [{ key: "AI thất bại", name: "AI trả lời thất bại", color: themeColors[1] || "#D73C01" }];
    } else { // Tổng hội thoại
      renderKeys = [
        { key: "Tổng hội thoại", name: "Tổng hội thoại", color: themeColors[0] || "#003865" },
        { key: "AI thành công", name: "AI trả lời thành công", color: themeColors[2] || "#228A61" },
      ];
    }

    if (selectedChartType === "donut" || selectedChartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RePieChart>
            <Pie data={currentData} cx="50%" cy="50%" innerRadius={selectedChartType === "donut" ? 70 : 0} outerRadius={110} dataKey="value">
              {currentData.map((entry, i) => <Cell key={`builder-pie-${entry.name}`} fill={themeColors[i % themeColors.length]} />)}
            </Pie>
            <Tooltip />
            {showLegend && <Legend />}
          </RePieChart>
        </ResponsiveContainer>
      );
    }
    if (selectedChartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ReLineChart data={currentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
            <Tooltip />
            {showLegend && <Legend />}
            {renderKeys.map(k => (
              <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} strokeWidth={2.5} dot={{ r: 4 }} />
            ))}
          </ReLineChart>
        </ResponsiveContainer>
      );
    }
    if (selectedChartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ReAreaChart data={currentData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
            <Tooltip />
            {showLegend && <Legend />}
            {renderKeys.map(k => (
              <Area key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} fill={`${k.color}20`} strokeWidth={2} />
            ))}
          </ReAreaChart>
        </ResponsiveContainer>
      );
    }
    if (selectedChartType === "hbar") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <ReBarChart data={currentData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} width={90} />
            <Tooltip />
            {showLegend && <Legend />}
            {renderKeys.map(k => (
              <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} radius={[0, 4, 4, 0]} />
            ))}
          </ReBarChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ReBarChart data={currentData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
          <YAxis tick={{ fontSize: 12, fill: "rgba(0,56,101,0.5)" }} />
          <Tooltip />
          {showLegend && <Legend />}
          {renderKeys.map(k => (
            <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} radius={[5, 5, 0, 0]} />
          ))}
        </ReBarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 72px)", overflow: "hidden", backgroundColor: "#f8fafc" }}>
      {/* Left: Field Panel */}
      <div style={{ width: "260px", flexShrink: 0, backgroundColor: "#fff", borderRight: "1px solid rgba(0,56,101,0.08)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(0,56,101,0.06)" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,56,101,0.5)", letterSpacing: "0.08em", marginBottom: "4px" }}>TRƯỜNG DỮ LIỆU</div>
          <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.35)" }}>Kéo thả vào vùng biểu đồ</div>
        </div>
        {dynamicFieldGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.label);
          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                style={{ width: "100%", padding: "10px 16px", display: "flex", alignItems: "center", gap: "8px", border: "none", background: "transparent", cursor: "pointer", color: NAVY, fontSize: "13px", fontWeight: 600 }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {group.label}
              </button>
              {isExpanded && (
                <div style={{ padding: "4px 12px 8px" }}>
                  {group.fields.map((field) => (
                    <div
                      key={field}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", JSON.stringify({ field, groupLabel: group.label }));
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 10px",
                        borderRadius: "8px",
                        cursor: "grab",
                        marginBottom: "2px",
                        transition: "background 0.15s",
                        fontSize: "12px",
                        color: "rgba(0,56,101,0.7)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = "#f4f6fa"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"}
                    >
                      <GripVertical size={12} style={{ color: "rgba(0,56,101,0.3)" }} />
                      {field}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Center: Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Workspace Header */}
        <div style={{ padding: "16px 24px", backgroundColor: "#fff", borderBottom: "1px solid rgba(0,56,101,0.08)", display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => onNavigate("overview")}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", cursor: "pointer", color: NAVY, fontSize: "13px" }}
          >
            <ArrowLeft size={14} /> Quay lại Dashboard
          </button>
          <input
            value={chartTitle}
            onChange={(e) => setChartTitle(e.target.value)}
            style={{ flex: 1, padding: "7px 14px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "15px", fontWeight: 600, color: NAVY, outline: "none" }}
          />
          <button
            onClick={() => { setChartTitle("Biểu đồ mới"); setSelectedChartType("bar"); setSelectedTemplate(null); toast.info("Đã đặt lại biểu đồ"); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(0,56,101,0.12)", background: "#fff", cursor: "pointer", color: NAVY, fontSize: "13px" }}
          >
            <RefreshCw size={14} /> Đặt lại
          </button>
          <button
            onClick={handleSaveDashboard}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 20px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${ORANGE}, #ED5206)`, cursor: "pointer", color: "#fff", fontSize: "13px", fontWeight: 600, boxShadow: "0 4px 12px rgba(215,60,1,0.25)" }}
          >
            <Save size={14} /> Lưu vào Dashboard
          </button>
        </div>

        {/* Workspace Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          {/* Templates */}
          {!selectedTemplate && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "12px", opacity: 0.6 }}>Gợi ý template</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {templateCards.map((t) => (
                  <button
                    key={t.title}
                    onClick={() => applyTemplate(t.title)}
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1.5px dashed rgba(0,56,101,0.2)",
                      background: "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = ORANGE;
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fff8f6";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,56,101,0.2)";
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#fff";
                    }}
                  >
                    <div style={{ marginBottom: "12px", color: NAVY, backgroundColor: "#EBF2FF", width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <t.icon size={20} strokeWidth={1.5} />
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: NAVY, marginBottom: "4px" }}>{t.title}</div>
                    <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)" }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dropzones */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {["Trục X", "Giá trị", "Chú thích", "Bộ lọc"].map((zone) => (
              <div
                key={zone}
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "1.5px dashed rgba(0,56,101,0.2)",
                  backgroundColor: "#fff",
                  minHeight: "52px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onDragOver={(e) => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = ORANGE; (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff8f6"; }}
                onDragLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,56,101,0.2)"; (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff"; }}
                onDrop={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,56,101,0.2)";
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff";
                  try {
                    const data = JSON.parse(e.dataTransfer.getData("text/plain"));
                    const { field } = data;
                    if (zone === "Trục X") {
                      if (["Ngày", "Tuần", "Tháng", "Quý"].includes(field)) {
                        setAxisX(field === "Quý" ? "Tháng" : field === "Tuần" ? "Ngày" : field);
                        toast.success(`Đã đặt Trục X là ${field}`);
                      } else if (["Zalo Business", "Facebook", "Zalo OA", "Chat Widget", "Kênh"].includes(field)) {
                        setAxisX("Kênh");
                        toast.success(`Đã đặt Trục X là Kênh`);
                      } else {
                        setAxisX("Chủ đề");
                        toast.success(`Đã đặt Trục X là Chủ đề`);
                      }
                    } else if (zone === "Giá trị") {
                      if (field.includes("thành công") || field.includes("tin cậy")) {
                        setValues("AI thành công");
                        toast.success(`Đã đặt Giá trị là AI trả lời thành công`);
                      } else if (field.includes("thất bại") || field.includes("tự tạo") || field.includes("ảo giác")) {
                        setValues("AI thất bại");
                        toast.success(`Đã đặt Giá trị là AI trả lời thất bại`);
                      } else if (field.includes("Cảm xúc")) {
                        setValues("Cảm xúc");
                        toast.success(`Đã đặt Giá trị là Cảm xúc`);
                      } else {
                        setValues("Tổng hội thoại");
                        toast.success(`Đã đặt Giá trị là Tổng hội thoại`);
                      }
                    } else {
                      toast.success(`Đã thêm ${field} vào ${zone}`);
                    }
                  } catch (err) {
                    toast.error("Không thể xử lý thao tác kéo thả");
                  }
                }}
              >
                <span style={{ fontSize: "12px", color: "rgba(0,56,101,0.35)", fontWeight: 500 }}>
                  {zone === "Trục X" ? axisX : zone === "Giá trị" ? values : `Kéo ${zone} vào đây`}
                </span>
              </div>
            ))}
          </div>

          {/* Chart Preview */}
          <div style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 16px rgba(0,56,101,0.08)", padding: "24px" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: NAVY, marginBottom: "20px" }}>{chartTitle}</div>
            {renderPreview()}
          </div>
        </div>
      </div>

      {/* Right: Config Panel */}
      <div style={{ width: "260px", flexShrink: 0, backgroundColor: "#fff", borderLeft: "1px solid rgba(0,56,101,0.08)", overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,56,101,0.5)", letterSpacing: "0.08em", marginBottom: "10px" }}>LOẠI BIỂU ĐỒ</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
            {chartTypeOptions.map((ct) => {
              const Ic = ct.icon;
              const isSelected = selectedChartType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => setSelectedChartType(ct.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    padding: "8px 4px",
                    borderRadius: "8px",
                    border: isSelected ? `2px solid ${ORANGE}` : "2px solid transparent",
                    backgroundColor: isSelected ? "#fff3ef" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <Ic size={16} style={{ color: isSelected ? ORANGE : "rgba(0,56,101,0.5)" }} />
                  <span style={{ fontSize: "10px", color: isSelected ? ORANGE : "rgba(0,56,101,0.55)", fontWeight: isSelected ? 600 : 400 }}>{ct.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {[
          { label: "Trục X", value: axisX, setter: setAxisX, options: ["Chủ đề", "Kênh", "Ngày", "Tháng"] },
          { label: "Giá trị", value: values, setter: setValues, options: ["Tổng hội thoại", "AI thành công", "AI thất bại", "Cảm xúc"] },
          { label: "Giao diện", value: theme, setter: setTheme, options: ["FLIC Brand", "Xanh Navy", "Đơn sắc", "Gam màu ấm"] },
        ].map(({ label, value, setter, options }) => (
          <div key={label}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,56,101,0.5)", letterSpacing: "0.08em", marginBottom: "8px" }}>{label.toUpperCase()}</div>
            <select
              value={value}
              onChange={(e) => setter(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid rgba(0,56,101,0.12)", fontSize: "12px", color: NAVY, outline: "none", cursor: "pointer" }}
            >
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}

        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(0,56,101,0.5)", letterSpacing: "0.08em", marginBottom: "10px" }}>CÀI ĐẶT</div>
          {[
            { label: "Hiển thị chú thích", value: showLegend, setter: setShowLegend },
            { label: "Nhãn dữ liệu", value: showDataLabels, setter: setShowDataLabels },
          ].map(({ label, value, setter }) => (
            <label key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", cursor: "pointer" }}>
              <span style={{ fontSize: "12px", color: NAVY }}>{label}</span>
              <div
                onClick={() => setter(!value)}
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  backgroundColor: value ? ORANGE : "#e2e8f0",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: value ? "18px" : "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
