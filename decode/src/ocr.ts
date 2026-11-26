/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import OcrWorker from './Progress-Bar/ocr-worker.ts?worker';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ============================================================================
// 0. Types & Interfaces
// ============================================================================
interface OcrPageRecord {
  pageNum: number;
  text: string;
  durationMs?: number;
}

interface OcrPageDoneResult {
  type: 'OCR_PAGE_DONE';
  pageNum: number;
  text: string;
  durationMs: number;
}

interface ModelPresetOption {
  label: string;
  modelId: string;
  detModelId?: string | null;
  recFileName?: string | null;
  rec2FileName?: string | null;
}

type WorkerOutMessage =
  | { type: 'MODEL_STATUS'; status: string; message: string; device?: string }
  | { type: 'MODEL_PROGRESS'; file: string; loadedBytes: number; totalBytes: number; percent: number }
  | { type: 'MODEL_READY'; modelId: string; device: string; fromCache: boolean }
  | { type: 'CACHE_CLEARED' }
  | OcrPageDoneResult
  | { type: 'ERROR'; message: string };

const MODEL_PRESETS: ModelPresetOption[] = [
  {
    label: 'iapp/OpenThai2.1-OCR-Text-20261118',
    modelId: 'iapp/OpenThai2.1-OCR-Text-20261118',
    detModelId: 'iapp/OpenThai2.1-OCR-Text-20261118',
    recFileName: 'rec.onnx',
    rec2FileName: 'rec2.onnx',
  },
  {
    label: 'dojojin/hippocraft-thai-ocr-rec (hippocraft-thai-rec-v1.onnx)',
    modelId: 'dojojin/hippocraft-thai-ocr-rec',
    detModelId: 'iapp/OpenThai2.1-OCR-Text-20261118',
    recFileName: 'hippocraft-thai-rec-v1.onnx',
    rec2FileName: null,
  },
];

// ============================================================================
// 1. IndexedDB Helper (เก็บผลลัพธ์ทีละหน้า ป้องกันเบราว์เซอร์ค้างเมื่อมี 400+ หน้า)
// ============================================================================
const DB_NAME = 'linklift-ocr-store';
const STORE_NAME = 'pages';

function openOcrDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'pageNum' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbClearPages(): Promise<void> {
  const db = await openOcrDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPutPage(record: OcrPageRecord): Promise<void> {
  const db = await openOcrDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAllPages(): Promise<OcrPageRecord[]> {
  const db = await openOcrDB();
  return new Promise<OcrPageRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const items = (req.result as OcrPageRecord[]) || [];
      resolve(items.sort((a, b) => a.pageNum - b.pageNum));
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// 2. DOM References & Application State
// ============================================================================
function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`ไม่พบ Element #${id} ในหน้า HTML`);
  }
  return el as T;
}

