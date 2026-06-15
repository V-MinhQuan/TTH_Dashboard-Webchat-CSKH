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
  showLegend: boolean;
  showDataLabels: boolean;
  showGrid: boolean;
  showTooltip: boolean;
  palette: string[];
}

const numberFormat = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function ChartPreview({
  chartType,
  groupBy,
  data,
  loading,
  error,
  invalidMessages,
  showLegend,
  showDataLabels,
  showGrid,
  showTooltip,
  palette,
}: Props) {
  if (invalidMessages.length) {
    return (
      <PreviewState
        title={CHART_BUILDER_LABELS.invalidChart}
        messages={invalidMessages}
        invalid
      />
    );
  }
  if (loading) {
    return <PreviewState title={CHART_BUILDER_LABELS.loadingChart} loading />;
  }
  if (error) {
    return (
      <PreviewState
        title={CHART_BUILDER_LABELS.chartError}
        messages={[error, "Vui lòng kiểm tra cấu hình và thử lại."]}
        error
      />
    );
  }
  if (!data?.rows.length) {
    return <PreviewState title={CHART_BUILDER_LABELS.emptyChart} />;
  }

  const dimensionKey = groupBy || data.dimensionKeys?.[0] || "";
  const common = {
    data: data.rows,
    margin: { top: 24, right: 24, bottom: 24, left: 0 },
  };
  const tooltip = (
    <Tooltip
      formatter={(value: number | string, name: string) => [
        formatValue(value, data.series.find((item) => item.key === name)),
        data.series.find((item) => item.key === name)?.label || name,
      ]}
      labelStyle={{ color: "#003865", fontWeight: 700 }}
      contentStyle={{
        border: "1px solid rgba(0,56,101,.1)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(15,23,42,.12)",
      }}
    />
  );

  if (chartType === "pie" || chartType === "donut") {
    const metric = data.series[0];
    if (!metric || !dimensionKey) {
      return (
        <PreviewState
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ hình tròn hoặc hình khuyên cần một chiều phân tích và một chỉ số."]}
          invalid
        />
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <PieChart>
          <Pie
            data={data.rows}
            dataKey={metric.key}
            nameKey={dimensionKey}
            cx="50%"
            cy="48%"
            innerRadius={chartType === "donut" ? 82 : 0}
            outerRadius={138}
            paddingAngle={2}
            label={showDataLabels
              ? ({ name, value }) => `${name}: ${numberFormat.format(Number(value))}`
              : false}
          >
            {data.rows.map((row, index) => (
              <Cell
                key={`${String(row[dimensionKey])}-${index}`}
                fill={palette[index % palette.length] || metric.color}
              />
            ))}
          </Pie>
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "scatter") {
    if (data.series.length < 2) {
      return (
        <PreviewState
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ phân tán cần ít nhất hai chỉ số số."]}
          invalid
        />
      );
    }
    const xSeries = data.series[0];
    const ySeries = data.series[1];
    return (
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
            name={xSeries.label}
            tick={tickStyle}
          />
          <YAxis
            type="number"
            dataKey={ySeries.key}
            name={ySeries.label}
            tick={tickStyle}
          />
          <ZAxis range={[55, 150]} />
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Scatter
            name={`${xSeries.label} / ${ySeries.label}`}
            data={data.rows}
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
          title={CHART_BUILDER_LABELS.invalidChart}
          messages={["Biểu đồ radar cần một chiều phân tích."]}
          invalid
        />
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <RadarChart data={data.rows} outerRadius="72%">
          {showGrid && <PolarGrid stroke="rgba(0,56,101,0.13)" />}
          <PolarAngleAxis dataKey={dimensionKey} tick={tickStyle} />
          <PolarRadiusAxis tick={tickStyle} />
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.series.map((series) => (
            <Radar
              key={series.key}
              dataKey={series.key}
              name={series.label}
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
    const hasRightAxis = data.series.some(
      (series) => series.axisGroup === "right",
    );
    return (
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
              data.series
                .filter((series) => series.axisGroup !== "right")
                .map((series) => series.label)
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
                data.series
                  .filter((series) => series.axisGroup === "right")
                  .map((series) => series.label)
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
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.series.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
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
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <ComposedChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, data.series)}
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.series.map((series, index) => renderComboSeries(
            series,
            index === 0 ? "bar" : "line",
            showDataLabels,
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <LineChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, data.series)}
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.series.map((series) => (
            <Line
              key={series.key}
              dataKey={series.key}
              name={series.label}
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
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={430}>
        <AreaChart {...common}>
          {renderGridAndAxes(dimensionKey, showGrid, data.series)}
          {showTooltip && tooltip}
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {data.series.map((series) => (
            <Area
              key={series.key}
              dataKey={series.key}
              name={series.label}
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

  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={430}>
      <BarChart {...common}>
        {renderGridAndAxes(dimensionKey, showGrid, data.series)}
        {showTooltip && tooltip}
        {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {data.series.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
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
      fontSize={9}
      fill="#475569"
      formatter={(value: number) => numberFormat.format(value)}
    />
  );
}

function formatValue(
  value: number | string,
  series?: ChartSeries,
) {
  if (typeof value !== "number") return value;
  if (series?.numberFormat === "percent") {
    return `${numberFormat.format(value)}%`;
  }
  if (series?.numberFormat === "minutes") {
    return `${numberFormat.format(value)} phút`;
  }
  return numberFormat.format(value);
}

function PreviewState({
  title,
  messages = [],
  loading = false,
  error = false,
  invalid = false,
}: {
  title: string;
  messages?: string[];
  loading?: boolean;
  error?: boolean;
  invalid?: boolean;
}) {
  return (
    <div
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

const tickStyle = { fontSize: 10, fill: "#64748b" };

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
    fontSize: 9,
  } as const;
}
