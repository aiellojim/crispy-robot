// supabase/functions/send-push/index.ts
// 部署指令：supabase functions deploy send-push
// 實作 RFC 8291（ECDH+HKDF）+ RFC 8188（aes128gcm）payload 加密
// 同時支援 Apple Push Service（Safari）和 Chrome FCM

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY     = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY    = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_MAILTO         = Deno.env.get("VAPID_MAILTO")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Base64url helpers ──────────────────────────────────────────────────────
function b64uDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - str.length % 4) % 4);
  return Uint8Array.from(atob((str + pad).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

function b64uEncode(buf: Uint8Array | ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out   = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ── HKDF（手動實作以分離 Extract / Expand）────────────────────────────────
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

// HKDF-Extract: PRK = HMAC-SHA-256(salt, IKM)
function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return hmacSha256(salt, ikm);
}

// HKDF-Expand: OKM = T(1) || T(2) || … where T(i) = HMAC(PRK, T(i-1) || info || i)
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const k   = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let t     = new Uint8Array(0);
  const okm = new Uint8Array(Math.ceil(length / 32) * 32);
  let off   = 0;
  for (let i = 1; off < length; i++) {
    t = new Uint8Array(await crypto.subtle.sign("HMAC", k, concat(t, info, new Uint8Array([i]))));
    okm.set(t, off);
    off += 32;
  }
  return okm.slice(0, length);
}

// ── RFC 8291 + RFC 8188 Payload Encryption ────────────────────────────────
async function encryptPayload(
  p256dh: string,
  auth: string,
  payload: string
): Promise<Uint8Array> {
  const enc        = new TextEncoder();
  const uaPublic   = b64uDecode(p256dh);
  const authSecret = b64uDecode(auth);
  const plaintext  = enc.encode(payload);

  // 1. 產生 server 端 ECDH key pair
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));

  // 2. ECDH：計算 shared secret
  const uaKey = await crypto.subtle.importKey(
    "raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, serverKP.privateKey, 256)
  );

  // 3. RFC 8291 Key Derivation
  //    PRK_key = HKDF-Extract(salt=auth_secret, IKM=ecdhSecret)
  const prkKey = await hkdfExtract(authSecret, ecdhSecret);

  //    auth_info = "WebPush: info\0" || ua_public || as_public
  const authInfo = concat(enc.encode("WebPush: info\0"), uaPublic, serverPublic);

  //    IKM = HKDF-Expand(PRK_key, auth_info, 32)
  const ikm = await hkdfExpand(prkKey, authInfo, 32);

  // 4. RFC 8188 Content Encoding
  const salt = crypto.getRandomValues(new Uint8Array(16));

  //    PRK = HKDF-Extract(salt, IKM)
  const prk = await hkdfExtract(salt, ikm);

  //    CEK = HKDF-Expand(PRK, cek_info, 16)
  const cek = await hkdfExpand(
    prk,
    concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])),
    16
  );

  //    NONCE = HKDF-Expand(PRK, nonce_info, 12)
  const nonce = await hkdfExpand(
    prk,
    concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])),
    12
  );

  // 5. AES-128-GCM 加密（payload + 0x02 padding delimiter）
  const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, tagLength: 128 },
      cekKey,
      concat(plaintext, new Uint8Array([0x02])) // 0x02 = last record
    )
  );

  // 6. RFC 8188 Header: salt(16) + rs(4 BE=4096) + idlen(1) + keyid(65)
  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPublic.length; // 65
  header.set(serverPublic, 21);

  return concat(header, ciphertext);
}

// ── VAPID JWT ──────────────────────────────────────────────────────────────
async function buildVapidJwt(audience: string): Promise<string> {
  const enc = new TextEncoder();
  const pub = b64uDecode(VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: VAPID_PRIVATE_KEY,
      x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const h = b64uEncode(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const p = b64uEncode(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: VAPID_MAILTO,
  })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64uEncode(sig)}`;
}

// ── Web Push 發送（加密版）────────────────────────────────────────────────
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; tag?: string }
): Promise<number> {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await buildVapidJwt(audience);
  const body     = await encryptPayload(sub.p256dh, sub.auth, JSON.stringify(payload));

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type":     "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization":    `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      "TTL":              "86400",
    },
    body,
  });

  const text = await res.text();
  console.log(`Push ${res.status} → ${sub.endpoint.slice(0, 60)}...`);
  if (text) console.log(`Response: ${text}`);
  return res.status;
}

// ── Main ───────────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
  if (error || !subs?.length) return new Response(JSON.stringify({ sent: 0 }), { status: 200 });

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, launch_date, batch1_deadline, batch2_deadline");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, project_id, name, type, deadline, period_start, period_end");

  let totalSent = 0;

  for (const sub of subs) {
    const notifyDays: number   = sub.notify_days_before ?? 0;
    const subscribed: string[] = sub.subscribed_projects ?? [];
    const messages: { title: string; body: string; tag: string }[] = [];

    const checkDate = (projName: string, projId: string, dateStr: string | null, label: string) => {
      if (!dateStr || !subscribed.includes(projId)) return;
      const diffDays = Math.round((new Date(dateStr + "T00:00:00Z").getTime() - today.getTime()) / 86400000);
      if (diffDays !== notifyDays) return;
      messages.push({
        title: `📅 ${projName}`,
        body:  `${label}${notifyDays === 0 ? "就是今天" : `在 ${notifyDays} 天後到期`}`,
        tag:   `${projId}-${label}`,
      });
    };

    for (const proj of projects ?? []) {
      checkDate(proj.name, proj.id, proj.launch_date,     "上線日");
      checkDate(proj.name, proj.id, proj.batch1_deadline, "第一批資料期限");
      checkDate(proj.name, proj.id, proj.batch2_deadline, "第二批資料期限");
    }

    for (const task of tasks ?? []) {
      const proj = (projects ?? []).find(p => p.id === task.project_id);
      if (!proj) continue;
      if (task.type === "deadline") {
        checkDate(proj.name, proj.id, task.deadline, `任務「${task.name}」`);
      } else {
        checkDate(proj.name, proj.id, task.period_start, `任務「${task.name}」開始日`);
        checkDate(proj.name, proj.id, task.period_end,   `任務「${task.name}」結束日`);
      }
    }

    if (messages.length === 0) continue;

    // 取 endpoints 陣列，相容舊格式（單一 endpoint 欄位）
    const endpoints: { endpoint: string; p256dh: string; auth: string }[] =
      Array.isArray(sub.endpoints) && sub.endpoints.length > 0
        ? sub.endpoints
        : sub.endpoint
          ? [{ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }]
          : [];

    if (endpoints.length === 0) continue;

    const expired: string[] = [];

    for (const ep of endpoints) {
      for (const msg of messages) {
        const status = await sendPush(ep, msg);
        if (status < 300) totalSent++;
        if (status === 410 || status === 404) {
          if (!expired.includes(ep.endpoint)) expired.push(ep.endpoint);
        }
      }
    }

    // 清理失效的 endpoints
    if (expired.length > 0) {
      const remaining = endpoints.filter(e => !expired.includes(e.endpoint));
      if (remaining.length === 0) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        await supabase.from("push_subscriptions").update({ endpoints: remaining }).eq("id", sub.id);
      }
    }
  }

  return new Response(JSON.stringify({ sent: totalSent }), { status: 200 });
});
