import './sw-register.js';

document.addEventListener('DOMContentLoaded', function() {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const copyBtn = document.getElementById('copyBtn');
    const copyBtnText = document.getElementById('copyBtnText');
    const diffBtn = document.getElementById('diffBtn');
    const inputCharCount = document.getElementById('inputCharCount');
    const inputWordCount = document.getElementById('inputWordCount');
    const outputCharCount = document.getElementById('outputCharCount');
    const savedPercent = document.getElementById('savedPercent');
    const statsSection = document.getElementById('statsSection');
    const statRemoved = document.getElementById('statRemoved');
    const statRemaining = document.getElementById('statRemaining');
    const statLines = document.getElementById('statLines');
    const statWords = document.getElementById('statWords');
    const toast = document.getElementById('toast');

    // Options
    const options = {
        extraSpaces: document.getElementById('optExtraSpaces'),
        specialChars: document.getElementById('optSpecialChars'),
        emojis: document.getElementById('optEmojis'),
        lineBreaks: document.getElementById('optLineBreaks'),
        duplicateWords: document.getElementById('optDuplicateWords'),
        trimEnds: document.getElementById('optTrimEnds'),
        removeMarkdown: document.getElementById('optRemoveMarkdown'),
        aiFiller: document.getElementById('optAIFiller'),
        fixCaps: document.getElementById('optFixCaps'),
        removeNumbers: document.getElementById('optRemoveNumbers'),
        normalize: document.getElementById('optNormalize'),
        removeCodeBlocks: document.getElementById('optRemoveCodeBlocks')
    };

    Object.values(options).forEach(opt => opt.addEventListener('change', clean));

    function showToast(message, type = 'success') {
        toast.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 toast ${type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`;
        toast.innerHTML = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    // AI filler phrases to remove
    const aiFillers = [
        // English
        "Certainly!", "Of course!", "Sure!", "Absolutely!", "Great question!",
        "I'd be happy to help", "Here's", "Here is", "Let me explain",
        "As an AI", "I hope this helps", "Feel free to ask", "Is there anything else",
        "In conclusion", "To summarize", "Overall",
        // Thai
        "แน่นอนครับ", "แน่นอนค่ะ", "ครับผม", "ค่ะ", "ได้เลยครับ", "ได้เลยค่ะ",
        "ยินดีครับ", "ยินดีค่ะ", "ขอบคุณครับ", "ขอบคุณค่ะ",
        "หวังว่าจะเป็นประโยชน์", "หากมีคำถามเพิ่มเติม", "มีอะไรให้ช่วยอีกไหม",
        "สรุปแล้ว", "โดยรวมแล้ว"
    ];

    function cleanText(text) {
        if (!text.trim()) return '';
        let result = text;

        // Remove code blocks first
        if (options.removeCodeBlocks.checked) {
            result = result.replace(/```[\s\S]*?```/g, '');
            result = result.replace(/`[^`]*`/g, '');
        }

        // Remove AI filler phrases
        if (options.aiFiller.checked) {
            aiFillers.forEach(phrase => {
                const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                result = result.replace(regex, '');
            });
        }

        // Remove emojis
        if (options.emojis.checked) {
            result = result.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{2702}-\u{27B0}]|[\u{24C2}-\u{1F251}]/gu, '');
        }

        // Remove special characters (keep alphanumeric, Thai, spaces, and basic punctuation)
        if (options.specialChars.checked) {
            result = result.replace(/[^\p{L}\p{N}\s.,!?;:()\-\[\]{}"'\/\\]/gu, '');
        }

        // Remove markdown symbols
        if (options.removeMarkdown.checked) {
            result = result.replace(/^#{1,6}\s+/gm, '');      // Headings
            result = result.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
            result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1'); // Italic
            result = result.replace(/`([^`]+)`/g, '$1');       // Code
            result = result.replace(/^[-*+]\s+/gm, '');        // Lists
            result = result.replace(/^\d+\.\s+/gm, '');        // Numbered lists
            result = result.replace(/^>\s+/gm, '');            // Blockquotes
            result = result.replace(/---+/g, '');              // HR
            result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
        }

        // Remove line numbers (like "1.", "2." at start of line)
        if (options.removeNumbers.checked) {
            result = result.replace(/^\s*\d+[.)]\s+/gm, '');
        }

        // Remove duplicate consecutive words
        if (options.duplicateWords.checked) {
            result = result.replace(/\b(\w+)\s+\1\b/gi, '$1');
        }

        // Fix capitalization - capitalize first letter of sentences
        if (options.fixCaps.checked) {
            result = result.replace(/([.!?]\s+)([a-zก-ฮ])/g, (match, p1, p2) => {
                return p1 + p2.toUpperCase();
            });
            // Capitalize first letter
            result = result.replace(/^([a-zก-ฮ])/i, (match) => match.toUpperCase());
        }

        // Extra spaces - collapse multiple spaces
        if (options.extraSpaces.checked) {
            result = result.replace(/[ \t]+/g, ' ');
        }

        // Extra line breaks - collapse 3+ newlines into 2
        if (options.lineBreaks.checked) {
            result = result.replace(/\n{3,}/g, '\n\n');
        }

        // Normalize - proper paragraph breaks
        if (options.normalize.checked) {
            result = result.replace(/\n\n+/g, '\n\n');
            result = result.replace(/([.!?:])\s*\n\s*([A-Zก-ฮ])/g, '$1\n\n$2');
        }

        // Trim ends
        if (options.trimEnds.checked) {
            result = result.split('\n').map(line => line.trim()).join('\n');
            result = result.trim();
        }

        // Final cleanup - remove empty lines at start/end
        result = result.replace(/^\s+|\s+$/g, '');
        
        return result;
    }

    function updateStats(original, cleaned) {
        const removed = original.length - cleaned.length;
        const percent = original.length > 0 ? Math.round((removed / original.length) * 100) : 0;
        
        inputCharCount.textContent = `${original.length} ตัวอักษร`;
        inputWordCount.textContent = `${original.trim() ? original.trim().split(/\s+/).length : 0} คำ`;
        outputCharCount.textContent = `${cleaned.length} ตัวอักษร`;
        savedPercent.textContent = `ลดไป ${percent}%`;
        
        statRemoved.textContent = removed;
        statRemaining.textContent = cleaned.length;
        statLines.textContent = cleaned ? cleaned.split('\n').length : 0;
        statWords.textContent = cleaned.trim() ? cleaned.trim().split(/\s+/).length : 0;
        
        if (original.trim()) {
            statsSection.classList.remove('hidden');
        } else {
            statsSection.classList.add('hidden');
        }
    }

    function clean() {
        const original = inputText.value;
        const cleaned = cleanText(original);
        outputText.value = cleaned;
        updateStats(original, cleaned);
    }

    inputText.addEventListener('input', clean);

    // Clear
    clearInputBtn.addEventListener('click', () => {
        inputText.value = '';
        clean();
        inputText.focus();
    });

    // Paste
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            inputText.value = text;
            clean();
            showToast('<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> วางข้อความแล้ว');
        } catch (err) {
            showToast('<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg> ไม่สามารถวางได้', 'error');
        }
    });

    // Copy
    copyBtn.addEventListener('click', () => {
        if (!outputText.value) return;
        navigator.clipboard.writeText(outputText.value).then(() => {
            copyBtnText.textContent = 'คัดลอกแล้ว!';
            showToast('<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> คัดลอกข้อความแล้ว!');
            setTimeout(() => copyBtnText.textContent = 'คัดลอก', 2000);
        });
    });

    // Init
    clean();
});