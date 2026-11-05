// Service worker al CRM-ului: primește notificările (Web Push) și le afișează pe telefon,
// chiar dacă aplicația e închisă. Nu păstrează pagini în cache (datele vin mereu proaspete).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "MoreLeads CRM", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "MoreLeads CRM", {
        body: data.body || "",
        tag: data.tag,
        // aceeași etichetă (ex. alt comentariu la aceeași sarcină): sună din nou, nu doar înlocuiește
        renotify: Boolean(data.tag),
        // atenționările urgente rămân pe ecran până le atingi
        requireInteraction: Boolean(data.urgent),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { url: data.url || "/" },
      }),
      // cifra de pe iconița aplicației: câte notificări necitite ai (o trimite serverul)
      typeof data.badge === "number" && self.navigator.setAppBadge
        ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {})
        : null,
    ]),
  );
});

// Atingerea notificării: deschide (sau aduce în față) CRM-ul la pagina potrivită.
// `#n` îi spune aplicației că ai venit din notificare, ca s-o marcheze citită.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin);
  url.hash = "n";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url.href);
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
