/* Service Worker for Threadzy.ai Web Push Notifications */
/* Compatible with Chrome and Safari (macOS/iOS 16.4+) */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Threadzy.ai", body: event.data.text() };
  }

  const title = data.title || "Threadzy.ai";
  const options = {
    body: data.body || "",
    icon: "/icon-192x192.png",
    badge: "/favicon-32x32.png",
    tag: data.tag || "threadzy-notification",
    data: { url: data.url || "/threads" },
    // Vibrate pattern for mobile
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/threads";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    }),
  );
});
