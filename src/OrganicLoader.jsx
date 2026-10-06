// OrganicLoader — 全站 loading 動畫的「唯一替換點」。
//
// 用法：<OrganicLoader size={28} color="var(--accent)" style={{ margin:"0 auto 12px" }} />
//   size     px，預設 28，代表「高度」。慣例：按鈕內 13~14、區塊 24~28、全頁 56、AI 打字泡泡 20（cradle）
//            寬度由款式的 aspect 決定：orbit / ripple 是正方形，cradle 約 3.7 倍寬
//   color    任何 CSS 顏色，預設 var(--accent)；元件以 currentColor 上色，所以跟主題色變數自動連動
//   variant  "orbit" | "ripple" | "cradle"，預設見 DEFAULT_VARIANT
//            cradle（牛頓擺）目前只用在 AI 打字泡泡，其餘維持預設款
//   label    有值才會加 role="status"；旁邊已有文字說明時不要傳（避免螢幕閱讀器重複朗讀）
//   style    合併到外層 span，可傳 margin 等版面屬性（外層預設 display:block）
//
// 想改外觀時只動這個檔案：
//   換款式   → 改 DEFAULT_VARIANT，或在呼叫端傳 variant
//   調速度   → 改 SPEED（全域倍率，>1 變快）
//   調形狀   → 改下方 ORBIT / RIPPLE / CRADLE 設定物件（橢圓尺寸、軌道距離、週期）
//   新增款式 → 寫一個 function Xxx() 並加進 VARIANTS（同時給 aspect＝寬/高）
//
// keyframes 與 reduced-motion 規則在 LOADER_CSS，模組載入時自動注入 <head>
// （<style> 的 id 固定，重複載入或 HMR 只會覆蓋同一個），所以不需要動 GLOBAL_CSS，
// 也不新增任何 CSS 變數（不必同步四個主題區塊與 jim mode 區塊）。
// 會動的元素都帶 data-ol 屬性，reduced-motion 時由 LOADER_CSS 統一改成透明度呼吸。

import { useId } from "react";

// ─── 調整區 ───────────────────────────────────────────────────

const DEFAULT_VARIANT = "orbit";
const SPEED = 1; // 全域速度倍率

// Gooey Orbit：中心兩個橢圓反向旋轉 + 三顆橢圓衛星，經 SVG filter 融合。
// 座標系是 viewBox 0 0 100 100，中心 (50,50)；cy 離 50 越遠，衛星軌道越大。
// blur 越大越黏；alpha 的第二個數字（-7）越負越不容易黏連。
const ORBIT = {
  blur: 4,
  alpha: "18 -7",
  breatheSec: 3.4,
  // rot＝起始角度（度）。reduced-motion 不播動畫時，靜止畫面靠它散成團塊、不會排成直線（像驚嘆號）；
  // 有動畫時它只是起點，旋轉每圈依舊無縫。
  core: [
    { cx: 50, cy: 50, rx: 14, ry: 12, sec: 5.2, reverse: false, rot: 0 },
    { cx: 52.5, cy: 49, rx: 11, ry: 9.5, sec: 3.6, reverse: true, rot: 40 },
  ],
  satellites: [
    { cy: 24, rx: 11, ry: 7.5, sec: 2.2, reverse: false, rot: 20 },
    { cy: 77, rx: 9, ry: 6, sec: 3.4, reverse: true, rot: 100 },
    { cy: 33, rx: 7.5, ry: 5, sec: 1.5, reverse: false, rot: 150 },
  ],
};

// Ripple：三圈橢圓漣漪（各自傾斜、線寬不等）+ 中心會變形的橢圓。
// rot＝橢圓傾斜角；scale＝reduced-motion 時的靜態大小；phase＝0~1，錯開三圈的相位。
const RIPPLE = {
  sec: 2.6,
  rings: [
    { rot: -28, scale: 0.5, phase: 0 },
    { rot: 18, scale: 0.75, phase: 1 / 3 },
    { rot: 64, scale: 1, phase: 2 / 3 },
  ],
  centerSpinSec: 6,
  centerMorphSec: 3.6,
  centerBreatheSec: 2.4,
};

