

# LinkLift 🌐

<p align="center">
  <img src="https://raw.githubusercontent.com/ShoperGamer/-LinkLift/main/decode/logo.png" alt="LinkLift Logo" width="100" height="100">
</p>

<p align="center">
  <b>Modern URL Decoder & Intelligent Text Utility Platform</b><br>
  เครื่องมือถอดรหัส URL ภาษาไทย และชุดเครื่องมือจัดการข้อความอัจฉริยะ ทำงานแบบ Client-side 100%
</p>

<p align="center">
  <a href="https://github.com/ShoperGamer/-LinkLift"><img src="https://img.shields.io/github/repo-size/ShoperGamer/-LinkLift?style=for-the-badge&color=blue" alt="Repo Size"></a>
  <a href="https://github.com/ShoperGamer/-LinkLift/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge" alt="License"></a>
  <a href="https://github.com/ShoperGamer/-LinkLift/commits/main"><img src="https://img.shields.io/github/last-commit/ShoperGamer/-LinkLift?style=for-the-badge&color=orange" alt="Last Commit"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/JavaScript_ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA">
</p>

---


# 🇹🇭 LinkLift (ภาษาไทย)

**LinkLift** เป็นเว็บแอปพลิเคชันยูทิลิตี้แบบครบวงจร ออกแบบมาเพื่อถอดรหัส URL ที่ถูกเข้ารหัส (%20, ภาษาไทย และอักขระพิเศษ) ให้กลับมาเป็นลิงก์ที่อ่านง่าย พร้อมระบบพรีวิวหน้าเว็บ และเครื่องมือจัดการข้อความ (Text Tools) สำหรับล้างข้อความฟิลเลอร์หรือสัญลักษณ์ส่วนเกินจาก AI

### 🧰 ภาพรวมชุดเครื่องมือ

1. **URL Decoder (`index.html`)**  
   ถอดรหัส URL พร้อมระบบ Sandboxed Web Preview, ปุ่มสลับภาษา (TH/EN), การแจ้งเตือนสถานะ Offline และ PWA Support
2. **Clean Text (`clean-text.html`)**  
   ทำความสะอาดข้อความจาก AI (ChatGPT, Gemini, Claude) ลบช่องว่างส่วนเกิน, บรรทัดว่าง, สัญลักษณ์ Markdown, คำฟิลเลอร์ และอักขระพิเศษ พร้อมระบบคำนวณสถิติตัวอักษรและเปอร์เซ็นต์ที่ลดลงแบบเรียลไทม์
3. **Text to Markdown (`/markdown`)**  
   แปลงข้อความรูปแบบทั่วไปให้อยู่ในโครงสร้าง Markdown syntax อย่างเป็นระเบียบ

---

## ✨ คุณสมบัติเด่น

- 🔓 **Instant URL Decode:** แปลง Encoded URL (เช่น รหัสภาษาไทยหรือช่องว่าง `%20`) กลับเป็นข้อความปกติได้ทันที
- 👀 **Live Sandbox Preview:** พรีวิวหน้าเว็บปลายทางผ่าน iFrame ที่มีมาตรการความปลอดภัย
- 🧹 **AI Text Sanitization:** เลือกลบ Markdown, คำซ้ำ, Emoji, Code blocks, บรรทัดว่างส่วนเกิน ได้อย่างยืดหยุ่น
- 📊 **Real-time Statistics:** แสดงจำนวนตัวอักษร, จำนวนคำ, สถิติตัวอักษรที่ตัดออก และเปอร์เซ็นต์ที่ประหยัดพื้นที่
- 🎨 **Glassmorphism & Gradient UI:** หน้าตาทันสมัย สบายตา รองรับหน้าจอทุกขนาด (Responsive Design)
- 💾 **Smart Preferences:** จดจำการตั้งค่าและภาษาที่เลือกใช้งานล่าสุดอัตโนมัติผ่าน Local Storage
- 🔒 **Privacy-First (100% Client-Side):** การประมวลผลทั้งหมดเกิดขึ้นบนเบราว์เซอร์ของผู้ใช้ ไม่มีการส่งข้อมูลข้อความหรือ URL ไปยังเซิร์ฟเวอร์ภายนอก

---

## 🚀 วิธีการใช้งาน

