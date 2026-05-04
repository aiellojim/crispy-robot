import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Supabase ─────────────────────────────────────────────────
const SUPABASE_URL = "https://yqoingcpcryrcpnhkjzu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxb2luZ2NwY3J5cmNwbmhranp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTg5NTMsImV4cCI6MjA5MjgzNDk1M30.mDbv7McB9urXXYoqm795dnNj2SHUDal_L0Y1_klFy4Y";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── DB ↔ UI mappers ──────────────────────────────────────────
// Convert a DB row pair (projects + project_progress) → UI project shape
const dbToUi = (row, prog) => ({
  id: row.id,
  info: {
    name: row.name ?? "",
    hotelId: row.hotel_id ?? "",
    address: row.address ?? "",
    region: row.region ?? "",
    regionOther: row.region_other ?? "",
    products: row.products ?? [],
    avaUnits: row.ava_units ?? "",
    avaSpare: row.ava_spare ?? "",
    integrations: row.integrations ?? [],
    integrationNotes: row.integration_notes ?? {},
    launchDate: row.launch_date ?? "",
    batch1Deadline: row.batch1_deadline ?? "",
    batch2Deadline: row.batch2_deadline ?? "",
    notes: row.notes ?? "",
    pic: row.pic ?? "",
  },
  updatedAt: prog?.updated_at ?? row.updated_at ?? null,
  basicChecked: prog?.basic_checked ?? {},
  basicNotes: prog?.basic_notes ?? {},
  faqChecked: prog?.faq_checked ?? {},
  faqNotes: prog?.faq_notes ?? {},
  batch2Checked: prog?.batch2_checked ?? {},
  batch2Notes: prog?.batch2_notes ?? {},
  sheetLinks: prog?.sheet_links ?? { basic: "", faq: "", showcase: "", ad: "", popupQR: "" },
});

// Convert UI project → DB rows for upsert
const uiToDb = (proj) => ({
  project: {
    id: proj.id,
    name: proj.info.name,
    hotel_id: proj.info.hotelId,
    address: proj.info.address,
    region: proj.info.region,
    region_other: proj.info.regionOther,
    products: proj.info.products,
    ava_units: proj.info.avaUnits,
    ava_spare: proj.info.avaSpare,
    integrations: proj.info.integrations,
    integration_notes: proj.info.integrationNotes,
    launch_date: proj.info.launchDate || null,
    batch1_deadline: proj.info.batch1Deadline || null,
    batch2_deadline: proj.info.batch2Deadline || null,
    notes: proj.info.notes,
    pic: proj.info.pic,
  },
  progress: {
    project_id: proj.id,
    basic_checked: proj.basicChecked,
    basic_notes: proj.basicNotes,
    faq_checked: proj.faqChecked,
    faq_notes: proj.faqNotes,
    batch2_checked: proj.batch2Checked,
    batch2_notes: proj.batch2Notes,
    sheet_links: proj.sheetLinks,
  },
});

// ─── Constants ────────────────────────────────────────────────
const PRODUCTS = ["AVA", "AVT", "ACA", "TMSP", "GW", "KMS"];
const INTEGRATIONS = ["PBX", "PMS", "TMS", "RCU", "POS", "IPTV"];
const COUNTRIES = ["台灣", "日本", "新加坡", "印尼", "馬來西亞", "澳洲", "美國", "其他"];

const BASIC_SETUP_ITEMS = [
  "房型及機台擺放位置圖片", "需申請後台權限的 email 帳號", "樓層房號表及 WiFi 資訊",
  "機台重啟（Check out）方式", "是否需開啟打掃 & 勿擾功能", "通話快捷鍵設定 & 分機提供",
  "歡迎畫面背景", "歡迎詞填寫", "後台服務功能設定 & 送物 / 修繕項目清單", "TMS Pro 設定",
];
const FAQ_TV_ITEM = "電視頻道設定（若串接項目不含 IPTV 則不用填寫）";
const FAQ_ITEMS = [
  "飯店基本資訊", "飯店內設施", "飯店提供之服務", "入住規則", "備品清單",
  FAQ_TV_ITEM, "特別推薦美食景點",
];
const BATCH2_GW_ITEM = "GuestWeb 內容建置";
const BATCH2_ITEMS = ["機台 Showcase 設定", "廣告設定", "Pop-up QR code 內容設定"];
const BATCH2_LINK_KEYS = ["showcase", "ad", "popupQR"];
const BATCH2_GW_LINK_KEY = "guestWeb";
const calcTotalItems = (integrations, products) => {
  const faqCount = integrations.includes("IPTV") ? FAQ_ITEMS.length : FAQ_ITEMS.length - 1;
  const gwCount = products.includes("GW") ? 1 : 0;
  return BASIC_SETUP_ITEMS.length + faqCount + BATCH2_ITEMS.length + gwCount;
};
const PRODUCT_COLORS = { AVA: "#1e6fb5", AVT: "#0891b2", ACA: "#0e7a5a", TMSP: "#7c3aed", GW: "#b45309", KMS: "#be185d" };

// ─── Theme ────────────────────────────────────────────────────
const L = {
  bg: "#f4f6f9", surface: "#ffffff", border: "#e2e8f0", borderStrong: "#cbd5e1",
  text: "#1e293b", textMid: "#475569", textLight: "#94a3b8",
  accent: "#1d4ed8", accentLight: "#eff6ff", accentBorder: "#bfdbfe",
  green: "#059669", greenLight: "#ecfdf5",
  amber: "#d97706", amberLight: "#fffbeb",
  purple: "#7c3aed", purpleLight: "#f5f3ff",
  red: "#dc2626",
};

const inputStyle = {
  width: "100%", background: "#fff", border: `1.5px solid ${L.border}`, borderRadius: 10,
  color: L.text, padding: "10px 14px", fontSize: 14, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s",
};

