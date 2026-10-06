/* eslint-disable react-refresh/only-export-components */
// 毛玻璃材質 A/B 預覽（僅開發用，不進 build）。
// 用法：npm run dev → 開 http://localhost:5173/dev/glass-preview.html
// 左＝現在（正式站目前的 GLASS 樣式 1:1 拷貝），右＝提案（glass-proposed.css）。
// 兩側用同一份 JSX、同樣的內容，只有 className 不同——差別完全來自材質本身。
// 這也是正式導入時的範本：元件只寫 className，不再手寫 background / backdropFilter / boxShadow。
import { useState, useRef, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "./glass-base.css";
import "./glass-proposed.css";

const KITS = {
  now: {
    title: "現在", spec: "blur 20px · saturate 160% · 單一材質 · 1px 均勻上緣高光",
    canvas: "now-canvas", root: "", header: "now-header", card: "now-card", ctl: "now-ctl",
    modal: "now-modal", hr: "now-hr", num: "", overlay: "rgba(0,0,0,0.15)",
  },
  next: {
    title: "提案", spec: "三級 elevation · 斜向光 + 邊緣高光 + 顆粒 · 帶色調雙層陰影 · 畫布有形狀 · 小控制項不做 blur",
    canvas: "lg-canvas", root: "lg-type", header: "lg lg-2", card: "lg lg-hover lg-live", ctl: "lg lg-ctl",
    modal: "lg lg-3", hr: "lg-hr", num: "lg-num", overlay: "rgba(10,14,36,0.32)",
  },
};

const PROJECTS = [
  { name: "城市花園飯店", id: "A-018", prods: ["AVA", "GW", "KMS"], pct: 78, tag: ["amber", "即將上線"], due: "剩 12 天" },
  { name: "海灣度假酒店", id: "B-006", prods: ["AVA", "AVT"], pct: 54, due: "剩 31 天" },
  { name: "山林溫泉會館", id: "C-011", prods: ["AVA", "TMSP", "ACA"], pct: 100, tag: ["green", "✓ 完成"], due: "已上線" },
  { name: "機場商務旅店", id: "D-003", prods: ["AVA", "ACA"], pct: 36, due: "剩 58 天" },
  { name: "河岸藝術飯店", id: "E-024", prods: ["AVA", "GW"], pct: 67, due: "剩 20 天" },
  { name: "湖畔渡假村", id: "F-009", prods: ["AVA", "AVT", "KMS"], pct: 22, due: "剩 90 天" },
];
const PROD_COLOR = { AVA: "var(--prod-ava)", AVT: "var(--prod-avt)", ACA: "var(--prod-aca)", TMSP: "var(--prod-tmsp)", GW: "var(--prod-gw)", KMS: "var(--accent)" };
const TASKS = [
  ["AHP-1201", "建立基礎設定表", "完成"], ["AHP-1202", "FAQ 資料表匯入", "進行中"], ["AHP-1203", "ACA 介面文案確認", "進行中"],
  ["AHP-1204", "PMS 串接測試", "待處理"], ["AHP-1205", "QR Code 版型", "待處理"], ["AHP-1206", "GuestWeb 網址設定", "完成"],
  ["AHP-1207", "UAT 排程", "待處理"], ["AHP-1208", "上線前檢查清單", "待處理"],
];
const PANE_H = "min(84vh, 880px)";

const onPointerLight = (e) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
};

function Chip({ color, children }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 500, color, background: `color-mix(in srgb, ${color} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 28%, transparent)` }}>
      {children}
    </span>
  );
}

