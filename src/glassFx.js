// glassFx — Liquid Glass 的「質感加成」層（2026-10-06）。
//
// 這個檔案負責五件事，全部疊在既有毛玻璃（--glass-surface／blur(20px) saturate(160%)／
// canvas 色暈）之上，不改變它們：
//   1. 斜向光   --lg-bg / --lg-bg-hover：左上角一道 135° 的柔光，疊在 --glass-surface 上面
//   2. 邊緣光   .lg-live：游標移到元素上時，邊框（1px）會跟著游標位置亮起一小段
//   3. 色調陰影 tint(a)：大陰影不用純黑，改成帶一點主題色的深色（淺色=藍灰、深色=靛黑、jim=深綠）
//   4. 主色 CTA   .lg-cta：實色平面＋半透明白邊框＋游標邊緣光（CTA_CLASS）；底色、文字色維持原本
//   5. 文字細節 body 等寬數字（tabular-nums）、標題 text-wrap:balance
//
// 想調整外觀時只動這個檔案的 token（下面 GLASS_FX_CSS 的五個區塊）；jsx 那邊只引用
// GLASS_BG / GLASS_BG_HOVER / RIM / RIM_HOVER / tint()，不再手寫字面值。
//
// ⚠ 新增 token 要在五個區塊都定義：:root、dark media、html[data-theme=light]、
//   html[data-theme=dark]、html.jim-mode-effect（jim 要放最後，兩者同 specificity 靠順序）。
//   這跟 hotel-project-dashboard.jsx GLOBAL_CSS 的 --glass-surface 同一個規則。
//
// 還原：git tag before-glass-v2-2026-10-06；或把 jsx 的 GLASS.background 改回
// "var(--glass-surface)" 並移除本檔 import，即可完全回到原本材質。

// ─── jsx 端使用的常數 ─────────────────────────────────────────
export const GLASS_BG = "var(--lg-bg)";
export const GLASS_BG_HOVER = "var(--lg-bg-hover)";
export const RIM = "var(--lg-rim)";
export const RIM_HOVER = "var(--lg-rim-hover)";
export const CTA_CLASS = "lg-cta lg-live"; // 主色 CTA 按鈕用，樣式見 GLASS_FX_CSS 的 .lg-cta

// 色調陰影：保留各處原本的強度（a = 原本 rgba(0,0,0,a) 的 alpha），只把顏色換成主題色調。
// color-mix 需要 Chrome 111 / Safari 16.2 / Firefox 113 以上；更舊的瀏覽器整條 box-shadow 會失效
// （只剩 border，沒有陰影），不影響功能。
export const tint = (a) =>
  `color-mix(in srgb, var(--lg-shadow-tint) ${Math.round(a * 100)}%, transparent)`;

// 重複出現的樣式組合（值與原本逐字相同，只是集中定義）：
// glassTint("purple") → 玻璃底 + 一層同色系淡色（完成／啟用狀態用）
export const glassTint = (name) =>
  `linear-gradient(var(--${name}-subtle),var(--${name}-subtle)), ${GLASS_BG}`;
// 側邊面板（通知設定、AI 助手、Jira 等）的左側陰影 + 內緣高光
export const PANEL_SHADOW = `-4px 0 24px ${tint(0.12)}, inset 1px 0 0 rgba(255,255,255,0.5)`;
// 彈窗（新增／編輯任務等）的大陰影 + 玻璃邊緣
export const MODAL_SHADOW = `0 20px 60px ${tint(0.2)}, ${RIM}`;

// ─── CSS ──────────────────────────────────────────────────────
// 每個區塊只放「原始 token」；組合用的 token（--lg-bg 等）只在 :root 定義一次，
// 因為所有主題區塊都作用在同一個 <html> 上，var() 會用最後生效的原始值解析。
const LIGHT = `
    --lg-sheen: rgba(255,255,255,0.34);
    --lg-sheen-hover: rgba(255,255,255,0.42);
    --lg-rim-hi: rgba(255,255,255,0.5);
    --lg-rim-hi-hover: rgba(255,255,255,0.65);
    --lg-rim-side: rgba(255,255,255,0.28);
    --lg-rim-lo: rgba(0,0,0,0.04);
    --lg-rim-lo-hover: rgba(0,0,0,0.06);
    --lg-edge: color-mix(in srgb, var(--accent) 62%, transparent);
    --lg-shadow-tint: rgb(28,38,84);
    --lg-purple-border: #C4B5FD;
    --lg-dim: rgba(0,0,0,0.04);`;

const DARK = `
    --lg-sheen: rgba(255,255,255,0.09);
    --lg-sheen-hover: rgba(255,255,255,0.12);
    --lg-rim-hi: rgba(255,255,255,0.5);
    --lg-rim-hi-hover: rgba(255,255,255,0.65);
    --lg-rim-side: rgba(255,255,255,0.22);
    --lg-rim-lo: rgba(0,0,0,0.04);
    --lg-rim-lo-hover: rgba(0,0,0,0.06);
    --lg-edge: rgba(255,255,255,0.5);
    --lg-shadow-tint: rgb(2,4,18);
    --lg-purple-border: color-mix(in srgb, #A78BFA 55%, transparent);
    --lg-dim: rgba(255,255,255,0.03);`;

