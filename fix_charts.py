import re

with open(r'd:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\src\app\components\screens\SentimentAnalysis.tsx', 'r', encoding='utf-8') as f:
    orig = f.read()

# 1. First ChartCard (Xu hướng cảm xúc)
pattern1 = r'(<ChartCard title="Xu hướng cảm xúc theo thời gian" onOpenBuilder=\{\(\) => onNavigate\("chartbuilder"\)\}>)(.*?)(</ChartCard>)'

repl1 = r'''<ChartCard title="Xu hướng cảm xúc theo thời gian" data={sentimentTrend} onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            if (chartType === "bar" || chartType === "hbar") {
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout={chartType === "hbar" ? "vertical" : "horizontal"}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                    {chartType === "hbar" ? <XAxis type="number" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} /> : <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />}
                    {chartType === "hbar" ? <YAxis dataKey="date" type="category" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} width={80} /> : <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />}
                    <Tooltip formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend iconSize={10} />}
                    <Bar dataKey="positive" name="Tích cực" fill="#3E9675" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                    <Bar dataKey="neutral" name="Trung lập" fill="#E5A850" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                    <Bar dataKey="negative" name="Tiêu cực" fill="#D26767" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            }
            return (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(0,56,101,0.5)" }} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  {showLegend && <Legend iconSize={10} />}
                  <Line type="monotone" dataKey="positive" name="Tích cực" stroke="#3E9675" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="neutral" name="Trung lập" stroke="#E5A850" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="negative" name="Tiêu cực" stroke="#D26767" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>'''

orig = re.sub(pattern1, repl1, orig, flags=re.DOTALL)

# 2. Second ChartCard (Phân bổ cảm xúc)
# We won't make pie dynamic to bar in a 50/50 layout easily, but we'll try to just pass data and wrap it so it doesn't crash if they try to edit legend
pattern2 = r'(<ChartCard title="Phân bổ cảm xúc tổng quan" onOpenBuilder=\{\(\) => onNavigate\("chartbuilder"\)\}>)(.*?)(</ChartCard>)'

repl2 = r'''<ChartCard title="Phân bổ cảm xúc tổng quan" data={donutData} defaultChartType="donut" onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            // Provide a generic pie view
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "24px", height: "220px" }}>
                <PieChart width={200} height={200}>
                  <Pie data={chartData} cx={100} cy={100} innerRadius={chartType === "pie" ? 0 : 55} outerRadius={85} dataKey="value">
                    {chartData.map((d: any) => <Cell key={`sentiment-donut-${d.name}`} fill={d.color || "#003BB9"} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${v}%`} />
                </PieChart>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {showLegend && chartData.map((item: any, i: number) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minWidth: "140px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: item.color || "#003BB9" }} />
                        <span style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)" }}>{item.name}</span>
                      </div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#003865" }}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        </ChartCard>'''

orig = re.sub(pattern2, repl2, orig, flags=re.DOTALL)

# 3. Third ChartCard (Cảm xúc theo chủ đề)
pattern3 = r'(<ChartCard title="Cảm xúc theo chủ đề" onOpenBuilder=\{\(\) => onNavigate\("chartbuilder"\)\}>)(.*?)(</ChartCard>)'

repl3 = r'''<ChartCard title="Cảm xúc theo chủ đề" data={dynamicTopicData} onOpenBuilder={() => onNavigate("chartbuilder")}>
          {({ chartType, chartData, editValues }: any) => {
            const showLegend = editValues?.legend !== false;
            if (chartType === "line" || chartType === "area") {
              return (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" vertical={false} />
                    <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ fill: "rgba(0,56,101,0.02)" }} formatter={(v: any) => `${v}%`} />
                    {showLegend && <Legend iconSize={8} iconType="square" wrapperStyle={{ bottom: 0 }} />}
                    <Line type="monotone" dataKey="positive" name="Tích cực" stroke="#3E9675" strokeWidth={2} />
                    <Line type="monotone" dataKey="neutral" name="Trung lập" stroke="#E5A850" strokeWidth={2} />
                    <Line type="monotone" dataKey="negative" name="Tiêu cực" stroke="#D26767" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              );
            }
            return (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 20 }} layout={chartType === "hbar" ? "vertical" : "horizontal"}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,56,101,0.06)" vertical={chartType !== "hbar"} horizontal={chartType === "hbar"} />
                  {chartType === "hbar" ? <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} /> : <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} dy={10} />}
                  {chartType === "hbar" ? <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} width={100} /> : <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(0,56,101,0.4)" }} tickFormatter={(v) => `${v}%`} />}
                  <Tooltip cursor={{ fill: "rgba(0,56,101,0.02)" }} formatter={(v: any) => `${v}%`} />
                  {showLegend && <Legend iconSize={8} iconType="square" wrapperStyle={{ bottom: 0 }} />}
                  <Bar dataKey="positive" name="Tích cực" stackId="a" fill="#3E9675" />
                  <Bar dataKey="neutral" name="Trung lập" stackId="a" fill="#E5A850" />
                  <Bar dataKey="negative" name="Tiêu cực" stackId="a" fill="#D26767" radius={chartType === "hbar" ? [0,4,4,0] : [4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            );
          }}
        </ChartCard>'''

orig = re.sub(pattern3, repl3, orig, flags=re.DOTALL)

with open(r'd:\WebChat_Project\TTH_Dashboard-Webchat-CSKH\src\app\components\screens\SentimentAnalysis.tsx', 'w', encoding='utf-8') as f:
    f.write(orig)
