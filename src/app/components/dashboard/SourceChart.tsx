import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const NAVY = "#003BB9";
const ORANGE = "#D73C01";

// Cấu hình bảng màu cho từng kênh dữ liệu
const SOURCE_COLORS: Record<string, string> = {
  ZaloOA: "#00B2FE",       // Xanh Zalo OA (Sky Blue sáng)
  ZaloBusiness: "#0a61b4ff", // Xanh Zalo Business (Ink Navy đậm)
  Facebook: "#1877F2",     // Xanh Facebook (Royal Blue)
  ChatWidget: ORANGE,      // Cam Chat Widget
};

interface SourceChartProps {
  sourceSummary: Record<string, number>;
}

export function SourceChart({ sourceSummary }: SourceChartProps) {
  // Chuẩn hóa case-insensitive và gom các nguồn dữ liệu tương tự
  const normalizedData: Record<string, number> = {
    ZaloOA: 0,
    ZaloBusiness: 0,
    Facebook: 0,
    ChatWidget: 0
  };

  Object.entries(sourceSummary).forEach(([key, value]) => {
    const k = key.toLowerCase().trim();
    if (k === "zalooa" || k === "zalo") {
      normalizedData.ZaloOA += value;
    } else if (k === "zalobusiness" || k === "zalobiz") {
      normalizedData.ZaloBusiness += value;
    } else if (k === "facebook" || k === "fb" || k === "messenger") {
      normalizedData.Facebook += value;
    } else if (k === "chatwidget" || k === "website" || k === "web") {
      normalizedData.ChatWidget += value;
    }
  });

  const data = Object.entries(normalizedData)
    .map(([name, value]) => ({
      name,
      value,
      colorKey: name
    }))
    .filter((item) => item.value > 0);

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(0,59,185,0.4)", fontSize: "13px" }}>
        Không có dữ liệu kênh nguồn
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "220px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={0} // Biểu đồ tròn đặc (Pie Chart) theo brand
            outerRadius={80}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell
                key={`cell-source-${entry.colorKey}`}
                fill={SOURCE_COLORS[entry.colorKey] || NAVY}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              `${value.toLocaleString("vi-VN")} hội thoại (${((value / total) * 100).toFixed(1)}%)`,
              "Số lượng"
            ]}
            contentStyle={{ borderRadius: "8px", border: "1px solid rgba(0,59,185,0.08)", fontFamily: "sans-serif", fontSize: "12px" }}
          />
          <Legend
            iconSize={8}
            iconType="circle"
            layout="horizontal"
            verticalAlign="bottom"
            formatter={(value) => <span style={{ fontSize: "11px", color: NAVY, fontWeight: 500 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
