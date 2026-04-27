/* eslint-disable no-restricted-globals */
self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/emergency-icon.png',
            badge: '/emergency-icon.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            data: {
                url: data.data?.url || '/records'
            },
            actions: [
                {
                    action: 'open_url',
                    title: 'Xem ngay'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
