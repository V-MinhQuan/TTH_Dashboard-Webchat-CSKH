import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const NAVY = "#003865";

const STATUS_COLORS: Record<string, string> = {
  "Mới": "#42A5F5",
  "Đang tư vấn / Chờ phản hồi": NAVY,
  "Đang xử lý": NAVY, // legacy alias
  "Chờ xử lý": "#D73C01",
  "Đã đóng": "#1565C0",
  "Khác": "#F36C2E"
};

const STATUS_LABELS: Record<string, string> = {
  new: "Mới",
  open: "Đang tư vấn / Chờ phản hồi",
  pending: "Chờ xử lý",
  closed: "Đã đóng",
  unknown: "Khác"
};

interface StatusBarChartProps {
  statusSummary: Record<string, number>;
}

export function StatusBarChart({ statusSummary }: StatusBarChartProps) {
  const data = Object.entries(statusSummary).map(([key, value]) => ({
    status: STATUS_LABELS[key] || key,
    "Số lượng": value,
    rawKey: key
  }));

  const total = data.reduce((acc, curr) => acc + curr["Số lượng"], 0);

  if (total === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "220px", color: "rgba(0,56,101,0.4)", fontSize: "13px" }}>
        Không có dữ liệu để so sánh trạng thái
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "220px" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 5
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
          <XAxis 
            dataKey="status" 
            tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} 
          />
          <YAxis 
            tick={{ fontSize: 10, fill: "rgba(0,56,101,0.6)" }} 
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,56,101,0.03)" }}
            contentStyle={{ borderRadius: "8px", border: "1px solid rgba(0,56,101,0.08)", fontFamily: "sans-serif", fontSize: "12px" }}
          />
          <Bar dataKey="Số lượng" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-bar-${index}`} 
                fill={STATUS_COLORS[entry.status] || NAVY} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
