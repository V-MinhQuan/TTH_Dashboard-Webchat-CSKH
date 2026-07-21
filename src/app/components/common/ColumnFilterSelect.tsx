import { useEffect, useRef, useState } from "react";
import { ListFilter } from "lucide-react";

interface ColumnFilterSelectProps {
  label: string;
  value: string;
  allValue?: string;
  options: readonly string[];
  onChange: (value: string) => void;
  ariaContext?: string;
}

export function ColumnFilterSelect({
  label,
  value,
  allValue = "Tất cả",
  options,
  onChange,
  ariaContext,
}: ColumnFilterSelectProps) {
  const active = value !== allValue;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <span className="column-filter" ref={rootRef}>
      <span>{label}</span>
      <button
        type="button"
        className="column-filter__control"
        data-active={active ? "true" : "false"}
        title={active ? `Đang lọc: ${value}` : `Lọc cột ${label}`}
        data-print-hidden="true"
        aria-label={`${ariaContext ? `${ariaContext}: ` : ""}Lọc cột ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <ListFilter size={12} aria-hidden="true" />
      </button>
      {open && (
        <span
          className="column-filter__menu"
          role="listbox"
          aria-label={`Giá trị lọc ${label}`}
        >
          {[allValue, ...options.filter((option) => option !== allValue)].map((option) => (
            <button
              type="button"
              key={option}
              role="option"
              aria-selected={value === option}
              className="column-filter__option"
              data-selected={value === option ? "true" : "false"}
              onClick={(event) => {
                event.stopPropagation();
                selectValue(option);
              }}
            >
              {option}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
