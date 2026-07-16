import { useState, useEffect } from "react";
import { History, Search, Filter, Calendar, ArrowRight, Loader2 } from "lucide-react";
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

export function ActivityHistory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

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

  const filteredActivities = activities.filter(
    (log) =>
      log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <button style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: NAVY, fontSize: "13px", fontWeight: 500 }}>
            <Calendar size={16} /> Thời gian
          </button>
          <button style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(0,56,101,0.12)", backgroundColor: "#fff", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: NAVY, fontSize: "13px", fontWeight: 500 }}>
            <Filter size={16} /> Lọc kết quả
          </button>
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
            Array.from(new Set(filteredActivities.map(a => a.date_str))).map(date => (
              <div key={date}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(0,56,101,0.4)", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {date}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "8px", borderLeft: "2px solid rgba(0,56,101,0.06)", marginLeft: "6px" }}>
                  {filteredActivities.filter(a => a.date_str === date).map(log => (
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
