

# LinkLift 🌐

<p align="center">
  <img src="https://raw.githubusercontent.com/ShoperGamer/-LinkLift/main/decode/logo.png" alt="LinkLift Logo" width="100" height="100">
</p>

<p align="center">
  <b>Modern URL Decoder, Thai AI OCR & Intelligent Text Utility Platform</b><br>
  เครื่องมือถอดรหัส URL ภาษาไทย, ระบบถอดข้อความ OCR ออฟไลน์ และชุดเครื่องมือจัดการข้อความอัจฉริยะ ทำงานแบบ Client-side 100%
</p>

<p align="center">
  <a href="https://github.com/ShoperGamer/-LinkLift"><img src="https://img.shields.io/github/repo-size/ShoperGamer/-LinkLift?style=for-the-badge&color=blue" alt="Repo Size"></a>
  <a href="https://github.com/ShoperGamer/-LinkLift/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/ShoperGamer/-LinkLift/commits/main"><img src="https://img.shields.io/github/last-commit/ShoperGamer/-LinkLift?style=for-the-badge&color=orange" alt="Last Commit"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  <img src="https://img.shields.io/badge/ONNX_Runtime-005CED?style=for-the-badge&logo=onnx&logoColor=white" alt="ONNX Runtime Web">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
</p>

---

# 🇺🇸 LinkLift (English)

**LinkLift** is a lightweight, privacy-first, 100% client-side web utility suite designed to decode percent-encoded URLs (with full Thai character support and live sandboxed previews), extract Thai/English text and tables from images and multi-hundred-page PDFs directly in the browser using ONNX Runtime Web, and sanitize AI-generated text outputs.

### 🧰 Utility Suite Overview

1. **URL Decoder (`index.html`)**  
   Instantly decodes encoded URLs (`%20`, Thai characters, and special symbols) with a Sandboxed Web Preview, bilingual switcher (TH/EN), offline status indicator, and PWA support.
2. **Clean Text (`clean-text.html`)**  
   Sanitizes outputs from AI models (ChatGPT, Gemini, Claude) by removing redundant spaces, blank lines, Markdown symbols, AI filler phrases, and special characters with real-time character/word reduction statistics.
3. **Text to Markdown (`markdown.html` / `/markdown`)**  
   Converts plain unformatted text into clean, well-structured Markdown syntax.
4. **ThaiOCR (`thaiocr.html`)**  
   100% client-side Thai & English OCR engine powered by Web Workers and ONNX Runtime Web (`wasm-simd`). Supports 400+ page PDFs, batch image uploads, automatic Markdown Table extraction, Hugging Face model switching with Browser Cache API offline storage, and IndexedDB auto-recovery.

---

## ✨ Key Features

- 🔓 **Instant URL Decoder:** Converts percent-encoded URLs (including Thai Unicode strings and `%20` spaces) back into clean, human-readable links.
- 🌐 **Live Sandboxed Preview:** Safely inspect destination web pages inside a restricted `<iframe>` sandbox.
- 🧠 **Client-Side Thai AI OCR (`ThaiOCR`):** Runs neural text detection and recognition (`det.onnx` + `rec.onnx` / `rec2.onnx`) locally via WebAssembly SIMD in a dedicated Web Worker without blocking the UI.
- 📚 **400+ Page PDF Streaming & IndexedDB:** Uses a producer-consumer rendering pipeline with PDF.js and saves extracted text page-by-page into IndexedDB to prevent browser memory crashes and support session recovery.
- 📊 **Hybrid Table Extraction (Markdown Table):** Automatically detects both bordered grid tables and borderless aligned-column layouts, converting them into ready-to-use Markdown Tables.
- 🤗 **Multi-Model Hugging Face & Offline Cache:** Supports `iapp/OpenThai2.1-OCR-Text-20261118`, `dojojin/hippocraft-thai-ocr-rec` caching weights in the Browser Cache API for offline use.
- 📝 **Custom Export Pop-up:** Real-time telemetry (elapsed time, ETA, sec/page speed) with a filename prompt modal (defaulting to `thaiocr-DD-MM-YYYY`) for `.TXT` and `.MD` downloads.
- 🧹 **AI Text Sanitizer & Live Stats:** Flexibly strip Markdown, emojis, code blocks, and filler words while tracking exact character savings.
- 🔒 **Privacy-First (Zero Telemetry):** All decoding, text cleaning, and OCR inference happen locally on your device—no URLs, documents, or images are ever uploaded to a server.

