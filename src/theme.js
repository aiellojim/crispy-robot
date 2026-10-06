// 主題色彩 token（淺色／深色）——全站配色的「唯一來源」。
//
// 為什麼獨立成檔：同一組 token 要在兩個位置各定義一次——
//   淺色：`:root`（預設）＋ `html[data-theme="light"]`（手動切到淺色時，要壓過作業系統的深色 media query）
//   深色：`@media (prefers-color-scheme: dark) :root`（「系統」模式）＋ `html[data-theme="dark"]`（手動深色）
// 以前是手抄四份、靠人記得同步（`--glass-surface` 漏放過一次，見 docs/architecture.md）；現在只改這裡。
// jim 彩蛋的 `html.jim-mode-effect` 是第三套（只出現一次，仍在 hotel-project-dashboard.jsx 的 GLOBAL_CSS）。
//
// 新增 token 的規則：
//   - 一般色彩 token → 加在下面 LIGHT_TOKENS／DARK_TOKENS（兩邊都要有）＋ jim 區塊
//   - 玻璃質感加成用的 `--lg-*` token → 在 src/glassFx.js（它有自己的五個區塊）
// 這個檔案只有字串常數，沒有任何執行期副作用，之後換前端框架可以原封不動搬走。

export const LIGHT_TOKENS = `
    --bg: #F5F5F5;
    --surface: #FFFFFF;
    --surface-raised: #FAFAFA;
    --border: #E5E5E5;
    --border-mid: #D4D4D4;
    --text: #111111;
    --text-mid: #6B6B6B;
    --text-subtle: #767676;
    --accent: #E8621A;
    --accent-light: #FFF4EE;
    --accent-border: rgba(232,98,26,0.25);
    --accent-subtle: rgba(232,98,26,0.07);
    --green: #16A34A;
    --green-light: #F0FDF4;
    --green-subtle: rgba(22,163,74,0.08);
    --amber: #B45309;
    --amber-light: #FFFBEB;
    --amber-subtle: rgba(180,83,9,0.08);
    --red: #DC2626;
    --red-light: #FEF2F2;
    --red-subtle: rgba(220,38,38,0.07);
    --purple: #7C3AED;
    --purple-light: #F5F3FF;
    --purple-subtle: rgba(124,58,237,0.07);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
    --shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --cal-launch-bg: #DBEAFE; --cal-launch-text: #1E40AF; --cal-launch-border: #93C5FD;
    --cal-batch1-bg: #DCFCE7; --cal-batch1-text: #166534; --cal-batch1-border: #86EFAC;
    --cal-batch2-bg: #F3E8FF; --cal-batch2-text: #6B21A8; --cal-batch2-border: #D8B4FE;
    --cal-task-bg:   #FEF3C7; --cal-task-text:   #92400E; --cal-task-border:   #FCD34D;
    --cal-period-bg: #FFE4E6; --cal-period-text:  #9F1239; --cal-period-border: #FCA5A5;
    --cal-jira-bg: #F5F5F4; --cal-jira-text: #57534E; --cal-jira-border: #D6D3D1;
    --prod-ava:#1e6fb5; --prod-avt:#0891b2; --prod-aca:#0e7a5a;
    --prod-tmsp:#7c3aed; --prod-gw:#b45309; --prod-kms:#be185d; --prod-sitechat:#4338ca;
    --glass-surface: rgba(255,255,255,0.62);
    --glass-surface-hover: rgba(255,255,255,0.78);
    --canvas-glow-1: rgba(30,111,181,0.40);
    --canvas-glow-2: rgba(232,98,26,0.34);
    --canvas-glow-3: rgba(14,122,90,0.32);
  `;

export const DARK_TOKENS = `
    --bg: #17171E;
    --surface: #21212B;
    --surface-raised: #2A2A36;
    --border: #32323F;
    --border-mid: #42424F;
    --text: #EDEDED;
    --text-mid: #B8B8C2;
    --text-subtle: #A4A4B0;
    --accent: #F4873D;
    --accent-light: #2A1A0A;
    --accent-border: rgba(244,135,61,0.3);
    --accent-subtle: rgba(244,135,61,0.08);
    --green: #22C55E;
    --green-light: #052E16;
    --green-subtle: rgba(34,197,94,0.1);
    --amber: #F59E0B;
    --amber-light: #1C1200;
    --amber-subtle: rgba(245,158,11,0.1);
    --red: #EF4444;
    --red-light: #2D0F0F;
    --red-subtle: rgba(239,68,68,0.1);
    --purple: #A78BFA;
    --purple-light: #1E0A3C;
    --purple-subtle: rgba(167,139,250,0.1);
    --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
    --shadow: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4);
    --cal-launch-bg: #1A2744; --cal-launch-text: #93C5FD; --cal-launch-border: #1E3A6E;
    --cal-batch1-bg: #0A2E1A; --cal-batch1-text: #86EFAC; --cal-batch1-border: #14532D;
    --cal-batch2-bg: #1E0A3C; --cal-batch2-text: #D8B4FE; --cal-batch2-border: #4C1D95;
    --cal-task-bg:   #2A1C00; --cal-task-text:   #FCD34D; --cal-task-border:   #78350F;
    --cal-period-bg: #2D0A14; --cal-period-text:  #FCA5A5; --cal-period-border: #881337;
    --cal-jira-bg: #292524; --cal-jira-text: #D6D3D1; --cal-jira-border: #78716C;
    --prod-ava:#4d90d4; --prod-avt:#22c4de; --prod-aca:#22a474;
    --prod-tmsp:#a78bfa; --prod-gw:#f59e0b; --prod-kms:#e879a0; --prod-sitechat:#818cf8;
    --glass-surface: rgba(33,33,43,0.55);
    --glass-surface-hover: rgba(42,42,54,0.72);
    --canvas-glow-1: rgba(77,144,212,0.40);
    --canvas-glow-2: rgba(244,135,61,0.36);
    --canvas-glow-3: rgba(34,164,116,0.32);
    `;