const JIM = `
    --lg-sheen: rgba(0,255,65,0.07);
    --lg-sheen-hover: rgba(0,255,65,0.10);
    --lg-rim-hi: rgba(255,255,255,0.5);
    --lg-rim-hi-hover: rgba(255,255,255,0.65);
    --lg-rim-side: rgba(255,255,255,0.22);
    --lg-rim-lo: rgba(0,0,0,0.04);
    --lg-rim-lo-hover: rgba(0,0,0,0.06);
    --lg-edge: color-mix(in srgb, var(--accent) 70%, transparent);
    --lg-shadow-tint: rgb(0,32,8);
    --lg-purple-border: color-mix(in srgb, var(--purple) 70%, transparent);
    --lg-dim: rgba(0,255,65,0.03);`;

export const GLASS_FX_CSS = `
  :root {${LIGHT}
    /* 組合 token：只在這裡定義一次 */
    --lg-bg: linear-gradient(135deg, var(--lg-sheen) 0%, transparent 38%), var(--glass-surface);
    --lg-bg-hover: linear-gradient(135deg, var(--lg-sheen-hover) 0%, transparent 38%), var(--glass-surface-hover);
    --lg-rim: inset 0 1px 0 var(--lg-rim-hi), inset 1px 0 0 var(--lg-rim-side), inset 0 -1px 0 var(--lg-rim-lo);
    --lg-rim-hover: inset 0 1px 0 var(--lg-rim-hi-hover), inset 1px 0 0 var(--lg-rim-side), inset 0 -1px 0 var(--lg-rim-lo-hover);
  }
  @media (prefers-color-scheme: dark) {
    :root {${DARK}
    }
  }
  html[data-theme="light"] {${LIGHT}
  }
  html[data-theme="dark"] {${DARK}
  }
  html.jim-mode-effect {${JIM}
  }

  /* 邊緣光：::after 只畫 1px 邊框那一圈（mask 挖空內部），亮點跟著 --mx/--my（由下方的
     pointermove 寫入，單位 px，相對於元素左上角）。沒有 hover 能力的裝置（觸控）整個關掉。 */
  .lg-live { position: relative; }
  .lg-live::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px;
    pointer-events: none; opacity: 0; transition: opacity 0.25s;
    background: radial-gradient(180px circle at var(--mx, 50%) var(--my, 0%), var(--lg-edge), transparent 70%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  }
  .lg-live:hover::after { opacity: 1; }
  @media (hover: none) { .lg-live::after { display: none; } }
  @media (prefers-reduced-motion: reduce) { .lg-live::after { transition: none; } }

  /* 主色 CTA 按鈕：維持原本的實色平面（background:var(--accent)、白字），只多一圈半透明白邊框跟游標邊緣光
     （.lg-live）。jsx 只傳 className={CTA_CLASS}，版面（height/padding/borderRadius/fontSize）用 inline；
     inline 寫了 background／color／border 會蓋掉這裡，所以不要寫。 */
  .lg-cta {
    background: var(--accent); color: #fff; border: 1px solid rgba(255,255,255,0.28);
    cursor: pointer; font-family: inherit;
  }
  /* 停用態各按鈕自己有灰底樣式，這裡只負責關掉邊緣光（不再疊透明度，避免雙重變淡） */
  .lg-cta:disabled::after { display: none; }
  .lg-cta.lg-live::after {
    background: radial-gradient(120px circle at var(--mx, 50%) var(--my, 0%), rgba(255,255,255,0.85), transparent 70%);
  }

  /* 文字細節：數字等寬（百分比、日期、計數跳動時不會左右抖動；字型沒有 tnum 時等於沒作用），
     標題換行平衡。 */
  body { font-variant-numeric: tabular-nums; }
  h1, h2, h3 { text-wrap: balance; }
`;

// ─── 模組載入時自動注入 <head>（同 OrganicLoader 的做法，id 固定所以重複 import／HMR 不會重複） ───
if (typeof document !== "undefined") {
  const STYLE_ID = "glass-fx-css";
  const el =
    document.getElementById(STYLE_ID) ||
    document.head.appendChild(Object.assign(document.createElement("style"), { id: STYLE_ID }));
  el.textContent = GLASS_FX_CSS;
}

// ─── 游標位置追蹤：全站只掛一個 listener（delegated + rAF 節流） ───
if (typeof window !== "undefined" && !window.__glassFxPointer) {
  window.__glassFxPointer = true;
  let raf = 0;
  let last = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const t = last && last.target;
        const el = t && t.closest ? t.closest(".lg-live") : null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${last.clientX - r.left}px`);
        el.style.setProperty("--my", `${last.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}