---

## 🚀 Quick Start & Usage

### Installation & Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/ShoperGamer/-LinkLift.git
   cd -LinkLift/decode
   ```

2. Install dependencies and start the Vite dev server:
   ```bash
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

### How to Use

1. **URL Decoding (`index.html`):** Paste an encoded URL (e.g., `https://medium.com/@gakungza123/%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5...`), press **Decode** (or `Enter`), copy the readable link, or inspect it in the Live Preview box.
2. **AI Text Cleaning (`clean-text.html`):** Paste raw LLM output into the left panel, toggle the cleanup rules you need, and copy the sanitized text from the right panel.
3. **ThaiOCR (`thaiocr.html`):** Select a model preset (or enter a Hugging Face Repo ID / local `./models/` path), click **Load & Cache Model**, drop a PDF (up to 400+ pages) or images (`PNG`, `JPG`, `WEBP`), and export the extracted text or Markdown tables as `.TXT` or `.MD`.

---

## 📁 Project Structure

```text
-LinkLift/
└── decode/
    ├── index.html                  # Main URL Decoder & Sandboxed Preview
    ├── clean-text.html             # AI Text Sanitizer tool
    ├── markdown.html               # Text to Markdown converter
    ├── thaiocr.html                # Client-side Thai AI OCR & Table Extractor
    ├── ocr.ts                      # ThaiOCR UI controller, PDF streaming & IndexedDB store
    ├── Progress-Bar/
    │   └── ocr-worker.ts           # ONNX Runtime Web worker, CTC decoder & Table parser
    ├── manifest.json               # Progressive Web App (PWA) manifest
    ├── logo.png                    # Project logo & favicon
    ├── fonts/                      # Self-hosted local fonts (IBM Plex Sans Thai)
    └── src/
        ├── app.js                  # URL decoding, iFrame preview & i18n logic
        ├── clean-text.js           # Regex sanitization & real-time stats
        ├── styles.css              # Core Tailwind CSS styles
        ├── clean-text.css          # Clean Text page styles
        └── css/
            └── all.min.css         # Icon styles
```

---

## 🛠️ Tech Stack

