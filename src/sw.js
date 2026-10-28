/* eslint-disable no-restricted-globals */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'ti4-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 }),
    ],
  }),
);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//],
  }),
);

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    // Skip banner when the app is already on screen (open + visible/focused).
    // Background, closed, or locked screen → show notification.
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const appActive = windows.some(
      (client) => client.focused || client.visibilityState === 'visible',
    );
    if (appActive) return;

    let data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch {
      data = { body: event.data?.text?.() || '' };
    }
    const title = data.title || 'TI4 Tracker';
    await self.registration.showNotification(title, {
      body: data.body || 'Нужно ваше действие в партии.',
      // Color mark on dark tile (left of notification). Status-bar badge stays mono/white on Android.
      icon: '/pwa/notification-icon.png',
      badge: '/pwa/notification-badge.png',
      // Short buzz so the player notices a turn/action alert (OS may still mute).
      vibrate: [180, 80, 180],
      data: {
        url: data.url || '/',
        roomId: data.roomId || null,
        reason: data.reason || null,
      },
      tag: data.roomId ? `ti4-room-${data.roomId}` : 'ti4-action',
      renotify: true,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of all) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          try {
            await client.navigate(targetUrl);
          } catch {
            /* ignore */
          }
        }
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
