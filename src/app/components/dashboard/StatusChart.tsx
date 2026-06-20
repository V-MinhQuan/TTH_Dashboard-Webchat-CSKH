import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const NAVY = "#003865";
const ORANGE = "#D73C01";

// Cấu hình bảng màu cho từng trạng thái
const STATUS_COLORS: Record<string, string> = {
  new: "#42A5F5",      // Xanh dương nhạt
  open: "#1565C0",     // Xanh dương đậm
  pending: "#B7791F",  // Vàng/Cam đất
  closed: "#228A61",   // Xanh lá cây
  unknown: "#94a3b8"   // Xám
};

const STATUS_LABELS: Record<string, string> = {
  new: "Mới (New)",
  open: "Đang tư vấn / Chờ phản hồi",
  pending: "Chờ xử lý (Pending)",
  closed: "Đã đóng (Closed)",
  unknown: "Không xác định"
};

interface StatusChartProps {
  statusSummary: Record<string, number>;
}

export function StatusChart({ statusSummary }: StatusChartProps) {
  // Chuyển đổi dữ liệu sang dạng Recharts yêu cầu
  const data = Object.entries(statusSummary)
    .map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value: value,
      rawKey: key
    }))
    .filter((item) => item.value > 0); // Chỉ hiển thị các trạng thái có dữ liệu > 0

  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(0,56,101,0.4)", fontSize: "13px" }}>
        Không có dữ liệu trạng thái
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
            innerRadius={60}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry) => (
              <Cell 
                key={`cell-${entry.rawKey}`} 
                fill={STATUS_COLORS[entry.rawKey] || NAVY} 
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [
              `${value.toLocaleString("vi-VN")} hội thoại (${((value / total) * 100).toFixed(1)}%)`,
              "Số lượng"
            ]}
            contentStyle={{ borderRadius: "8px", border: "1px solid rgba(0,56,101,0.08)", fontFamily: "sans-serif", fontSize: "12px" }}
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
