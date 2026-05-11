// supabase/functions/send-push/index.ts
// 部署指令：supabase functions deploy send-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO = Deno.env.get("VAPID_MAILTO")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── VAPID JWT helpers ──────────────────────────────────────────────────────
function base64UrlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function base64UrlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_MAILTO,
  };
  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const sigInput = `${headerB64}.${payloadB64}`;

  const keyBytes = base64UrlDecode(VAPID_PRIVATE_KEY);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(sigInput)
  );
  return `${sigInput}.${base64UrlEncode(sig)}`;
}

async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string }
) {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      TTL: "86400",
    },
    body: JSON.stringify(payload),
  });
  return res.status;
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 取得所有訂閱
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error || !subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // 取得所有專案與任務
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, launch_date, batch1_deadline, batch2_deadline");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, project_id, name, type, deadline, period_start, period_end");

  let totalSent = 0;

  for (const sub of subs) {
    const notifyDays: number = sub.notify_days_before ?? 0;
    const subscribedProjects: string[] = sub.subscribed_projects ?? [];
    const messages: { title: string; body: string; tag: string }[] = [];

    for (const proj of projects ?? []) {
      if (!subscribedProjects.includes(proj.id)) continue;

      const checkDate = (dateStr: string | null, label: string) => {
        if (!dateStr) return;
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
        if (diffDays === notifyDays) {
          const dayLabel = notifyDays === 0 ? "今天" : `${notifyDays} 天後`;
          messages.push({
            title: `📅 ${proj.name}`,
            body: `${label}${notifyDays === 0 ? "就是今天" : `在 ${dayLabel} 到期`}`,
            tag: `${proj.id}-${label}`,
          });
        }
      };

      checkDate(proj.launch_date, "上線日");
      checkDate(proj.batch1_deadline, "第一批資料期限");
      checkDate(proj.batch2_deadline, "第二批資料期限");

      // 任務
      for (const task of tasks ?? []) {
        if (task.project_id !== proj.id) continue;
        if (task.type === "deadline") {
          checkDate(task.deadline, `任務「${task.name}」`);
        } else if (task.type === "period") {
          checkDate(task.period_start, `任務「${task.name}」開始日`);
          checkDate(task.period_end, `任務「${task.name}」結束日`);
        }
      }
    }

    for (const msg of messages) {
      const status = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        msg
      );
      if (status < 300) totalSent++;
    }
  }

  return new Response(JSON.stringify({ sent: totalSent }), { status: 200 });
});