### 1. การถอดรหัส URL
1. เปิดหน้า `index.html`
2. วางลิงก์ที่ต้องการถอดรหัสลงในช่องค้นหา เช่น:


    
```text
[https://medium.com/@gakungza123/%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%95%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3%E0%B8%AA%E0%B8%99%E0%B9%80%E0%B8%97%E0%B8%A8%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B9%84%E0%B8%A3-44d1fed3b828](https://medium.com/@gakungza123/%E0%B8%82%E0%B9%89%E0%B8%AD%E0%B8%A1%E0%B8%B9%E0%B8%A5%E0%B8%95%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B8%88%E0%B8%B2%E0%B8%81%E0%B8%AA%E0%B8%B2%E0%B8%A3%E0%B8%AA%E0%B8%99%E0%B9%80%E0%B8%97%E0%B8%A8%E0%B8%AD%E0%B8%A2%E0%B9%88%E0%B8%B2%E0%B8%87%E0%B9%84%E0%B8%A3-44d1fed3b828)
```
 


3. กดปุ่ม **"ถอดรหัส"** (หรือกด Enter)
4. คัดลอก URL ฉบับอ่านง่าย หรือดูหน้าตัวอย่างเว็บไซต์ผ่านกล่อง Preview

### 2. การทำความสะอาดข้อความ AI

1. ไปที่เมนู **Clean Text** (`clean-text.html`)
2. วางข้อความที่ได้จากโมเดล AI ลงในกล่องข้อความฝั่งซ้าย
3. ติ๊กเลือกตัวเลือกที่ต้องการทำความสะอาด (เช่น ช่องว่างส่วนเกิน, บรรทัดว่าง, คำฟิลเลอร์ AI)
4. ผลลัพธ์ที่คลีนแล้วจะแสดงผลในกล่องฝั่งขวาทันที กดปุ่ม **"คัดลอก"** เพื่อนำไปใช้งาน

---

## 📁 โครงสร้างโปรเจกต์

```text
LinkLift/
├── index.html              # หน้าหลักสำหรับถอดรหัส URL
├── clean-text.html         # เครื่องมือทำความสะอาดข้อความ AI
├── manifest.json           # การตั้งค่า Progressive Web App (PWA)
├── logo.png                # โลโก้และ Favicon ประจำโปรเจกต์
├── README.md               # เอกสารประกอบโปรเจกต์
├── LICENSE                 # สัญญาอนุญาต MIT
├── fonts/                  # ฟอนต์แบบ Local (IBM Plex Sans Thai)
└── src/
    ├── app.js              # ตรรกะการถอดรหัส URL, Preview, และ i18n
    ├── clean-text.js       # ตรรกะ Regex และการประมวลผลข้อความ AI
    ├── styles.css          # สไตล์หลักและ Tailwind Directives
    ├── clean-text.css      # สไตล์เฉพาะหน้า Clean Text
    └── css/
        └── all.min.css     # Font Awesome Icons

```

---

# 🇺🇸 LinkLift (English)

**LinkLift** is a lightweight, privacy-focused client-side web utility designed to decode URL-encoded links (supporting Thai characters and complex symbols) with live sandboxed web previews, paired with intelligent text cleaning tools tailored for AI-generated outputs.

---

## ✨ Features

* 🔓 **URL Decoder:** Effortlessly converts percent-encoded strings back to clean, human-readable URLs.
* 🌐 **Sandboxed Live Preview:** Safely view destination websites through an interactive sandbox frame.
* 🧹 **AI Text Sanitizer:** Clean up redundant spaces, empty lines, Markdown syntax, emojis, and AI filler phrases from LLM outputs.
* ⚡ **Offline & PWA Ready:** Installable and functional even without an internet connection.
* 🎨 **Sleek Interface:** Minimalist aesthetics featuring soft gradients, glassmorphism, and responsive layouts.
* 💾 **Smart Persistence:** Remembers your selected language and preferences locally via `localStorage`.
* 🔒 **Zero Telemetry:** All decoding and string operations run locally in your browser. No data ever touches a remote backend.

---

## 🚀 Quick Start

1. Clone the repository:
```bash
git clone https://github.com/ShoperGamer/-LinkLift.git
cd -LinkLift
```


2. Serve locally with any static server:
```bash
npm run dev
```


3. Open `http://localhost:5173` in your web browser.

---

## 🛠️ Tech Stack

* **Markup & Styling:** [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML), [Tailwind CSS](https://tailwindcss.com/)
* **Logic & Execution:** Vanilla JavaScript (ES6+ Modules)
* **Typography & Icons:** IBM Plex Sans Thai (Self-hosted), Font Awesome
* **Architecture:** Local-first, Client-side Processing (Zero Server Dependencies)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for full details.

## 🤝 Authors & Credits

Crafted with care by **Shoper Team**

Maintained by **@ShoperGamer, @Charifkub, @Animexo**