// ─── Helpers ──────────────────────────────────────────────────
const calcPct = (proj) => {
  const hasIptv = proj.info.integrations.includes("IPTV");
  const hasGw = proj.info.products.includes("GW");
  const faqCheckedCount = Object.entries(proj.faqChecked)
    .filter(([k, v]) => v && (k !== FAQ_TV_ITEM || hasIptv)).length;
  const batch2CheckedCount = Object.values(proj.batch2Checked).filter(Boolean).length
    + (hasGw && proj.batch2Checked[BATCH2_GW_ITEM] ? 1 : 0);
  const done = Object.values(proj.basicChecked).filter(Boolean).length
    + faqCheckedCount + batch2CheckedCount;
  return Math.round((done / calcTotalItems(proj.info.integrations, proj.info.products)) * 100);
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

const makeProject = () => ({
  id: crypto.randomUUID(),
  info: {
    name: "", hotelId: "", address: "", region: "", regionOther: "",
    products: [], avaUnits: "", avaSpare: "",
    integrations: [], integrationNotes: {},
    launchDate: "", batch1Deadline: "", batch2Deadline: "", notes: "", pic: "",
  },
  basicChecked: {}, faqChecked: {}, batch2Checked: {},
  basicNotes: {}, faqNotes: {}, batch2Notes: {},
  sheetLinks: { basic: "", faq: "", showcase: "", ad: "", popupQR: "", guestWeb: "" },
});

// ─── Module-level UI components (never redefined on render) ───

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #f1f5f9; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
  input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;

// Ring chart
const Ring = ({ pct, size = 80, stroke = 7, color }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={L.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s cubic-bezier(.4,2,.6,1)" }} />
    </svg>
  );
};

// Progress card with ring
const ProgressCard = ({ label, checked, total, color }) => {
  const pct = total === 0 ? 0 : Math.round((checked / total) * 100);
  return (
    <div style={{
      background: "#fff", border: `1.5px solid ${color}33`, borderRadius: 16,
      padding: "18px 22px", display: "flex", alignItems: "center", gap: 18,
      flex: 1, minWidth: 160, boxShadow: `0 2px 12px ${color}15`,
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Ring pct={pct} color={color} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 14, fontWeight: 700, color,
          fontFamily: "'DM Mono',monospace",
        }}>{pct}%</div>
      </div>
      <div>
        <div style={{ fontSize: 11, letterSpacing: 1.5, color: L.textMid, textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: L.text, fontFamily: "'DM Mono',monospace" }}>
          {checked}<span style={{ color: L.textLight, fontSize: 14 }}>/{total}</span>
        </div>
        <div style={{ fontSize: 12, color, marginTop: 2, fontWeight: 500 }}>
          {total - checked === 0 ? "✓ 全部完成" : `還剩 ${total - checked} 項`}
        </div>
      </div>
    </div>
  );
};

// Mini progress bar
const MiniBar = ({ pct, color }) => (
  <div style={{ height: 5, background: L.border, borderRadius: 3, overflow: "hidden", flex: 1 }}>
    <div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 0.6s ease" }} />
  </div>
);

// Section header with count badge
const SectionHeader = ({ title, count, total, color }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: L.text }}>{title}</div>
    <div style={{ background: L.bg, border: `1px solid ${color}44`, borderRadius: 10, padding: "6px 14px" }}>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "'DM Mono',monospace" }}>{count}</span>
      <span style={{ fontSize: 13, color: L.textLight }}>/{total}</span>
    </div>
  </div>
);

// White card wrapper
const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16, padding: 24, marginBottom: 20, boxShadow: "0 1px 4px #0000000a", ...style }}>
    {children}
  </div>
);

// Section label
const SectionLabel = ({ title, icon, accent = L.accent }) => (
  <div style={{ fontSize: 11, letterSpacing: 2, color: accent, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 7, fontWeight: 700 }}>
    <span>{icon}</span>{title}
  </div>
);

// Form input with label
const FInput = ({ label, value, onChange, placeholder, type = "text", accent = L.accent }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.textMid, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
      onFocus={e => (e.target.style.borderColor = accent)}
      onBlur={e => (e.target.style.borderColor = L.border)}
    />
  </div>
);

// Product / integration chip
const Chip = ({ label, active, onClick, color = L.accent }) => (
  <button onClick={onClick} style={{
    padding: "6px 14px", borderRadius: 8,
    border: `1.5px solid ${active ? color : L.border}`,
    background: active ? color : "#fff",
    color: active ? "#fff" : L.textMid,
    cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
  }}>{label}</button>
);

