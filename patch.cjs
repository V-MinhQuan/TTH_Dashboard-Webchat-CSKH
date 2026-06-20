const fs = require('fs');
const file = 'src/app/components/screens/AIInsights.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /\]\.map\(\(\{ icon: Icon, label, value, change \}\) => \{([\s\S]*?)onMouseEnter=\{\(e\) => \{/m;

const replacement = `].map(({ icon: Icon, label, value, change }) => {
              const badgeBg = "#f8fafc";
              const badgeColor = "#64748b";
              let iconBg = "#EBF2FF";
              let iconColor = NAVY;
              if (Icon === CheckCircle) {
                iconBg = "#EAF8F1";
                iconColor = "#228A61";
              } else if (Icon === XCircle) {
                iconBg = "#FFF1F1";
                iconColor = "#B42318";
              } else if (Icon === ShieldAlert) {
                iconBg = "#FFF4EE";
                iconColor = ORANGE;
              } else if (Icon === Activity) {
                iconBg = "#EBF2FF";
                iconColor = NAVY;
              }

              return (
                <div
                  key={label}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: "16px",
                    border: "1px solid rgba(0,56,101,0.08)",
                    boxShadow: "0 2px 10px rgba(0,62,154,0.06)",
                    padding: "20px 22px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    transition: "box-shadow 0.2s ease",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) => {`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Patched');
