import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import flicLogo from '../../../imports/image.png';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

const NAVY = "#003865";
const CTA = "#ED5206";
const ORANGE = "#D73C01";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState(() => localStorage.getItem("saved_username") || "");
  const [password, setPassword] = useState(() => localStorage.getItem("saved_password") || "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(() => localStorage.getItem("saved_username") ? true : false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        setError(resJson.message || "Tên đăng nhập hoặc mật khẩu không đúng.");
        return;
      }

      const userData = resJson.data;
      if (rememberLogin) {
        localStorage.setItem("saved_username", username.trim());
        localStorage.setItem("saved_password", password);
      } else {
        localStorage.removeItem("saved_username");
        localStorage.removeItem("saved_password");
      }
      login(userData, rememberLogin);
    } catch (err: any) {
      setError("Không thể kết nối tới máy chủ. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px 11px 42px",
    borderRadius: "10px",
    border: "1.5px solid rgba(0,56,101,0.15)",
    fontSize: "14px",
    color: NAVY,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    backgroundColor: "#fafbfe",
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0f4fa',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        background: '#fff',
        padding: '48px 44px',
        borderRadius: '24px',
        boxShadow: '0 12px 48px rgba(0,56,101,0.12)',
        width: '100%',
        maxWidth: '420px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '72px', height: '72px', margin: '0 auto 18px',
            borderRadius: '16px', backgroundColor: '#f0f4fa',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px',
          }}>
            <ImageWithFallback
              src={flicLogo}
              alt="FLIC AI Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ margin: '0 0 6px', color: NAVY, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Hệ thống phân tích hỗ trợ CSKH Web ChatBot FLIC
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
            Bảng điều khiển trực quan hóa dữ liệu WebChat CSKH kết hợp Phân tích AI
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: NAVY, marginBottom: '6px' }}>
              Tên đăng nhập
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,56,101,0.4)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Nhập tên đăng nhập"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={handleKeyDown}
                style={inputStyle}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = CTA; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(0,56,101,0.15)"; }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: NAVY, marginBottom: '6px' }}>
              Mật khẩu
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,56,101,0.4)', pointerEvents: 'none' }} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, paddingRight: '42px' }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = CTA; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "rgba(0,56,101,0.15)"; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,56,101,0.4)', padding: 0, display: 'flex' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ fontSize: '12px', color: ORANGE, backgroundColor: '#fff5f0', border: `1px solid ${ORANGE}30`, borderRadius: '8px', padding: '9px 12px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: NAVY, fontSize: '12px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={rememberLogin}
              onChange={(e) => setRememberLogin(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: CTA,
                cursor: 'pointer',
              }}
            />
            Ghi nhớ đăng nhập
          </label>

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? '#ccc' : CTA,
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(237,82,6,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </div>



        <p style={{ marginTop: '20px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
          © 2026 FLIC Education · Bản thử nghiệm
        </p>
      </div>
    </div>
  );
}
