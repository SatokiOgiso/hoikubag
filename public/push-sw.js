/* Web Push のハンドラ。vite-plugin-pwa の workbox.importScripts で生成SWに合流する。 */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'hoikubag', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || '明日のかばんの中身を確定しましたか?';
  const options = {
    body: data.body || '降園時に、明日の持ち物を入力して確定しておきましょう。',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'hoikubag-reminder',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