function Pane({ kit, scrollRef, modalOpen, onCloseModal, hidden, ink }) {
  const k = KITS[kit];
  return (
    <div style={{ display: hidden ? "none" : "block" }}>
      <div style={{ color: ink, opacity: 0.85, fontSize: 12, margin: "0 2px 8px", display: "flex", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{k.title}</strong>
        <span style={{ opacity: 0.7 }}>{k.spec}</span>
      </div>
      <div style={{ position: "relative", isolation: "isolate", overflow: "hidden", borderRadius: 16, height: PANE_H, border: "1px solid rgba(128,128,128,.3)" }} data-pane={kit}>
        <div className={k.canvas} />
        <div ref={scrollRef} className={k.root} style={{ position: "absolute", inset: 0, overflowY: "auto", zIndex: 1, color: "var(--text)" }}>
          <header className={k.header} style={{ position: "sticky", top: 0, zIndex: 10, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 22, height: 22, borderRadius: 7, background: "var(--accent)" }} />
              <strong style={{ fontWeight: 500, fontSize: 15 }}>飯店專案進度</strong>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={k.ctl} style={{ padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>🔔 通知設定</button>
              <button className={k.ctl} style={{ padding: "6px 12px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>設定</button>
            </div>
          </header>

          <main style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
              {[["進行中專案", "12"], ["本週到期", "5"], ["待填資料", "38"]].map(([label, n]) => (
                <div key={label} className={k.card} style={{ padding: "16px 18px" }} onPointerMove={onPointerLight}>
                  <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 6 }}>{label}</div>
                  <div className={k.num} style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.1 }}>{n}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <button style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 500 }}>全部</button>
              {["進行中", "即將上線", "已完成"].map((t) => (
                <button key={t} className={k.ctl} style={{ padding: "7px 14px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>{t}</button>
              ))}
              <span style={{ flex: 1 }} />
              <button style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 500, boxShadow: "0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)" }}>＋ 新增專案</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 20 }}>
              {PROJECTS.map((p) => (
                <div key={p.id} className={k.card} style={{ padding: 18, cursor: "pointer" }} onPointerMove={onPointerLight}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "'DM Mono', monospace", background: "var(--bg)", padding: "2px 7px", borderRadius: 5 }}>#{p.id}</span>
                    {p.tag && <Chip color={`var(--${p.tag[0]})`}>{p.tag[1]}</Chip>}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {p.prods.map((x) => <Chip key={x} color={PROD_COLOR[x]}>{x}</Chip>)}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-mid)", marginBottom: 6 }}>
                    <span>資料完成度</span>
                    <span className={k.num} style={{ color: "var(--text)", fontWeight: 500 }}>{p.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ width: `${p.pct}%`, height: "100%", background: p.pct === 100 ? "var(--green)" : "var(--accent)", borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>{p.due}</div>
                </div>
              ))}
            </div>

            <div className={k.card} style={{ padding: "18px 20px 8px", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>Jira 子任務（示範清單）</div>
              {TASKS.map(([key, title, st], i) => (
                <div key={key}>
                  {i > 0 && <hr className={k.hr} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", fontSize: 13 }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--text-subtle)", width: 70 }}>{key}</span>
                    <span style={{ flex: 1 }}>{title}</span>
                    <Chip color={st === "完成" ? "var(--green)" : st === "進行中" ? "var(--prod-ava)" : "var(--text-mid)"}>{st}</Chip>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: 120 }} />
          </main>
        </div>

        {modalOpen && (
          <div onClick={onCloseModal} style={{ position: "absolute", inset: 0, zIndex: 50, background: k.overlay, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, color: "var(--text)" }}>
            <div className={`${k.modal} ${k.root}`} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, padding: 24 }}>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 14 }}>新增專案</div>
              <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 6 }}>飯店名稱</div>
              <input defaultValue="示範飯店" style={{ width: "100%", background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-mid)", borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 14, fontFamily: "inherit" }} />
              <div style={{ fontSize: 12, color: "var(--text-mid)", marginBottom: 6 }}>備註</div>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border-mid)", borderRadius: 10, padding: "9px 12px", fontSize: 13, color: "var(--text-subtle)", marginBottom: 20 }}>輸入框維持不透明，才分得出哪裡能打字</div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button className={k.ctl} onClick={onCloseModal} style={{ padding: "8px 16px", fontSize: 13, color: "var(--text)", cursor: "pointer" }}>取消</button>
                <button onClick={onCloseModal} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>建立</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 以 rAF 量測「自動捲動 4 秒」的幀間隔。只量主執行緒看得到的節奏，compositor 層的細節請用 DevTools Performance。
function measureScroll(el, ms = 4000) {
  return new Promise((resolve) => {
    const max = el.scrollHeight - el.clientHeight;
    const deltas = [];
    let last = 0;
    let t0 = 0;
    const tick = (now) => {
      if (!t0) { t0 = now; last = now; requestAnimationFrame(tick); return; }
      const t = now - t0;
      const p = t < ms / 2 ? t / (ms / 2) : 1 - (t - ms / 2) / (ms / 2);
      el.scrollTop = max * Math.max(0, Math.min(1, p));
      deltas.push(now - last);
      last = now;
      if (t < ms) requestAnimationFrame(tick);
      else {
        el.scrollTop = 0;
        const s = [...deltas].sort((a, b) => a - b);
        const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        resolve({ fps: 1000 / mean, p95: s[Math.floor(s.length * 0.95)], worst: s[s.length - 1], slow: deltas.filter((d) => d > 20).length, frames: deltas.length });
      }
    };
    requestAnimationFrame(tick);
  });
}

