import { channelColorForLabel } from "../../colors";

type ChannelLabelProps = {
  channel: string | null | undefined;
  badge?: boolean;
  weight?: number;
};

export function ChannelLabel({ channel, badge = true, weight }: ChannelLabelProps) {
  const label = channel || "Chưa xác định";
  const color = channelColorForLabel(label);

  return (
    <span
      style={badge ? {
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "20px",
        backgroundColor: `${color}18`,
        color,
        fontWeight: weight ?? 500,
        display: "inline-block",
        whiteSpace: "nowrap",
      } : { color, fontWeight: weight ?? 600 }}
    >
      {label}
    </span>
  );
}

export function ChannelChartTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const label = String(payload?.value || "");
  return <text x={x} y={y + 14} textAnchor="middle" fill={channelColorForLabel(label)} fontSize={10} fontWeight={400}>{label}</text>;
}

/** Dùng cho trục Y của biểu đồ cột ngang (hbar) — căn phải để nhãn nằm sát trục, không bị che */
export function ChannelYAxisTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const label = String(payload?.value || "");
  return <text x={x} y={y} dy="0.35em" textAnchor="end" fill={channelColorForLabel(label)} fontSize={10} fontWeight={500}>{label}</text>;
}