const els = {
  badgeDevice: getEl<HTMLSpanElement>('badge-device'),
  badgeCache: getEl<HTMLSpanElement>('badge-cache'),
  hfModelId: getEl<HTMLInputElement>('hf-model-id'),
  hfPresetSelect: getEl<HTMLSelectElement>('hf-preset-select'),
  btnLoadModel: getEl<HTMLButtonElement>('btn-load-model'),
  btnClearCache: getEl<HTMLButtonElement>('btn-clear-cache'),
  modelProgressBox: getEl<HTMLDivElement>('model-progress-box'),
  modelStatusText: getEl<HTMLSpanElement>('model-status-text'),
  modelPercentText: getEl<HTMLSpanElement>('model-percent-text'),
  modelProgressBar: getEl<HTMLDivElement>('model-progress-bar'),
  modelFileName: getEl<HTMLSpanElement>('model-file-name'),
  modelBytesText: getEl<HTMLSpanElement>('model-bytes-text'),

  dropZone: getEl<HTMLDivElement>('drop-zone'),
  fileInput: getEl<HTMLInputElement>('file-input'),
  selectedFileLabel: getEl<HTMLParagraphElement>('selected-file-label'),
  optPdfScale: getEl<HTMLInputElement>('opt-pdf-scale'),
  optPdfScaleVal: getEl<HTMLSpanElement>('opt-pdf-scale-val'),
  btnStartOcr: getEl<HTMLButtonElement>('btn-start-ocr'),
  btnCancelOcr: getEl<HTMLButtonElement>('btn-cancel-ocr'),

  ocrSpinner: getEl<HTMLSpanElement>('ocr-spinner'),
  ocrPhaseLabel: getEl<HTMLSpanElement>('ocr-phase-label'),
  ocrCounterLabel: getEl<HTMLSpanElement>('ocr-counter-label'),
  ocrPercentLabel: getEl<HTMLSpanElement>('ocr-percent-label'),
  ocrProgressBar: getEl<HTMLDivElement>('ocr-progress-bar'),
  statElapsed: getEl<HTMLSpanElement>('stat-elapsed'),
  statEta: getEl<HTMLSpanElement>('stat-eta'),
  statSpeed: getEl<HTMLSpanElement>('stat-speed'),
  statLastPage: getEl<HTMLSpanElement>('stat-last-page'),

  outputInfoBadge: getEl<HTMLSpanElement>('output-info-badge'),
  ocrOutputText: getEl<HTMLTextAreaElement>('ocr-output-text'),
  btnCopyAll: getEl<HTMLButtonElement>('btn-copy-all'),
  btnDownloadTxt: getEl<HTMLButtonElement>('btn-download-txt'),
  btnDownloadMd: getEl<HTMLButtonElement>('btn-download-md'),
  btnClearOutput: getEl<HTMLButtonElement>('btn-clear-output'),
};

function syncPresetDropdownOptions(): void {
  const existingValues = new Set(Array.from(els.hfPresetSelect.options).map((o) => o.value));
  for (const preset of MODEL_PRESETS) {
    if (!existingValues.has(preset.modelId)) {
      const opt = document.createElement('option');
      opt.value = preset.modelId;
      opt.textContent = preset.label;
      els.hfPresetSelect.appendChild(opt);
    }
  }
}

syncPresetDropdownOptions();

interface AppState {
  isModelReady: boolean;
  isProcessing: boolean;
  isCancelled: boolean;
  tableExtractionEnabled: boolean;
  selectedFiles: File[];
  totalPages: number;
  completedPages: number;
  lastPageMs: number;
  startTimeMs: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  modelHideTimeout: ReturnType<typeof setTimeout> | null;
  previewChunks: string[];
}

const state: AppState = {
  isModelReady: false,
  isProcessing: false,
  isCancelled: false,
  tableExtractionEnabled: true,
  selectedFiles: [],
  totalPages: 0,
  completedPages: 0,
  lastPageMs: 0,
  startTimeMs: 0,
  timerInterval: null,
  modelHideTimeout: null,
  previewChunks: [],
};

function clearModelHideTimer(): void {
  if (state.modelHideTimeout !== null) {
    clearTimeout(state.modelHideTimeout);
    state.modelHideTimeout = null;
  }
}

function hideModelProgressBox(): void {
  clearModelHideTimer();
  els.modelProgressBox.classList.add('hidden');
}

function scheduleHideModelProgressBox(delayMs = 600): void {
  clearModelHideTimer();
  state.modelHideTimeout = setTimeout(() => {
    state.modelHideTimeout = null;
    els.modelProgressBox.classList.add('hidden');
  }, delayMs);
}

// ============================================================================
// 2B. Download Filename Pop-up Modal (ค่าเริ่มต้น: thaiocr-วัน-เดือน-ปี)
// ============================================================================
function getDefaultThaiOcrBaseName(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `thaiocr-${dd}-${mm}-${yyyy}`;
}

