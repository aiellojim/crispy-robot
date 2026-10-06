/* eslint-disable react-refresh/only-export-components */
// OrganicLoader 預覽頁（僅開發用）。
// 用法：npm run dev → 開 http://localhost:5173/dev/loader-preview.html
// 這個頁面不在 vite 的 build 入口內（只有根目錄 index.html 會被打包），所以不會上線。
// 目的：Agent 回覆太快、Jira 建立太短時，沒辦法在真實頁面看清楚動畫；這裡可以讓 loader 一直留著慢慢看。
// 改了 src/OrganicLoader.jsx 存檔後，這頁會即時更新（HMR）。
import { useState } from "react";
import { createRoot } from "react-dom/client";
import OrganicLoader from "../src/OrganicLoader.jsx";

const THEMES = {
  dark: { bg: "#17171E", fg: "#EDEDED", surface: "#21212B", border: "#33333F", accent: "#F4873D" },
  light: { bg: "#F5F5F5", fg: "#111111", surface: "#FFFFFF", border: "#E3E3E3", accent: "#E8621A" },
};
const VARIANTS = ["orbit", "ripple", "cradle"];

function Row({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 10, opacity: 0.65, fontSize: 12 }}>{title}</div>
      <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Preview() {
  const [theme, setTheme] = useState("dark");
  const [scale, setScale] = useState(1);
  const t = THEMES[theme];
  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.fg, fontFamily: "sans-serif", fontSize: 13, padding: 24, "--accent": t.accent, "--red": "#D93025" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 28 }}>
        <strong>OrganicLoader preview</strong>
        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>切換 {theme === "dark" ? "淺色" : "深色"}</button>
        <label>
          放大 {scale}×{" "}
          <input type="range" min="1" max="6" step="0.5" value={scale} onChange={(e) => setScale(+e.target.value)} />
        </label>
        <span style={{ opacity: 0.6 }}>放大只是方便看細節，實際尺寸見各列標示</span>
      </div>

      {VARIANTS.map((v) => (
        <Row key={v} title={`variant="${v}" size = 56 / 28 / 20 / 13（由左到右）`}>
          {[56, 28, 20, 13].map((s) => (
            <OrganicLoader key={s} variant={v} size={s * scale} />
          ))}
        </Row>
      ))}

      <Row title="AI 打字泡泡（cradle, size 20）— 真實使用情境，不會自己消失">
        <div style={{ padding: "10px 14px", borderRadius: 14, borderBottomLeftRadius: 4, background: t.surface, border: `1px solid ${t.border}`, display: "flex", gap: 5, alignItems: "center" }}>
          <OrganicLoader variant="cradle" size={20 * scale} />
        </div>
      </Row>

      <Row title="按鈕內（預設款, size 13）">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.accent, color: "#fff", padding: "8px 14px", borderRadius: 9 }}>
          <OrganicLoader size={13 * scale} color="#fff" />
          處理中…
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: t.surface, color: "#D93025", border: `1px solid ${t.border}`, padding: "8px 14px", borderRadius: 9 }}>
          <OrganicLoader size={13 * scale} color="var(--red)" />
          移除中…
        </span>
      </Row>

      <Row title="區塊 loading（預設款, size 28，如 Jira 建立 Epic 視窗）">
        <div style={{ textAlign: "center", padding: "20px 40px", background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14 }}>
          <OrganicLoader size={28 * scale} style={{ margin: "0 auto 14px" }} />
          <div style={{ opacity: 0.7 }}>正在建立 Epic…</div>
        </div>
      </Row>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