- **Markup & Styling:** [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [Tailwind CSS](https://tailwindcss.com/)
- **Languages & Bundler:** [TypeScript](https://www.typescriptlang.org/), Vanilla JavaScript (ES6+ Modules), [Vite](https://vitejs.dev/)
- **AI & Document Engine:** [ONNX Runtime Web](https://onnxruntime.ai/) (WASM SIMD + Web Workers), [PDF.js](https://mozilla.github.io/pdf.js/)
- **Storage & Offline:** IndexedDB, Browser Cache API, Service Worker (PWA), `localStorage`
- **Typography:** IBM Plex Sans Thai (Self-hosted)

---
---

# 🇹🇭 LinkLift (ภาษาไทย)

**LinkLift** เป็นเว็บแอปพลิเคชันยูทิลิตี้แบบครบวงจรที่ทำงานบนเบราว์เซอร์ 100% (Client-side) ออกแบบมาเพื่อถอดรหัส URL ภาษาไทยและอักขระพิเศษ พร้อมระบบพรีวิวหน้าเว็บที่ปลอดภัย, ระบบถอดข้อความและตารางภาษาไทย/อังกฤษจากรูปภาพและไฟล์ PDF หลายร้อยหน้าด้วย AI ออฟไลน์ (`ThaiOCR`) และชุดเครื่องมือจัดการข้อความสำหรับล้างคำฟิลเลอร์หรือสัญลักษณ์ส่วนเกินจาก AI

### 🧰 ภาพรวมชุดเครื่องมือ

1. **URL Decoder (`index.html`)**  
   ถอดรหัส URL (`%20`, ภาษาไทย และอักขระพิเศษ) พร้อมระบบ Sandboxed Web Preview, ปุ่มสลับภาษา (TH/EN), การแจ้งเตือนสถานะ Offline และรองรับการติดตั้งเป็น PWA
2. **Clean Text (`clean-text.html`)**  
   ทำความสะอาดข้อความจากโมเดล AI (ChatGPT, Gemini, Claude) ลบช่องว่างส่วนเกิน, บรรทัดว่าง, สัญลักษณ์ Markdown, คำฟิลเลอร์ และอักขระพิเศษ พร้อมคำนวณสถิติตัวอักษรและเปอร์เซ็นต์ที่ลดลงแบบเรียลไทม์
3. **Text to Markdown (`markdown.html` / `/markdown`)**  
   แปลงข้อความทั่วไปให้เป็นโครงสร้าง Markdown syntax อย่างเป็นระเบียบ
4. **ThaiOCR (`thaiocr.html`)**  
   ระบบถอดข้อความภาษาไทยและอังกฤษจากรูปภาพและไฟล์ PDF หลายร้อยหน้าในเครื่อง 100% ผ่าน Web Worker และ ONNX Runtime Web (`wasm-simd`) รองรับการถอดตารางเป็น Markdown Table อัตโนมัติ, แคชโมเดลไว้ใช้งานออฟไลน์ และบันทึกผลลัพธ์ทีละหน้าลง IndexedDB

---

## ✨ คุณสมบัติเด่น

- 🔓 **Instant URL Decode:** แปลง Encoded URL (เช่น รหัสภาษาไทยหรือช่องว่าง `%20`) กลับเป็นลิงก์ที่อ่านง่ายได้ทันที
- 👀 **Live Sandbox Preview:** พรีวิวหน้าเว็บปลายทางผ่าน `<iframe>` ที่มีมาตรการความปลอดภัย
- 🧠 **Client-Side Thai AI OCR (`ThaiOCR`):** รันโมเดลตรวจจับและอ่านตัวอักษร (`det.onnx` + `rec.onnx` / `rec2.onnx`) ผ่าน WebAssembly SIMD ใน Web Worker แยกจากหน้าจอหลัก ทำให้เว็บไม่ค้างขณะประมวลผล
- 📚 **รองรับ PDF 400+ หน้า & IndexedDB:** ใช้สถาปัตยกรรม Streaming Producer-Consumer ร่วมกับ PDF.js และบันทึกข้อความลง IndexedDB ทีละหน้า ป้องกันเบราว์เซอร์ค้างและกู้คืนข้อมูลเดิมได้อัตโนมัติ
- 📊 **ถอดโครงสร้างตารางอัตโนมัติ (Markdown Table):** รองรับทั้งตารางแบบมีเส้นขอบ (Bordered Grid) และตารางไม่มีเส้นขอบที่จัดแนวคอลัมน์ (Borderless) แปลงเป็นตาราง Markdown พร้อมใช้งานทันที
- 🤗 **สลับโมเดล Hugging Face & แคชออฟไลน์:** รองรับโมเดล `iapp/OpenThai2.1-OCR-Text-20261118`, `dojojin/hippocraft-thai-ocr-rec` พร้อมระบบ Cache API เก็บไฟล์โมเดลไว้ใช้ซ้ำโดยไม่ต้องโหลดใหม่
- 📝 **Pop-up ตั้งชื่อไฟล์ก่อนดาวน์โหลด:** แสดงสถิติความเร็วและเวลาที่เหลือ (ETA) แบบเรียลไทม์ พร้อมหน้าต่างตั้งชื่อไฟล์อัตโนมัติ (`thaiocr-วัน-เดือน-ปี`) รองรับการส่งออกทั้ง `.TXT` และ `.MD`
- 🧹 **AI Text Sanitization & Real-time Stats:** เลือกลบ Markdown, คำซ้ำ, Emoji, Code blocks และบรรทัดว่างส่วนเกิน พร้อมแสดงจำนวนตัวอักษรที่ประหยัดได้ทันที
- 🔒 **Privacy-First (100% Client-Side):** การประมวลผลทั้งหมดเกิดขึ้นบนเบราว์เซอร์ของผู้ใช้ ไม่มีการอัปโหลดลิงก์ ข้อความ รูปภาพ หรือไฟล์ PDF ขึ้นเซิร์ฟเวอร์ภายนอก

---

## 🚀 การติดตั้งและวิธีการใช้งาน

### การรันโปรเจกต์บนเครื่อง (Local Development)

1. โคลนโปรเจกต์:
   ```bash
   git clone [https://github.com/ShoperGamer/-LinkLift.git](https://github.com/ShoperGamer/-LinkLift.git)
   cd -LinkLift/decode
   ```

2. ติดตั้งแพ็กเกจและรันเซิร์ฟเวอร์พัฒนา:
   ```bash
   npm install
   npm run dev
   ```

3. เปิดเบราว์เซอร์ไปที่ `http://localhost:5173`

### วิธีการใช้งานแต่ละเครื่องมือ

1. **การถอดรหัส URL (`index.html`):** วางลิงก์ที่ถูกเข้ารหัสลงในช่องค้นหา กดปุ่ม **"ถอดรหัส"** (หรือกด `Enter`) เพื่อคัดลอก URL ฉบับอ่านง่าย หรือดูตัวอย่างหน้าเว็บผ่านกล่อง Preview
2. **การทำความสะอาดข้อความ AI (`clean-text.html`):** วางข้อความจาก AI ลงในกล่องฝั่งซ้าย ติ๊กเลือกตัวเลือกที่ต้องการทำความสะอาด แล้วกด **"คัดลอก"** ผลลัพธ์จากกล่องฝั่งขวา
3. **การถอดข้อความจากภาพและ PDF (`thaiocr.html`):** เลือกโมเดลจาก Dropdown (หรือใส่ Hugging Face Repo ID / พาธ `./models/`) กด **"โหลดและแคชโมเดล"** จากนั้นลากไฟล์ PDF (สูงสุด 400+ หน้า) หรือไฟล์รูปภาพ (`PNG`, `JPG`, `WEBP`) มาวาง แล้วกดเริ่มถอดข้อความและดาวน์โหลดเป็น `.TXT` หรือ `.MD`

---

## 📁 โครงสร้างโปรเจกต์

```text
-LinkLift/
└── decode/
    ├── index.html                  # หน้าหลักสำหรับถอดรหัส URL
    ├── clean-text.html             # เครื่องมือทำความสะอาดข้อความ AI
    ├── markdown.html               # เครื่องมือแปลงข้อความเป็น Markdown
    ├── thaiocr.html                # เครื่องมือถอดข้อความและตารางด้วย Thai AI OCR
    ├── ocr.ts                      # ตัวควบคุมหน้า ThaiOCR, PDF Streaming และ IndexedDB
    ├── Progress-Bar/
    │   └── ocr-worker.ts           # Web Worker สำหรับ ONNX Runtime, ถอดรหัส CTC และแยกตาราง
    ├── manifest.json               # การตั้งค่า Progressive Web App (PWA)
    ├── logo.png                    # โลโก้และ Favicon ประจำโปรเจกต์
    ├── fonts/                      # ฟอนต์แบบ Local (IBM Plex Sans Thai)
    └── src/
        ├── app.js                  # ตรรกะการถอดรหัส URL, Preview และ i18n
        ├── clean-text.js           # ตรรกะ Regex และการประมวลผลข้อความ AI
        ├── styles.css              # สไตล์หลักและ Tailwind Directives
        ├── clean-text.css          # สไตล์เฉพาะหน้า Clean Text
        └── css/
            └── all.min.css         # สไตล์ไอคอน
```

---

## 🛠️ เทคโนโลยีที่ใช้ (Tech Stack)

- **โครงสร้างและสไตล์:** [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [Tailwind CSS](https://tailwindcss.com/)
- **ภาษาและตัวจัดการ Build:** [TypeScript](https://www.typescriptlang.org/), Vanilla JavaScript (ES6+ Modules), [Vite](https://vitejs.dev/)
- **เอนจิน AI และเอกสาร:** [ONNX Runtime Web](https://onnxruntime.ai/) (WASM SIMD + Web Workers), [PDF.js](https://mozilla.github.io/pdf.js/)
- **การจัดเก็บข้อมูลและออฟไลน์:** IndexedDB, Browser Cache API, Service Worker (PWA), `localStorage`
- **ฟอนต์:** IBM Plex Sans Thai (Self-hosted)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for full details.

## 🤝 Authors & Credits

Crafted with care by **Shoper Team**

Maintained by **@ShoperGamer, @Charifkub, @Animexo**

