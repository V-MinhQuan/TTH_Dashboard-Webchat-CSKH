import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

class GlobalErrorBoundary extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) return (
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "white", color: "red", padding: "40px", zIndex: 99999, overflow: "auto" }}>
        <h2>Giao diện bị lỗi (Crash UI)</h2>
        <p>Hệ thống đã bắt được thông tin lỗi khiến giao diện bị trắng. Hãy chụp màn hình này gửi cho tôi để tôi khắc phục ngay lập tức:</p>
        <pre style={{ whiteSpace: "pre-wrap", border: "1px solid red", padding: "10px", backgroundColor: "#ffe6e6" }}>
          {this.state.error?.stack || this.state.error?.message || "Unknown error"}
        </pre>
      </div>
    ); 
    return this.props.children; 
  }
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </QueryClientProvider>
);
