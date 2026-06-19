import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import {
  ChartDataResponse,
  ChartSeries,
  ChartType,
} from "../../types/chartBuilder";
import { CHART_BUILDER_LABELS } from "./chartBuilderLabels";

interface Props {
  chartType: ChartType;
  groupBy: string;
  data: ChartDataResponse | null;
  loading: boolean;
  error: string;
  invalidMessages: string[];
  configured?: boolean;
  showLegend: boolean;
  showDataLabels: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  palette: string[];
  seriesDisplayByKey?: Record<string, Partial<ChartSeries>>;
}

const numberFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});
const chartFontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const legendStyle = { fontSize: 12, fontFamily: chartFontFamily };

export function ChartPreview({
  chartType,
  groupBy,
  data,
  loading,
  error,
  invalidMessages,
  configured = true,
  showLegend,
  showDataLabels,
  showGrid,
  showTooltip,
  palette,
  seriesDisplayByKey = {},
}: Props) {
  if (!configured) {
    return (
      <PreviewState
        status="not-configured"
        title={CHART_BUILDER_LABELS.notConfiguredChart}
        messages={["Hãy chọn bộ dữ liệu, chiều phân tích và chỉ số để tạo biểu đồ."]}
      />
    );
  }
  if (invalidMessages.length) {
    return (
      <PreviewState
        status="invalid"
        title={CHART_BUILDER_LABELS.invalidChart}
        messages={invalidMessages}
        invalid
      />
    );
  }
  if (loading) {
    return (
      <PreviewState
        status="loading"
        title={CHART_BUILDER_LABELS.loadingChart}
        loading
      />
    );
  }
  if (error) {
    return (
      <PreviewState
        status="api-error"
        title={CHART_BUILDER_LABELS.chartError}
        messages={[error, "Vui lòng kiểm tra cấu hình và thử lại."]}
        error
      />
    );
  }
  if (!data?.rows.length) {
    return (
      <PreviewState
        status="no-data"
        title={CHART_BUILDER_LABELS.emptyChart}
      />
    );
  }

  const dimensionKeys = [
    ...new Set([groupBy, ...(data.dimensionKeys || [])].filter(Boolean)),
  ];
  const chartRows = normalizeChartRows(data.rows, dimensionKeys);
  const chartSeries = normalizeChartSeries(data.series, palette, seriesDisplayByKey);
  const dimensionKey = groupBy || dimensionKeys[0] || "";
  const common = {
    data: chartRows,
    margin: { top: 24, right: 24, bottom: 24, left: 0 },
  };
  const tooltip = (
    <Tooltip
      formatter={(value: unknown, name: string) => [
        formatValue(value, chartSeries.find((item) => item.key === name)),
        safeText(chartSeries.find((item) => item.key === name)?.label || name),
      ]}
      labelFormatter={(label) => formatDimensionValue(label)}
      labelStyle={{ color: "#003865", fontWeight: 700 }}
      contentStyle={{
        border: "1px solid rgba(0,56,101,.1)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(15,23,42,.12)",
      }}
    />
  );

  if (chartType === "pie" || chartType === "donut") {
    const metric = chartSeries[0];
    if (!metric || !dimensionKey) {
      return (
        <PreviewState
          status="invalid"
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ hình tròn hoặc hình khuyên cần một chiều phân tích và một chỉ số."]}
          invalid
        />
      );
    }
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <PieChart>
          <Pie
            data={chartRows}
            dataKey={metric.key}
            nameKey={dimensionKey}
            cx="50%"
            cy="48%"
            innerRadius={chartType === "donut" ? 82 : 0}
            outerRadius={138}
            paddingAngle={2}
            label={showDataLabels
              ? ({ name, value }) => `${formatDimensionValue(name)}: ${formatValue(value, metric)}`
              : false}
          >
            {chartRows.map((row, index) => (
              <Cell
                key={`${formatDimensionValue(row[dimensionKey])}-${index}`}
                fill={palette[index % palette.length] || metric.color}
              />
            ))}
          </Pie>
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "scatter") {
    if (chartSeries.length < 2) {
      return (
        <PreviewState
          status="invalid"
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ phân tán cần ít nhất hai chỉ số số."]}
          invalid
        />
      );
    }
    const xSeries = chartSeries[0];
    const ySeries = chartSeries[1];
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <ScatterChart {...common}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,56,101,0.09)"
            />
          )}
          <XAxis
            type="number"
            dataKey={xSeries.key}
            name={safeText(xSeries.label)}
            tick={tickStyle}
          />
          <YAxis
            type="number"
            dataKey={ySeries.key}
            name={safeText(ySeries.label)}
            tick={tickStyle}
          />
          <ZAxis range={[55, 150]} />
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          <Scatter
            name={`${safeText(xSeries.label)} / ${safeText(ySeries.label)}`}
            data={chartRows}
            fill={ySeries.color}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "radar") {
    if (!dimensionKey) {
      return (
        <PreviewState
          status="invalid"
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ radar cần một chiều phân tích."]}
          invalid
        />
      );
    }
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <RadarChart data={chartRows} outerRadius="72%">
          {showGrid && <PolarGrid stroke="rgba(0,56,101,0.13)" />}
          <PolarAngleAxis dataKey={dimensionKey} tick={tickStyle} />
          <PolarRadiusAxis tick={tickStyle} />
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          {chartSeries.map((series) => (
            <Radar
              key={series.key}
              dataKey={series.key}
              name={safeText(series.label)}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.16}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "horizontal_bar") {
    const hasRightAxis = chartSeries.some(
      (series) => series.axisGroup === "right",
    );
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <BarChart {...common} layout="vertical">
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0,56,101,0.09)"
              horizontal={false}
            />
          )}
          <XAxis
            xAxisId="left"
            type="number"
            tick={tickStyle}
            label={axisLabel(
              chartSeries
                .filter((series) => series.axisGroup !== "right")
                .map((series) => safeText(series.label))
                .join(", "),
              "insideBottom",
            )}
          />
          {hasRightAxis && (
            <XAxis
              xAxisId="right"
              type="number"
              orientation="top"
              tick={tickStyle}
              label={axisLabel(
                chartSeries
                  .filter((series) => series.axisGroup === "right")
                  .map((series) => safeText(series.label))
                  .join(", "),
                "insideTop",
              )}
            />
          )}
          <YAxis
            type="category"
            dataKey={dimensionKey}
            tick={tickStyle}
            width={110}
          />
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          {chartSeries.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={safeText(series.label)}
              xAxisId={series.axisGroup || "left"}
              fill={series.color}
              radius={[0, 5, 5, 0]}
            >
              {showDataLabels && <DataLabel dataKey={series.key} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "combo") {
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <ComposedChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, chartSeries)}
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          {chartSeries.map((series, index) => renderComboSeries(
            series,
            index === 0 ? "bar" : "line",
            showDataLabels,
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <LineChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, chartSeries)}
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          {chartSeries.map((series) => (
            <Line
              key={series.key}
              dataKey={series.key}
              name={safeText(series.label)}
              yAxisId={series.axisGroup || "left"}
              stroke={series.color}
              strokeWidth={2.4}
              dot={false}
              activeDot={{ r: 4 }}
            >
              {showDataLabels && <DataLabel dataKey={series.key} />}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return withChartBody(
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <AreaChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, chartSeries)}
          {showTooltip && tooltip}
          {showLegend && (
            <Legend
              wrapperStyle={legendStyle}
              formatter={(value) => safeText(value)}
            />
          )}
          {chartSeries.map((series) => (
            <Area
              key={series.key}
              dataKey={series.key}
              name={safeText(series.label)}
              yAxisId={series.axisGroup || "left"}
              stroke={series.color}
              fill={series.color}
              fillOpacity={0.18}
              strokeWidth={2.2}
            >
              {showDataLabels && <DataLabel dataKey={series.key} />}
            </Area>
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return withChartBody(
    <ResponsiveContainer width="100%" height="100%" minHeight={430}>
      <BarChart {...common}>
        {renderGridAndAxes(dimensionKey, showGrid, chartSeries)}
        {showTooltip && tooltip}
        {showLegend && (
          <Legend
          wrapperStyle={legendStyle}
            formatter={(value) => safeText(value)}
          />
        )}
        {chartSeries.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={safeText(series.label)}
            yAxisId={series.axisGroup || "left"}
            fill={series.color}
            radius={chartType === "stacked_bar" ? 0 : [5, 5, 0, 0]}
            stackId={chartType === "stacked_bar" ? "chart-builder-stack" : undefined}
          >
            {showDataLabels && <DataLabel dataKey={series.key} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderGridAndAxes(
  groupBy: string,
  showGrid: boolean,
  series: ChartSeries[],
) {
  const hasRightAxis = series.some((item) => item.axisGroup === "right");
  const leftAxisLabel = series
    .filter((item) => item.axisGroup !== "right")
    .map((item) => item.label)
    .join(", ");
  const rightAxisLabel = series
    .filter((item) => item.axisGroup === "right")
    .map((item) => item.label)
    .join(", ");
  return (
    <>
      {showGrid && (
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(0,56,101,0.09)"
          vertical={false}
        />
      )}
      <XAxis
        dataKey={groupBy}
        tick={tickStyle}
        tickLine={false}
        axisLine={{ stroke: "#dbe3ea" }}
        minTickGap={18}
      />
      <YAxis
        yAxisId="left"
        tick={tickStyle}
        tickLine={false}
        axisLine={false}
        width={52}
        label={axisLabel(leftAxisLabel, "insideLeft", -90)}
      />
      {hasRightAxis && (
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          width={52}
          label={axisLabel(rightAxisLabel, "insideRight", 90)}
        />
      )}
    </>
  );
}

function renderComboSeries(
  series: ChartSeries,
  fallbackType: "bar" | "line",
  showDataLabels: boolean,
) {
  const seriesType = series.seriesType || fallbackType;
  if (seriesType === "area") {
    return (
      <Area
        key={series.key}
        dataKey={series.key}
        name={series.label}
        yAxisId={series.axisGroup || "left"}
        stroke={series.color}
        fill={series.color}
        fillOpacity={0.16}
      />
    );
  }
  if (seriesType === "line") {
    return (
      <Line
        key={series.key}
        dataKey={series.key}
        name={series.label}
        yAxisId={series.axisGroup || "left"}
        stroke={series.color}
        strokeWidth={2.4}
        dot={false}
      >
        {showDataLabels && <DataLabel dataKey={series.key} />}
      </Line>
    );
  }
  return (
    <Bar
      key={series.key}
      dataKey={series.key}
      name={series.label}
      yAxisId={series.axisGroup || "left"}
      fill={series.color}
      radius={[5, 5, 0, 0]}
    >
      {showDataLabels && <DataLabel dataKey={series.key} />}
    </Bar>
  );
}

function DataLabel({ dataKey }: { dataKey: string }) {
  return (
    <LabelList
      dataKey={dataKey}
      position="top"
      fontSize={11}
      fontFamily={chartFontFamily}
      fill="#475569"
      formatter={(value: unknown) => formatValue(value)}
    />
  );
}

function formatValue(
  value: unknown,
  series?: ChartSeries,
) {
  if (value === null || value === undefined || value === "") {
    return "Không xác định";
  }
  if (typeof value !== "number") return safeText(value);
  if (series?.numberFormat === "percent") {
    return `${numberFormat.format(value)}%`;
  }
  if (series?.numberFormat === "minutes") {
    return `${numberFormat.format(value)} phút`;
  }
  return numberFormat.format(value);
}

type PreviewStatus =
  | "not-configured"
  | "invalid"
  | "loading"
  | "has-data"
  | "no-data"
  | "api-error";

function PreviewState({
  status,
  title,
  messages = [],
  loading = false,
  error = false,
  invalid = false,
}: {
  status: PreviewStatus;
  title: string;
  messages?: string[];
  loading?: boolean;
  error?: boolean;
  invalid?: boolean;
}) {
  return (
    <div
      className="chart-builder-preview-state"
      data-preview-state={status}
      style={{
        height: 430,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: 28,
        color: error ? "#b91c1c" : invalid ? "#9a3412" : "#64748b",
      }}
    >
      <div>
        {loading && <div className="chart-builder-spinner" />}
        <strong style={{ display: "block", marginBottom: messages.length ? 6 : 0 }}>
          {title}
        </strong>
        {messages.map((message) => (
          <div key={message} style={{ maxWidth: 480, lineHeight: 1.6 }}>
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}

function withChartBody(children: React.ReactElement) {
  return (
    <div className="chart-builder-chart-body" data-preview-state="has-data">
      {children}
    </div>
  );
}

function normalizeChartRows(
  rows: ChartDataResponse["rows"],
  dimensionKeys: string[],
) {
  return rows.map((row) => {
    const next = { ...row };
    for (const key of dimensionKeys) {
      next[key] = formatDimensionValue(row[key]);
    }
    return next;
  });
}

function normalizeChartSeries(
  series: ChartSeries[],
  palette: string[],
  seriesDisplayByKey: Record<string, Partial<ChartSeries>>,
) {
  return series.map((item, index) => ({
    ...item,
    ...seriesDisplayByKey[item.key],
    label: safeText(seriesDisplayByKey[item.key]?.label || item.label || item.key),
    color: seriesDisplayByKey[item.key]?.color || palette[index % palette.length] || item.color,
  }));
}

function formatDimensionValue(value: unknown): string {
  if (value === true || value === "true" || value === "True") {
    return "Không cần phản hồi";
  }
  if (value === false || value === "false" || value === "False") {
    return "Cần phản hồi";
  }
  if (value === null || value === undefined || value === "") {
    return "Không xác định";
  }
  if (value === "ZaloBusiness") {
    return "Zalo Business";
  }
  if (value === "ZaloOA") {
    return "Zalo OA";
  }
  if (value === "ChatWidget") {
    return "Chat Widget";
  }
  if (Array.isArray(value)) {
    const values = value.map((item) => safeText(item)).filter(Boolean);
    return values.length ? values.join(", ") : "Không xác định";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "Không xác định";
    }
  }
  return String(value);
}

function safeText(value: unknown): string {
  if (typeof value === "boolean" || value === null || value === undefined) {
    return formatDimensionValue(value);
  }
  if (typeof value === "object") {
    return formatDimensionValue(value);
  }
  return String(value);
}

const tickStyle = {
  fontSize: 12,
  fill: "#64748b",
  fontFamily: chartFontFamily,
};

function axisLabel(
  value: string,
  position: "insideBottom" | "insideTop" | "insideLeft" | "insideRight",
  angle = 0,
) {
  if (!value) return undefined;
  return {
    value,
    position,
    angle,
    fill: "#64748b",
    fontSize: 11,
    fontFamily: chartFontFamily,
  } as const;
}
