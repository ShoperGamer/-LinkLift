/* =====================================================
   TextTools Service Worker
   - Offline shell: precache หน้า HTML หลักทันทีตอน install
   - Hashed assets (/assets/*): cache-first (ชื่อไฟล์มี hash = immutable)
   - อื่น ๆ: network-first + fallback cache
   - มี offline fallback ไม่จอขาว
   ⚠️ เปลี่ยน CACHE_NAME ทุกครั้งที่ release เพื่อล้างแคชเก่า
   ===================================================== */
const CACHE_NAME = 'texttools-v1-2026-11-08';

// ไฟล์ที่ไม่มี hash ใน dist root -> precache ได้เลย
const CORE_ASSETS = [
    './',
    './index.html',
    './markdown.html',
    './clean-text.html',
    './manifest.json',
    './logo.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    // ข้าม cross-origin ทั้งหมด (กันแคช opaque response)
    if (url.origin !== self.location.origin) return;

    /* ---- 1) Navigation (หน้า HTML): network-first -> cache -> shell ---- */
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req).then((hit) => hit || caches.match('./index.html'))
                )
        );
        return;
    }

    /* ---- 2) Hashed build assets: cache-first (immutable ตาม hash) ----
       รวมถึง JS/CSS bundle + ฟอนต์ KaTeX + ฟอนต์ IBM Plex ที่ Vite ออกให้ */
    if (url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.match(req).then((hit) => {
                if (hit) return hit;
                return fetch(req).then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    }
                    return res;
                });
            })
        );
        return;
    }

    /* ---- 3) อื่น ๆ (css/js/fonts นอก assets, รูปภาพ): network-first ---- */
    event.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                }
                return res;
            })
            .catch(() =>
                caches.match(req).then((hit) => {
                    if (hit) return hit;
                    // กันจอขาว: คืน response ว่างแทน undefined
                    return new Response('', { status: 504, statusText: 'Offline' });
                })
            )
    );
});

// รับข้อความจากหน้าเว็บให้บังคับ activate ทันที (ใช้ตอนอัปเดตเวอร์ชัน)
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});