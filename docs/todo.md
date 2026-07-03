# 待辦與方案評估

> 模型可自行更新本檔（完成就劃掉、新增待辦補進來），commit message 註明。
> 最後整理：2026-07-03。

## 進行中

### 1. 任務狀態修改者追蹤
- **建議案（方案 C）**：Magic Link 登入 + 每人一組 Jira token，不需要 RLS。
- 方案 A / B 的內容與落選原因**未在舊文件留存（未確認）**——動工前先請 Jim 口述補齊，寫回本段再實作。

### 2. 顏色變數漸進重構：`C.blue` 系列 → `C.accent` 系列
- 策略：漸進替換，不一次全改。`C` 物件位置見 `docs/jsx-map.md`（約 39–58 行）。

### 3. Web Push 三項未解
1. Chrome：舊版 FCM endpoint（`fcm.googleapis.com/fcm/send/...`）回 `BadWebPushRequest`——需 Firebase Server Key 或改用新版 FCM endpoint 格式。
2. Safari：需 RFC 8291（ECDH+HKDF）payload 加密，尚未實作。**高知識密度題**：卡兩次就停，建議升級模型專門處理（見 lessons 判準區 #5）。
3. `NotificationPanel` 重開頁面後不會從瀏覽器 endpoint 恢復訂閱狀態——需在 `useEffect` 加自動查詢邏輯。

### 4. `customer-access-manage` Edge Function（2026-07-03 觀察）
- 只存在於 Jim 主工作目錄、未進 git（worktree / fresh clone 裡沒有）；前端 `CustomerAccessPanel` 已在呼叫。
- 屬 Jim 進行中的工作：**勿動**；若任務被迫觸及，先停下來問 Jim。建議 Jim 儘早 commit。

## 長期方向

- ACA 產品 checklist 擴充。
- Jira 整合加深：目前 REST API 單向同步，雙向同步為未來階段。

## harness 未竟事項（2026-07-03 建立制度時留下）

1. Google Drive MCP 停用需 Jim 在 `/mcp` 介面手動操作（帳號層級 connector，CLI 停不掉）；在那之前依 CLAUDE.md 硬規則忽略即可。
2. `customer-portal/Dashboard.jsx` 程式碼不在本 repo，實際位置待 Jim 確認後補進 `docs/architecture.md`。
3. 任務狀態追蹤的方案 A/B 落選原因待 Jim 補述（見上方待辦 #1）。
4. 建議 Jim 把 `mcp__claude_ai_Supabase__get_logs` 加進 `.claude/settings.json` 的 allow——
   deploy commands 每次都要查 log，目前會跳權限提示（權限設定依維護協議須由 Jim 決定，模型不自行修改）。
