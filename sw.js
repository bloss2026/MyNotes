
const CACHE_NAME = "mynotes-v12";

const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json"
];

/* INSTALLATION */

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );

});

/* AKTIVIERUNG UND ALTE CACHE-DATEIEN LÖSCHEN */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()
            .then(keys => {

                return Promise.all(

                    keys
                        .filter(key =>
                            key.startsWith("mynotes-") &&
                            key !== CACHE_NAME
                        )
                        .map(key => caches.delete(key))

                );

            })
            .then(() => self.clients.claim())

    );

});

/* DATEIEN LADEN */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(

        caches.match(event.request)
            .then(cached => {

                if (cached) {
                    return cached;
                }

                return fetch(event.request)
                    .then(response => {

                        if (response && response.ok) {

                            const copy = response.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, copy);
                                });

                        }

                        return response;

                    });

            })

    );

});