// Checkbox row
const CheckRow = ({ label, checked, onChange, color = L.green }) => (
  <div onClick={onChange} style={{
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    borderRadius: 10, cursor: "pointer", marginBottom: 6,
    background: checked ? `${color}0d` : "#fafbfc",
    border: `1.5px solid ${checked ? color + "55" : L.border}`,
    transition: "all 0.15s",
  }}>
    <div style={{
      width: 20, height: 20, borderRadius: 6,
      border: `2px solid ${checked ? color : L.borderStrong}`,
      background: checked ? color : "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s",
    }}>
      {checked && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
    </div>
    <span style={{ fontSize: 14, color: checked ? L.text : L.textMid }}>{label}</span>
  </div>
);

// Sheet link input block
const SheetLink = ({ value, onChange, accent = L.accent }) => {
  const isInvalid = value.length > 0 && !value.startsWith("http");
  return (
    <div style={{ marginTop: 14, padding: "12px 14px", background: L.accentLight, border: `1px solid ${isInvalid ? L.red + "55" : L.accentBorder}`, borderRadius: 12 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1.5, color: accent, textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
        🔗 資料表連結
      </label>
      <input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="貼上 Google Sheets 或其他資料表連結"
        style={{ ...inputStyle, borderColor: isInvalid ? L.red : `${accent}33` }}
        onFocus={e => (e.target.style.borderColor = isInvalid ? L.red : accent)}
        onBlur={e => (e.target.style.borderColor = isInvalid ? L.red : `${accent}33`)}
      />
      {isInvalid && (
        <div style={{ marginTop: 6, fontSize: 12, color: L.red }}>⚠️ 連結格式不正確，請確認是否以 http 或 https 開頭</div>
      )}
      {!isInvalid && value && (
        <a href={value} target="_blank" rel="noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 12, color: accent, textDecoration: "none", fontWeight: 600 }}>
          ↗ 開啟連結
        </a>
      )}
    </div>
  );
};

// Nav buttons row
const NavRow = ({ onBack, onNext, nextLabel, nextColor = L.accent }) => (
  <div style={{ display: "flex", justifyContent: onBack ? "space-between" : "flex-end" }}>
    {onBack && (
      <button onClick={onBack} style={{ background: "#fff", color: L.textMid, border: `1px solid ${L.border}`, borderRadius: 12, padding: "11px 22px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← 返回</button>
    )}
    {onNext && (
      <button onClick={onNext} style={{ background: nextColor, color: "#fff", border: "none", borderRadius: 12, padding: "11px 26px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 2px 8px ${nextColor}40` }}>{nextLabel}</button>
    )}
  </div>
);

// Batch badge
const BatchBadge = ({ batch, color, bg, deadline }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
    <span style={{ fontSize: 11, background: bg, color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 10px", fontWeight: 700 }}>第{batch}批</span>
    {deadline && <span style={{ fontSize: 12, color: L.textMid }}>期限：{deadline}</span>}
  </div>
);

// ─── HomePage ─────────────────────────────────────────────────
const HomePage = ({ projects, onNew, onOpen, onDelete }) => {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("全部");
  const [sortBy, setSortBy] = useState("created_desc");
  const [picFilter, setPicFilter] = useState("全部");

  const regions = useMemo(() => {
    const set = new Set(projects.map(p => {
      const r = p.info.region;
      return r === "其他" ? (p.info.regionOther || "其他") : r;
    }).filter(Boolean));
    return ["全部", ...Array.from(set)];
  }, [projects]);

  const picList = useMemo(() => {
    const set = new Set(projects.map(p => p.info.pic).filter(Boolean));
    return ["全部", ...Array.from(set).sort()];
  }, [projects]);

  const filtered = useMemo(() => {
    const list = projects.filter(p => {
      const regionDisplay = p.info.region === "其他" ? (p.info.regionOther || "其他") : p.info.region;
      return p.info.name.toLowerCase().includes(search.toLowerCase())
        && (regionFilter === "全部" || regionDisplay === regionFilter)
        && (picFilter === "全部" || p.info.pic === picFilter);
    });
    return [...list].sort((a, b) => {
      if (sortBy === "created_desc") return b.id > a.id ? 1 : -1;
      if (sortBy === "created_asc")  return a.id > b.id ? 1 : -1;
      if (sortBy === "launch_asc") {
        if (!a.info.launchDate) return 1;
        if (!b.info.launchDate) return -1;
        return a.info.launchDate.localeCompare(b.info.launchDate);
      }
      if (sortBy === "launch_desc") {
        if (!a.info.launchDate) return 1;
        if (!b.info.launchDate) return -1;
        return b.info.launchDate.localeCompare(a.info.launchDate);
      }
      return 0;
    });
  }, [projects, search, regionFilter, sortBy]);

  const avgPct = projects.length === 0 ? 0 : Math.round(projects.reduce((a, p) => a + calcPct(p), 0) / projects.length);
  const soonCount = projects.filter(p => { const d = daysUntil(p.info.launchDate); return d !== null && d >= 0 && d <= 30; }).length;
  const doneCount = projects.filter(p => calcPct(p) === 100).length;

  const stats = [
    { label: "專案總數", value: projects.length, icon: "📋", color: L.accent, bg: L.accentLight },
    { label: "平均完成度", value: `${avgPct}%`, icon: "📊", color: L.green, bg: L.greenLight },
    { label: "即將上線（30天內）", value: soonCount, icon: "🚀", color: L.amber, bg: L.amberLight },
    { label: "已完成資料", value: doneCount, icon: "✅", color: L.purple, bg: L.purpleLight },
  ];

  return (
    <div style={{ minHeight: "100vh", background: L.bg, fontFamily: "'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${L.border}`, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: L.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏨</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: L.text, letterSpacing: 0.3 }}>專案交付中心</span>
        </div>
        <button onClick={onNew} style={{ background: L.accent, color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, letterSpacing: 0.3, boxShadow: "0 2px 8px #1d4ed840", fontFamily: "inherit" }}>
          + 新增專案
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 40px 80px" }}>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map(({ label, value, icon, color, bg }, i) => (
            <div key={label} style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16, padding: "22px 24px", boxShadow: "0 1px 4px #0000000a", animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: L.textMid, fontWeight: 500 }}>{label}</span>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: L.text, fontFamily: "'DM Mono',monospace", letterSpacing: -1 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* List header + search + filter + sort */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: L.text, margin: "0 0 18px" }}>專案列表</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "0 0 260px" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: L.textLight, fontSize: 15, pointerEvents: "none" }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋飯店名稱..."
                style={{ ...inputStyle, paddingLeft: 38, borderRadius: 10, fontSize: 13 }}
                onFocus={e => (e.target.style.borderColor = L.accent)}
                onBlur={e => (e.target.style.borderColor = L.border)} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {regions.map(r => (
                <button key={r} onClick={() => setRegionFilter(r)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${regionFilter === r ? L.accent : L.border}`, background: regionFilter === r ? L.accent : "#fff", color: regionFilter === r ? "#fff" : L.textMid, transition: "all 0.15s", fontFamily: "inherit" }}>{r}</button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: L.textLight, whiteSpace: "nowrap" }}>排序方式</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 32px 7px 12px", fontSize: 13, borderRadius: 8, cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
                onFocus={e => (e.target.style.borderColor = L.accent)}
                onBlur={e => (e.target.style.borderColor = L.border)}>
                <option value="created_desc">新增時間（最新）</option>
                <option value="created_asc">新增時間（最舊）</option>
                <option value="launch_asc">上線日期（最近）</option>
                <option value="launch_desc">上線日期（最遠）</option>
              </select>
            </div>
          </div>
          {/* PIC filter row — only shown when there are PICs to filter */}
          {picList.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: L.textLight, whiteSpace: "nowrap" }}>👤 PIC</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {picList.map(p => (
                  <button key={p} onClick={() => setPicFilter(p)} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${picFilter === p ? L.green : L.border}`, background: picFilter === p ? L.green : "#fff", color: picFilter === p ? "#fff" : L.textMid, transition: "all 0.15s", fontFamily: "inherit" }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: L.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏨</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{projects.length === 0 ? "尚無專案，點擊右上角「新增專案」開始" : "找不到符合條件的專案"}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(500px,1fr))", gap: 20 }}>
            {filtered.map((proj, i) => {
              const pct = calcPct(proj);
              const basicDone = Object.values(proj.basicChecked).filter(Boolean).length;
              const faqDone = Object.values(proj.faqChecked).filter(Boolean).length;
              const b2done = Object.values(proj.batch2Checked).filter(Boolean).length;
              const regionDisplay = proj.info.region === "其他" ? (proj.info.regionOther || "其他") : proj.info.region;
              const d = daysUntil(proj.info.launchDate);
              const isComplete = pct === 100;
              const isSoon = d !== null && d >= 0 && d <= 30;
              // Nearest upcoming data deadline
              const deadlines = [
                { label: "第一批期限", date: proj.info.batch1Deadline },
                { label: "第二批期限", date: proj.info.batch2Deadline },
              ].filter(x => x.date).map(x => ({ ...x, days: daysUntil(x.date) }))
               .filter(x => x.days !== null && x.days >= 0)
               .sort((a, b) => a.days - b.days);
              const nearestDeadline = deadlines[0] ?? null;
              return (
                <div key={proj.id} style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.18s", boxShadow: "0 1px 4px #0000000a", animation: `fadeUp 0.3s ease ${i * 0.05}s both`, position: "relative" }}
                  onClick={() => onOpen(proj.id)}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px #1d4ed820"; e.currentTarget.style.borderColor = L.accentBorder; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px #0000000a"; e.currentTarget.style.borderColor = L.border; e.currentTarget.style.transform = "none"; }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: L.text }}>{proj.info.name || "（未命名）"}</span>
                        {proj.info.hotelId && <span style={{ fontSize: 11, color: L.textLight, fontFamily: "'DM Mono',monospace", background: L.bg, padding: "2px 8px", borderRadius: 5 }}>#{proj.info.hotelId}</span>}
                        {regionDisplay && <span style={{ fontSize: 11, background: L.accentLight, color: L.accent, border: `1px solid ${L.accentBorder}`, borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>{regionDisplay}</span>}
                      </div>
                      {proj.info.address && <div style={{ fontSize: 13, color: L.textLight }}>📍 {proj.info.address}</div>}
                      {proj.info.pic && <div style={{ fontSize: 12, color: L.textMid, marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}><span style={{ background: L.greenLight, color: L.green, border: `1px solid ${L.green}33`, borderRadius: 6, padding: "2px 9px", fontWeight: 600 }}>👤 {proj.info.pic}</span></div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      {isComplete && <span style={{ fontSize: 11, background: L.greenLight, color: L.green, border: `1px solid ${L.green}33`, borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}>✓ 完成</span>}
                      {!isComplete && isSoon && <span style={{ fontSize: 11, background: L.amberLight, color: L.amber, border: `1px solid ${L.amber}33`, borderRadius: 6, padding: "3px 10px", fontWeight: 700 }}>🚀 即將上線</span>}
                      <button
                        onClick={e => { e.stopPropagation(); if (window.confirm(`確定要移除「${proj.info.name || "此專案"}」嗎？`)) onDelete(proj.id); }}
                        style={{ background: "none", border: `1px solid ${L.border}`, borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontSize: 13, color: L.textLight, lineHeight: 1, transition: "all 0.15s", fontFamily: "inherit" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.borderColor = L.red; e.currentTarget.style.color = L.red; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.textLight; }}
                        title="移除專案"
                      >🗑</button>
                    </div>
                  </div>

                  {proj.info.products.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      {proj.info.products.map(p => (
                        <span key={p} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: PRODUCT_COLORS[p] || L.accent, borderRadius: 6, padding: "3px 10px" }}>{p}</span>
                      ))}
                    </div>
                  )}

                  {proj.info.integrations.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                      {proj.info.integrations.map(intg => (
                        <span key={intg} style={{ fontSize: 11, fontWeight: 600, color: L.purple, background: L.purpleLight, border: `1px solid ${L.purple}33`, borderRadius: 6, padding: "2px 9px" }}>{intg}</span>
                      ))}
                    </div>
                  )}

                  {proj.info.launchDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: L.bg, borderRadius: 10, padding: "9px 14px", marginBottom: nearestDeadline ? 8 : 16 }}>
                      <span>📅</span>
                      <span style={{ fontSize: 13, color: L.textMid, fontWeight: 500 }}>上線日：</span>
                      <span style={{ fontSize: 13, color: L.text, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{proj.info.launchDate}</span>
                      {d !== null && d >= 0 && (
                        <span style={{ marginLeft: "auto", fontSize: 12, color: d <= 7 ? L.red : d <= 30 ? L.amber : L.textLight, fontWeight: 600 }}>
                          {d === 0 ? "今天" : `${d} 天後`}
                        </span>
                      )}
                    </div>
                  )}
                  {nearestDeadline && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: nearestDeadline.days <= 7 ? "#fef2f2" : L.greenLight, border: `1px solid ${nearestDeadline.days <= 7 ? L.red + "44" : L.green + "44"}`, borderRadius: 10, padding: "9px 14px", marginBottom: 16 }}>
                      <span>🗓️</span>
                      <span style={{ fontSize: 13, color: nearestDeadline.days <= 7 ? L.red : L.green, fontWeight: 500 }}>{nearestDeadline.label}：</span>
                      <span style={{ fontSize: 13, color: L.text, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{nearestDeadline.date}</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: nearestDeadline.days <= 7 ? L.red : L.green, fontWeight: 600 }}>
                        {nearestDeadline.days === 0 ? "今天到期" : `${nearestDeadline.days} 天後`}
                      </span>
                    </div>
                  )}

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                      <span style={{ fontSize: 12, color: L.textMid, fontWeight: 500 }}>整體完成度</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isComplete ? L.green : L.accent, fontFamily: "'DM Mono',monospace" }}>{pct}%</span>
                    </div>
                    <MiniBar pct={pct} color={isComplete ? L.green : L.accent} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { label: "基礎設定", done: basicDone, total: BASIC_SETUP_ITEMS.length, color: L.green },
                      { label: "FAQ 資料表", done: faqDone, total: FAQ_ITEMS.length, color: L.amber },
                      { label: "第二批資料", done: b2done, total: BATCH2_ITEMS.length, color: L.purple },
                    ].map(({ label, done, total, color }) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: L.textLight }}>{label}</span>
                          <span style={{ fontSize: 11, color, fontWeight: 600, fontFamily: "'DM Mono',monospace" }}>{done}/{total}</span>
                        </div>
                        <MiniBar pct={Math.round((done / total) * 100)} color={color} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ProjectDetail ────────────────────────────────────────────
// Uses LOCAL state for the form; syncs to parent only on blur / toggle,
// so typing a character never causes a full remount of input elements.
const ProjectDetail = ({ project, isNew, onUpdate, onBack, allPics }) => {
  const [step, setStep] = useState(isNew ? 0 : 3);

  // Local copies – avoids propagating every keystroke up to App
  const [info, setInfoLocal] = useState(project.info);
  const [basicChecked, setBasicChecked] = useState(project.basicChecked);
  const [faqChecked, setFaqChecked] = useState(project.faqChecked);
  const [batch2Checked, setBatch2Checked] = useState(project.batch2Checked);
  const [basicNotes, setBasicNotes] = useState(project.basicNotes || {});
  const [faqNotes, setFaqNotes] = useState(project.faqNotes || {});
  const [batch2Notes, setBatch2Notes] = useState(project.batch2Notes || {});
  const [sheetLinks, setSheetLinks] = useState(project.sheetLinks);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved
  const saveStatusTimer = useRef(null);

  // Sync local → parent whenever any piece changes
  useEffect(() => {
    setSaveStatus("saving");
    if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    onUpdate({ ...project, info, basicChecked, faqChecked, batch2Checked, basicNotes, faqNotes, batch2Notes, sheetLinks });
    saveStatusTimer.current = setTimeout(() => {
      setSaveStatus("saved");
      saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
    }, 900);
  }, [info, basicChecked, faqChecked, batch2Checked, basicNotes, faqNotes, batch2Notes, sheetLinks]); // eslint-disable-line

  const setInfo = useCallback((fn) => setInfoLocal(p => fn(p)), []);
  const toggleArr = useCallback((key, val) =>
    setInfo(p => ({ ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val] })), [setInfo]);
  const toggleCheck = useCallback((setter, key) => setter(p => ({ ...p, [key]: !p[key] })), []);

  const hasIptv = info.integrations.includes("IPTV");
  const hasGw = info.products.includes("GW");
  const activeFaqItems = FAQ_ITEMS.filter(item => item !== FAQ_TV_ITEM || hasIptv);
  const basicCount = Object.values(basicChecked).filter(Boolean).length;
  const faqCount = Object.entries(faqChecked).filter(([k, v]) => v && (k !== FAQ_TV_ITEM || hasIptv)).length;
  const batch2Count = Object.values(batch2Checked).filter(Boolean).length;
  const totalPct = Math.round(((basicCount + faqCount + batch2Count) / calcTotalItems(info.integrations, info.products)) * 100);
  const infoComplete = info.name && info.address && info.region && info.products.length > 0 && info.launchDate;

  const STEPS = ["專案資訊", "第一批資料", "第二批資料", "總覽"];

  return (
    <div style={{ minHeight: "100vh", background: L.bg, fontFamily: "'Noto Sans TC','Segoe UI',sans-serif" }}>
      <style>{GLOBAL_STYLES}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${L.border}`, padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: L.textMid, fontSize: 13, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", padding: 0 }}>← 返回列表</button>
          <span style={{ color: L.border }}>│</span>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: L.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏨</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: L.text }}>{info.name || "新專案"}</span>
          {info.hotelId && <span style={{ fontSize: 12, color: L.textLight, fontFamily: "'DM Mono',monospace" }}>#{info.hotelId}</span>}
        </div>
        <div style={{ fontSize: 13, color: L.textMid, background: L.bg, border: `1px solid ${L.border}`, borderRadius: 8, padding: "5px 14px", fontFamily: "'DM Mono',monospace", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: totalPct === 100 ? L.green : L.accent }}>{totalPct}%</span> 完成
          <span style={{ fontSize: 11, fontWeight: 400, color: saveStatus === "saving" ? L.amber : saveStatus === "saved" ? L.green : L.textLight, transition: "color 0.3s", minWidth: 60 }}>
            {saveStatus === "saving" ? "· 儲存中…" : saveStatus === "saved" ? "· 已儲存 ✓" : "· 自動儲存"}
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background: "#fff", borderBottom: `1px solid ${L.border}`, padding: "0 40px", display: "flex" }}>
        {STEPS.map((s, i) => (
          <button key={i} onClick={() => setStep(i)} style={{ padding: "14px 20px", background: "none", border: "none", borderBottom: `2.5px solid ${step === i ? L.accent : "transparent"}`, color: step === i ? L.accent : L.textLight, cursor: "pointer", fontSize: 13, fontWeight: step === i ? 700 : 500, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", background: step === i ? L.accentLight : L.bg, border: `1.5px solid ${step === i ? L.accent : L.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: step === i ? L.accent : L.textLight }}>{i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 32px 80px" }}>

        {/* ── Step 0: Info ── */}
        {step === 0 && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: L.text, margin: "0 0 5px" }}>專案基本資訊</h2>
              <p style={{ fontSize: 13, color: L.textMid, margin: 0 }}>填寫飯店基本資料與購置設備</p>
            </div>

            <Card>
              <SectionLabel title="飯店資訊" icon="🏨" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                <FInput label="飯店名稱" value={info.name} onChange={v => setInfo(p => ({ ...p, name: v }))} placeholder="例：台北大飯店" />
                <FInput label="Hotel ID" value={info.hotelId} onChange={v => setInfo(p => ({ ...p, hotelId: v }))} placeholder="例：TPE-001" />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.textMid, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>負責人（PIC）</label>
                <datalist id="pic-list">
                  {allPics.map(p => <option key={p} value={p} />)}
                </datalist>
                <input
                  list="pic-list"
                  value={info.pic}
                  onChange={e => setInfo(p => ({ ...p, pic: e.target.value }))}
                  placeholder="輸入負責人姓名，若不在清單內將自動新增"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = L.green)}
                  onBlur={e => (e.target.style.borderColor = L.border)}
                />
                {info.pic && !allPics.includes(info.pic) && (
                  <div style={{ marginTop: 6, fontSize: 12, color: L.green }}>✦ 將新增「{info.pic}」至 PIC 清單</div>
                )}
              </div>
              <FInput label="地址" value={info.address} onChange={v => setInfo(p => ({ ...p, address: v }))} placeholder="例：台北市中山區南京東路一段" />
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.textMid, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>所在國家</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {COUNTRIES.map(c => (
                    <Chip key={c} label={c} active={info.region === c} color={L.accent}
                      onClick={() => setInfo(p => ({ ...p, region: c, regionOther: c !== "其他" ? "" : p.regionOther }))} />
                  ))}
                </div>
                {info.region === "其他" && (
                  <input type="text" value={info.regionOther}
                    onChange={e => setInfo(p => ({ ...p, regionOther: e.target.value }))}
                    placeholder="請輸入國家／地區名稱"
                    style={{ ...inputStyle, borderColor: L.accent }}
                    onFocus={e => (e.target.style.borderColor = L.accent)}
                    onBlur={e => (e.target.style.borderColor = L.accent)} />
                )}
              </div>
            </Card>

            <Card>
              <SectionLabel title="購置產品" icon="📦" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                {PRODUCTS.map(p => <Chip key={p} label={p} active={info.products.includes(p)} color={PRODUCT_COLORS[p] || L.accent} onClick={() => toggleArr("products", p)} />)}
              </div>
              {info.products.includes("AVA") && (
                <div style={{ background: L.accentLight, border: `1px solid ${L.accentBorder}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: L.accent, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>AVA 機台數量</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <FInput label="裝機數量" value={info.avaUnits} onChange={v => setInfo(p => ({ ...p, avaUnits: v }))} placeholder="例：50" type="number" />
                    <FInput label="備品機台數量" value={info.avaSpare} onChange={v => setInfo(p => ({ ...p, avaSpare: v }))} placeholder="例：5" type="number" />
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <SectionLabel title="串接功能" icon="🔗" accent={L.purple} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                {INTEGRATIONS.map(i => <Chip key={i} label={i} active={info.integrations.includes(i)} color={L.purple} onClick={() => toggleArr("integrations", i)} />)}
              </div>
              {info.integrations.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {info.integrations.map(intg => (
                    <div key={intg}>
                      <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.purple, textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>{intg} 備註說明</label>
                      <textarea value={info.integrationNotes[intg] || ""}
                        onChange={e => setInfo(p => ({ ...p, integrationNotes: { ...p.integrationNotes, [intg]: e.target.value } }))}
                        placeholder={`請說明 ${intg} 串接相關需求或細節`}
                        rows={3}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                        onFocus={e => (e.target.style.borderColor = L.purple)}
                        onBlur={e => (e.target.style.borderColor = L.border)} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 24 }}>
                <SectionLabel title="日期設定" icon="📅" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.textMid, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>上線日期</label>
                    <input type="date" value={info.launchDate}
                      onChange={e => setInfo(p => ({ ...p, launchDate: e.target.value }))}
                      style={{ ...inputStyle, borderColor: L.border }}
                      onFocus={e => (e.target.style.borderColor = L.accent)}
                      onBlur={e => (e.target.style.borderColor = L.border)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.green, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>第一批資料期限</label>
                    <div style={{ fontSize: 10, color: L.textLight, marginBottom: 6 }}>基礎設定 ＋ FAQ</div>
                    <input type="date" value={info.batch1Deadline}
                      onChange={e => setInfo(p => ({ ...p, batch1Deadline: e.target.value }))}
                      style={{ ...inputStyle, borderColor: info.launchDate && info.batch1Deadline && info.batch1Deadline > info.launchDate ? L.red : `${L.green}44`, background: L.greenLight }}
                      onFocus={e => (e.target.style.borderColor = L.green)}
                      onBlur={e => (e.target.style.borderColor = info.launchDate && info.batch1Deadline && info.batch1Deadline > info.launchDate ? L.red : `${L.green}44`)} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, letterSpacing: 1.5, color: L.purple, textTransform: "uppercase", marginBottom: 7, fontWeight: 600 }}>第二批資料期限</label>
                    <div style={{ fontSize: 10, color: L.textLight, marginBottom: 6 }}>Showcase ＋ 廣告 ＋ QR</div>
                    <input type="date" value={info.batch2Deadline}
                      onChange={e => setInfo(p => ({ ...p, batch2Deadline: e.target.value }))}
                      style={{ ...inputStyle, borderColor: `${L.purple}44`, background: L.purpleLight }}
                      onFocus={e => (e.target.style.borderColor = L.purple)}
                      onBlur={e => (e.target.style.borderColor = `${L.purple}44`)} />
                  </div>
                </div>
                {info.launchDate && info.batch1Deadline && info.batch1Deadline > info.launchDate && (
                  <div style={{ marginTop: 10, padding: "9px 14px", background: "#fef2f2", border: `1px solid ${L.red}44`, borderRadius: 10, fontSize: 12, color: L.red, display: "flex", alignItems: "center", gap: 7 }}>
                    ⚠️ 第一批資料期限（{info.batch1Deadline}）晚於上線日期（{info.launchDate}），請確認是否正確。
                  </div>
                )}
              </div>

              <div style={{ marginTop: 24 }}>
                <SectionLabel title="其餘功能需求或備注" icon="📝" />
                <textarea value={info.notes}
                  onChange={e => setInfo(p => ({ ...p, notes: e.target.value }))}
                  placeholder="說明是否有額外功能開發需求..."
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  onFocus={e => (e.target.style.borderColor = L.accent)}
                  onBlur={e => (e.target.style.borderColor = L.border)} />
              </div>
            </Card>

            <NavRow onNext={() => setStep(1)} nextLabel="下一步：第一批資料 →" nextColor={infoComplete ? L.accent : L.textLight} />
          </div>
        )}

        {/* ── Step 1: Batch 1 ── */}
        {step === 1 && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: L.text, margin: "0 0 6px" }}>第一批資料</h2>
              <BatchBadge batch="一" color={L.green} bg={L.greenLight} deadline={info.batch1Deadline} />
            </div>

            <Card>
              <SectionHeader title="基礎設定資料表" count={basicCount} total={BASIC_SETUP_ITEMS.length} color={L.green} />
              {BASIC_SETUP_ITEMS.map(item => (
                <div key={item} style={{ marginBottom: 8 }}>
                  <CheckRow label={item} checked={!!basicChecked[item]} onChange={() => toggleCheck(setBasicChecked, item)} color={L.green} />
                  <textarea
                    value={basicNotes[item] || ""}
                    onChange={e => setBasicNotes(p => ({ ...p, [item]: e.target.value }))}
                    placeholder="補充說明進行狀況或缺少項目…"
                    rows={2}
                    style={{ ...inputStyle, marginTop: 4, fontSize: 12, color: L.textMid, resize: "vertical", minHeight: 56, background: "#fafbfc", borderColor: L.border }}
                    onFocus={e => (e.target.style.borderColor = L.green)}
                    onBlur={e => (e.target.style.borderColor = L.border)}
                  />
                </div>
              ))}
              <SheetLink value={sheetLinks.basic} onChange={v => setSheetLinks(p => ({ ...p, basic: v }))} accent={L.green} />
            </Card>

            <Card>
              <SectionHeader title="FAQ 資料表" count={faqCount} total={activeFaqItems.length} color={L.amber} />
              {activeFaqItems.map(item => (
                <div key={item} style={{ marginBottom: 8 }}>
                  <CheckRow label={item} checked={!!faqChecked[item]} onChange={() => toggleCheck(setFaqChecked, item)} color={L.amber} />
                  <textarea
                    value={faqNotes[item] || ""}
                    onChange={e => setFaqNotes(p => ({ ...p, [item]: e.target.value }))}
                    placeholder="補充說明進行狀況或缺少項目…"
                    rows={2}
                    style={{ ...inputStyle, marginTop: 4, fontSize: 12, color: L.textMid, resize: "vertical", minHeight: 56, background: "#fafbfc", borderColor: L.border }}
                    onFocus={e => (e.target.style.borderColor = L.amber)}
                    onBlur={e => (e.target.style.borderColor = L.border)}
                  />
                </div>
              ))}
              {!hasIptv && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: L.bg, border: `1px solid ${L.border}`, marginBottom: 6, opacity: 0.6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${L.borderStrong}`, background: L.border, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: L.textLight }}>{FAQ_TV_ITEM}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: L.textLight, background: L.borderStrong + "44", borderRadius: 5, padding: "2px 8px" }}>未選擇 IPTV，不需填寫</span>
                </div>
              )}
              <SheetLink value={sheetLinks.faq} onChange={v => setSheetLinks(p => ({ ...p, faq: v }))} accent={L.amber} />
            </Card>

            <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="下一步：第二批資料 →" nextColor={L.green} />
          </div>
        )}

        {/* ── Step 2: Batch 2 ── */}
        {step === 2 && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: L.text, margin: "0 0 6px" }}>第二批資料</h2>
              <BatchBadge batch="二" color={L.purple} bg={L.purpleLight} deadline={info.batch2Deadline} />
            </div>

            <Card>
              <SectionHeader title="第二批資料完成情況" count={batch2Count} total={BATCH2_ITEMS.length + (hasGw ? 1 : 0)} color={L.purple} />
              {BATCH2_ITEMS.map((item, idx) => (
                <div key={item} style={{ marginBottom: 16 }}>
                  <CheckRow label={item} checked={!!batch2Checked[item]} onChange={() => toggleCheck(setBatch2Checked, item)} color={L.purple} />
                  <textarea
                    value={batch2Notes[item] || ""}
                    onChange={e => setBatch2Notes(p => ({ ...p, [item]: e.target.value }))}
                    placeholder="補充說明進行狀況或缺少項目…"
                    rows={2}
                    style={{ ...inputStyle, marginTop: 4, fontSize: 12, color: L.textMid, resize: "vertical", minHeight: 56, background: "#fafbfc", borderColor: L.border }}
                    onFocus={e => (e.target.style.borderColor = L.purple)}
                    onBlur={e => (e.target.style.borderColor = L.border)}
                  />
                  <SheetLink value={sheetLinks[BATCH2_LINK_KEYS[idx]]} onChange={v => setSheetLinks(p => ({ ...p, [BATCH2_LINK_KEYS[idx]]: v }))} accent={L.purple} />
                </div>
              ))}
              {hasGw ? (
                <div style={{ marginBottom: 16 }}>
                  <CheckRow label={`${BATCH2_GW_ITEM}`} checked={!!batch2Checked[BATCH2_GW_ITEM]} onChange={() => toggleCheck(setBatch2Checked, BATCH2_GW_ITEM)} color={L.purple} />
                  <textarea
                    value={batch2Notes[BATCH2_GW_ITEM] || ""}
                    onChange={e => setBatch2Notes(p => ({ ...p, [BATCH2_GW_ITEM]: e.target.value }))}
                    placeholder="補充說明進行狀況或缺少項目…"
                    rows={2}
                    style={{ ...inputStyle, marginTop: 4, fontSize: 12, color: L.textMid, resize: "vertical", minHeight: 56, background: "#fafbfc", borderColor: L.border }}
                    onFocus={e => (e.target.style.borderColor = L.purple)}
                    onBlur={e => (e.target.style.borderColor = L.border)}
                  />
                  <SheetLink value={sheetLinks[BATCH2_GW_LINK_KEY]} onChange={v => setSheetLinks(p => ({ ...p, [BATCH2_GW_LINK_KEY]: v }))} accent={L.purple} />
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: L.bg, border: `1px solid ${L.border}`, opacity: 0.6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${L.borderStrong}`, background: L.border, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: L.textLight }}>{BATCH2_GW_ITEM}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: L.textLight, background: L.borderStrong + "44", borderRadius: 5, padding: "2px 8px" }}>未選擇 GW，不需填寫</span>
                </div>
              )}
            </Card>

            <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="查看總覽 →" nextColor={L.purple} />
          </div>
        )}

        {/* ── Step 3: Overview ── */}
        {step === 3 && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: L.text, margin: "0 0 5px" }}>專案總覽</h2>
              <p style={{ fontSize: 13, color: L.textMid, margin: 0 }}>
                所有資料的完成度一覽
                {project.updatedAt && (
                  <span style={{ marginLeft: 12, color: L.textLight }}>
                    · 最後更新：{new Date(project.updatedAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </p>
            </div>

            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: L.textMid, fontWeight: 500 }}>整體完成度</span>
                <span style={{ fontSize: 26, fontWeight: 700, color: totalPct === 100 ? L.green : L.accent, fontFamily: "'DM Mono',monospace" }}>{totalPct}%</span>
              </div>
              <div style={{ height: 10, background: L.bg, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 5, background: totalPct === 100 ? L.green : `linear-gradient(90deg,${L.accent},${L.purple})`, width: `${totalPct}%`, transition: "width 0.8s ease" }} />
              </div>
            </Card>

            {(info.batch1Deadline || info.batch2Deadline) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                {[
                  { label: "第一批資料期限", date: info.batch1Deadline, sub: "基礎設定資料 ＋ FAQ 資料", color: L.green, bg: L.greenLight },
                  { label: "第二批資料期限", date: info.batch2Deadline, sub: "Showcase ＋ 廣告 ＋ QR", color: L.purple, bg: L.purpleLight },
                ].map(({ label, date, sub, color, bg }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 24 }}>🗓️</span>
                    <div>
                      <div style={{ fontSize: 10, color, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2, fontWeight: 700 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: L.text, fontFamily: "'DM Mono',monospace" }}>{date || "—"}</div>
                      <div style={{ fontSize: 11, color: L.textMid, marginTop: 2 }}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
              <ProgressCard label="基礎設定資料表" checked={basicCount} total={BASIC_SETUP_ITEMS.length} color={L.green} />
              <ProgressCard label="FAQ 資料表" checked={faqCount} total={FAQ_ITEMS.length} color={L.amber} />
              <ProgressCard label="第二批資料" checked={batch2Count} total={BATCH2_ITEMS.length} color={L.purple} />
            </div>

            {info.name && (
              <Card>
                <div style={{ fontSize: 11, letterSpacing: 2, color: L.accent, textTransform: "uppercase", marginBottom: 16, fontWeight: 700 }}>📋 專案資訊</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 28px" }}>
                  {[
                    ["飯店名稱", info.name], ["Hotel ID", info.hotelId || "—"],
                    ["負責人（PIC）", info.pic || "—"],
                    ["地址", info.address],
                    ["所在國家", info.region === "其他" ? (info.regionOther || "其他") : info.region],
                    ["上線日期", info.launchDate || "—"],
                    ["購置產品", info.products.join("、") || "—"],
                    ["串接功能", info.integrations.join("、") || "無"],
                    info.products.includes("AVA") && ["AVA 裝機 / 備品", `${info.avaUnits || "—"} / ${info.avaSpare || "—"} 台`],
                    ["第一批資料期限", info.batch1Deadline || "—"],
                    ["第二批資料期限", info.batch2Deadline || "—"],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} style={{ padding: "10px 0", borderBottom: `1px solid ${L.border}` }}>
                      <div style={{ fontSize: 11, color: L.textLight, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4, fontWeight: 500 }}>{k}</div>
                      <div style={{ fontSize: 14, color: L.text, fontWeight: 500 }}>{v || "—"}</div>
                    </div>
                  ))}
                </div>
                {info.notes && (
                  <div style={{ marginTop: 14, padding: 14, background: L.bg, borderRadius: 10, border: `1px solid ${L.border}` }}>
                    <div style={{ fontSize: 11, color: L.textLight, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, fontWeight: 500 }}>其餘功能需求或備注</div>
                    <div style={{ fontSize: 13, color: L.textMid, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{info.notes}</div>
                  </div>
                )}
                {info.integrations.length > 0 && info.integrations.some(k => info.integrationNotes[k]) && (
                  <div style={{ marginTop: 14, padding: 14, background: L.purpleLight, borderRadius: 10, border: `1px solid ${L.purple}33` }}>
                    <div style={{ fontSize: 11, color: L.purple, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10, fontWeight: 700 }}>串接功能備註</div>
                    {info.integrations.filter(k => info.integrationNotes[k]).map(k => (
                      <div key={k} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${L.purple}22` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: L.purple, marginBottom: 4, letterSpacing: 0.5 }}>{k}</div>
                        <div style={{ fontSize: 13, color: L.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{info.integrationNotes[k]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {[
                { label: "基礎設定資料表", items: BASIC_SETUP_ITEMS, checked: basicChecked, notes: basicNotes, color: L.green, linkKey: "basic" },
                { label: "FAQ 資料表", items: activeFaqItems, checked: faqChecked, notes: faqNotes, color: L.amber, linkKey: "faq", showTvNotice: !hasIptv },
              ].map(({ label, items, checked, notes, color, linkKey, showTvNotice }) => (
                <div key={label} style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16, padding: 18, boxShadow: "0 1px 4px #0000000a" }}>
                  <div style={{ fontSize: 11, letterSpacing: 1.5, color, textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>{label}</div>
                  {items.map(item => {
                    const hasNote = notes[item] && notes[item].trim();
                    return (
                      <div key={item} style={{ borderBottom: `1px solid ${L.bg}` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 0" }}>
                          <span style={{ fontSize: 13, color: checked[item] ? color : L.border, flexShrink: 0, marginTop: 1 }}>{checked[item] ? "✓" : "○"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: checked[item] ? L.text : L.textLight, lineHeight: 1.5 }}>{item}</span>
                            {hasNote && (
                              <div style={{ marginTop: 5, padding: "6px 10px", background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 7, fontSize: 11, color: L.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                {notes[item]}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {showTvNotice && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${L.bg}`, opacity: 0.5 }}>
                      <span style={{ fontSize: 13, color: L.border, flexShrink: 0 }}>—</span>
                      <span style={{ fontSize: 12, color: L.textLight }}>{FAQ_TV_ITEM}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: L.textLight, background: L.bg, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>未選 IPTV</span>
                    </div>
                  )}
                  {sheetLinks[linkKey] && (
                    <a href={sheetLinks[linkKey]} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 14, fontSize: 12, color, textDecoration: "none", fontWeight: 600, background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 7, padding: "5px 12px" }}>
                      🔗 開啟資料表
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${L.border}`, borderRadius: 16, padding: 18, marginBottom: 24, boxShadow: "0 1px 4px #0000000a" }}>
              <div style={{ fontSize: 11, letterSpacing: 1.5, color: L.purple, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>第二批資料</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {BATCH2_ITEMS.map((item, idx) => {
                  const lk = BATCH2_LINK_KEYS[idx];
                  const done = !!batch2Checked[item];
                  const hasNote = batch2Notes[item] && batch2Notes[item].trim();
                  return (
                    <div key={item} style={{ background: done ? L.purpleLight : "#fafbfc", border: `1px solid ${done ? L.purple + "44" : L.border}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (hasNote || sheetLinks[lk]) ? 8 : 0 }}>
                        <span style={{ fontSize: 13, color: done ? L.purple : L.border, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                        <span style={{ fontSize: 13, color: done ? L.text : L.textLight, fontWeight: done ? 600 : 400 }}>{item}</span>
                      </div>
                      {hasNote && (
                        <div style={{ margin: "6px 0 8px 22px", padding: "6px 10px", background: `${L.purple}08`, border: `1px solid ${L.purple}22`, borderRadius: 7, fontSize: 11, color: L.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {batch2Notes[item]}
                        </div>
                      )}
                      {sheetLinks[lk] && (
                        <div style={{ marginLeft: 22 }}>
                          <a href={sheetLinks[lk]} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: L.purple, textDecoration: "none", fontWeight: 600, background: L.purpleLight, border: `1px solid ${L.purple}33`, borderRadius: 6, padding: "3px 10px", display: "inline-block" }}>
                            🔗 連結
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* GW item — only shown when GW is selected */}
                {hasGw ? (() => {
                  const done = !!batch2Checked[BATCH2_GW_ITEM];
                  const hasNote = batch2Notes[BATCH2_GW_ITEM] && batch2Notes[BATCH2_GW_ITEM].trim();
                  return (
                    <div style={{ background: done ? L.purpleLight : "#fafbfc", border: `1px solid ${done ? L.purple + "44" : L.border}`, borderRadius: 12, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: (hasNote || sheetLinks[BATCH2_GW_LINK_KEY]) ? 8 : 0 }}>
                        <span style={{ fontSize: 13, color: done ? L.purple : L.border, flexShrink: 0 }}>{done ? "✓" : "○"}</span>
                        <span style={{ fontSize: 13, color: done ? L.text : L.textLight, fontWeight: done ? 600 : 400 }}>{BATCH2_GW_ITEM}</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 5, padding: "2px 7px" }}>GW</span>
                      </div>
                      {hasNote && (
                        <div style={{ margin: "6px 0 8px 22px", padding: "6px 10px", background: `${L.purple}08`, border: `1px solid ${L.purple}22`, borderRadius: 7, fontSize: 11, color: L.textMid, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {batch2Notes[BATCH2_GW_ITEM]}
                        </div>
                      )}
                      {sheetLinks[BATCH2_GW_LINK_KEY] && (
                        <div style={{ marginLeft: 22 }}>
                          <a href={sheetLinks[BATCH2_GW_LINK_KEY]} target="_blank" rel="noreferrer"
                            style={{ fontSize: 11, color: L.purple, textDecoration: "none", fontWeight: 600, background: L.purpleLight, border: `1px solid ${L.purple}33`, borderRadius: 6, padding: "3px 10px", display: "inline-block" }}>
                            🔗 連結
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })() : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: L.bg, border: `1px solid ${L.border}`, opacity: 0.5 }}>
                    <span style={{ fontSize: 13, color: L.border }}>—</span>
                    <span style={{ fontSize: 12, color: L.textLight }}>{BATCH2_GW_ITEM}</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: L.textLight, background: L.bg, borderRadius: 5, padding: "2px 7px", whiteSpace: "nowrap" }}>未選擇 GW</span>
                  </div>
                )}
              </div>
            </div>

            <NavRow onBack={() => setStep(2)} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Debounce timer ref for auto-save
  const saveTimer = useRef({});

  // ── Load all projects on mount ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: projRows, error: e1 } = await sb.from("projects").select("*").order("created_at", { ascending: false });
        if (e1) throw e1;
        const { data: progRows, error: e2 } = await sb.from("project_progress").select("*");
        if (e2) throw e2;
        const progMap = Object.fromEntries((progRows ?? []).map(p => [p.project_id, p]));
        setProjects((projRows ?? []).map(row => dbToUi(row, progMap[row.id])));
      } catch (err) {
        setError("無法連線到資料庫：" + (err.message ?? err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Create new project ──
  const handleNew = async () => {
    const proj = makeProject();
    // Optimistic update
    setProjects(prev => [proj, ...prev]);
    setActiveId(proj.id);
    setIsNew(true);
    setView("detail");
    try {
      const { project, progress } = uiToDb(proj);
      const { error: e1 } = await sb.from("projects").insert(project);
      if (e1) throw e1;
      const { error: e2 } = await sb.from("project_progress").insert(progress);
      if (e2) throw e2;
    } catch (err) {
      setError("新增專案失敗：" + (err.message ?? err));
    }
  };

  // ── Auto-save on update (debounced 800ms) ──
  const handleUpdate = useCallback((updated) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    // Clear previous timer for this project
    if (saveTimer.current[updated.id]) clearTimeout(saveTimer.current[updated.id]);
    saveTimer.current[updated.id] = setTimeout(async () => {
      try {
        const { project, progress } = uiToDb(updated);
        const { error: e1 } = await sb.from("projects").upsert(project);
        if (e1) throw e1;
        const { error: e2 } = await sb.from("project_progress").upsert(progress, { onConflict: "project_id" });
        if (e2) throw e2;
      } catch (err) {
        setError("儲存失敗：" + (err.message ?? err));
      }
    }, 800);
  }, []);

  // ── Delete project ──
  const handleDelete = useCallback(async (id) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    try {
      const { error: e } = await sb.from("projects").delete().eq("id", id);
      if (e) throw e;
    } catch (err) {
      setError("刪除失敗：" + (err.message ?? err));
    }
  }, []);

  const handleOpen = (id) => { setActiveId(id); setIsNew(false); setView("detail"); };
  const activeProject = projects.find(p => p.id === activeId);
  const allPics = useMemo(() => [...new Set(projects.map(p => p.info.pic).filter(Boolean))].sort(), [projects]);

  // ── Loading screen ──
  if (loading) return (
    <div style={{ minHeight: "100vh", background: L.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC',sans-serif", gap: 16 }}>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ width: 40, height: 40, border: `3px solid ${L.accentBorder}`, borderTopColor: L.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 14, color: L.textMid }}>載入專案資料中…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      {/* Global error toast */}
      {error && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#fef2f2", border: `1px solid ${L.red}44`, borderRadius: 12, padding: "12px 20px", fontSize: 13, color: L.red, zIndex: 9999, boxShadow: "0 4px 16px #0000001a", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: L.red, fontWeight: 700, fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}
      {view === "detail" && activeProject
        ? <ProjectDetail project={activeProject} isNew={isNew} onUpdate={handleUpdate} onBack={() => setView("home")} allPics={allPics} />
        : <HomePage projects={projects} onNew={handleNew} onOpen={handleOpen} onDelete={handleDelete} />
      }
    </>
  );
}
