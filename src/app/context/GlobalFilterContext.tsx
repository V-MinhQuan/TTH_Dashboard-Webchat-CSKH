import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface FilterValues {
  dateRange: string;
  customDateFrom?: string;
  customDateTo?: string;
  channel: string;
  topic: string;
  conversationStatus: string;
  aiStatus: string;
  aiFailureType: string;
}

export const defaultFilterValues: Readonly<FilterValues> = Object.freeze({
  dateRange: "30 ngày qua",
  channel: "Tất cả",
  topic: "Tất cả",
  conversationStatus: "Tất cả",
  aiStatus: "Tất cả",
  aiFailureType: "Tất cả",
});

interface FilterState {
  draftFilters: FilterValues;
  appliedFilters: FilterValues;
}

interface GlobalFilterContextValue extends FilterState {
  updateDraft: (changes: Partial<FilterValues>) => void;
  setDraftFilters: (filters: FilterValues) => void;
  applyDraft: () => void;
  applyFilters: (filters: FilterValues) => void;
  resetFilters: () => void;
}

const STORAGE_KEY = "flic_dashboard_filters:v2";
const LEGACY_STORAGE_KEYS = ["flic_dashboard_filters:v1"] as const;
const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null);

function normalizeDateRange(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    normalized === "thang nay"
    || normalized === "quy nay"
    || normalized === "toan bo du lieu"
    || normalized === "toan bo thoi gian"
    || normalized === "all_time"
  ) {
    return defaultFilterValues.dateRange;
  }
  return value;
}

function normalizeFilters(value: unknown): FilterValues {
  const candidate = value && typeof value === "object"
    ? value as Partial<Record<keyof FilterValues, unknown>>
    : {};
  const text = (key: keyof FilterValues, fallback: string) => {
    const raw = candidate[key];
    return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
  };
  const normalized: FilterValues = {
    dateRange: normalizeDateRange(text("dateRange", defaultFilterValues.dateRange)),
    channel: text("channel", defaultFilterValues.channel),
    topic: text("topic", defaultFilterValues.topic),
    conversationStatus: defaultFilterValues.conversationStatus,
    aiStatus: defaultFilterValues.aiStatus,
    aiFailureType: defaultFilterValues.aiFailureType,
  };
  if (typeof candidate.customDateFrom === "string" && candidate.customDateFrom.trim()) {
    normalized.customDateFrom = candidate.customDateFrom;
  }
  if (typeof candidate.customDateTo === "string" && candidate.customDateTo.trim()) {
    normalized.customDateTo = candidate.customDateTo;
  }
  if (normalized.dateRange !== "Tùy chỉnh") {
    delete normalized.customDateFrom;
    delete normalized.customDateTo;
  }
  return normalized;
}

function readStoredState(): FilterState {
  if (typeof window === "undefined") {
    return {
      draftFilters: { ...defaultFilterValues },
      appliedFilters: { ...defaultFilterValues },
    };
  }
  try {
    const currentRaw = window.sessionStorage.getItem(STORAGE_KEY);
    const legacyKey = LEGACY_STORAGE_KEYS.find(
      (key) => window.sessionStorage.getItem(key) !== null,
    );
    const raw = currentRaw ?? (legacyKey ? window.sessionStorage.getItem(legacyKey) : null);
    const parsed = raw ? JSON.parse(raw) : null;
    const state = {
      draftFilters: normalizeFilters(parsed?.draftFilters),
      appliedFilters: normalizeFilters(parsed?.appliedFilters),
    };
    if (raw) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      LEGACY_STORAGE_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
    }
    return state;
  } catch {
    return {
      draftFilters: { ...defaultFilterValues },
      appliedFilters: { ...defaultFilterValues },
    };
  }
}

function persistState(state: FilterState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The in-memory state remains authoritative when storage is unavailable.
  }
}

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(() => readStoredState());

  const commit = useCallback((updater: (current: FilterState) => FilterState) => {
    setState((current) => {
      const next = updater(current);
      persistState(next);
      return next;
    });
  }, []);

  const updateDraft = useCallback((changes: Partial<FilterValues>) => {
    commit((current) => ({
      ...current,
      draftFilters: normalizeFilters({ ...current.draftFilters, ...changes }),
    }));
  }, [commit]);

  const setDraftFilters = useCallback((filters: FilterValues) => {
    commit((current) => ({ ...current, draftFilters: normalizeFilters(filters) }));
  }, [commit]);

  const applyDraft = useCallback(() => {
    commit((current) => ({
      draftFilters: { ...current.draftFilters },
      appliedFilters: { ...current.draftFilters },
    }));
  }, [commit]);

  const applyFilters = useCallback((filters: FilterValues) => {
    const normalized = normalizeFilters(filters);
    commit(() => ({
      draftFilters: { ...normalized },
      appliedFilters: { ...normalized },
    }));
  }, [commit]);

  const resetFilters = useCallback(() => {
    const defaults = { ...defaultFilterValues };
    commit(() => ({
      draftFilters: { ...defaults },
      appliedFilters: { ...defaults },
    }));
  }, [commit]);

  const value = useMemo<GlobalFilterContextValue>(() => ({
    ...state,
    updateDraft,
    setDraftFilters,
    applyDraft,
    applyFilters,
    resetFilters,
  }), [applyDraft, applyFilters, resetFilters, setDraftFilters, state, updateDraft]);

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export function useGlobalFilters() {
  const context = useContext(GlobalFilterContext);
  if (!context) throw new Error("useGlobalFilters must be used within GlobalFilterProvider");
  return context;
}

export function useOptionalGlobalFilters() {
  return useContext(GlobalFilterContext);
}
