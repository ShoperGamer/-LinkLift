import katex from 'katex';
import 'katex/dist/katex.min.css';
import './sw-register.js';

document.addEventListener('DOMContentLoaded', function () {
    // ==================== DOM ELEMENTS ====================
    const inputText = document.getElementById('inputText');
    const markdownPreview = document.getElementById('markdownPreview');
    const clearInputBtn = document.getElementById('clearInputBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const copyBtn = document.getElementById('copyBtn');
    const copyBtnText = document.getElementById('copyBtnText');
    const downloadToggle = document.getElementById('downloadToggle');
    const downloadMenu = document.getElementById('downloadMenu');
    const downloadMd = document.getElementById('downloadMd');
    const downloadTxt = document.getElementById('downloadTxt');
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    const outputCharCount = document.getElementById('outputCharCount');
    const outputLineCount = document.getElementById('outputLineCount');
    const toast = document.getElementById('toast');

    const optHeadings = document.getElementById('optHeadings');
    const optBold = document.getElementById('optBold');
    const optItalic = document.getElementById('optItalic');
    const optLists = document.getElementById('optLists');
    const optLinks = document.getElementById('optLinks');
    const optCode = document.getElementById('optCode');

    [optHeadings, optBold, optItalic, optLists, optLinks, optCode]
        .forEach(opt => opt.addEventListener('change', convert));

    let currentMarkdown = '';

    // ==================== TOAST ====================
    const ICON_OK = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>';
    const ICON_ERR = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>';

    function showToast(message, type = 'success') {
        const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        toast.className = `fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 toast text-white ${bg}`;
        toast.innerHTML = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderMath(latex, displayMode) {
        try {
            return katex.renderToString(latex, {
                throwOnError: false,
                displayMode: displayMode,
                strict: false,
                trust: false
            });
        } catch (err) {
            return `<code class="math-fallback">${escapeHtml(latex)}</code>`;
        }
    }

    /* =====================================================================
       ✨ HISTORY (UNDO / REDO)
       ===================================================================== */
    const history = { stack: [], index: -1 };
    const tbUndo = document.getElementById('tbUndo');
    const tbRedo = document.getElementById('tbRedo');

    function updateHistoryButtons() {
        tbUndo.disabled = history.index <= 0;
        tbRedo.disabled = history.index >= history.stack.length - 1;
    }

    function pushHistory() {
        const last = history.stack[history.index];
        if (last && last.value === inputText.value) return;
        history.stack = history.stack.slice(0, history.index + 1);
        history.stack.push({
            value: inputText.value,
            start: inputText.selectionStart,
            end: inputText.selectionEnd
        });
        if (history.stack.length > 100) history.stack.shift();
        history.index = history.stack.length - 1;
        updateHistoryButtons();
    }

    function restoreState(state) {
        inputText.value = state.value;
        inputText.setSelectionRange(state.start, state.end);
        inputText.focus();
        convert();
        updateHistoryButtons();
    }

    function undo() {
        if (history.index > 0) {
            history.index--;
            restoreState(history.stack[history.index]);
        }
    }

    function redo() {
        if (history.index < history.stack.length - 1) {
            history.index++;
            restoreState(history.stack[history.index]);
        }
    }

    tbUndo.addEventListener('click', undo);
    tbRedo.addEventListener('click', redo);

    // debounce push เมื่อพิมพ์เอง
    let inputTimer;
    inputText.addEventListener('input', () => {
        convert();
        clearTimeout(inputTimer);
        inputTimer = setTimeout(pushHistory, 400);
    });

    /* =====================================================================
       ✨ TOOLBAR ACTIONS
       ===================================================================== */
    function applyEdit(newValue, selStart, selEnd) {
        inputText.value = newValue;
        inputText.setSelectionRange(selStart, selEnd);
        inputText.focus();
        pushHistory();
        convert();
    }

    // คลุมสัญลักษณ์รอบข้อความที่เลือก (toggle ได้)
    function wrapSelection(before, after, placeholder) {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const sel = v.slice(s, e);

        // กรณีเคอร์เซอร์คร่อมอยู่แล้ว -> ปลดออก
        const beforeSel = v.slice(Math.max(0, s - before.length), s);
        const afterSel = v.slice(e, e + after.length);
        if (beforeSel === before && afterSel === after) {
            const nv = v.slice(0, s - before.length) + sel + v.slice(e + after.length);
            applyEdit(nv, s - before.length, s - before.length + sel.length);
            return;
        }
        // กรณีข้อความที่เลือกมีสัญลักษณ์คลุมอยู่แล้ว -> ปลดออก
        if (sel.length >= before.length + after.length &&
            sel.startsWith(before) && sel.endsWith(after)) {
            const inner = sel.slice(before.length, sel.length - after.length);
            const nv = v.slice(0, s) + inner + v.slice(e);
            applyEdit(nv, s, s + inner.length);
            return;
        }
        // เพิ่มสัญลักษณ์
        const content = sel || placeholder;
        const nv = v.slice(0, s) + before + content + after + v.slice(e);
        applyEdit(nv, s + before.length, s + before.length + content.length);
    }

    const stripPrefix = l => l.replace(/^(\s*)(?:[-*•]\s+\[[ xX]\]\s+|[-*•]\s+|\d+[.)]\s+|>\s+|#{1,6}\s+)/, '$1');

    function getLineBlock(v, s, e) {
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        let le = v.indexOf('\n', e);
        if (le === -1) le = v.length;
        return [ls, le];
    }

    // สลับคำนำหน้าบรรทัด (bullet / numbered / task / quote)
    function toggleLineMode(mode) {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const [ls, le] = getLineBlock(v, s, e);
        const lines = v.slice(ls, le).split('\n');

        const testers = {
            bullet: l => /^[-*•]\s+(?!\[)/.test(l),
            number: l => /^\d+[.)]\s+/.test(l),
            task: l => /^[-*•]\s+\[[ xX]\]\s+/.test(l),
            quote: l => /^>\s?/.test(l)
        };
        const isTarget = testers[mode];
        const allOn = lines.every(l => l.trim() === '' || isTarget(l));
        const hasContent = lines.some(l => l.trim() !== '');
        if (!hasContent) return;

        let counter = 0;
        const newLines = lines.map(l => {
            if (l.trim() === '') return l;
            const clean = stripPrefix(l);
            if (allOn) return clean;
            counter++;
            switch (mode) {
                case 'bullet': return '- ' + clean;
                case 'number': return counter + '. ' + clean;
                case 'task': return '- [ ] ' + clean;
                case 'quote': return '> ' + clean;
            }
        });

        const newBlock = newLines.join('\n');
        const nv = v.slice(0, ls) + newBlock + v.slice(le);
        applyEdit(nv, ls, ls + newBlock.length);
    }

    // หัวเรื่อง: วนระดับ ปกติ -> H1 -> H2 -> H3 -> ปกติ
    function cycleHeading() {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const [ls, le] = getLineBlock(v, s, e);
        const lines = v.slice(ls, le).split('\n');

        const firstLevel = (lines[0].match(/^(#{1,3})\s/) || [, ''])[1].length;
        const next = (firstLevel + 1) % 4;

        const newLines = lines.map(l => {
            const clean = l.replace(/^#{1,6}\s+/, '');
            if (clean.trim() === '') return l;
            return next === 0 ? clean : '#'.repeat(next) + ' ' + clean;
        });

        const newBlock = newLines.join('\n');
        const nv = v.slice(0, ls) + newBlock + v.slice(le);
        applyEdit(nv, ls, ls + newBlock.length);
    }

    // โค้ด: เลือกหลายบรรทัด/ไม่เลือก = fence, เลือกคำเดียว = inline
    function insertCode() {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const sel = v.slice(s, e);
        if (sel === '' || sel.includes('\n')) {
            const inner = sel || 'โค้ดที่นี่';
            const snippet = '```\n' + inner + '\n```';
            const nv = v.slice(0, s) + snippet + v.slice(e);
            applyEdit(nv, s + 4, s + 4 + inner.length);
        } else {
            wrapSelection('`', '`', 'code');
        }
    }

    // แทรกเทมเพลตแล้วเลือกส่วนสำคัญให้ทันที
    function insertSnippet(snippet, selectOffset, selectText) {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const prefix = (s > 0 && v[s - 1] !== '\n') ? '\n\n' : '';
        const nv = v.slice(0, s) + prefix + snippet + v.slice(e);
        const base = s + prefix.length + selectOffset;
        applyEdit(nv, base, base + selectText.length);
    }

    function insertTable() {
        const h1 = 'หัวข้อ 1';
        insertSnippet(
            `| ${h1} | หัวข้อ 2 | หัวข้อ 3 |\n| --- | --- | --- |\n| เซลล์ | เซลล์ | เซลล์ |`,
            2, h1
        );
    }

    function insertLink() {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const sel = v.slice(s, e);
        const label = 'ข้อความ';
        if (/^https?:\/\/\S+$/i.test(sel)) {
            // เลือก URL ไว้ -> ให้เป็นลิงก์ทันที
            const nv = v.slice(0, s) + `[${label}](` + sel + `)` + v.slice(e);
            applyEdit(nv, s + 1, s + 1 + label.length);
        } else if (sel) {
            // เลือกข้อความไว้ -> ให้เป็น label แล้วเลือก url ต่อ
            const nv = v.slice(0, s) + `[${sel}](https://)` + v.slice(e);
            const us = s + sel.length + 3;
            applyEdit(nv, us, us + 8);
        } else {
            const nv = v.slice(0, s) + `[${label}](https://)` + v.slice(e);
            applyEdit(nv, s + 1, s + 1 + label.length);
        }
    }

    function insertImage() {
        const v = inputText.value;
        const s = inputText.selectionStart;
        const e = inputText.selectionEnd;
        const alt = v.slice(s, e) || 'คำอธิบายภาพ';
        const snippet = `![${alt}](https://)`;
        const urlStart = 2 + alt.length + 2;
        const nv = v.slice(0, s) + snippet + v.slice(e);
        applyEdit(nv, s + urlStart, s + urlStart + 8);
    }

    // ผูกปุ่ม toolbar
    document.getElementById('tbBold').addEventListener('click', () => wrapSelection('**', '**', 'ตัวหนา'));
    document.getElementById('tbItalic').addEventListener('click', () => wrapSelection('*', '*', 'ตัวเอียง'));
    document.getElementById('tbStrike').addEventListener('click', () => wrapSelection('~~', '~~', 'ขีดฆ่า'));
    document.getElementById('tbHeading').addEventListener('click', cycleHeading);
    document.getElementById('tbBullet').addEventListener('click', () => toggleLineMode('bullet'));
    document.getElementById('tbNumber').addEventListener('click', () => toggleLineMode('number'));
    document.getElementById('tbTask').addEventListener('click', () => toggleLineMode('task'));
    document.getElementById('tbQuote').addEventListener('click', () => toggleLineMode('quote'));
    document.getElementById('tbCode').addEventListener('click', insertCode);
    document.getElementById('tbTable').addEventListener('click', insertTable);
    document.getElementById('tbLink').addEventListener('click', insertLink);
    document.getElementById('tbImage').addEventListener('click', insertImage);

    // คีย์ลัดภายใน textarea
    inputText.addEventListener('keydown', (e) => {
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        else if (key === 'b') { e.preventDefault(); wrapSelection('**', '**', 'ตัวหนา'); }
        else if (key === 'i') { e.preventDefault(); wrapSelection('*', '*', 'ตัวเอียง'); }
        else if (key === 'k') { e.preventDefault(); insertLink(); }
    });

    /* =====================================================================
       HTML BLOCK EXTRACTOR
       ===================================================================== */
    const BLOCK_TAGS = 'details|summary|dl|dt|dd|div|section|article|table|thead|tbody|tfoot|tr|th|td|ul|ol|li|blockquote|pre|h[1-6]|hr|p|figure|figcaption|nav|aside|header|footer|main|form|video|audio|canvas';
    const VOID_TAGS = ['hr', 'br', 'img', 'input', 'meta', 'link', 'source', 'embed', 'wbr'];

    function extractHtmlBlocks(md) {
        const openRe = new RegExp('^\\s*<(' + BLOCK_TAGS + ')(\\s[^>]*)?\\s*>', 'i');
        const lines = md.split('\n');
        const out = [];
        const blocks = [];
        let i = 0;
        const countOf = (str, re) => (str.match(re) || []).length;

        while (i < lines.length) {
            const line = lines[i];
            const om = line.match(openRe);
            if (om) {
                const tag = om[1].toLowerCase();
                const isVoid = VOID_TAGS.includes(tag);
                const openReG = new RegExp('<' + tag + '(?:\\s[^>]*)?\\s*>', 'gi');
                const closeReG = new RegExp('</' + tag + '\\s*>', 'gi');
                let htmlContent = line;
                let opens = isVoid ? 0 : countOf(line, openReG);
                let closes = isVoid ? 1 : countOf(line, closeReG);
                let j = i;
                while (opens > closes && j + 1 < lines.length) {
                    j++;
                    htmlContent += '\n' + lines[j];
                    opens += countOf(lines[j], openReG);
                    closes += countOf(lines[j], closeReG);
                }
                if (isVoid || opens <= closes) {
                    blocks.push(htmlContent);
                    out.push(`\u0000HB${blocks.length - 1}\u0001`);
                    i = j + 1;
                    continue;
                }
            }
            out.push(line);
            i++;
        }
        return { md: out.join('\n'), blocks };
    }

    function processHtmlBlock(html) {
        return html.replace(/>([^<>]+)</g, (m, text) => '>' + inlineRender(text) + '<');
    }

    /* =====================================================================
       RENDERER - Markdown -> HTML
       ===================================================================== */
    function renderMarkdown(md) {
        if (!md.trim()) return '';

        const escapeStore = [];
        md = md.replace(/\\([\\`*_{}\[\]()#+\-.!|~$])/g, (m, c) => {
            escapeStore.push(c);
            return `\u0000E${escapeStore.length - 1}\u0001`;
        });

        const codeBlocks = [];
        md = md.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
            codeBlocks.push({ lang: lang || 'text', code: code.replace(/\n$/, '') });
            return `\n\u0000CB${codeBlocks.length - 1}\u0001\n`;
        });

        const mathBlocks = [];
        md = md.replace(/\$\$([\s\S]*?)\$\$/g, (m, math) => {
            mathBlocks.push(renderMath(math.trim(), true));
            return `\n\u0000MB${mathBlocks.length - 1}\u0001\n`;
        });

        const hb = extractHtmlBlocks(md);
        md = hb.md;
        const htmlBlocks = hb.blocks;

        const footnotes = {};
        md = md.replace(/^\[\^([^\]]+)\]:\s+([\s\S]+?)(?=\n\n|\n\[\^|\n\u0000|$)/gm, (m, id, text) => {
            footnotes[id] = text.trim();
            return '';
        });

        const blocks = [];
        const blockLines = md.split('\n');
        let idx = 0;

        while (idx < blockLines.length) {
            const line = blockLines[idx];
            const t = line.trim();

            if (t === '') { idx++; continue; }

            const cbM = t.match(/^\u0000CB(\d+)\u0001$/);
            if (cbM) { blocks.push({ type: 'code_block', ...codeBlocks[+cbM[1]] }); idx++; continue; }

            const mbM = t.match(/^\u0000MB(\d+)\u0001$/);
            if (mbM) { blocks.push({ type: 'math_block', html: mathBlocks[+mbM[1]] }); idx++; continue; }

            const hbM = t.match(/^\u0000HB(\d+)\u0001$/);
            if (hbM) { blocks.push({ type: 'html_block', html: htmlBlocks[+hbM[1]] }); idx++; continue; }

            const hM = t.match(/^(#{1,6})\s+(.*)$/);
            if (hM) { blocks.push({ type: 'heading', level: hM[1].length, text: hM[2] }); idx++; continue; }

            if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { blocks.push({ type: 'hr' }); idx++; continue; }

            if (t.includes('|') && idx + 1 < blockLines.length) {
                const nextT = blockLines[idx + 1].trim();
                if (/^[\s|:\-]+$/.test(nextT) && nextT.includes('-')) {
                    const tableLines = [];
                    while (idx < blockLines.length && blockLines[idx].trim().includes('|')) {
                        tableLines.push(blockLines[idx]);
                        idx++;
                    }
                    blocks.push(parseTable(tableLines));
                    continue;
                }
            }

            if (/^>/.test(t)) {
                const quoteLines = [];
                while (idx < blockLines.length) {
                    const l = blockLines[idx];
                    if (/^>/.test(l.trim())) {
                        quoteLines.push(l.replace(/^\s*>\s?/, ''));
                        idx++;
                    } else if (l.trim() === '') {
                        if (idx + 1 < blockLines.length && /^>/.test(blockLines[idx + 1].trim())) {
                            quoteLines.push('');
                            idx++;
                        } else break;
                    } else break;
                }
                blocks.push({ type: 'blockquote', content: quoteLines.join('\n') });
                continue;
            }

            if (/^[\*\-\+]\s+/.test(t)) {
                const items = [];
                while (idx < blockLines.length) {
                    const l = blockLines[idx];
                    const liM = l.match(/^[\*\-\+]\s+(.*)$/);
                    if (!liM) break;
                    const taskM = liM[1].match(/^\[([ xX])\]\s*(.*)$/);
                    if (taskM) items.push({ text: taskM[2], checked: taskM[1].toLowerCase() === 'x' });
                    else items.push({ text: liM[1], checked: null });
                    idx++;
                }
                const isTask = items.some(it => it.checked !== null);
                blocks.push({ type: 'ul', items, task: isTask });
                continue;
            }

            if (/^\d+[.)]\s+/.test(t)) {
                const items = [];
                while (idx < blockLines.length) {
                    const l = blockLines[idx];
                    const liM = l.match(/^\d+[.)]\s+(.*)$/);
                    if (!liM) break;
                    items.push(liM[1]);
                    idx++;
                }
                blocks.push({ type: 'ol', items });
                continue;
            }

            const paraLines = [];
            while (idx < blockLines.length && blockLines[idx].trim() !== '') {
                const next = blockLines[idx].trim();
                if (paraLines.length > 0 && (
                    /^#{1,6}\s/.test(next) ||
                    /^(-{3,}|\*{3,}|_{3,})$/.test(next) ||
                    /^>/.test(next) ||
                    /^[\*\-\+]\s+/.test(next) ||
                    /^\d+[.)]\s+/.test(next) ||
                    /^</.test(next) ||
                    /^\u0000(CB|MB|HB)\d+\u0001$/.test(next) ||
                    (next.includes('|') && idx + 1 < blockLines.length && /^[\s|:\-]+$/.test(blockLines[idx + 1]?.trim() || ''))
                )) break;
                paraLines.push(blockLines[idx]);
                idx++;
            }
            if (paraLines.length) {
                blocks.push({ type: 'paragraph', text: paraLines.join('<br>') });
            }
        }

        const html = [];
        for (const b of blocks) {
            switch (b.type) {
                case 'heading':
                    html.push(`<h${b.level}>${inlineRender(b.text)}</h${b.level}>`);
                    break;
                case 'paragraph':
                    html.push(`<p>${inlineRender(b.text)}</p>`);
                    break;
                case 'hr':
                    html.push('<hr>');
                    break;
                case 'code_block':
                    html.push(`<pre><code class="language-${escapeHtml(b.lang)}">${escapeHtml(b.code)}</code></pre>`);
                    break;
                case 'math_block':
                    html.push(`<div class="math-block">${b.html}</div>`);
                    break;
                case 'html_block':
                    html.push(processHtmlBlock(b.html));
                    break;
                case 'table':
                    html.push(renderTable(b));
                    break;
                case 'blockquote':
                    html.push(`<blockquote>${renderMarkdown(b.content)}</blockquote>`);
                    break;
                case 'ul':
                    if (b.task) {
                        html.push('<ul class="task-list">' +
                            b.items.map(it => {
                                const cb = `<input type="checkbox" disabled ${it.checked ? 'checked' : ''} class="task-checkbox">`;
                                return `<li class="task-item">${cb} <span>${inlineRender(it.text)}</span></li>`;
                            }).join('') + '</ul>');
                    } else {
                        html.push('<ul>' + b.items.map(it => `<li>${inlineRender(it.text)}</li>`).join('') + '</ul>');
                    }
                    break;
                case 'ol':
                    html.push('<ol>' + b.items.map(it => `<li>${inlineRender(it)}</li>`).join('') + '</ol>');
                    break;
            }
        }

        const fnKeys = Object.keys(footnotes);
        if (fnKeys.length) {
            let fnHtml = '<section class="footnotes"><hr><ol>';
            for (const id of fnKeys) {
                fnHtml += `<li id="fn-${escapeHtml(id)}">${inlineRender(footnotes[id])} <a href="#fnref-${escapeHtml(id)}" class="footnote-back">↩</a></li>`;
            }
            fnHtml += '</ol></section>';
            html.push(fnHtml);
        }

        let result = html.join('\n');
        result = result.replace(/\u0000E(\d+)\u0001/g, (m, i) => escapeHtml(escapeStore[+i]));
        return result;
    }

    // ==================== TABLE PARSER ====================
    function parseTable(lines) {
        const parseCells = line => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headerCells = parseCells(lines[0]);
        const alignRow = parseCells(lines[1]);
        const aligns = alignRow.map(c => {
            const l = c.startsWith(':');
            const r = c.endsWith(':');
            if (l && r) return 'center';
            if (r) return 'right';
            if (l) return 'left';
            return '';
        });
        const rows = lines.slice(2).map(parseCells);
        return { type: 'table', headerCells, aligns, rows };
    }

    function renderTable(b) {
        let h = '<div class="table-wrapper"><table><thead><tr>';
        b.headerCells.forEach((c, i) => {
            const align = b.aligns[i] ? ` style="text-align:${b.aligns[i]}"` : '';
            h += `<th${align}>${inlineRender(c)}</th>`;
        });
        h += '</tr></thead><tbody>';
        b.rows.forEach(row => {
            h += '<tr>';
            row.forEach((c, i) => {
                const align = b.aligns[i] ? ` style="text-align:${b.aligns[i]}"` : '';
                h += `<td${align}>${inlineRender(c)}</td>`;
            });
            h += '</tr>';
        });
        h += '</tbody></table></div>';
        return h;
    }

    // ==================== INLINE RENDERER ====================
    function inlineRender(s) {
        const codeStore = [];
        const linkStore = [];
        const mathStore = [];
        const htmlInlineStore = [];

        let r = s.replace(/`([^`\n]+)`/g, (m, c) => {
            codeStore.push(c);
            return `\u0000C${codeStore.length - 1}\u0001`;
        });

        r = r.replace(/(?<!\$)\$(?![\s\d])([^\$\n]+?)(?<!\s)\$(?!\$)/g, (m, math) => {
            mathStore.push(renderMath(math, false));
            return `\u0000M${mathStore.length - 1}\u0001`;
        });

        r = r.replace(/<(kbd|mark|del|sub|sup|abbr|cite|q|b|i|em|strong|u|s|small|big|span)(\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi, (m, tag, attr, content) => {
            htmlInlineStore.push(`<${tag}${attr || ''}>${content}</${tag}>`);
            return `\u0000HI${htmlInlineStore.length - 1}\u0001`;
        });
        r = r.replace(/<(br|hr)(\s[^>]*)?\s*\/?\s*>/gi, (m) => {
            htmlInlineStore.push(m);
            return `\u0000HI${htmlInlineStore.length - 1}\u0001`;
        });

        r = r.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (m, alt, url, title) => {
            const t = title ? ` title="${escapeHtml(title)}"` : '';
            linkStore.push(`<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${t} class="md-image" loading="lazy">`);
            return `\u0000L${linkStore.length - 1}\u0001`;
        });

        r = r.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (m, text, url, title) => {
            const t = title ? ` title="${escapeHtml(title)}"` : '';
            linkStore.push(`<a href="${escapeHtml(url)}"${t} target="_blank" rel="noopener">${escapeHtml(text)}</a>`);
            return `\u0000L${linkStore.length - 1}\u0001`;
        });

        r = r.replace(/\[\^([^\]]+)\]/g, (m, id) => {
            linkStore.push(`<sup class="footnote-ref"><a href="#fn-${escapeHtml(id)}" id="fnref-${escapeHtml(id)}">[${escapeHtml(id)}]</a></sup>`);
            return `\u0000L${linkStore.length - 1}\u0001`;
        });

        r = r.replace(/(?<![\w/])(https?:\/\/[^\s<>"']+)/g, (m, u) => {
            const trail = u.match(/[.,;:!?)\]]+$/);
            let url = u, suffix = '';
            if (trail) {
                url = u.slice(0, u.length - trail[0].length);
                suffix = trail[0];
            }
            linkStore.push(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`);
            return `\u0000L${linkStore.length - 1}\u0001` + suffix;
        });

        r = escapeHtml(r);

        r = r.replace(/\*\*\*([^\n]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        r = r.replace(/___([^\n]+?)___/g, '<strong><em>$1</em></strong>');
        r = r.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
        r = r.replace(/__([^\n]+?)__/g, '<strong>$1</strong>');
        r = r.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
        r = r.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '<em>$1</em>');
        r = r.replace(/~~([^\n]+?)~~/g, '<del>$1</del>');

        r = r.replace(/\u0000HI(\d+)\u0001/g, (m, i) => htmlInlineStore[+i]);
        r = r.replace(/\u0000M(\d+)\u0001/g, (m, i) => mathStore[+i]);
        r = r.replace(/\u0000C(\d+)\u0001/g, (m, i) => '<code>' + escapeHtml(codeStore[+i]) + '</code>');
        r = r.replace(/\u0000L(\d+)\u0001/g, (m, i) => linkStore[+i]);

        return r;
    }

    /* =====================================================================
       CONVERTER - Plain Text -> Markdown
       ===================================================================== */
    function inlineConvert(s) {
        const codeStore = [];
        const linkStore = [];

        let r = s.replace(/`([^`]+)`/g, (m, c) => {
            codeStore.push(c);
            return `\u0000C${codeStore.length - 1}\u0001`;
        });

        if (optLinks.checked) {
            r = r.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (m) => {
                linkStore.push(m);
                return `\u0000L${linkStore.length - 1}\u0001`;
            });
            r = r.replace(/<(https?:\/\/[^\s>]+)>/g, (m) => {
                linkStore.push(m);
                return `\u0000L${linkStore.length - 1}\u0001`;
            });
            r = r.replace(/(?<![\w/<])(https?:\/\/[^\s<]+)(?![\w/>])/g, '<$1>');
        }

        if (optBold.checked) {
            r = r.replace(/(?<!\*)\b([A-Z]{2,}(?:\s[A-Z]{2,})*)\b(?!\*)/g, '**$1**');
            r = r.replace(/(?<!\*)([^\s*]+!!)/g, '**$1**');
        }

        if (optItalic.checked) {
            r = r.replace(/(?<![\w*])_([^_\n]+)_(?![\w*])/g, '*$1*');
        }

        r = r.replace(/\u0000L(\d+)\u0001/g, (m, i) => linkStore[+i]);
        r = r.replace(/\u0000C(\d+)\u0001/g, (m, i) => '`' + codeStore[+i] + '`');
        return r;
    }

    function convertToMarkdown(text) {
        if (!text.trim()) return '';
        const lines = text.split('\n');
        const out = [];
        let inFence = false;
        let firstHeadingDone = false;
        const RE_BULLET = /^[-*•]\s+/;
        const RE_NUMBER = /^(\d+)[.)]\s+/;
        const isBlank = l => l.trim() === '';

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const t = raw.trim();

            if (optCode.checked && t.startsWith('```')) {
                inFence = !inFence;
                out.push(t);
                continue;
            }
            if (inFence) { out.push(raw); continue; }
            if (t === '') { out.push(''); continue; }

            if (/^<\/?[a-zA-Z]/.test(t)) {
                out.push(t);
                continue;
            }

            if (/^#{1,6}\s/.test(t) || /^>/.test(t) || /^(-{3,}|\*{3,}|_{3,})$/.test(t) ||
                /^\$\$/.test(t) || /^\[\^[^\]]+\]:/.test(t)) {
                out.push(t);
                continue;
            }

            if (optLists.checked && RE_BULLET.test(t)) {
                out.push('- ' + inlineConvert(t.replace(RE_BULLET, '')));
                continue;
            }
            if (optLists.checked && RE_NUMBER.test(t)) {
                const m = t.match(RE_NUMBER);
                out.push(m[1] + '. ' + inlineConvert(t.replace(RE_NUMBER, '')));
                continue;
            }

            if (optHeadings.checked &&
                !/^\d/.test(t) &&
                !/^</.test(t) &&
                t.length <= 80 &&
                t.split(/\s+/).length <= 12 &&
                !/[.,;:!?)»"']$/.test(t) &&
                (i === 0 || isBlank(lines[i - 1])) &&
                (i + 1 < lines.length && !isBlank(lines[i + 1]) && lines[i + 1].trim().length > t.length)) {
                out.push((firstHeadingDone ? '## ' : '# ') + inlineConvert(t));
                firstHeadingDone = true;
                continue;
            }

            out.push(inlineConvert(t));
        }

        return out.join('\n');
    }

    // ==================== MAIN CONVERT ====================
    function convert() {
        const text = inputText.value;
        currentMarkdown = convertToMarkdown(text);
        markdownPreview.innerHTML = renderMarkdown(currentMarkdown);

        charCount.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            ${text.length} ตัวอักษร`;
        wordCount.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
            ${text.trim() ? text.trim().split(/\s+/).length : 0} คำ`;
        outputCharCount.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            ${currentMarkdown.length} ตัวอักษร`;
        outputLineCount.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
            ${currentMarkdown ? currentMarkdown.split('\n').length : 0} บรรทัด`;
    }

    // ==================== BASIC ACTIONS ====================
    clearInputBtn.addEventListener('click', () => {
        inputText.value = '';
        pushHistory();
        convert();
        inputText.focus();
    });

    pasteBtn.addEventListener('click', async () => {
        try {
            inputText.value = await navigator.clipboard.readText();
            pushHistory();
            convert();
            showToast(ICON_OK + ' วางข้อความแล้ว');
        } catch {
            showToast(ICON_ERR + ' ไม่สามารถวางได้', 'error');
        }
    });

    copyBtn.addEventListener('click', () => {
        if (!currentMarkdown) {
            showToast(ICON_ERR + ' ไม่มีข้อมูลให้คัดลอก', 'error');
            return;
        }
        navigator.clipboard.writeText(currentMarkdown).then(() => {
            const original = copyBtnText.textContent;
            copyBtnText.textContent = '✓';
            showToast(ICON_OK + ' คัดลอก Markdown แล้ว!');
            setTimeout(() => copyBtnText.textContent = original, 2000);
        });
    });

    // ==================== DOWNLOAD ====================
    downloadToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!downloadToggle.contains(e.target) && !downloadMenu.contains(e.target)) {
            downloadMenu.classList.add('hidden');
        }
    });

    function downloadFile(content, filename, mimeType) {
        if (!content) {
            showToast(ICON_ERR + ' ไม่มีข้อมูลให้ดาวน์โหลด', 'error');
            return;
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    downloadMd.addEventListener('click', () => {
        downloadFile(currentMarkdown, `document-${new Date().toISOString().slice(0, 10)}.md`, 'text/markdown;charset=utf-8');
        showToast(ICON_OK + ' ดาวน์โหลด .md สำเร็จ!');
        downloadMenu.classList.add('hidden');
    });

    downloadTxt.addEventListener('click', () => {
        downloadFile(currentMarkdown, `document-${new Date().toISOString().slice(0, 10)}.txt`, 'text/plain;charset=utf-8');
        showToast(ICON_OK + ' ดาวน์โหลด .txt สำเร็จ!');
        downloadMenu.classList.add('hidden');
    });

    // ==================== GLOBAL SHORTCUTS ====================
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            downloadMd.click();
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            downloadTxt.click();
        }
    });

    // ==================== INIT ====================
    pushHistory();   // snapshot เริ่มต้น
    convert();
});