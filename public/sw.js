// sw.js — 放在 public/sw.js

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // 若解析失敗，顯示原始文字作為通知內容（方便除錯）
    console.error("[sw] push parse error:", e, event.data.text());
    data = { title: "新通知", body: event.data.text(), tag: "hotel-dashboard" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "新通知", {
      body:  data.body  || "",
      icon:  "/favicon.svg",
      badge: "/favicon.svg",
      tag:   data.tag   || "hotel-dashboard",
      data:  { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || "/");
      }
    })
  );
});
