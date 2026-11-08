// ลงทะเบียน Service Worker เฉพาะตอน build จริง (กันแคชเพี้ยนตอน dev)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => {
                console.log('SW Registered:', reg.scope);
                // ถ้ามี SW ตัวใหม่มารอ -> บอกให้ข้าม waiting เลย
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            newWorker.postMessage('SKIP_WAITING');
                        }
                    });
                });
            })
            .catch((err) => console.log('SW Registration failed:', err));
    });
}