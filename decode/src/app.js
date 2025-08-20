document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('urlInput');
    const decodeBtn = document.getElementById('decodeBtn');
    const resultSection = document.getElementById('resultSection');
    const decodedOutput = document.getElementById('decodedOutput');
    const copyBtn = document.getElementById('copyBtn');
    const previewFrame = document.getElementById('previewFrame');
    const openLink = document.getElementById('openLink');
    const urlDisplay = document.getElementById('urlDisplay');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const languageToggle = document.getElementById('language-toggle');
    const languageDropdown = document.getElementById('language-dropdown');
    const languageToggleMobile = document.getElementById('language-toggle-mobile');
    const mobileLanguageMenu = document.getElementById('mobile-language-menu');
    const closeLanguageMenu = document.getElementById('close-language-menu');
    const mobileLanguageBtn = document.getElementById('mobile-language-btn');
    const currentLanguageElement = document.getElementById('current-language');
    const mobileCurrentLanguageElement = document.getElementById('mobile-current-language');
    const header = document.querySelector('header'); // Get header element

    // Language data
    const languageData = {
        th: {
            // Header
            "header-title": "LinkLift",
            "nav-tool": "เครื่องมือ",
            "nav-about": "เกี่ยวกับ",
            "nav-faq": "คำถามที่พบบ่อย",
            "current-language": "ไทย",
            "mobile-current-language": "เปลี่ยนภาษา (ไทย)",
            
            // Hero section
            "hero-title": "ถอดรหัส URL ของคุณ<br>ในไม่กี่วินาที",
            "hero-description": "เครื่องมือฟรีสำหรับถอดรหัส URL ที่เข้ารหัสแล้ว แปลง %20 และรหัสพิเศษอื่น ๆ เป็นตัวอักษรที่อ่านได้",
            "security-note": "ปลอดภัย 100%: เราไม่เก็บข้อมูล URL ของคุณ",
            
            // Tool section
            "input-label": "วาง URL ที่เข้ารหัสที่นี่",
            "decode-button-text": "ถอดรหัส",
            "result-title": "ผลลัพธ์",
            "decoded-url-label": "URL หลังถอดรหัส",
            "copy-button-text": "คัดลอก",
            "preview-title": "พรีวิวหน้าเว็บ",
            "open-new-tab-text": "เปิดในแท็บใหม่",
            
            // About section
            "about-title": "เกี่ยวกับเครื่องมือนี้",
            "about-subtitle-1": "URL Encoding คืออะไร?",
            "about-content-1": "URL Encoding คือกระบวนการแปลงอักขระใน URL ให้อยู่ในรูปแบบที่ปลอดภัยสำหรับการส่งผ่านอินเทอร์เน็ต ตัวอย่างเช่น ช่องว่างจะถูกแปลงเป็น %20 อักขระพิเศษต่าง ๆ ก็จะถูกแปลงเป็นรหัสเฉพาะ",
            "about-subtitle-2": "เครื่องมือนี้ช่วยอะไรได้บ้าง?",
            "about-content-2": "เครื่องมือของเราช่วยถอดรหัส URL ที่ถูก encode แล้วให้กลับไปเป็นรูปแบบปกติที่มนุษย์อ่านเข้าใจได้ พร้อมทั้งแสดงตัวอย่างเว็บไซต์นั้นๆ เพื่อให้คุณมั่นใจได้ว่าเป็นลิงก์ที่ถูกต้องก่อนเข้าชม",
            
            // FAQ section
            "faq-title": "คำถามที่พบบ่อย",
            "faq-question-1": "การถอดรหัส URL ปลอดภัยหรือไม่?",
            "faq-answer-1": "การถอดรหัส URL นั้นปลอดภัย เนื่องจากเราไม่มีการบันทึกหรือเก็บข้อมูล URL ของคุณไว้ในเซิร์ฟเวอร์ใดๆ ทั้งสิ้น การประมวลผลทั้งหมดเกิดขึ้นบนเบราว์เซอร์ของคุณ",
            "faq-question-2": "ทำไมบางลิงก์ถึงไม่แสดงผลพรีวิว?",
            "faq-answer-2": "บางเว็บไซต์มีนโยบายป้องกันการแสดงผลใน iframe (X-Frame-Options) ซึ่งทำให้ไม่สามารถแสดงพรีวิวได้ ในกรณีนี้คุณสามารถใช้ปุ่ม \"เปิดในแท็บใหม่\" เพื่อดูเนื้อหาของเว็บไซต์ได้",
            "faq-question-3": "เครื่องมือนี้รองรับ URL ประเภทใดบ้าง?",
            "faq-answer-3": "เครื่องมือของเราสามารถถอดรหัส URL ได้ทุกประเภท ทั้ง HTTP, HTTPS และโปรโตคอลอื่นๆ รวมถึงรองรับอักขระทุกภาษา",
            
            // Footer
            "footer-text": "© 2025 LinkLift - เครื่องมือถอดรหัส URL ฟรี",
            "footer-built": "สร้างขึ้นด้วย HTML, TailwindCSS และ JavaScript",
            
            // Notifications
            "notification-empty-url": "กรุณาป้อน URL ที่ต้องการถอดรหัส",
            "notification-decode-error": "ไม่สามารถถอดรหัส URL นี้ได้ กรุณาตรวจสอบอีกครั้ง",
            "notification-success": "ถอดรหัส URL สำเร็จแล้ว!",
            "notification-copied": "คัดลอก URL ไปยังคลิปบอร์ดแล้ว",
            "notification-example-added": "เพิ่มตัวอย่าง URL แล้ว",
            "notification-encoded": "เข้ารหัส URL กลับแล้ว",
            "notification-refreshed": "รีเฟรชพรีวิวแล้ว"
        },
        en: {
            // Header
            "header-title": "LinkLift",
            "nav-tool": "Tool",
            "nav-about": "About",
            "nav-faq": "FAQ",
            "current-language": "English",
            "mobile-current-language": "Change Language (English)",
            
            // Hero section
            "hero-title": "Decode Your URL<br>in Seconds",
            "hero-description": "Free tool for decoding encoded URLs. Convert %20 and other special codes to readable characters.",
            "security-note": "100% Secure: We do not store your URL data",
            
            // Tool section
            "input-label": "Paste encoded URL here",
            "decode-button-text": "Decode",
            "result-title": "Result",
            "decoded-url-label": "Decoded URL",
            "copy-button-text": "Copy",
            "preview-title": "Web Preview",
            "open-new-tab-text": "Open in new tab",
            
            // About section
            "about-title": "About This Tool",
            "about-subtitle-1": "What is URL Encoding?",
            "about-content-1": "URL Encoding is the process of converting characters in a URL into a format that is safe for internet transmission. For example, spaces are converted to %20 and special characters are converted to specific codes.",
            "about-subtitle-2": "How can this tool help?",
            "about-content-2": "Our tool helps decode encoded URLs back to a normal, human-readable format. It also shows a preview of the website so you can ensure it's the correct link before visiting.",
            
            // FAQ section
            "faq-title": "Frequently Asked Questions",
            "faq-question-1": "Is URL decoding safe?",
            "faq-answer-1": "URL decoding is safe because we do not record or store your URL data on any server. All processing happens in your browser.",
            "faq-question-2": "Why don't some links show a preview?",
            "faq-answer-2": "Some websites have policies preventing display in iframes (X-Frame-Options) which prevents preview. In this case, you can use the \"Open in new tab\" button to view the website content.",
            "faq-question-3": "What types of URLs does this tool support?",
            "faq-answer-3": "Our tool can decode all types of URLs, including HTTP, HTTPS, and other protocols, and supports all language characters.",
            
            // Footer
            "footer-text": "© 2025 LinkLift",
            "footer-built": "Built with HTML, TailwindCSS and JavaScript",
            
            // Notifications
            "notification-empty-url": "Please enter a URL to decode",
            "notification-decode-error": "Unable to decode this URL. Please check and try again",
            "notification-success": "URL decoded successfully!",
            "notification-copied": "URL copied to clipboard",
            "notification-example-added": "Example URL added",
            "notification-encoded": "URL encoded back",
            "notification-refreshed": "Preview refreshed"
        }
    };

    // Set default language
    let currentLang = 'th';

    // Function to change language
    function changeLanguage(lang) {
        currentLang = lang;
        
        // Update all text elements
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
        
        // Update language toggle text
        currentLanguageElement.textContent = languageData[lang]['current-language'];
        mobileCurrentLanguageElement.textContent = languageData[lang]['mobile-current-language'];
        
        // Update input placeholder based on language
        if (lang === 'th') {
            urlInput.placeholder = "https://example.com/%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5";
        } else {
            urlInput.placeholder = "https://example.com/%E0%B8%AA%E0%B8%A7%E0%B8%B1%E0%B8%AA%E0%B8%94%E0%B8%B5";
        }
        
        // Save language preference to localStorage
        localStorage.setItem('preferredLanguage', lang);
    }

    // Load saved language preference
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage) {
        changeLanguage(savedLanguage);
    }

    // Language toggle functionality
    languageToggle.addEventListener('click', function() {
        languageDropdown.classList.toggle('hidden');
    });

    // Close language dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!languageToggle.contains(event.target) && !languageDropdown.contains(event.target)) {
            languageDropdown.classList.add('hidden');
        }
    });

    // Language selection from dropdown
    document.querySelectorAll('#language-dropdown button, #mobile-language-menu button').forEach(button => {
        button.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            changeLanguage(lang);
            languageDropdown.classList.add('hidden');
            mobileLanguageMenu.classList.add('hidden');
        });
    });

    // Mobile language menu toggle
    languageToggleMobile.addEventListener('click', function() {
        mobileLanguageMenu.classList.remove('hidden');
    });

    mobileLanguageBtn.addEventListener('click', function() {
        mobileMenu.classList.add('hidden');
        mobileLanguageMenu.classList.remove('hidden');
    });

    closeLanguageMenu.addEventListener('click', function() {
        mobileLanguageMenu.classList.add('hidden');
    });

    // *** NEW: Navbar scroll effect ***
    window.addEventListener('scroll', function() {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    mobileMenuBtn.addEventListener('click', function() {
        mobileMenu.classList.toggle('hidden');
    });
    
    // Close mobile menu when clicking on links
    const mobileLinks = mobileMenu.querySelectorAll('a');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenu.classList.add('hidden');
        });
    });
    
    // Decode URL function
    function decodeURL() {
        const encodedURL = urlInput.value.trim();
        
        if (!encodedURL) {
            showNotification(languageData[currentLang]['notification-empty-url'], 'error');
            urlInput.focus();
            return;
        }
        
        try {
            // Add loading state to button
            decodeBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${currentLang === 'th' ? 'กำลังถอดรหัส...' : 'Decoding...'}`;
            decodeBtn.disabled = true;
            
            // Decode the URL
            const decodedURL = decodeURIComponent(encodedURL);
            
            // Show the result
            setTimeout(() => {
                decodedOutput.value = decodedURL;
                resultSection.classList.remove('hidden');
                
                // Set iframe source and link
                previewFrame.src = decodedURL;
                openLink.href = decodedURL;
                urlDisplay.textContent = decodedURL;
                
                // Reset button state
                decodeBtn.innerHTML = `<i class="fas fa-bolt mr-2"></i>${languageData[currentLang]['decode-button-text']}`;
                decodeBtn.disabled = false;
                
                // Show success notification
                showNotification(languageData[currentLang]['notification-success'], 'success');
                
                // Scroll to result section
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 800);
        } catch (error) {
            showNotification(languageData[currentLang]['notification-decode-error'], 'error');
            console.error('Decode error:', error);
            
            // Reset button state
            decodeBtn.innerHTML = `<i class="fas fa-bolt mr-2"></i>${languageData[currentLang]['decode-button-text']}`;
            decodeBtn.disabled = false;
        }
    }
    
    // Copy to clipboard function
    function copyToClipboard() {
        decodedOutput.select();
        document.execCommand('copy');
        
        // Show notification
        showNotification(languageData[currentLang]['notification-copied'], 'success');
        
        // Change button text temporarily
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = `<i class="fas fa-check mr-2"></i>${currentLang === 'th' ? 'คัดลอกแล้ว!' : 'Copied!'}`;
        copyBtn.classList.add('bg-green-600');
        
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.classList.remove('bg-green-600');
        }, 2000);
    }
    
    // Show notification function
    function showNotification(message, type) {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 opacity-0 translate-y-10';
            document.body.appendChild(toast);
        }
        
        // Set toast message and style
        toast.textContent = message;
        toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white`;
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('translate-y-0', 'opacity-100');
            toast.classList.add('translate-y-10', 'opacity-0');
        }, 3000);
    }
    
    // Event listeners
    decodeBtn.addEventListener('click', decodeURL);
    
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            decodeURL();
        }
    });
    
    copyBtn.addEventListener('click', copyToClipboard);
    
    // Add animation to buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.classList.add('btn-animate');
    });
});