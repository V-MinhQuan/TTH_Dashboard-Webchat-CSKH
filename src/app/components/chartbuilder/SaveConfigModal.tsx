import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  defaultName: string;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => Promise<void>;
}

export function SaveConfigModal({ open, defaultName, saving, onOpenChange, onSave }: Props) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription("");
    }
  }, [defaultName, open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !saving) onOpenChange(false);
      }}
      style={overlayStyle}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="chart-save-title" style={modalStyle}>
        <button type="button" aria-label="Đóng" disabled={saving} onClick={() => onOpenChange(false)} style={closeButton}>
          <X size={17} />
        </button>
        <div>
          <h2 id="chart-save-title" style={{ margin: 0, color: "#003865", fontSize: 18 }}>Lưu biểu đồ</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12 }}>
            Biểu đồ và cấu hình hiện tại sẽ được lưu để sử dụng lại.
          </p>
        </div>
        <label style={fieldStyle}>
          <span>Tên cấu hình</span>
          <input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} style={inputStyle} autoFocus />
        </label>
        <label style={fieldStyle}>
          <span>Mô tả</span>
          <textarea value={description} maxLength={500} rows={4} onChange={(event) => setDescription(event.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        </label>
        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" disabled={saving} onClick={() => onOpenChange(false)} style={secondaryButton}>Hủy</button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => onSave(name.trim(), description.trim())}
            style={{ ...primaryButton, opacity: saving || !name.trim() ? 0.55 : 1 }}
          >
            {saving ? "Đang lưu..." : "Lưu biểu đồ"}
          </button>
        </footer>
      </section>
    </div>
  );
}

const overlayStyle = { position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 16, background: "rgba(15,23,42,.52)" } as const;
const modalStyle = { position: "relative", width: "min(500px, 100%)", display: "grid", gap: 18, padding: 24, borderRadius: 16, border: "1px solid rgba(0,56,101,.12)", background: "#fff", boxShadow: "0 22px 70px rgba(15,23,42,.24)" } as const;
const closeButton = { position: "absolute", top: 13, right: 13, display: "grid", placeItems: "center", width: 30, height: 30, border: 0, borderRadius: 7, background: "#f1f5f9", color: "#64748b", cursor: "pointer" } as const;
const fieldStyle = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#003865" } as const;
const inputStyle = { padding: "10px 11px", borderRadius: 8, border: "1px solid #dbe3ea", outlineColor: "#D73C01" } as const;
const secondaryButton = { padding: "9px 14px", borderRadius: 8, border: "1px solid #dbe3ea", background: "#fff", color: "#003865", cursor: "pointer" } as const;
const primaryButton = { ...secondaryButton, borderColor: "#D73C01", background: "#D73C01", color: "#fff" } as const;
