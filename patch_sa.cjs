const fs = require('fs');
let content = fs.readFileSync('src/app/components/screens/SentimentAnalysis.tsx', 'utf8');
content = content.replace(/\]\.map\(\(\{ icon: Icon, label, value, change, color, bg, trend \}\) => \(/m, `  return (
    <div style={{ padding: "24px" }}>
      <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />

      {loading ? (
        <div style={{ padding: "20px", color: "rgba(0,56,101,0.5)" }}>Đang tải dữ liệu...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { icon: Heart, label: "Tỷ lệ tích cực", value: posPctStr, change: sentimentKpiTrend.pos || "—", color: "#228A61", bg: "#f0fdf4", trend: sentimentKpiTrend.pos ? \`\${sentimentKpiTrend.pos} so với kỳ trước\` : "Chưa đủ dữ liệu xu hướng" },
          { icon: Meh, label: "Tỷ lệ trung lập", value: neuPctStr, change: sentimentKpiTrend.neu || "—", color: "#f59e0b", bg: "#fffbeb", trend: sentimentKpiTrend.neu ? \`\${sentimentKpiTrend.neu} so với kỳ trước\` : "Chưa đủ dữ liệu xu hướng" },
          { icon: Frown, label: "Tỷ lệ tiêu cực", value: negPctStr, change: sentimentKpiTrend.neg || "—", color: ORANGE, bg: "#fff5f5", trend: sentimentKpiTrend.neg ? \`\${sentimentKpiTrend.neg} so với kỳ trước\` : "Chưa đủ dữ liệu xu hướng" },
          { icon: Star, label: "Mức độ hài lòng", value: satisfactionStr, change: "—", color: "#a855f7", bg: "#faf5ff", trend: "Từ dữ liệu MessageAnalytics" },
        ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (`);
fs.writeFileSync('src/app/components/screens/SentimentAnalysis.tsx', content);
console.log('Patched SentimentAnalysis');
