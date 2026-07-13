import { useState, useEffect, useMemo, useRef } from "react";
import { History, Search, Filter, Calendar, ArrowRight, Loader2, ChevronDown, Check, RotateCcw } from "lucide-react";
import { fetchActivityLogs } from "../../services/activityApi";
import { toast } from "sonner";

const NAVY = "#003865";
const CTA = "#ED5206";

interface ActivityLog {
  id: string;
  action_type: string;
  entity: string;
  details: string;
  time: string;
  date_str: string;
  created_at: string;
}

type DateRangeFilter = "all" | "today" | "7d" | "30d";

const dateRangeOptions: Array<{ value: DateRangeFilter; label: string }> = [
  { value: "all", label: "Tất cả thời gian" },
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày gần đây" },
  { value: "30d", label: "30 ngày gần đây" },
];

function isSameCalendarDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function matchesDateRange(log: ActivityLog, range: DateRangeFilter) {
  if (range === "all") return true;

  const createdAt = new Date(log.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;

  const now = new Date();
  if (range === "today") return isSameCalendarDay(createdAt, now);

  const days = range === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  return createdAt >= start && createdAt <= now;
}

export function ActivityHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const timeMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetchActivityLogs(50, 0);
        
        // Format the time from created_at
        const formattedData = res.data.map(item => {
          const dt = new Date(item.created_at);
          return {
            ...item,
            time: dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          };
        });
        
        setActivities(formattedData);
      } catch (error) {
        toast.error("Không thể tải lịch sử hoạt động");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (timeMenuRef.current && !timeMenuRef.current.contains(target)) {
        setShowTimeMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setShowFilterMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const actionOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(activities.map((log) => log.action_type).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [activities]
  );

  const entityOptions = useMemo(
    () =>
      Array.from(
        new Set<string>(activities.map((log) => log.entity).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "vi")),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return activities.filter((log) => {
      const matchesSearch =
        !normalizedSearch ||
        log.action_type.toLowerCase().includes(normalizedSearch) ||
        log.entity.toLowerCase().includes(normalizedSearch) ||
        (log.details && log.details.toLowerCase().includes(normalizedSearch));

      return (
        matchesSearch &&
        matchesDateRange(log, dateRange) &&
        (actionFilter === "all" || log.action_type === actionFilter) &&
        (entityFilter === "all" || log.entity === entityFilter)
      );
    });
  }, [activities, searchTerm, dateRange, actionFilter, entityFilter]);

  const groupedActivities = useMemo(
    () =>
      Array.from(new Set(filteredActivities.map((activity) => activity.date_str))).map((date) => ({
        date,
        items: filteredActivities.filter((activity) => activity.date_str === date),
      })),
    [filteredActivities]
  );

  const resultFilterCount = Number(actionFilter !== "all") + Number(entityFilter !== "all");
  const activeDateRangeLabel = dateRangeOptions.find((option) => option.value === dateRange)?.label ?? "Thời gian";

  const toolbarButtonStyle = {
    minHeight: "42px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1px solid rgba(0,56,101,0.12)",
    backgroundColor: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    color: NAVY,
    fontSize: "13px",
    fontWeight: 600,
  };

  const popoverStyle = {
    position: "absolute" as const,
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 30,
    width: "260px",
    borderRadius: "14px",
    border: "1px solid rgba(0,56,101,0.1)",
    backgroundColor: "#fff",
    boxShadow: "0 16px 42px rgba(0,56,101,0.16)",
    padding: "10px",
  };

  const selectStyle = {
    width: "100%",
    minHeight: "38px",
    borderRadius: "9px",
    border: "1px solid rgba(0,56,101,0.14)",
    backgroundColor: "#fff",
    color: NAVY,
    fontSize: "13px",
    fontWeight: 500,
    padding: "8px 10px",
    outline: "none",
  };

  return (
    <div style={{ padding: "28px", maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "rgba(0,56,101,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <History size={20} style={{ color: NAVY }} />
        </div>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: NAVY, margin: 0, lineHeight: 1.2 }}>Lịch sử hoạt động</h1>
          <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.5)", marginTop: "4px" }}>
            Theo dõi các thao tác và hoạt động của bạn trên hệ thống
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 4px 20px rgba(0,56,101,0.03)", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "rgba(0,56,101,0.4)" }} />
            <input
              type="text"
              placeholder="Tìm kiếm theo hành động, nội dung..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                borderRadius: "10px",
                border: "1px solid rgba(0,56,101,0.12)",
                fontSize: "13px",
                color: NAVY,
                outline: "none",
                boxSizing: "border-box"
              }}
            />
          </div>
          <div ref={timeMenuRef} style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={() => { setShowTimeMenu((open) => !open); setShowFilterMenu(false); }}
              style={{ ...toolbarButtonStyle, backgroundColor: dateRange === "all" ? "#fff" : "#fff7ed", borderColor: dateRange === "all" ? "rgba(0,56,101,0.12)" : "rgba(237,82,6,0.28)", color: dateRange === "all" ? NAVY : "#D73C01" }}
            >
              <Calendar size={16} />
              {dateRange === "all" ? "Thời gian" : activeDateRangeLabel}
              <ChevronDown size={15} />
            </button>

            {showTimeMenu && (
              <div style={popoverStyle}>
                <div style={{ display: "grid", gap: "4px" }}>
                  {dateRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => { setDateRange(option.value); setShowTimeMenu(false); }}
                      style={{
                        minHeight: "36px",
                        padding: "8px 10px",
                        border: 0,
                        borderRadius: "9px",
                        backgroundColor: dateRange === option.value ? "#fff4ee" : "transparent",
                        color: dateRange === option.value ? "#D73C01" : NAVY,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "13px",
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      {option.label}
                      {dateRange === option.value && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div ref={filterMenuRef} style={{ position: "relative", flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={() => { setShowFilterMenu((open) => !open); setShowTimeMenu(false); }}
              style={{ ...toolbarButtonStyle, backgroundColor: resultFilterCount ? "#fff7ed" : "#fff", borderColor: resultFilterCount ? "rgba(237,82,6,0.28)" : "rgba(0,56,101,0.12)", color: resultFilterCount ? "#D73C01" : NAVY }}
            >
              <Filter size={16} />
              Lọc kết quả{resultFilterCount ? ` (${resultFilterCount})` : ""}
              <ChevronDown size={15} />
            </button>

            {showFilterMenu && (
              <div style={{ ...popoverStyle, width: "300px" }}>
                <div style={{ display: "grid", gap: "12px" }}>
                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700, color: "rgba(0,56,101,0.62)" }}>
                    Hành động
                    <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} style={selectStyle}>
                      <option value="all">Tất cả hành động</option>
                      {actionOptions.map((action) => (
                        <option key={action} value={action}>{action}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: "6px", fontSize: "12px", fontWeight: 700, color: "rgba(0,56,101,0.62)" }}>
                    Đối tượng
                    <select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} style={selectStyle}>
                      <option value="all">Tất cả đối tượng</option>
                      {entityOptions.map((entity) => (
                        <option key={entity} value={entity}>{entity}</option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "2px" }}>
                    <button
                      type="button"
                      onClick={() => { setActionFilter("all"); setEntityFilter("all"); }}
                      style={{ border: 0, background: "transparent", color: "rgba(0,56,101,0.56)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}
                    >
                      <RotateCcw size={14} /> Đặt lại
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(false)}
                      style={{ border: 0, borderRadius: "8px", background: CTA, color: "#fff", cursor: "pointer", padding: "8px 12px", fontSize: "12px", fontWeight: 700 }}
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "10px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", color: CTA }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(0,56,101,0.5)", fontSize: "13px" }}>
              Không tìm thấy lịch sử hoạt động nào phù hợp.
            </div>
          ) : (
            // Group by date
            groupedActivities.map((group) => (
              <div key={group.date}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,56,101,0.4)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {group.date}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "8px", borderLeft: "2px solid rgba(0,56,101,0.06)", marginLeft: "6px" }}>
                  {group.items.map(log => (
                    <div key={log.id} style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ position: "absolute", left: "-13px", top: "6px", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: CTA, border: "2px solid #fff" }} />
                      <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.5)", fontWeight: 500, width: "45px", flexShrink: 0, marginTop: "2px" }}>
                        {log.time}
                      </div>
                      <div style={{ flex: 1, backgroundColor: "#f8fafc", borderRadius: "12px", padding: "14px", border: "1px solid rgba(0,56,101,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{log.action_type}</span>
                          <ArrowRight size={12} style={{ color: "rgba(0,56,101,0.3)" }} />
                          <span style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{log.entity}</span>
                        </div>
                        {log.details && (
                          <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.6)", lineHeight: 1.5 }}>
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
