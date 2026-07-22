// supabase/functions/customer-access-manage/index.ts
// 部署指令：supabase functions deploy customer-access-manage
//
// 功能：PM 新增 / 移除客戶存取權限
// 安全：只有登入的內部使用者（authenticated）可以呼叫

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")   return json({ error: "method not allowed" }, 405);

  // ── 1. 驗證內部 PM session ──────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: userErr } = await sb.auth.getUser(authHeader.slice(7));
  if (userErr || !user) return json({ error: "invalid session" }, 401);

  // ── 2. 解析 body ────────────────────────────────────────────
  let action: string, hotel_id: string, email: string;
  try {
    ({ action, hotel_id, email } = await req.json());
  } catch { return json({ error: "invalid body" }, 400); }

  if (!action || !hotel_id || !email)
    return json({ error: "action, hotel_id and email are required" }, 400);

  const normalizedEmail = email.trim().toLowerCase();

  // ── ADD ─────────────────────────────────────────────────────
  if (action === "add") {
    // 建立 Auth 帳號（若已存在不會重複建立）
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: true, // 直接確認，客戶透過 Magic Link 登入
    });

    // 忽略「user already exists」錯誤，其他錯誤才回傳
    if (createErr && !createErr.message.includes("already been registered")) {
      console.error("createUser error:", createErr);
      return json({ error: "failed to create user" }, 500);
    }

    // 寫入 customer_access（upsert 避免重複）
    const { error: insertErr } = await sb
      .from("customer_access")
      .upsert(
        { hotel_id, email: normalizedEmail, created_by: user.id },
        { onConflict: "hotel_id,email" }
      );

    if (insertErr) {
      console.error("customer_access insert error:", insertErr);
      return json({ error: "failed to grant access" }, 500);
    }

    return json({ ok: true });
  }

  // ── REMOVE ──────────────────────────────────────────────────
  if (action === "remove") {
    const { error: deleteErr } = await sb
      .from("customer_access")
      .delete()
      .eq("hotel_id", hotel_id)
      .eq("email", normalizedEmail);

    if (deleteErr) {
      console.error("customer_access delete error:", deleteErr);
      return json({ error: "failed to remove access" }, 500);
    }

    return json({ ok: true });
  }

  return json({ error: "unknown action" }, 400);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