function countBlur(paneEl) {
  if (!paneEl) return 0;
  let n = 0;
  paneEl.querySelectorAll("*").forEach((el) => {
    const bf = getComputedStyle(el).backdropFilter;
    if (bf && bf !== "none") n += 1;
  });
  return n;
}

function Preview() {
  const [theme, setTheme] = useState("dark");
  const [mode, setMode] = useState("side");
  const [modalOpen, setModalOpen] = useState(false);
  const [hiding, setHiding] = useState(null);
  const [bench, setBench] = useState({});
  const [running, setRunning] = useState(false);
  const [blurCount, setBlurCount] = useState({});
  const nowRef = useRef(null);
  const nextRef = useRef(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setBlurCount({
        now: countBlur(document.querySelector('[data-pane="now"]')),
        next: countBlur(document.querySelector('[data-pane="next"]')),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [modalOpen, mode, theme]);

  const runBench = useCallback(async () => {
    setRunning(true);
    setBench({});
    const out = {};
    for (const kit of ["now", "next"]) {
      setHiding(kit === "now" ? "next" : "now");
      await new Promise((r) => setTimeout(r, 400));
      out[kit] = await measureScroll((kit === "now" ? nowRef : nextRef).current);
      setBench({ ...out });
    }
    setHiding(null);
    setRunning(false);
  }, []);

  const show = (kit) => (mode === "side" ? true : mode === kit) && hiding !== kit;
  const ink = theme === "light" ? "#16161d" : "#fff";
  const btn = (active) => ({ background: active ? ink : theme === "light" ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.12)", color: active ? (theme === "light" ? "#fff" : "#111") : ink, border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" });

  return (
    <div style={{ padding: 20, minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14, color: ink, fontSize: 13 }}>
        <strong style={{ fontSize: 15, fontWeight: 500 }}>Glass 預覽：現在 vs 提案</strong>
        <button style={btn(theme === "dark")} onClick={() => setTheme("dark")}>深色</button>
        <button style={btn(theme === "light")} onClick={() => setTheme("light")}>淺色</button>
        <span style={{ opacity: 0.4 }}>|</span>
        <button style={btn(mode === "side")} onClick={() => setMode("side")}>並排</button>
        <button style={btn(mode === "now")} onClick={() => setMode("now")}>只看現在</button>
        <button style={btn(mode === "next")} onClick={() => setMode("next")}>只看提案</button>
        <span style={{ opacity: 0.4 }}>|</span>
        <button style={btn(modalOpen)} onClick={() => setModalOpen(!modalOpen)}>{modalOpen ? "關閉 modal" : "開啟 modal"}</button>
        <button style={btn(false)} onClick={runBench} disabled={running}>{running ? "量測中…（約 10 秒）" : "效能實測：自動捲動"}</button>
      </div>

      <div style={{ color: ink, opacity: 0.75, fontSize: 12, marginBottom: 14, lineHeight: 1.7 }}>
        在卡片上移動游標看「邊緣光」；往下捲動看內容經過 Header 時的模糊；切換深淺色與 modal 比較層級。
        backdrop-filter 元素數：現在 <b>{blurCount.now ?? "–"}</b> ／ 提案 <b>{blurCount.next ?? "–"}</b>（預覽內；差在小控制項不再各自做 blur）
      </div>

      {Object.keys(bench).length > 0 && (
        <div style={{ color: ink, fontSize: 12, marginBottom: 14, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {["now", "next"].map((kit) => bench[kit] && (
            <div key={kit}>
              <b>{KITS[kit].title}</b>：平均 {bench[kit].fps.toFixed(1)} fps · p95 幀間隔 {bench[kit].p95.toFixed(1)} ms · 最差 {bench[kit].worst.toFixed(1)} ms · &gt;20ms 的幀 {bench[kit].slow}/{bench[kit].frames}
            </div>
          ))}
          <div style={{ opacity: 0.6 }}>（量測時另一側會暫時隱藏；顯示器 60Hz 時平均約 60 fps 為滿速）</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: mode === "side" ? "repeat(auto-fit, minmax(540px, 1fr))" : "minmax(0, 960px)", gap: 20, justifyContent: "center" }}>
        <Pane kit="now" scrollRef={nowRef} modalOpen={modalOpen} onCloseModal={() => setModalOpen(false)} hidden={!show("now")} ink={ink} />
        <Pane kit="next" scrollRef={nextRef} modalOpen={modalOpen} onCloseModal={() => setModalOpen(false)} hidden={!show("next")} ink={ink} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Preview />);
