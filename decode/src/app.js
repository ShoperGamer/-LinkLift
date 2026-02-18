const currentYear = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const decodeBtn = document.getElementById('decodeBtn');
    const resultSection = document.getElementById('resultSection');
    const decodedOutput = document.getElementById('decodedOutput');
    const copyBtn = document.getElementById('copyBtn');
    const languageToggle = document.getElementById('language-toggle');
    const languageDropdown = document.getElementById('language-dropdown');
    const currentLanguageElement = document.getElementById('current-language');

    const languageData = {
        th: {
            "header-title": "LinkLift",
            "nav-tool": "เครื่องมือ",
            "nav-about": "เกี่ยวกับ",
            "nav-faq": "คำถามที่พบบ่อย",
            "input-label": "วาง URL ที่เข้ารหัสที่นี่",
            "decode-button-text": "ถอดรหัส",
            "decoded-url-label": "URL หลังถอดรหัส",
            "copy-button-text": "คัดลอก",
            "footer-text": `© ${currentYear} LinkLift - เครื่องมือถอดรหัส URL ฟรี`,
            "footer-built": "Made By Shoper Team",
            "notification-success": "ถอดรหัส URL สำเร็จแล้ว!",
            "notification-copied": "คัดลอกแล้ว"
        },
        en: {
            "header-title": "LinkLift",
            "nav-tool": "Tool",
            "nav-about": "About",
            "nav-faq": "FAQ",
            "input-label": "Paste encoded URL here",
            "decode-button-text": "Decode",
            "decoded-url-label": "Decoded URL",
            "copy-button-text": "Copy",
            "footer-text": `© ${currentYear} LinkLift`,
            "footer-built": "Made By Shoper Team",
            "notification-success": "URL decoded successfully!",
            "notification-copied": "Copied to clipboard"
        }
    };

    function changeLanguage(lang) {
        Object.keys(languageData[lang]).forEach(key => {
            const element = document.getElementById(key);
            if (element) element.textContent = languageData[lang][key];
        });
        currentLanguageElement.textContent = lang === 'th' ? 'ไทย' : 'English';
        localStorage.setItem('preferredLanguage', lang);
    }

    // Decode Logic
    decodeBtn.addEventListener('click', () => {
        const encodedURL = urlInput.value.trim();
        if (!encodedURL) return;
        try {
            decodedOutput.value = decodeURIComponent(encodedURL);
            resultSection.classList.remove('hidden');
        } catch (e) {
            alert('URL ไม่ถูกต้อง');
        }
    });

    // Copy Logic
    copyBtn.addEventListener('click', () => {
        decodedOutput.select();
        document.execCommand('copy');
        copyBtn.textContent = "คัดลอกแล้ว!";
        setTimeout(() => copyBtn.textContent = languageData[localStorage.getItem('preferredLanguage') || 'th']['copy-button-text'], 2000);
    });

    // Language Toggle
    languageToggle.addEventListener('click', () => languageDropdown.classList.toggle('hidden'));
    document.querySelectorAll('#language-dropdown button').forEach(btn => {
        btn.addEventListener('click', () => {
            changeLanguage(btn.getAttribute('data-lang'));
            languageDropdown.classList.add('hidden');
        });
    });

    // Initial Load
    changeLanguage(localStorage.getItem('preferredLanguage') || 'th');
});