// Cradle（牛頓擺）：一排圓球，只有最左、最右兩顆輪流擺出去再落回，經 SVG filter 融合（球碰到時會黏一下）。
// 座標單位同樣是 viewBox 的 user unit；整個圖形隨 size 等比縮放，blur 也跟著縮。
// swingX / swingY＝外側球擺出的位移（y 為負＝往上抬）；sec＝一個完整來回（左擺＋右擺）的週期。
const CRADLE = {
  balls: 4,
  r: 14,
  pitch: 30, // 相鄰球心距；30 = 球徑 28 + 縫 2
  swingX: 26,
  swingY: 10,
  sec: 1.2,
  blur: 7,
  alpha: "22 -10",
};
const CRADLE_PAD = 4; // viewBox 上下留白
const CRADLE_GEOM = (() => {
  const w = 2 * CRADLE.swingX + (CRADLE.balls - 1) * CRADLE.pitch + 2 * CRADLE.r;
  const cy = CRADLE.swingY + CRADLE.r + CRADLE_PAD;
  const h = cy + CRADLE.r + CRADLE_PAD;
  return { w, h, cy };
})();

// ─── keyframes（模組載入時注入 <head>）─────────────────────────

const LOADER_CSS = `
@keyframes olSpin { to { transform: rotate(360deg); } }
@keyframes olBreatheOrbit {
  0%,100% { transform: scale(1.05,.95); }
  50% { transform: scale(.94,1.06); }
}
@keyframes olBreatheRipple {
  0%,100% { transform: scale(1.08,.88); }
  50% { transform: scale(.9,1.1); }
}
@keyframes olMorph {
  0%,100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  25% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
  50% { border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; }
  75% { border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%; }
}
@keyframes olRipple {
  0% { transform: scale(.18) rotate(0deg); opacity: 0; border-radius: 55% 45% 52% 48% / 50% 58% 42% 50%; border-width: .09em .05em .1em .06em; }
  15% { opacity: .95; }
  50% { border-radius: 46% 54% 60% 40% / 58% 42% 58% 42%; border-width: .06em .08em .05em .09em; }
  100% { transform: scale(1) rotate(40deg); opacity: 0; border-radius: 60% 40% 46% 54% / 44% 60% 40% 56%; border-width: .03em .05em .03em .04em; }
}
@keyframes olCradleL {
  0%,50%,100% { transform: translate(0,0); }
  25% { transform: translate(${-CRADLE.swingX}px,${-CRADLE.swingY}px); }
}
@keyframes olCradleR {
  0%,50%,100% { transform: translate(0,0); }
  75% { transform: translate(${CRADLE.swingX}px,${-CRADLE.swingY}px); }
}
@keyframes olPulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  [data-ol] { animation: olPulse 2.4s ease-in-out infinite !important; }
}
`;

if (typeof document !== "undefined") {
  const STYLE_ID = "organic-loader-css";
  const el =
    document.getElementById(STYLE_ID) ||
    document.head.appendChild(Object.assign(document.createElement("style"), { id: STYLE_ID }));
  el.textContent = LOADER_CSS;
}

// ─── 款式 ─────────────────────────────────────────────────────

const dur = (s) => `${(s / SPEED).toFixed(2)}s`;

// 旋轉的 <g>：只放動畫（olSpin 固定 0→360°，所以每圈無縫接續）。
// 靜態起始角度 rot 不能寫在這個 <g> 的 transform 上——keyframes 只有 to{} 時，起點會取該 transform，
// 變成 rot→360° 每圈跳回 rot（一跳一跳）。因此 rot 放在外面另包一層 <g transform>，見 Spin。
const spinStyle = (sec, reverse) => ({
  transformOrigin: "50px 50px",
  transformBox: "view-box",
  animation: `olSpin ${dur(sec)} linear infinite${reverse ? " reverse" : ""}`,
});

function Spin({ sec, reverse, rot = 0, children }) {
  return (
    <g transform={`rotate(${rot} 50 50)`}>
      <g data-ol style={spinStyle(sec, reverse)}>
        {children}
      </g>
    </g>
  );
}

