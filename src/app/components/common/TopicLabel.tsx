import { topicColorForLabel } from "../../constants/topicTaxonomy";

type TopicLabelProps = {
  topic: string | null | undefined;
  badge?: boolean;
};

export function TopicLabel({ topic, badge = true }: TopicLabelProps) {
  const label = topic || "Không xác định";
  const color = topicColorForLabel(label);

  return (
    <span
      style={badge ? {
        fontSize: "10px",
        padding: "2px 7px",
        borderRadius: "20px",
        backgroundColor: `${color}18`,
        color,
        fontWeight: 500,
        display: "inline-block",
        wordBreak: "break-word",
        whiteSpace: "nowrap",
      } : { color, fontWeight: 700 }}
    >
      {label}
    </span>
  );
}
