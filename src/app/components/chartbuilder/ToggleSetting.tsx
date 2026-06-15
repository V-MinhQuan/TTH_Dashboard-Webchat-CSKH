interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSetting({ label, checked, onChange }: Props) {
  return (
    <label className="chart-builder-toggle-setting">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="chart-builder-switch" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}
