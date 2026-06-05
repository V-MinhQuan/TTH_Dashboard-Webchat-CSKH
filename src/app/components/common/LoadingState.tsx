const NAVY = "#003865";

function SkeletonBlock({ w = "100%", h = "40px", radius = "10px" }: { w?: string; h?: string; radius?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: "linear-gradient(90deg, #f0f4f8 25%, #e2e8f0 50%, #f0f4f8 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite"
      }}
    />
  );
}

export function LoadingState() {
  return (
    <div style={{ padding: "24px" }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Header Loading */}
      <div style={{ marginBottom: "24px" }}>
        <SkeletonBlock h="28px" w="200px" />
        <div style={{ marginTop: "8px" }}>
          <SkeletonBlock h="16px" w="350px" />
        </div>
      </div>

      {/* Filter Panel Loading */}
      <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "16px 20px", border: "1px solid rgba(0,56,101,0.08)", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <SkeletonBlock h="20px" w="120px" />
          <SkeletonBlock h="30px" w="110px" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <SkeletonBlock h="45px" />
          <SkeletonBlock h="45px" />
          <SkeletonBlock h="45px" />
          <SkeletonBlock h="45px" />
        </div>
      </div>

      {/* KPI Cards Skeletons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#fff",
              borderRadius: "16px",
              padding: "20px 22px",
              border: "1px solid rgba(0,62,154,0.07)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              height: "100px",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <SkeletonBlock h="34px" w="34px" radius="50%" />
              <SkeletonBlock h="18px" w="45px" radius="10px" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <SkeletonBlock h="14px" w="70%" />
              <SkeletonBlock h="24px" w="50%" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Loading Skeletons */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(0,62,154,0.07)", height: "280px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <SkeletonBlock h="22px" w="30%" />
          <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "12px" }}>
            {[10, 30, 20, 60, 45, 80, 50, 70, 40, 90].map((h, idx) => (
              <div key={idx} style={{ flex: 1, height: `${h}%`, backgroundColor: "#f1f5f9", borderRadius: "6px" }} />
            ))}
          </div>
        </div>
        <div style={{ backgroundColor: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid rgba(0,62,154,0.07)", height: "280px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <div style={{ width: "100%", textAlign: "left" }}>
            <SkeletonBlock h="22px" w="50%" />
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: "130px", height: "130px", borderRadius: "50%", border: "16px solid #f1f5f9", borderTop: `16px solid ${NAVY}22` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
