const fs = require('fs');
const file = 'd:/WebChat_Project/TTH_Dashboard-Webchat-CSKH/src/app/components/screens/SentimentAnalysis.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (
              <div key={label} style={{ backgroundColor: "#fff", borderRadius: "20px", border: "1px solid rgba(0,56,101,0.08)", boxShadow: "0 2px 12px rgba(0,56,101,0.06)", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "14px", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={28} style={{ color }} />
                  </div>
              <div>
                <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>{value}</div>
              </div>
            </div>
            <div style={{ fontSize: "12px", color: "rgba(0,56,101,0.45)" }}>{trend}</div>
            <div style={{ marginTop: "10px", fontSize: "11px", padding: "3px 8px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "rgba(0,56,101,0.5)", display: "inline-block", fontWeight: 500 }}>{change}</div>
          </div>
        ))}
      </div>`;

const newStr = `            ].map(({ icon: Icon, label, value, change, color, bg, trend }) => (
              <div key={label} style={{ 
                backgroundColor: "#fff", 
                borderRadius: "20px", 
                border: "1px solid rgba(0,56,101,0.08)", 
                boxShadow: "0 2px 12px rgba(0,56,101,0.06)", 
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                minHeight: "140px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "42px", height: "42px", borderRadius: "14px", backgroundColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={28} style={{ color }} strokeWidth={2} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: "13px", color: "rgba(0,56,101,0.55)", fontWeight: 500, marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "28px", fontWeight: 700, color: NAVY, lineHeight: 1.1 }}>{value}</div>
                    
                    {(trend || change) && (
                      <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
                        {trend && <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)" }}>{trend}</div>}
                        {change && <div style={{ fontSize: "11px", color: "rgba(0,56,101,0.45)", fontWeight: 500 }}>{change}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>`;

if (content.includes(targetStr)) {
    fs.writeFileSync(file, content.replace(targetStr, newStr), 'utf8');
    console.log("Replaced successfully.");
} else {
    console.log("Target string not found. Please verify the exact whitespace.");
}
