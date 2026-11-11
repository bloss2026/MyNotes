const CACHE_NAME = 'mynotes-v16';

const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icon.svg'
];

const REMOTE_ASSETS = [
    'https://cdn.tailwindcss.com/',
    'https://unpkg.com/lucide@latest',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://unpkg.com/perfect-freehand@1.2.2/dist/esm/index.mjs',
    'https://unpkg.com/dexie@3.2.7/dist/dexie.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

const REMOTE_ASSET_SET = new Set(REMOTE_ASSETS);

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
        await cache.addAll(REMOTE_ASSETS.map(url => new Request(url, { mode: 'cors' })));
        await self.skipWaiting();
    })().catch(error => {
        console.error('MyNotes-Offline-Dateien konnten nicht vollständig vorgeladen werden:', error);
        throw error;
    }));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith('mynotes-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isLocalAsset = url.origin === self.location.origin;
    const isRemoteAsset = REMOTE_ASSET_SET.has(url.href);
    if (!isLocalAsset && !isRemoteAsset) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
            const response = await fetch(request);
            if (response.ok && (isLocalAsset || isRemoteAsset)) {
                await cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            if (request.mode === 'navigate') {
                const offlinePage = await cache.match('./index.html');
                if (offlinePage) return offlinePage;
            }
            console.error('Offline-Ressource nicht verfügbar:', request.url, error);
            return new Response('Diese Ressource ist offline nicht verfügbar.', {
                status: 503,
                statusText: 'Offline'
            });
        }
    })());
});