function sanitizeFileBaseName(rawName: string, fallback: string): string {
  const cleaned = rawName
    .trim()
    .replace(/\.(txt|md)$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

interface DownloadModalEls {
  backdrop: HTMLDivElement;
  titleEl: HTMLHeadingElement;
  extBadgeEl: HTMLSpanElement;
  inputEl: HTMLInputElement;
  btnConfirm: HTMLButtonElement;
  btnCancel: HTMLButtonElement;
  btnClose: HTMLButtonElement;
}

let downloadModalEls: DownloadModalEls | null = null;
let activeDownloadResolver: ((fileName: string | null) => void) | null = null;

function ensureDownloadModal(): DownloadModalEls {
  if (downloadModalEls) return downloadModalEls;

  const backdrop = document.createElement('div');
  backdrop.id = 'ocr-download-modal-backdrop';
  backdrop.className =
    'fixed inset-0 z-50 hidden items-center justify-center bg-black/75 backdrop-blur-xs p-4';

  backdrop.innerHTML = `
    <div
      id="ocr-download-modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-download-modal-title"
      class="w-full max-w-md rounded-2xl bg-slate-950 border border-cyan-500/30 shadow-2xl p-5 text-slate-100 space-y-4"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <h3 id="ocr-download-modal-title" class="text-base font-semibold text-white">
            ตั้งชื่อไฟล์ก่อนดาวน์โหลด
          </h3>
          <span
            id="ocr-download-ext-badge"
            class="px-2 py-0.5 text-xs font-mono rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-300"
          >.txt</span>
        </div>
        <button
          id="ocr-download-modal-close"
          type="button"
          aria-label="ปิดหน้าต่าง"
          class="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
        >✕</button>
      </div>

      <div class="space-y-1.5">
        <label for="ocr-download-filename-input" class="block text-xs text-slate-300">
          ชื่อไฟล์ (ระบบจะเติมนามสกุลให้อัตโนมัติหากยังไม่ได้ใส่)
        </label>
        <input
          id="ocr-download-filename-input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 focus:border-cyan-400 focus:outline-none text-sm font-mono text-white"
        />
        <p class="text-[11px] text-slate-400">
          ค่าเริ่มต้น: <span id="ocr-download-default-hint" class="font-mono text-cyan-300"></span>
        </p>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          id="ocr-download-modal-cancel"
          type="button"
          class="px-4 py-2 rounded-xl text-sm bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 transition"
        >ยกเลิก</button>
        <button
          id="ocr-download-modal-confirm"
          type="button"
          class="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition"
        >ดาวน์โหลด</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const refs: DownloadModalEls = {
    backdrop,
    titleEl: backdrop.querySelector('#ocr-download-modal-title') as HTMLHeadingElement,
    extBadgeEl: backdrop.querySelector('#ocr-download-ext-badge') as HTMLSpanElement,
    inputEl: backdrop.querySelector('#ocr-download-filename-input') as HTMLInputElement,
    btnConfirm: backdrop.querySelector('#ocr-download-modal-confirm') as HTMLButtonElement,
    btnCancel: backdrop.querySelector('#ocr-download-modal-cancel') as HTMLButtonElement,
    btnClose: backdrop.querySelector('#ocr-download-modal-close') as HTMLButtonElement,
  };

  const closeWith = (value: string | null) => {
    backdrop.classList.add('hidden');
    backdrop.classList.remove('flex');
    const resolver = activeDownloadResolver;
    activeDownloadResolver = null;
    if (resolver) resolver(value);
  };

  refs.btnConfirm.addEventListener('click', () => {
    const ext = refs.extBadgeEl.textContent?.trim() || '.txt';
    const fallback = getDefaultThaiOcrBaseName();
    const base = sanitizeFileBaseName(refs.inputEl.value, fallback);
    closeWith(`${base}${ext}`);
  });

  refs.btnCancel.addEventListener('click', () => closeWith(null));
  refs.btnClose.addEventListener('click', () => closeWith(null));

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeWith(null);
  });

  refs.inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      refs.btnConfirm.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeWith(null);
    }
  });

  downloadModalEls = refs;
  return refs;
}

function promptDownloadFilename(ext: '.txt' | '.md'): Promise<string | null> {
  const modal = ensureDownloadModal();
  const defaultBase = getDefaultThaiOcrBaseName();

  if (activeDownloadResolver) {
    const prev = activeDownloadResolver;
    activeDownloadResolver = null;
    prev(null);
  }

  modal.extBadgeEl.textContent = ext;
  modal.titleEl.textContent = `ตั้งชื่อไฟล์ก่อนดาวน์โหลด (${ext.toUpperCase()})`;
  const hintEl = modal.backdrop.querySelector('#ocr-download-default-hint');
  if (hintEl) hintEl.textContent = `${defaultBase}${ext}`;

  modal.inputEl.value = defaultBase;
  modal.backdrop.classList.remove('hidden');
  modal.backdrop.classList.add('flex');

  return new Promise<string | null>((resolve) => {
    activeDownloadResolver = resolve;
    requestAnimationFrame(() => {
      modal.inputEl.focus();
      modal.inputEl.select();
    });
  });
}

// ============================================================================
// 3. Web Worker Setup & Model Caching
// ============================================================================
const ocrWorker = new OcrWorker();

let pendingOcrResolver: ((value: OcrPageDoneResult) => void) | null = null;
let pendingOcrRejecter: ((reason?: unknown) => void) | null = null;

function mountTableExtractionToggle(): void {
  if (document.getElementById('opt-extract-tables')) return;
  const scaleRow = els.optPdfScale.parentElement;
  if (!scaleRow) return;

  const wrapper = document.createElement('label');
  wrapper.className =
    'mt-3 flex items-center justify-between gap-2 pt-3 border-t border-white/10 text-xs text-slate-300 cursor-pointer select-none';
  wrapper.innerHTML = `
    <span>ถอดโครงสร้างตารางอัตโนมัติ (Markdown Table)</span>
    <input
      id="opt-extract-tables"
      type="checkbox"
      checked
      class="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
    />
  `;

  scaleRow.insertAdjacentElement('afterend', wrapper);
  const checkbox = wrapper.querySelector('#opt-extract-tables') as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    state.tableExtractionEnabled = checkbox.checked;
    ocrWorker.postMessage({
      type: 'SET_OPTIONS',
      tableEnabled: state.tableExtractionEnabled,
    });
  });
}

mountTableExtractionToggle();

function settlePendingOcrError(err: Error): boolean {
  if (pendingOcrRejecter) {
    const reject = pendingOcrRejecter;
    pendingOcrResolver = null;
    pendingOcrRejecter = null;
    reject(err);
    return true;
  }
  return false;
}

ocrWorker.addEventListener('error', (err: ErrorEvent) => {
  console.error('OCR Worker Fatal Error:', err);
  const detail =
    err.message ||
    (err.filename ? `${err.filename}:${err.lineno}` : 'ไม่สามารถโหลดสคริปต์ Web Worker ได้');

  clearModelHideTimer();
  els.btnLoadModel.disabled = false;
  els.btnLoadModel.classList.remove('opacity-60');
  els.modelProgressBox.classList.remove('hidden');
  els.modelStatusText.textContent = `Worker Error: ${detail}`;

  settlePendingOcrError(new Error(detail));
});

ocrWorker.addEventListener('message', (event: MessageEvent<WorkerOutMessage>) => {
  const data = event.data;

  if (data.type === 'MODEL_STATUS') {
    clearModelHideTimer();
    els.modelProgressBox.classList.remove('hidden');
    els.modelStatusText.textContent = data.message;
    if (data.device) {
      els.badgeDevice.textContent = `Device: ${data.device.toUpperCase()}`;
    }
  } else if (data.type === 'MODEL_PROGRESS') {
    clearModelHideTimer();
    els.modelProgressBox.classList.remove('hidden');
    const pct = data.percent.toFixed(1);
    const loadedMB = (data.loadedBytes / (1024 * 1024)).toFixed(2);
    const totalMB = (data.totalBytes / (1024 * 1024)).toFixed(2);

    els.modelStatusText.textContent = 'กำลังโหลดไฟล์โมเดล...';
    els.modelPercentText.textContent = `${pct}%`;
    els.modelProgressBar.style.width = `${pct}%`;
    els.modelFileName.textContent = data.file;
    els.modelBytesText.textContent =
      data.totalBytes > 0 ? `${loadedMB} MB / ${totalMB} MB` : `${loadedMB} MB`;
  } else if (data.type === 'MODEL_READY') {
    state.isModelReady = true;
    els.btnLoadModel.disabled = false;
    els.btnLoadModel.classList.remove('opacity-60');

    els.badgeDevice.textContent = `Device: ${data.device.toUpperCase()}`;
    els.badgeDevice.className =
      'px-2.5 py-1 rounded-md bg-emerald-950/70 border border-emerald-500/30 text-emerald-300';

    els.badgeCache.textContent = data.fromCache
      ? 'Cache: โหลดจาก Cache สำเร็จ'
      : 'Cache: บันทึกลง Cache แล้ว';
    els.badgeCache.className =
      'px-2.5 py-1 rounded-md bg-cyan-950/70 border border-cyan-500/30 text-cyan-300';

    els.modelProgressBox.classList.remove('hidden');
    els.modelStatusText.textContent = data.fromCache
      ? `พร้อมใช้งานทันทีจาก Cache (${data.modelId})`
      : `โหลดและแคชโมเดลสำเร็จ (${data.modelId})`;
    els.modelPercentText.textContent = '100%';
    els.modelProgressBar.style.width = '100%';

    updateStartButtonState();
    scheduleHideModelProgressBox(650);
  } else if (data.type === 'CACHE_CLEARED') {
    state.isModelReady = false;
    els.badgeCache.textContent = 'Cache: ล้างแล้ว';
    els.badgeCache.className =
      'px-2.5 py-1 rounded-md bg-slate-900 border border-white/10 text-slate-300';
    els.modelPercentText.textContent = '0%';
    els.modelProgressBar.style.width = '0%';
    els.modelFileName.textContent = '';
    els.modelBytesText.textContent = '';
    hideModelProgressBox();
    updateStartButtonState();
  } else if (data.type === 'OCR_PAGE_DONE') {
    if (pendingOcrResolver) {
      const resolve = pendingOcrResolver;
      pendingOcrResolver = null;
      pendingOcrRejecter = null;
      resolve(data);
    }
  } else if (data.type === 'ERROR') {
    clearModelHideTimer();
    els.btnLoadModel.disabled = false;
    els.btnLoadModel.classList.remove('opacity-60');
    els.modelProgressBox.classList.remove('hidden');
    els.modelStatusText.textContent = `เกิดข้อผิดพลาด: ${data.message}`;
    if (!settlePendingOcrError(new Error(data.message))) {
      alert(`ข้อผิดพลาดจาก OCR Worker:\n${data.message}`);
    }
  }
});

function runOcrInWorker(pageNum: number, bitmap: ImageBitmap): Promise<OcrPageDoneResult> {
  if (pendingOcrRejecter) {
    bitmap.close();
    return Promise.reject(new Error('มีงาน OCR กำลังทำงานอยู่'));
  }

  return new Promise<OcrPageDoneResult>((resolve, reject) => {
    pendingOcrResolver = resolve;
    pendingOcrRejecter = reject;
    try {
      ocrWorker.postMessage({ type: 'RUN_OCR', pageNum, bitmap }, [bitmap]);
    } catch (err) {
      pendingOcrResolver = null;
      pendingOcrRejecter = null;
      bitmap.close();
      reject(err);
    }
  });
}

// ============================================================================
// 4. Real-Time Telemetry & Progress Bar Updates
// ============================================================================
function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateRealTimeProgress(phaseText: string): void {
  const total = state.totalPages;
  const done = state.completedPages;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  els.ocrPhaseLabel.textContent = phaseText;
  els.ocrCounterLabel.textContent = `${done} / ${total} หน้า`;
  els.ocrPercentLabel.textContent = `${pct.toFixed(1)}%`;
  els.ocrProgressBar.style.width = `${pct}%`;

  if (state.lastPageMs > 0) {
    els.statLastPage.textContent = `${(state.lastPageMs / 1000).toFixed(2)} วิ`;
  }

  const elapsedSec = (performance.now() - state.startTimeMs) / 1000;
  els.statElapsed.textContent = formatSeconds(elapsedSec);

  if (done > 0 && elapsedSec > 0) {
    const avgSecPerPage = elapsedSec / done;
    const remainingPages = Math.max(0, total - done);
    const etaSec = remainingPages * avgSecPerPage;
    els.statSpeed.textContent = `${avgSecPerPage.toFixed(2)} วิ/หน้า`;
    els.statEta.textContent = remainingPages === 0 ? '00:00' : formatSeconds(etaSec);
  }
}

async function handlePageCompleted(pageNum: number, text: string, durationMs: number): Promise<void> {
  state.completedPages += 1;
  state.lastPageMs = durationMs;

  await dbPutPage({
    pageNum,
    text,
    durationMs,
  });

  const block = `--- หน้า ${pageNum} ---\n${text || '(ไม่พบข้อความในหน้านี้)'}`;
  state.previewChunks.push(block);

  if (state.previewChunks.length <= 80) {
    els.ocrOutputText.value = state.previewChunks.join('\n\n');
  } else {
    const recent = state.previewChunks.slice(-80).join('\n\n');
    els.ocrOutputText.value = `[แสดง 80 หน้าล่าสุดจากทั้งหมด ${state.completedPages} หน้า — กดดาวน์โหลด .TXT หรือ .MD เพื่อรับข้อมูลครบทุกหน้า]\n\n${recent}`;
  }
  els.ocrOutputText.scrollTop = els.ocrOutputText.scrollHeight;

  updateRealTimeProgress(
    state.completedPages >= state.totalPages
      ? 'ถอดข้อความเสร็จสมบูรณ์'
      : `กำลังประมวลผลหน้า ${state.completedPages + 1} / ${state.totalPages}...`
  );
}

// ============================================================================
// 5. Streaming Producer-Consumer Pipeline (สำหรับ PDF 400+ หน้า และรูปภาพ)
// ============================================================================
async function processPdfFile(pdfFile: File): Promise<void> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  state.totalPages = pdf.numPages;

  const MAX_BUFFER_SIZE = 3;
  const renderQueue: Array<{ pageNum: number; bitmap: ImageBitmap }> = [];
  let isRenderingDone = false;
  const scale = parseFloat(els.optPdfScale.value) || 2.75;

  updateRealTimeProgress(`เริ่มต้นอ่าน PDF ทั้งหมด ${state.totalPages} หน้า...`);

  const producer = (async () => {
    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
      if (state.isCancelled) break;

      while (renderQueue.length >= MAX_BUFFER_SIZE && !state.isCancelled) {
        await new Promise<void>((r) => setTimeout(r, 25));
      }
      if (state.isCancelled) break;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        page.cleanup();
        throw new Error('ไม่สามารถสร้าง OffscreenCanvas 2D context ได้');
      }

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      } as Parameters<typeof page.render>[0]).promise;

      const bitmap = canvas.transferToImageBitmap();
      renderQueue.push({ pageNum, bitmap });
      page.cleanup();
    }
    isRenderingDone = true;
  })();

  const consumer = (async () => {
    while ((!isRenderingDone || renderQueue.length > 0) && !state.isCancelled) {
      const item = renderQueue.shift();
      if (!item) {
        await new Promise<void>((r) => setTimeout(r, 20));
        continue;
      }

      const res = await runOcrInWorker(item.pageNum, item.bitmap);
      await handlePageCompleted(item.pageNum, res.text, res.durationMs);
    }

    while (renderQueue.length > 0) {
      const leftover = renderQueue.shift();
      if (leftover) {
        try {
          leftover.bitmap.close();
        } catch {
          // ignore
        }
      }
    }
  })();

  await Promise.all([producer, consumer]);
}

async function processImageFiles(imageFiles: File[]): Promise<void> {
  state.totalPages = imageFiles.length;
  updateRealTimeProgress(`กำลังประมวลผลรูปภาพ ${state.totalPages} ไฟล์...`);

  for (let i = 0; i < imageFiles.length; i++) {
    if (state.isCancelled) break;
    const pageNum = i + 1;
    const bitmap = await createImageBitmap(imageFiles[i]);
    const res = await runOcrInWorker(pageNum, bitmap);
    await handlePageCompleted(pageNum, res.text, res.durationMs);
  }
}

async function startProcessing(): Promise<void> {
  if (!state.isModelReady || state.selectedFiles.length === 0 || state.isProcessing) return;

  state.isProcessing = true;
  state.isCancelled = false;
  state.totalPages = 0;
  state.completedPages = 0;
  state.lastPageMs = 0;
  state.previewChunks = [];
  state.startTimeMs = performance.now();

  await dbClearPages();
  els.ocrOutputText.value = '';
  els.statLastPage.textContent = '- วิ';
  els.statSpeed.textContent = '- วิ/หน้า';
  els.statEta.textContent = '--:--';
  els.btnStartOcr.disabled = true;
  els.btnCancelOcr.classList.remove('hidden');
  els.ocrSpinner.classList.remove('hidden');

  state.timerInterval = setInterval(() => {
    if (state.isProcessing) {
      const elapsedSec = (performance.now() - state.startTimeMs) / 1000;
      els.statElapsed.textContent = formatSeconds(elapsedSec);
    }
  }, 500);

  try {
    const pdfFile = state.selectedFiles.find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFile) {
      await processPdfFile(pdfFile);
    } else {
      await processImageFiles(state.selectedFiles);
    }

    if (state.isCancelled) {
      els.ocrPhaseLabel.textContent = `หยุดการทำงานแล้ว (เสร็จไป ${state.completedPages} หน้า)`;
    } else {
      updateRealTimeProgress('ถอดข้อความเสร็จสมบูรณ์ 100%');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('OCR Processing Error:', err);
    els.ocrPhaseLabel.textContent = `เกิดข้อผิดพลาด: ${message}`;
  } finally {
    state.isProcessing = false;
    if (state.timerInterval !== null) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    els.ocrSpinner.classList.add('hidden');
    els.btnCancelOcr.classList.add('hidden');
    updateStartButtonState();
  }
}

// ============================================================================
// 6. UI Event Listeners & Export Functions
// ============================================================================
function updateStartButtonState(): void {
  els.btnStartOcr.disabled = !(
    state.isModelReady &&
    state.selectedFiles.length > 0 &&
    !state.isProcessing
  );
}

function triggerLoadModel(): void {
  const modelId = els.hfModelId.value.trim();
  if (!modelId) {
    alert('กรุณาระบุแหล่งโมเดล');
    return;
  }
  clearModelHideTimer();
  els.btnLoadModel.disabled = true;
  els.btnLoadModel.classList.add('opacity-60');
  els.modelPercentText.textContent = '0%';
  els.modelProgressBar.style.width = '0%';
  els.modelFileName.textContent = '';
  els.modelBytesText.textContent = '';

  const isLocalPath = modelId.startsWith('./') || modelId.startsWith('/');
  const modelsBaseUrl = isLocalPath
    ? new URL(modelId.endsWith('/') ? modelId : `${modelId}/`, window.location.href).href
    : null;

  const matchedPreset = MODEL_PRESETS.find((p) => p.modelId === modelId);
  const recFileName = matchedPreset?.recFileName ?? null;
  const detModelId = matchedPreset?.detModelId ?? null;
  const rec2FileName = matchedPreset ? (matchedPreset.rec2FileName ?? null) : undefined;

  ocrWorker.postMessage({
    type: 'LOAD_MODEL',
    modelId,
    modelsBaseUrl,
    recFileName,
    detModelId,
    rec2FileName,
  });
}

function handleFilesSelected(fileList: FileList | null | undefined): void {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  state.selectedFiles = files;
  if (files.length === 1) {
    const sizeMB = (files[0].size / (1024 * 1024)).toFixed(2);
    els.selectedFileLabel.textContent = `เลือกไฟล์: ${files[0].name} (${sizeMB} MB)`;
  } else {
    els.selectedFileLabel.textContent = `เลือกไฟล์รูปภาพทั้งหมด ${files.length} ไฟล์`;
  }
  updateStartButtonState();
}

els.hfPresetSelect.addEventListener('change', () => {
  els.hfModelId.value = els.hfPresetSelect.value;
  state.isModelReady = false;
  updateStartButtonState();
});

els.hfModelId.addEventListener('input', () => {
  state.isModelReady = false;
  updateStartButtonState();
});

els.btnLoadModel.addEventListener('click', triggerLoadModel);

els.btnClearCache.addEventListener('click', () => {
  if (confirm('ต้องการล้างไฟล์โมเดลที่แคชไว้ในเบราว์เซอร์ทั้งหมดหรือไม่?')) {
    clearModelHideTimer();
    ocrWorker.postMessage({ type: 'CLEAR_CACHE' });
  }
});

els.optPdfScale.addEventListener('input', () => {
  els.optPdfScaleVal.textContent = `${parseFloat(els.optPdfScale.value).toFixed(2)}x`;
});

els.dropZone.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLInputElement | null;
  handleFilesSelected(target?.files);
});

els.dropZone.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  els.dropZone.classList.add('drag-over');
});
els.dropZone.addEventListener('dragleave', () => {
  els.dropZone.classList.remove('drag-over');
});
els.dropZone.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  els.dropZone.classList.remove('drag-over');
  handleFilesSelected(e.dataTransfer?.files);
});

els.btnStartOcr.addEventListener('click', startProcessing);
els.btnCancelOcr.addEventListener('click', () => {
  state.isCancelled = true;
  els.ocrPhaseLabel.textContent = 'กำลังหยุดการทำงาน...';
});

async function buildFullDocumentString(format: 'txt' | 'md'): Promise<string> {
  const pages = await dbGetAllPages();
  if (pages.length === 0) return els.ocrOutputText.value;

  if (format === 'md') {
    return pages
      .map((p) => `## หน้า ${p.pageNum}\n\n${p.text || '_ไม่พบข้อความ_'}`)
      .join('\n\n---\n\n');
  }
  return pages
    .map((p) => `=== หน้า ${p.pageNum} ===\n${p.text || ''}`)
    .join('\n\n');
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

els.btnCopyAll.addEventListener('click', async () => {
  const fullText = await buildFullDocumentString('txt');
  if (!fullText) return;
  await navigator.clipboard.writeText(fullText);
  const orig = els.btnCopyAll.textContent;
  els.btnCopyAll.textContent = 'คัดลอกแล้ว!';
  setTimeout(() => {
    els.btnCopyAll.textContent = orig;
  }, 1500);
});

els.btnDownloadTxt.addEventListener('click', async () => {
  const content = await buildFullDocumentString('txt');
  if (!content) return;
  const filename = await promptDownloadFilename('.txt');
  if (!filename) return;
  triggerDownload(content, filename, 'text/plain;charset=utf-8');
});

els.btnDownloadMd.addEventListener('click', async () => {
  const content = await buildFullDocumentString('md');
  if (!content) return;
  const filename = await promptDownloadFilename('.md');
  if (!filename) return;
  triggerDownload(content, filename, 'text/markdown;charset=utf-8');
});

els.btnClearOutput.addEventListener('click', async () => {
  await dbClearPages();
  state.previewChunks = [];
  state.completedPages = 0;
  state.totalPages = 0;
  state.lastPageMs = 0;
  els.ocrOutputText.value = '';
  els.ocrProgressBar.style.width = '0%';
  els.ocrPercentLabel.textContent = '0.0%';
  els.ocrCounterLabel.textContent = '0 / 0 หน้า';
  els.statLastPage.textContent = '- วิ';
  els.statSpeed.textContent = '- วิ/หน้า';
  els.statEta.textContent = '--:--';
  els.statElapsed.textContent = '00:00';
  els.ocrPhaseLabel.textContent = 'พร้อมทำงาน';
});

(async function initPage() {
  try {
    const savedPages = await dbGetAllPages();
    if (savedPages.length > 0) {
      state.previewChunks = savedPages.map((p) => `--- หน้า ${p.pageNum} ---\n${p.text}`);
      els.ocrOutputText.value = state.previewChunks.slice(-80).join('\n\n');
      els.outputInfoBadge.textContent = `(กู้คืนข้อมูลเดิม ${savedPages.length} หน้าจาก IndexedDB)`;
    }
  } catch {
    // ignore IndexedDB errors
  }

  triggerLoadModel();
})();