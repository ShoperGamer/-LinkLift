const currentYear = new Date().getFullYear();

// Register Service Worker for Offline capability
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Registration failed:', err));
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const decodeBtn = document.getElementById('decodeBtn');
    const resultSection = document.getElementById('resultSection');
    const decodedOutput = document.getElementById('decodedOutput');
    const copyBtn = document.getElementById('copyBtn');
    const copyButtonText = document.getElementById('copy-button-text');
    const languageToggle = document.getElementById('language-toggle');
    const languageDropdown = document.getElementById('language-dropdown');
    const currentLanguageElement = document.getElementById('current-language');
    const previewFrame = document.getElementById('previewFrame');
    const openLink = document.getElementById('openLink');
    const urlDisplay = document.getElementById('urlDisplay');

    // Mobile navigation elements
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const languageToggleMobile = document.getElementById('language-toggle-mobile');
    const mobileLanguageMenu = document.getElementById('mobile-language-menu');
    const closeLanguageMenu = document.getElementById('close-language-menu');
    const connectionStatus = document.getElementById('connection-status');

    const languageData = {
        th: {
            "header-title": "LinkLift",
            "nav-tool": "เครื่องมือ",
            "nav-about": "เกี่ยวกับ",
            "nav-faq": "คำถามที่พบบ่อย",
            "mobile-nav-tool": "เครื่องมือ",
            "mobile-nav-about": "เกี่ยวกับ",
            "mobile-nav-faq": "คำถามที่พบบ่อย",
            "hero-title": "ถอดรหัส URL ของคุณ<br class=\"hidden sm:inline\"> ในไม่กี่วินาที",
            "hero-description": "เครื่องมือฟรีสำหรับถอดรหัส URL ที่เข้ารหัสแล้ว แปลง %20 และรหัสพิเศษอื่น ๆ เป็นตัวอักษรปกติ ทำงานได้แม้ไม่มีอินเทอร์เน็ต",
            "security-note": "ปลอดภัย 100%: การทำงานทั้งหมดเกิดขึ้นบนอุปกรณ์ของคุณ",
            "input-label": "วาง URL ที่เข้ารหัสที่นี่",
            "decode-button-text": "ถอดรหัส",
            "result-title": "ผลลัพธ์",
            "decoded-url-label": "URL หลังถอดรหัส",
            "copy-button-text": "คัดลอก",
            "preview-title": "พรีวิวหน้าเว็บ",
            "open-new-tab-text": "เปิดในแท็บใหม่",
            "about-title": "เกี่ยวกับเครื่องมือนี้",
            "about-subtitle-1": "URL Encoding คืออะไร?",
            "about-content-1": "URL Encoding คือกระบวนการแปลงอักขระใน URL ให้อยู่ในรูปแบบที่ปลอดภัยสำหรับการส่งผ่านอินเทอร์เน็ต ตัวอย่างเช่น ช่องว่างจะถูกแปลงเป็น %20 อักขระพิเศษต่าง ๆ ก็จะถูกแปลงเป็นรหัสเฉพาะ",
            "about-subtitle-2": "เครื่องมือนี้ช่วยอะไรได้บ้าง?",
            "about-content-2": "เครื่องมือของเราช่วยถอดรหัส URL ที่ถูก encode แล้วให้กลับไปเป็นรูปแบบปกติที่มนุษย์อ่านเข้าใจได้ พร้อมทั้งแสดงตัวอย่างเว็บไซต์นั้นๆ เพื่อให้คุณมั่นใจได้ว่าเป็นลิงก์ที่ถูกต้องก่อนเข้าชม",
            "faq-title": "คำถามที่พบบ่อย",
            "faq-question-1": "การถอดรหัส URL ปลอดภัยหรือไม่?",
            "faq-answer-1": "การถอดรหัส URL นั้นปลอดภัย เนื่องจากเราไม่มีการบันทึกหรือเก็บข้อมูล URL ของคุณไว้ในเซิร์ฟเวอร์ใดๆ ทั้งสิ้น การประมวลผลทั้งหมดเกิดขึ้นบนเบราว์เซอร์ของคุณ",
            "faq-question-2": "ทำไมบางลิงก์ถึงไม่แสดงผลพรีวิว?",
            "faq-answer-2": "บางเว็บไซต์มีนโยบายป้องกันการแสดงผลใน iframe (X-Frame-Options) ซึ่งทำให้ไม่สามารถแสดงพรีวิวได้ ในกรณีนี้คุณสามารถใช้ปุ่ม \"เปิดในแท็บใหม่\" เพื่อดูเนื้อหาของเว็บไซต์ได้",
            "faq-question-3": "เครื่องมือนี้รองรับ URL ประเภทใดบ้าง?",
            "faq-answer-3": "เครื่องมือของเราสามารถถอดรหัส URL ได้ทุกประเภท ทั้ง HTTP, HTTPS และโปรโตคอลอื่นๆ รวมถึงรองรับอักขระทุกภาษา",
            "footer-text": `© ${currentYear} LinkLift - เครื่องมือถอดรหัส URL ฟรี`,
            "footer-built": "Made By Shoper Team",
            "notification-copied": "คัดลอกแล้ว!",
            "offline-alert": "กำลังใช้งานโหมดออฟไลน์ (Offline Mode)",
            "online-alert": "เชื่อมต่ออินเทอร์เน็ตแล้ว"
        },
        en: {
            "header-title": "LinkLift",
            "nav-tool": "Tool",
            "nav-about": "About",
            "nav-faq": "FAQ",
            "mobile-nav-tool": "Tool",
            "mobile-nav-about": "About",
            "mobile-nav-faq": "FAQ",
            "hero-title": "Decode Your URL<br class=\"hidden sm:inline\"> in Seconds",
            "hero-description": "Free tool to decode encoded URLs. Converts %20 and special characters into human-readable text. Works offline.",
            "security-note": "100% Safe: All operations run locally on your device",
            "input-label": "Paste encoded URL here",
            "decode-button-text": "Decode",
            "result-title": "Result",
            "decoded-url-label": "Decoded URL",
            "copy-button-text": "Copy",
            "preview-title": "Website Preview",
            "open-new-tab-text": "Open in new tab",
            "about-title": "About This Tool",
            "about-subtitle-1": "What is URL Encoding?",
            "about-content-1": "URL encoding converts characters into a format that can be transmitted over the Internet. For example, spaces are converted to %20.",
            "about-subtitle-2": "How does this tool help?",
            "about-content-2": "Our tool helps decode encoded URLs back to human-readable format and provides a website preview to verify links before visiting.",
            "faq-title": "Frequently Asked Questions",
            "faq-question-1": "Is URL decoding safe?",
            "faq-answer-1": "Yes, it is completely safe. All processing happens locally in your browser; no data is sent to our servers.",
            "faq-question-2": "Why does preview not show for some sites?",
            "faq-answer-2": "Some websites have iframe security policies (X-Frame-Options). You can use the 'Open in new tab' button instead.",
            "faq-question-3": "What types of URLs are supported?",
            "faq-answer-3": "Our tool supports all URL protocols (HTTP, HTTPS, etc.) and all language character sets.",
            "footer-text": `© ${currentYear} LinkLift - Free URL Decoder`,
            "footer-built": "Made By Shoper Team",
            "notification-copied": "Copied!",
            "offline-alert": "Working in Offline Mode",
            "online-alert": "Internet Connected"
        }
    };

    function changeLanguage(lang) {
        Object.keys(languageData[lang]).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (key === 'hero-title') {
                    element.innerHTML = languageData[lang][key];
                } else {
                    element.textContent = languageData[lang][key];
                }
            }
        });
        currentLanguageElement.textContent = lang === 'th' ? 'ไทย' : 'English';
        localStorage.setItem('preferredLanguage', lang);
    }

    // Toggle Clear (✕) Button visibility based on input value
    function toggleClearButton() {
        if (urlInput.value.trim().length > 0) {
            clearInputBtn.classList.remove('hidden');
        } else {
            clearInputBtn.classList.add('hidden');
        }
    }

    urlInput.addEventListener('input', toggleClearButton);

    // Clear Button Logic
    clearInputBtn.addEventListener('click', () => {
        urlInput.value = '';
        clearInputBtn.classList.add('hidden');
        resultSection.classList.add('hidden');
        decodedOutput.value = '';
        urlDisplay.textContent = '';
        previewFrame.src = '';
        openLink.href = '#';
        urlInput.focus();
    });

    // Decode Functionality
    decodeBtn.addEventListener('click', () => {
        const encodedURL = urlInput.value.trim();
        if (!encodedURL) return;
        try {
            const decoded = decodeURIComponent(encodedURL);
            decodedOutput.value = decoded;
            urlDisplay.textContent = decoded;
            
            let safeURL = decoded;
            if (!/^https?:\/\//i.test(safeURL)) {
                safeURL = 'https://' + safeURL;
            }
            
            previewFrame.src = safeURL;
            openLink.href = safeURL;
            resultSection.classList.remove('hidden');
        } catch (e) {
            alert('URL ไม่ถูกต้อง');
        }
    });

    // Allow Enter key to trigger decode
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            decodeBtn.click();
        }
    });

    // Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        if (!decodedOutput.value) return;
        decodedOutput.select();
        navigator.clipboard.writeText(decodedOutput.value).then(() => {
            const currentLang = localStorage.getItem('preferredLanguage') || 'th';
            copyButtonText.textContent = languageData[currentLang]["notification-copied"];
            setTimeout(() => {
                copyButtonText.textContent = languageData[currentLang]["copy-button-text"];
            }, 2000);
        });
    });

    // Language Dropdown (Desktop)
    languageToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        languageDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!languageToggle.contains(e.target) && !languageDropdown.contains(e.target)) {
            languageDropdown.classList.add('hidden');
        }
    });

    document.querySelectorAll('#language-dropdown button, #mobile-language-menu button[data-lang]').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            changeLanguage(lang);
            languageDropdown.classList.add('hidden');
            mobileLanguageMenu.classList.add('hidden');
        });
    });

    // Mobile Toggle Actions
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    if (languageToggleMobile) {
        languageToggleMobile.addEventListener('click', () => {
            mobileLanguageMenu.classList.remove('hidden');
        });
    }

    if (closeLanguageMenu) {
        closeLanguageMenu.addEventListener('click', () => {
            mobileLanguageMenu.classList.add('hidden');
        });
    }

    // Offline / Online Monitor
    function showConnectionStatus(isOnline) {
        const currentLang = localStorage.getItem('preferredLanguage') || 'th';
        if (!isOnline) {
            connectionStatus.className = "fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-sm font-semibold bg-amber-500 text-white flex items-center gap-2 fade-in";
            connectionStatus.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-5.657-2.828m0 0l2.828-2.829m-2.828 2.829L3 21M8.464 15.536a5 5 0 01-2.828-4.243m0 0l2.828-2.829M12 3v3m0 12v3"></path></svg> ${languageData[currentLang]["offline-alert"]}`;
            connectionStatus.classList.remove('hidden');
        } else {
            connectionStatus.className = "fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-sm font-semibold bg-emerald-600 text-white flex items-center gap-2 fade-in";
            connectionStatus.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> ${languageData[currentLang]["online-alert"]}`;
            setTimeout(() => connectionStatus.classList.add('hidden'), 3000);
        }
    }

    window.addEventListener('offline', () => showConnectionStatus(false));
    window.addEventListener('online', () => showConnectionStatus(true));

    if (!navigator.onLine) {
        showConnectionStatus(false);
    }

    // Initial Language Setup & Check
    toggleClearButton();
    changeLanguage(localStorage.getItem('preferredLanguage') || 'th');
});