function Orbit({ gid }) {
  // 每個實例各自一個 filter id（useId），避免多個 loader 同時存在時互相參照
  const fid = `ol-goo-${gid}`;
  return (
    <svg viewBox="0 0 100 100" style={{ width: "1em", height: "1em", display: "block", overflow: "visible" }}>
      <defs>
        <filter id={fid} filterUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <feGaussianBlur in="SourceGraphic" stdDeviation={ORBIT.blur} result="blur" />
          <feColorMatrix in="blur" mode="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${ORBIT.alpha}`} />
        </filter>
      </defs>
      <g filter={`url(#${fid})`} fill="currentColor">
        <g
          data-ol
          style={{
            transformOrigin: "50px 50px",
            transformBox: "view-box",
            animation: `olBreatheOrbit ${dur(ORBIT.breatheSec)} ease-in-out infinite`,
          }}
        >
          {ORBIT.core.map((e, i) => (
            <Spin key={i} sec={e.sec} reverse={e.reverse} rot={e.rot}>
              <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />
            </Spin>
          ))}
        </g>
        {ORBIT.satellites.map((s, i) => (
          <Spin key={i} sec={s.sec} reverse={s.reverse} rot={s.rot}>
            <ellipse cx={50} cy={s.cy} rx={s.rx} ry={s.ry} />
          </Spin>
        ))}
      </g>
    </svg>
  );
}

function Ripple() {
  return (
    <div style={{ position: "relative", width: "1em", height: "1em" }}>
      {RIPPLE.rings.map((r, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: 0, top: 0, width: "1em", height: "1em", transform: `rotate(${r.rot}deg)` }}
        >
          <div
            data-ol
            style={{
              position: "absolute",
              left: 0,
              top: ".12em",
              width: "1em",
              height: ".76em",
              boxSizing: "border-box",
              borderStyle: "solid",
              borderColor: "currentColor",
              borderWidth: ".08em .045em .09em .05em",
              borderRadius: "55% 45% 52% 48% / 50% 58% 42% 50%",
              transform: `scale(${r.scale})`,
              opacity: 0.9,
              animation: `olRipple ${dur(RIPPLE.sec)} ease-out ${((-r.phase * RIPPLE.sec) / SPEED).toFixed(2)}s infinite`,
            }}
          />
        </div>
      ))}
      <div style={{ position: "absolute", left: "50%", top: "50%", width: ".36em", height: ".36em", margin: "-.18em 0 0 -.18em" }}>
        <div
          data-ol
          style={{ width: "100%", height: "100%", animation: `olSpin ${dur(RIPPLE.centerSpinSec)} linear infinite` }}
        >
          <div
            data-ol
            style={{
              width: ".36em",
              height: ".24em",
              marginTop: ".06em",
              background: "currentColor",
              borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
              animation: `olMorph ${dur(RIPPLE.centerMorphSec)} ease-in-out infinite, olBreatheRipple ${dur(RIPPLE.centerBreatheSec)} ease-in-out infinite`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Cradle({ gid }) {
  const fid = `ol-goo-${gid}`;
  const { w, h, cy } = CRADLE_GEOM;
  const last = CRADLE.balls - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
      <defs>
        <filter id={fid} filterUnits="userSpaceOnUse" x="-10" y="-10" width={w + 20} height={h + 20}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={CRADLE.blur} result="blur" />
          <feColorMatrix in="blur" mode="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${CRADLE.alpha}`} result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
      <g filter={`url(#${fid})`} fill="currentColor">
        {Array.from({ length: CRADLE.balls }, (_, i) => {
          const anim =
            i === 0
              ? `olCradleL ${dur(CRADLE.sec)} ease-in-out infinite`
              : i === last
              ? `olCradleR ${dur(CRADLE.sec)} ease-in-out infinite`
              : undefined;
          // 中間的球沒有位移動畫；reduced-motion 時四顆一起改成透明度呼吸
          return (
            <circle
              key={i}
              data-ol
              cx={CRADLE.swingX + CRADLE.r + i * CRADLE.pitch}
              cy={cy}
              r={CRADLE.r}
              style={anim ? { animation: anim } : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}

// aspect＝寬/高。外層 span 的寬度 = size × aspect
const VARIANTS = {
  orbit: { View: Orbit, aspect: 1 },
  ripple: { View: Ripple, aspect: 1 },
  cradle: { View: Cradle, aspect: CRADLE_GEOM.w / CRADLE_GEOM.h },
};

// ─── 元件 ─────────────────────────────────────────────────────

export default function OrganicLoader({ size = 28, color = "var(--accent)", variant = DEFAULT_VARIANT, label, style }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { View, aspect } = VARIANTS[variant] || VARIANTS[DEFAULT_VARIANT];
  const a11y = label ? { role: "status", "aria-label": label } : { "aria-hidden": true };
  return (
    <span
      {...a11y}
      style={{
        display: "block",
        position: "relative",
        width: size * aspect,
        height: size,
        fontSize: size,
        lineHeight: 1,
        flexShrink: 0,
        color,
        ...style,
      }}
    >
      <View gid={gid} />
    </span>
  );
}
