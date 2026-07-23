// supabase/functions/form-submit-notify/index.ts
// 部署指令：supabase functions deploy form-submit-notify
// 由飯店端表單（AVA 基礎設定表單 index.html、AVA UI settings 獨立站）在點擊「提交 / 更新」按鈕、
// 確認完成後即時呼叫。
// verify_jwt = false：表單是以連結（anon publishable key）供飯店端匿名編輯，沒有登入 session，
// 因此不要求 Supabase Auth JWT（與 customer-auth 相同模式）。
//
// 收件人名單：目前先寫死一組信箱做流程驗證，之後如需改為依專案 PIC／teamAiello 動態決定，
// 可在 FIXED_RECIPIENTS 這段擴充邏輯（例如改查 hotel_form_config 或 aiello_team_members）。
//
// 2026-07-24：新增可選 source 參數，讓多個表單/網站可共用這支 function 但信件標題/內文能區分
// 是哪個來源觸發的。source 缺省或不在 SOURCE_LABELS 內時，一律 fallback 到 basic_settings。
// 同時把原本寫死的「AVA 基本設定表單」字樣改成「基礎設定表單」——因為這張表單現在不只涵蓋 AVA
// 這個產品線了。

import nodemailer from "npm:nodemailer@6.9.9";

const SUPA_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPA_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM       = "Aiello <service@aiello.ai>";
const SMTP_HOST  = Deno.env.get("SMTP_HOST")!;   // smtp.office365.com
const SMTP_PORT  = Number(Deno.env.get("SMTP_PORT") ?? "587");
const SMTP_USER  = Deno.env.get("SMTP_USER")!;   // dashboard@aiello.ai
const SMTP_PASS  = Deno.env.get("SMTP_PASS")!;

// 先寫死的通知收件人（測試流程用）。
const FIXED_RECIPIENTS = ["avapjm@aiello.ai"];

// 呼叫端傳來的 source 值 -> 信件標題/內文要顯示的來源名稱。新增呼叫來源時只需要在這裡加一行。
const SOURCE_LABELS: Record<string, string> = {
  basic_settings: "基礎設定表單",
  ui_settings: "Showcase／廣告／QR Code 設定表單",
};
const DEFAULT_SOURCE = "basic_settings";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

async function supaFetch(path: string) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    headers: { Authorization: `Bearer ${SUPA_KEY}`, apikey: SUPA_KEY },
  });
  return res.json();
}

async function sendEmail(to: string, subject: string, html: string) {
  const transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: false, // STARTTLS（port 587）
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({ from: FROM, to, subject, html });
}

function emailHtml(hotelName: string, formUrl: string, sourceLabel: string) {
  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
</head>
<body style="margin:0;padding:0;background:transparent;font-family:'Noto Sans TC',sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E5E5E5;">
    <div style="background:#0f5c53;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:12px;opacity:0.75;letter-spacing:1px;text-transform:uppercase;">${sourceLabel}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:700;">✅ 飯店已提交／更新表單</h1>
    </div>
    <div style="padding:28px 32px;background:#ffffff;">
      <p style="margin:0 0 20px;font-size:15px;color:#111111;line-height:1.7;">
        <strong>${hotelName || "（未填寫飯店名稱）"}</strong> 已在 ${sourceLabel}點擊「提交／更新」，確認內容已填寫完畢，請協助確認並進行後續作業。
      </p>
      ${formUrl ? `<a href="${formUrl}" style="display:inline-block;padding:11px 22px;background:#0f5c53;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">前往表單 →</a>` : ""}
    </div>
    <div style="padding:14px 32px;border-top:1px solid #E5E5E5;font-size:11px;color:#A3A3A3;background:#ffffff;">
      此信件由飯店端點擊「提交／更新」按鈕自動觸發。
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId, formUrl, source } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "projectId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sourceLabel = SOURCE_LABELS[source] ?? SOURCE_LABELS[DEFAULT_SOURCE];

    const projects = await supaFetch(`/rest/v1/projects?id=eq.${projectId}&select=name`);
    const hotelName = Array.isArray(projects) && projects[0]?.name ? projects[0].name : "";

    const subject = `【${sourceLabel}】${hotelName || projectId} 已提交／更新`;
    const html = emailHtml(hotelName, formUrl || "", sourceLabel);

    const results = await Promise.allSettled(
      FIXED_RECIPIENTS.map((to) => sendEmail(to, subject, html))
    );
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason && r.reason.message) || String(r.reason));

    return new Response(
      JSON.stringify({ ok: errors.length === 0, sentTo: FIXED_RECIPIENTS, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
