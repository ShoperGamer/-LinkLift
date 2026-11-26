/// <reference types="vite/client" />
import * as ort from 'onnxruntime-web/wasm';
import ortMjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';

interface FileProgressEntry {
  loaded: number;
  total: number;
}

interface ProgressState {
  networkDownloaded: boolean;
  files: Record<string, FileProgressEntry>;
}

interface RectBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface RecResult {
  text: string;
  conf: number;
  turned: boolean;
}

interface PageContentBlock {
  y0: number;
  y1: number;
  text: string;
  isTable: boolean;
}

interface RowCellSegment {
  x0: number;
  x1: number;
  text: string;
}

interface ParsedRowInfo {
  y0: number;
  y1: number;
  segments: RowCellSegment[];
  plainText: string;
}

type WorkerInMessage =
  | {
      type: 'LOAD_MODEL';
      modelId: string;
      modelsBaseUrl?: string | null;
      recFileName?: string | null;
      detModelId?: string | null;
      rec2FileName?: string | null;
    }
  | { type: 'RUN_OCR'; pageNum: number; bitmap: ImageBitmap }
  | { type: 'SET_OPTIONS'; tableEnabled?: boolean }
  | { type: 'CLEAR_CACHE' };

const DEFAULT_BASE_MODEL_ID = 'iapp/OpenThai2.1-OCR-Text-20261118';
const ORT_WASM_HF_URL =
  'https://huggingface.co/ShoperGamer/linklift-thaiocr/resolve/main/ort-wasm-simd-threaded.wasm';

const CFG = {
  det: {
    limit: 1600,
    thresh: 0.2,
    boxThresh: 0.4,
    unclip: 1.45,
    minSize: 3,
    maxCandidates: 3000,
    splitGap: 1.2,
  },
  rec: {
    height: 48,
    maxW: 3200,
    dropBelow: 0.78,
    junkBelow: 0.9,
    junkInvalid: 0.05,
    minChars: 2,
    minCharsDigits: 1,
    minCharsDigitsHeight: 0.62,
    minCharsLatin: true,
  },
  rec2: {
    minMixed: 1,
    lowConfTrigger: 0.9,
  },
  marks: {
    enabled: true,
    maxGap: 0.35,
    maxExt: 0.9,
    maxHeight: 0.9,
    margin: 0.0,
    pageShare: 0.25,
    pageMin: 3,
    keepBase: true,
  },
  cols: {
    listRep: 0.6,
    listFacing: 0.0,
    listMaxW: 10.0,
    listEnum: 0.0,
  },
  join: {
    decimalComma: true,
    paragraphs: true,
    paragraphGap: 1.0,
  },
  table: {
    enabled: true,
    colGapMultiplier: 1.35,
    minColGapPx: 16,
    maxRowGapMultiplier: 2.6,
    minBorderlessRows: 2,
  },
};

const CACHE_NAME = 'openthai-ocr-models-v2';

let detSession: ort.InferenceSession | null = null;
let recSession: ort.InferenceSession | null = null;
let rec2Session: ort.InferenceSession | null = null;
let charList: string[] = [''];
let loadedModelKey: string | null = null;
let cachedOrtWasmBlobUrl: string | null = null;

// ============================================================================
// 0. thai_norm.py + Script & Thai OCR Post-Processing Helpers
// ============================================================================
const PUA_MAP: Record<number, number> = {
  0xf700: 0x0e10, 0xf701: 0x0e34, 0xf702: 0x0e35, 0xf703: 0x0e36, 0xf704: 0x0e37,
  0xf705: 0x0e48, 0xf706: 0x0e49, 0xf707: 0x0e4a, 0xf708: 0x0e4b, 0xf709: 0x0e4c,
  0xf70a: 0x0e48, 0xf70b: 0x0e49, 0xf70c: 0x0e4a, 0xf70d: 0x0e4b, 0xf70e: 0x0e4c,
  0xf70f: 0x0e0d, 0xf710: 0x0e31, 0xf711: 0x0e4d, 0xf712: 0x0e47, 0xf713: 0x0e48,
  0xf714: 0x0e49, 0xf715: 0x0e4a, 0xf716: 0x0e4b, 0xf717: 0x0e4c, 0xf718: 0x0e38,
  0xf719: 0x0e39, 0xf71a: 0x0e3a,
};
const DROP_CODES = new Set([0x200b, 0x200c, 0x200d, 0x2060, 0x00ad, 0xfeff]);
const VOWEL_MARKS = new Set('ัิีึืฺุู็');
const TONE_MARKS = new Set('่้๊๋์๎');
const ALL_MARKS_SET = new Set('\u0e31\u0e34\u0e35\u0e36\u0e37\u0e38\u0e39\u0e3a\u0e47\u0e48\u0e49\u0e4a\u0e4b\u0e4c\u0e4d\u0e4e');
const LEADING_SET = new Set('\u0e40\u0e41\u0e42\u0e43\u0e44');
const DIGITS_SET = new Set('0123456789๐๑๒๓๔๕๖๗๘๙');
const LATIN_SET = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');

const MARK_RUN_RE = /[ัิีึืฺุู็่้๊๋์๎ํ]{2,}/g;
const SARA_AM_RE = /([่-๋]?)ํ([่-๋]?)า/g;
const SPACES_RE = /[ \t\f\v]+/g;
const LONE_W_RE = /(?<![A-Za-z])[Ww](?=\.?[\u0e01-\u0e2e\u0e40-\u0e44])/g;
const ZERO_IN_THAI_RE = /(?<=[๐-๙])[Oo0]|[Oo0](?=[๐-๙])/g;
const DECIMAL_COMMA_RE = /(?<![\d.,])(\d{1,3}(?:,\d{3})*),(\d{2})(?![\d.,])/g;
const MARK_STRIP_RE = /[ัิ-ฺ็-๎\s]/g;
const ENUM_RE = /^\s*\(?([0-9๐-๙]{1,4})\s*[.)]/;
const DIGIT_RUN_RE = /[0-9\u0e50-\u0e59]+/g;

function canonical(input: string): string {
  if (!input) return '';
  let translated = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (DROP_CODES.has(code)) continue;
    if (code === 0x00a0) {
      translated += ' ';
    } else if (PUA_MAP[code] !== undefined) {
      translated += String.fromCharCode(PUA_MAP[code]);
    } else {
      translated += input[i];
    }
  }

  let text = translated.normalize('NFC');
  text = text.replace(MARK_RUN_RE, (run) => {
    const sorted = Array.from(run).sort((a, b) => {
      const ka = VOWEL_MARKS.has(a) ? 0 : TONE_MARKS.has(a) ? 1 : 2;
      const kb = VOWEL_MARKS.has(b) ? 0 : TONE_MARKS.has(b) ? 1 : 2;
      return ka - kb;
    });
    const out: string[] = [];
    for (const ch of sorted) {
      if (out.length === 0 || out[out.length - 1] !== ch) out.push(ch);
    }
    return out.join('');
  });

  text = text.replace(SARA_AM_RE, (_, g1: string, g2: string) => `${g1}${g2}ำ`);
  text = text.replace(/\u0e40\u0e40/g, '\u0e41').replace(/\u0e33\u0e33/g, '\u0e33');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return text
    .split('\n')
    .map((line) => line.replace(SPACES_RE, ' ').trim())
    .join('\n')
    .trim();
}

function fixScripts(text: string): string {
  return text
    .replace(LONE_W_RE, 'พ')
    .replace(ZERO_IN_THAI_RE, '๐')
    .replace(/(?<![A-Za-z])S(?=[ะาำิีึืุูเแโใไ่้๊๋์ก-ฮ])/g, 'ร')
    .replace(/(?<![A-Za-z])n(?=[ะาำิีึืุูเแโใไ่้๊๋์ก-ฮ])/g, 'ท')
    .replace(/(?<![A-Za-z])U(?=[ะาำิีึืุูเแโใไก-ฮ])/g, 'บ')
    .replace(/เพรารeะไร/g, 'เพราะอะไร')
    .replace(/([ก-ฮ])รeะ/g, '$1ะอ')
    .replace(/([ก-ฮ])e([ัิีึืุูเแโใไะา])/g, '$1อ$2');
}

function postProcessThaiOcr(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bForn\b/g, 'Form')
    .replace(/\bAl\b/g, 'AI')
    .replace(/\bAl(?=[-ก-๛])/g, 'AI')
    .replace(/\b0Queue\b/g, 'Queue')
    .replace(/\b(?:OR|OQR)\s+PromptPay\b/gi, 'QR PromptPay')
    .replace(/(?:AIS\s+)?38[B8]\b/g, '3BB')
    .replace(/(?<![A-Za-z0-9])AS(?=\s+(?:Fibre|Cloud|Academy|HUB|มี|และ|เป็น|กำลัง|ถือ|ใช้|จะ|ได้))/g, 'AIS')
    .replace(/(?<![.\dก-๛])มคอ(?![.\dก-๛])/g, 'มคอ.')
    .replace(/(อะไร|ทำไม|อย่างไร|ยังไง|หรือไม่|ไหม|หรือเปล่า|ที่ไหน|เมื่อไร|ใคร|เท่าไร|กี่[^\s?2]{0,12}|ขึ้น|ได้|บ้าง|ยัง)2(?=\s|$)/g, '$1?')
    .replace(/และและการ์/g, 'และการ')
    .replace(/และการ์(?=[ก-ฮเแโใไ])/g, 'และการ')
    .replace(/รูปร่าร/g, 'รูปร่าง')
    .replace(/ล้าไม่/g, 'ถ้าไม่')
    .replace(/แก็(?=[?？\s]|ไข|ปัญหา|ตัว|เกม)/g, 'แก้')
    .replace(/เก็ค/g, 'เกิด')
    .replace(/อะใร/g, 'อะไร')
    .replace(/เรียนธู/g, 'เรียนรู้')
    .replace(/อัตโมมัติ/g, 'อัตโนมัติ')
    .replace(/แจ้งเดือน/g, 'แจ้งเตือน')
    .replace(/(แยก|คัดแยก|ทิ้ง|กอง|ถัง|ลด|ปริมาณ|เก็บ|จัดการ|ปัญหา)ชยะ/g, '$1ขยะ')
    .replace(/ชยะ(?=(?:อินทรีย์|รีไซเคิล|ทั่วไป|มูลฝอย|พลาสติก|อาหาร))/g, 'ขยะ')
    .replace(/(เกิดอะไร|มาก|สูง|เพิ่ม|ดี|เร็ว|ง่าย|ชัด|กว้าง|ใหญ่|ยาว|หนัก|เข้ม|เด่น|แข็งแกร่ง|ปลอดภัย|สะดวก|แม่นยำ|ทันสมัย)ชื้น/g, '$1ขึ้น')
    .replace(/จัต(?=การ|ทำ|ส่ง|หา|วาง|เตรียม|กลุ่ม|ลำดับ|สรร|ตั้ง|เก็บ)/g, 'จัด')
    .replace(/ตัดสิ้นใจ/g, 'ตัดสินใจ')
    .replace(/ผลลัพร์/g, 'ผลลัพธ์')
    .replace(/วิเคราะผ์/g, 'วิเคราะห์')
    .replace(/สมดูล/g, 'สมดุล')
    .replace(/รับผิคชอบ/g, 'รับผิดชอบ')
    .replace(/ใช้กฏ/g, 'ใช้กฎ')
    .replace(/ชั้นตอน/g, 'ขั้นตอน');
}

function normalizeBoxText(raw: string): string {
  let text = postProcessThaiOcr(fixScripts(canonical(raw)));
  if (CFG.join.decimalComma) {
    text = text.replace(DECIMAL_COMMA_RE, '$1.$2');
  }
  return text;
}

function isThaiChar(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x0e00 && c <= 0x0e7f;
}

function isThaiCons(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 0x0e01 && c <= 0x0e2e;
}

function invalidShare(text: string): number {
  let thai = 0;
  let bad = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!isThaiChar(ch)) continue;
    thai++;
    const prev = i > 0 ? text[i - 1] : ' ';
    if (ALL_MARKS_SET.has(ch)) {
      const ok = isThaiCons(prev) || (ALL_MARKS_SET.has(prev) && i >= 2 && isThaiCons(text[i - 2]));
      if (!ok) bad++;
    } else if (LEADING_SET.has(ch)) {
      if (!(i + 1 < text.length && isThaiCons(text[i + 1]))) bad++;
    }
  }
  return thai > 0 ? bad / thai : 0.0;
}

function mixedCount(text: string): number {
  let n = 0;
  for (const tok of text.split(/\s+/)) {
    let hasThai = false;
    for (let i = 0; i < tok.length; i++) {
      const c = tok.charCodeAt(i);
      if (c >= 0x0e01 && c <= 0x0e4e) {
        hasThai = true;
        break;
      }
    }
    if (hasThai) {
      for (let i = 0; i < tok.length; i++) {
        const c = tok.charCodeAt(i);
        if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) n++;
      }
    }
  }
  return n;
}

function baseText(text: string): string {
  return text.replace(/ำ/g, 'า').replace(MARK_STRIP_RE, '');
}

function digitsOnly(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    if (DIGITS_SET.has(text[i])) out += text[i];
  }
  return out;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) * 0.5 : s[mid];
}

function boxW(b: RectBox): number {
  return Math.max(1, b.x1 - b.x0);
}

function boxH(b: RectBox): number {
  return Math.max(1, b.y1 - b.y0);
}

function lineHeight(boxes: RectBox[]): number {
  if (boxes.length === 0) return 1.0;
  const hs = boxes.map((b) => boxH(b));
  const wideLines = boxes.filter((b) => boxW(b) >= 2 * boxH(b)).map((b) => boxH(b));
  return median(wideLines.length >= 3 ? wideLines : hs) || 1.0;
}

// ============================================================================
// 1. ONNX Runtime WASM (Hugging Face + Cache API) + Model Loader
// ============================================================================
async function ensureOrtWasmConfigured(
  progressState: ProgressState,
  onProgress: (currentFile: string, state: ProgressState) => void
): Promise<void> {
  if (!cachedOrtWasmBlobUrl) {
    const wasmBuffer = (await fetchAssetFromUrl(
      ORT_WASM_HF_URL,
      'ort-wasm-simd-threaded.wasm',
      'arrayBuffer',
      'application/wasm',
      progressState,
      onProgress
    )) as ArrayBuffer;

    const wasmBlob = new Blob([wasmBuffer], { type: 'application/wasm' });
    cachedOrtWasmBlobUrl = URL.createObjectURL(wasmBlob);
  }

  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.wasmPaths = {
    mjs: ortMjsUrl,
    wasm: cachedOrtWasmBlobUrl,
  };
}

function resolveAssetUrl(repoOrBase: string, fileName: string): string {
  if (/^https?:\/\/[^/]+\/.*\/$/.test(repoOrBase) || repoOrBase.startsWith('blob:')) {
    return `${repoOrBase}${fileName}`;
  }
  const cleanId = repoOrBase
    .replace(/^https?:\/\/huggingface\.co\//, '')
    .replace(/\/(blob|resolve)\/main\/.*$/, '')
    .replace(/\/+$/, '');
  return `https://huggingface.co/${cleanId}/resolve/main/${fileName}`;
}

async function fetchAssetFromUrl(
  url: string,
  displayFileName: string,
  type: 'arrayBuffer' | 'text',
  mime: string,
  progressState: ProgressState,
  onProgress: (currentFile: string, state: ProgressState) => void
): Promise<ArrayBuffer | string> {
  const cache = await caches.open(CACHE_NAME);
  const cachedRes = await cache.match(url);
  if (cachedRes) {
    const buf = await cachedRes.arrayBuffer();
    validateDownloadedBuffer(buf, displayFileName);
    progressState.files[displayFileName] = { loaded: buf.byteLength, total: buf.byteLength };
    onProgress(displayFileName, progressState);
    return type === 'text' ? new TextDecoder('utf-8').decode(buf) : buf;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`โหลดไฟล์ ${displayFileName} ไม่สำเร็จ (HTTP ${response.status}) จาก ${url}`);
  }

  const contentLength = Number(response.headers.get('content-length')) || 0;
  progressState.files[displayFileName] = { loaded: 0, total: contentLength };
  progressState.networkDownloaded = true;
  onProgress(displayFileName, progressState);

  if (!response.body) {
    const buf = await response.arrayBuffer();
    validateDownloadedBuffer(buf, displayFileName);
    progressState.files[displayFileName] = { loaded: buf.byteLength, total: buf.byteLength };
    onProgress(displayFileName, progressState);
    return type === 'text' ? new TextDecoder('utf-8').decode(buf) : buf;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.byteLength;
      progressState.files[displayFileName] = {
        loaded: received,
        total: Math.max(contentLength, received),
      };
      onProgress(displayFileName, progressState);
    }
  }

  const fullBuffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    fullBuffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  validateDownloadedBuffer(fullBuffer.buffer, displayFileName);

  await cache.put(
    url,
    new Response(fullBuffer.buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(received),
      },
    })
  );

  return type === 'text' ? new TextDecoder('utf-8').decode(fullBuffer) : fullBuffer.buffer;
}

function validateDownloadedBuffer(arrayBuffer: ArrayBuffer, fileName: string): void {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error(`ไฟล์ ${fileName} ว่างเปล่า (0 bytes)`);
  }
  const headText = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 32)).trim().toLowerCase();
  if (headText.startsWith('<!doctype') || headText.startsWith('<html')) {
    throw new Error(
      `ไม่พบไฟล์ "${fileName}" ในโฟลเดอร์ models (กรุณาตรวจสอบว่าวางไฟล์ครบถ้วน)`
    );
  }
}

function emitModelProgress(currentFile: string, progressState: ProgressState): void {
  let loadedBytes = 0;
  let totalBytes = 0;
  for (const item of Object.values(progressState.files)) {
    loadedBytes += item.loaded || 0;
    totalBytes += item.total || 0;
  }
  const percent = totalBytes > 0 ? Math.min(100, (loadedBytes / totalBytes) * 100) : 0;

  self.postMessage({
    type: 'MODEL_PROGRESS',
    file: currentFile,
    loadedBytes,
    totalBytes,
    percent,
  });
}

async function fetchDictWithFallback(
  primarySource: string,
  fallbackSource: string,
  progressState: ProgressState,
  onProgress: (currentFile: string, state: ProgressState) => void
): Promise<string> {
  const candidates: Array<{ source: string; name: string }> = [
    { source: primarySource, name: 'rec_dict.txt' },
    { source: primarySource, name: 'dict.txt' },
  ];
  if (fallbackSource !== primarySource) {
    candidates.push({ source: fallbackSource, name: 'rec_dict.txt' });
  }

  let lastErr: unknown = null;
  for (const cand of candidates) {
    try {
      const url = resolveAssetUrl(cand.source, cand.name);
      return (await fetchAssetFromUrl(
        url,
        cand.name,
        'text',
        'text/plain; charset=utf-8',
        progressState,
        onProgress
      )) as string;
    } catch (err) {
      delete progressState.files[cand.name];
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('ไม่สามารถโหลดไฟล์ Dictionary (rec_dict.txt) ได้');
}

async function loadOpenThaiModel(
  modelId: string,
  modelsBaseUrl?: string | null,
  recFileName?: string | null,
  detModelId?: string | null,
  rec2FileName?: string | null
): Promise<void> {
  const primarySource = modelsBaseUrl || modelId;
  const resolvedRecFile = recFileName || 'rec.onnx';
  const isBaseOpenThai =
    modelId === DEFAULT_BASE_MODEL_ID ||
    modelId.startsWith('./') ||
    modelId.startsWith('/');
  const resolvedDetSource = detModelId || (isBaseOpenThai ? primarySource : DEFAULT_BASE_MODEL_ID);
  const resolvedRec2File =
    rec2FileName !== undefined ? rec2FileName : isBaseOpenThai ? 'rec2.onnx' : null;

  const modelKey = `${primarySource}|${resolvedDetSource}|${resolvedRecFile}|${resolvedRec2File ?? 'none'}`;

  if (detSession && recSession && loadedModelKey === modelKey) {
    self.postMessage({
      type: 'MODEL_READY',
      modelId,
      device: 'wasm-simd',
      fromCache: true,
    });
    return;
  }

  self.postMessage({
    type: 'MODEL_STATUS',
    status: 'init',
    message: `กำลังเตรียมโหลดโมเดล ${modelId}...`,
    device: 'wasm-simd',
  });

  const progressState: ProgressState = { networkDownloaded: false, files: {} };

  // 0) โหลด ONNX Runtime WebAssembly (.wasm) จาก Hugging Face และแคชลง Browser Cache API
  await ensureOrtWasmConfigured(progressState, emitModelProgress);

  // 1) โหลด det.onnx
  let detBuffer: ArrayBuffer;
  try {
    detBuffer = (await fetchAssetFromUrl(
      resolveAssetUrl(resolvedDetSource, 'det.onnx'),
      'det.onnx',
      'arrayBuffer',
      'application/octet-stream',
      progressState,
      emitModelProgress
    )) as ArrayBuffer;
  } catch (err) {
    if (resolvedDetSource !== DEFAULT_BASE_MODEL_ID) {
      delete progressState.files['det.onnx'];
      detBuffer = (await fetchAssetFromUrl(
        resolveAssetUrl(DEFAULT_BASE_MODEL_ID, 'det.onnx'),
        'det.onnx',
        'arrayBuffer',
        'application/octet-stream',
        progressState,
        emitModelProgress
      )) as ArrayBuffer;
    } else {
      throw err;
    }
  }

  // 2) โหลดโมเดล Recognition หลัก
  const recBuffer = (await fetchAssetFromUrl(
    resolveAssetUrl(primarySource, resolvedRecFile),
    resolvedRecFile,
    'arrayBuffer',
    'application/octet-stream',
    progressState,
    emitModelProgress
  )) as ArrayBuffer;

  // 3) โหลด rec2.onnx (เฉพาะรุ่นที่มี rec2)
  let rec2Buffer: ArrayBuffer | null = null;
  if (resolvedRec2File) {
    rec2Buffer = (await fetchAssetFromUrl(
      resolveAssetUrl(primarySource, resolvedRec2File),
      resolvedRec2File,
      'arrayBuffer',
      'application/octet-stream',
      progressState,
      emitModelProgress
    )) as ArrayBuffer;
  }

  // 4) โหลด Dictionary
  const dictText = await fetchDictWithFallback(
    primarySource,
    resolvedDetSource,
    progressState,
    emitModelProgress
  );

  self.postMessage({
    type: 'MODEL_STATUS',
    status: 'compiling',
    message: rec2Buffer
      ? 'กำลังสร้าง ONNX Inference Sessions (det + rec + rec2)...'
      : `กำลังสร้าง ONNX Inference Sessions (det + ${resolvedRecFile})...`,
    device: 'wasm-simd',
  });

  const dictChars = dictText.split(/\r?\n/).filter((c) => c.length > 0);
  charList = ['', ...dictChars, ' '];

  const sessionOptions: ort.InferenceSession.SessionOptions = {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  };

  detSession = await ort.InferenceSession.create(detBuffer, sessionOptions);
  recSession = await ort.InferenceSession.create(recBuffer, sessionOptions);
  rec2Session = rec2Buffer
    ? await ort.InferenceSession.create(rec2Buffer, sessionOptions)
    : null;

  loadedModelKey = modelKey;

  self.postMessage({
    type: 'MODEL_READY',
    modelId,
    device: 'wasm-simd',
    fromCache: !progressState.networkDownloaded,
  });
}

// ============================================================================
// 2. _flatten (Per-column margin median + 1D medianBlur + p98)
// ============================================================================
function rgbaToGray(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const n = w * h;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    gray[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return gray;
}

function medianBlur1D(arr: Uint8Array, win: number): Float32Array {
  const w = arr.length;
  const out = new Float32Array(w);
  if (w === 0) return out;

  const half = (win - 1) >> 1;
  const target = half + 1;
  const hist = new Int32Array(256);

  for (let k = -half; k <= half; k++) {
    const idx = k < 0 ? 0 : k >= w ? w - 1 : k;
    hist[arr[idx]]++;
  }

  for (let x = 0; x < w; x++) {
    let acc = 0;
    let med = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) {
        med = v;
        break;
      }
    }
    out[x] = med;

    if (x + 1 < w) {
      const outIdx = x - half < 0 ? 0 : x - half;
      const inIdx = x + half + 1 >= w ? w - 1 : x + half + 1;
      hist[arr[outIdx]]--;
      hist[arr[inIdx]]++;
    }
  }
  return out;
}

function flattenGray(gray: Uint8Array, w: number, h: number): Uint8Array {
  const k = Math.max(2, Math.floor(h / 6));
  const bgRaw = new Uint8Array(w);
  const sampleCount = Math.min(k, h) * 2;
  const colSamples = new Uint8Array(sampleCount);

  for (let x = 0; x < w; x++) {
    let m = 0;
    for (let y = 0; y < Math.min(k, h); y++) {
      colSamples[m++] = gray[y * w + x];
    }
    for (let y = Math.max(0, h - k); y < h; y++) {
      colSamples[m++] = gray[y * w + x];
    }
    colSamples.sort();
    const mid = m >> 1;
    bgRaw[x] = m % 2 === 0 ? Math.floor((colSamples[mid - 1] + colSamples[mid]) * 0.5) : colSamples[mid];
  }

  const win = Math.max(3, Math.min(h | 1, 255));
  const bgSmooth = medianBlur1D(bgRaw, win);

  const n = w * h;
  const diff = new Float32Array(n);
  const hist = new Int32Array(256);

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(gray[rowOff + x] - bgSmooth[x]);
      diff[rowOff + x] = d;
      const bin = d >= 255 ? 255 : d | 0;
      hist[bin]++;
    }
  }

  const p98Target = 0.98 * n;
  let cum = 0;
  let p98 = 255;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= p98Target) {
      p98 = v;
      break;
    }
  }

  const hi = Math.max(p98, 24.0);
  const scale = 255.0 / hi;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const val = Math.min(255, Math.max(0, diff[i] * scale));
    out[i] = (255 - val) | 0;
  }
  return out;
}

// ============================================================================
// 3. Stage 1: Detection
// ============================================================================
async function detectBoxes(sourceCanvas: OffscreenCanvas): Promise<RectBox[]> {
  if (!detSession) return [];
  const W0 = sourceCanvas.width;
  const H0 = sourceCanvas.height;

  const pad = Math.max(8, Math.floor(0.05 * Math.min(H0, W0)));
  const pw = W0 + 2 * pad;
  const ph = H0 + 2 * pad;

  const s = Math.min(CFG.det.limit / Math.max(ph, pw), 4.0);
  const rw = Math.max(32, Math.round((pw * s) / 32) * 32);
  const rh = Math.max(32, Math.round((ph * s) / 32) * 32);

  const detCanvas = new OffscreenCanvas(rw, rh);
  const ctx = detCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('ไม่สามารถสร้าง OffscreenCanvas 2D context สำหรับ detect ได้');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rw, rh);
  ctx.drawImage(
    sourceCanvas,
    0,
    0,
    W0,
    H0,
    (pad * rw) / pw,
    (pad * rh) / ph,
    (W0 * rw) / pw,
    (H0 * rh) / ph
  );

  const rgba = ctx.getImageData(0, 0, rw, rh).data;
  const plane = rw * rh;
  const inputData = new Float32Array(3 * plane);

  const meanB = 0.485;
  const meanG = 0.456;
  const meanR = 0.406;
  const stdB = 0.229;
  const stdG = 0.224;
  const stdR = 0.225;

  for (let i = 0; i < plane; i++) {
    const p = i * 4;
    const r = rgba[p] / 255.0;
    const g = rgba[p + 1] / 255.0;
    const b = rgba[p + 2] / 255.0;

    inputData[i] = (b - meanB) / stdB;
    inputData[plane + i] = (g - meanG) / stdG;
    inputData[2 * plane + i] = (r - meanR) / stdR;
  }

  const tensor = new ort.Tensor('float32', inputData, [1, 3, rh, rw]);
  const out = await detSession.run({ [detSession.inputNames[0]]: tensor });
  const probTensor = out[detSession.outputNames[0]];
  const probH = probTensor.dims[2];
  const probW = probTensor.dims[3];
  const probData = probTensor.data as Float32Array;

  const sx = pw / probW;
  const sy = ph / probH;

  const visited = new Uint8Array(probW * probH);
  const qx = new Int32Array(probW * probH);
  const qy = new Int32Array(probW * probH);
  const boxes: RectBox[] = [];

  const { thresh, boxThresh, unclip, minSize, maxCandidates } = CFG.det;
  const dx8 = [-1, 0, 1, -1, 1, -1, 0, 1];
  const dy8 = [-1, -1, -1, 0, 0, 1, 1, 1];

  for (let y = 0; y < probH; y++) {
    for (let x = 0; x < probW; x++) {
      const idx = y * probW + x;
      if (visited[idx] || probData[idx] <= thresh) continue;

      let head = 0;
      let tail = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail++;
      visited[idx] = 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (let k = 0; k < 8; k++) {
          const nx = cx + dx8[k];
          const ny = cy + dy8[k];
          if (nx < 0 || nx >= probW || ny < 0 || ny >= probH) continue;
          const nIdx = ny * probW + nx;
          if (!visited[nIdx] && probData[nIdx] > thresh) {
            visited[nIdx] = 1;
            qx[tail] = nx;
            qy[tail] = ny;
            tail++;
          }
        }
      }

      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (Math.min(bw, bh) < minSize) continue;

      let scoreSum = 0;
      const rectArea = bw * bh;
      for (let yy = minY; yy <= maxY; yy++) {
        const rowOff = yy * probW;
        for (let xx = minX; xx <= maxX; xx++) {
          scoreSum += probData[rowOff + xx];
        }
      }
      if (scoreSum / rectArea < boxThresh) continue;

      const perimeter = 2 * (bw + bh);
      const offset = (rectArea * unclip) / perimeter;
      const uW = bw + 2 * offset;
      const uH = bh + 2 * offset;
      if (Math.min(uW, uH) < minSize + 2) continue;

      const padX = Math.max(offset * 1.2, bh * 0.22);
      const padY = Math.max(offset * 1.1, bh * 0.14);

      const x0 = Math.max(0, Math.min(W0 - 1, (minX - padX) * sx - pad));
      const y0 = Math.max(0, Math.min(H0 - 1, (minY - padY) * sy - pad));
      const x1 = Math.max(0, Math.min(W0 - 1, (maxX + 1 + padX) * sx - pad));
      const y1 = Math.max(0, Math.min(H0 - 1, (maxY + 1 + padY) * sy - pad));

      if (x1 - x0 >= 2 && y1 - y0 >= 2) {
        boxes.push({ x0, y0, x1, y1 });
        if (boxes.length >= maxCandidates) break;
      }
    }
    if (boxes.length >= maxCandidates) break;
  }

  return boxes;
}

function splitOne(sourceCanvas: OffscreenCanvas, b: RectBox, ratio: number): { pieces: RectBox[]; changed: boolean } {
  if (!ratio) return { pieces: [b], changed: false };
  const bw = Math.round(b.x1 - b.x0);
  const bh = Math.round(b.y1 - b.y0);
  if (bw < 4 * bh || bh < 4) return { pieces: [b], changed: false };

  const h = Math.min(48, bh);
  const w = Math.max(1, Math.round((bw * h) / bh));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { pieces: [b], changed: false };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, b.x0, b.y0, bw, bh, 0, 0, w, h);

  const gray = rgbaToGray(ctx.getImageData(0, 0, w, h).data, w, h);
  const flat = flattenGray(gray, w, h);

  const ink = new Uint8Array(w);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (flat[y * w + x] < 128) {
        ink[x] = 1;
        break;
      }
    }
  }

  const segs: Array<[number, number]> = [];
  let start: number | null = null;
  let blank = 0;
  const gapThresh = ratio * h;

  for (let x = 0; x < w; x++) {
    if (ink[x]) {
      if (start === null) {
        start = x;
      } else if (blank >= gapThresh) {
        segs.push([start, x - blank]);
        start = x;
      }
      blank = 0;
    } else if (start !== null) {
      blank++;
    }
  }
  if (start !== null) {
    segs.push([start, w - blank]);
  }

  if (segs.length === 0 || (segs.length === 1 && segs[0][0] < gapThresh && w - segs[0][1] < gapThresh)) {
    return { pieces: [b], changed: false };
  }

  const pad = 0.15 * h;
  const pieces: RectBox[] = [];
  for (const [sx0, sx1] of segs) {
    const t0 = Math.max(0.0, (sx0 - pad) / w);
    const t1 = Math.min(1.0, (sx1 + pad) / w);
    const nx0 = b.x0 + t0 * (b.x1 - b.x0);
    const nx1 = b.x0 + t1 * (b.x1 - b.x0);
    if (nx1 - nx0 >= 2) {
      pieces.push({ x0: nx0, y0: b.y0, x1: nx1, y1: b.y1 });
    }
  }

  return pieces.length > 0 ? { pieces, changed: true } : { pieces: [b], changed: false };
}

// ============================================================================
// 4. Stage 2: Recognition
// ============================================================================
function cropToCanvas(sourceCanvas: OffscreenCanvas, box: RectBox, rot90: 0 | 1 | -1 = 0): OffscreenCanvas {
  const sx = Math.max(0, Math.floor(box.x0));
  const sy = Math.max(0, Math.floor(box.y0));
  const sw = Math.max(1, Math.min(sourceCanvas.width - sx, Math.ceil(box.x1 - sx)));
  const sh = Math.max(1, Math.min(sourceCanvas.height - sy, Math.ceil(box.y1 - sy)));

  const outW = rot90 === 0 ? sw : sh;
  const outH = rot90 === 0 ? sh : sw;
  const c = new OffscreenCanvas(outW, outH);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas สำหรับ crop ได้');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  if (rot90 === 0) {
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  } else if (rot90 === 1) {
    ctx.translate(0, outH);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  } else {
    ctx.translate(outW, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  }
  return c;
}

function buildRecTensor(cropCanvas: OffscreenCanvas): ort.Tensor {
  const H = CFG.rec.height;
  const rw = Math.min(CFG.rec.maxW, Math.max(1, Math.ceil((H * cropCanvas.width) / Math.max(cropCanvas.height, 1))));
  const W = Math.max(16, rw);

  const scaled = new OffscreenCanvas(rw, H);
  const ctx = scaled.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas สำหรับ resize crop ได้');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rw, H);
  ctx.drawImage(cropCanvas, 0, 0, cropCanvas.width, cropCanvas.height, 0, 0, rw, H);

  const gray = rgbaToGray(ctx.getImageData(0, 0, rw, H).data, rw, H);
  const flat = flattenGray(gray, rw, H);

  const plane = H * W;
  const floatData = new Float32Array(3 * plane);

  for (let y = 0; y < H; y++) {
    const srcRow = y * rw;
    const dstRow = y * W;
    for (let x = 0; x < rw; x++) {
      const v = (flat[srcRow + x] / 255.0 - 0.5) / 0.5;
      const dst = dstRow + x;
      floatData[dst] = v;
      floatData[plane + dst] = v;
      floatData[2 * plane + dst] = v;
    }
  }

  return new ort.Tensor('float32', floatData, [1, 3, H, W]);
}

function decodeCtc(outputTensor: ort.Tensor): { text: string; conf: number } {
  const dims = outputTensor.dims;
  const data = outputTensor.data as Float32Array;
  const T = dims[1];
  const C = dims[2];

  let rowSum0 = 0;
  let hasNeg = false;
  for (let c = 0; c < C; c++) {
    const v = data[c];
    rowSum0 += v;
    if (v < -0.001) hasNeg = true;
  }
  const needSoftmax = hasNeg || rowSum0 < 0.98 || rowSum0 > 1.02;

  const ids = new Int32Array(T);
  const confs = new Float32Array(T);

  for (let t = 0; t < T; t++) {
    const off = t * C;
    let bestId = 0;
    let bestVal = -Infinity;
    for (let c = 0; c < C; c++) {
      const v = data[off + c];
      if (v > bestVal) {
        bestVal = v;
        bestId = c;
      }
    }
    ids[t] = bestId;
    if (needSoftmax) {
      let expSum = 0;
      for (let c = 0; c < C; c++) expSum += Math.exp(data[off + c] - bestVal);
      confs[t] = 1.0 / expSum;
    } else {
      confs[t] = bestVal;
    }
  }

  const chars: string[] = [];
  let confSum = 0;
  let confCount = 0;
  let t = 0;

  while (t < T) {
    let end = t + 1;
    while (end < T && ids[end] === ids[t]) end++;
    const id = ids[t];
    if (id !== 0) {
      const ch = id < charList.length ? charList[id] : '';
      chars.push(ch);
      confSum += confs[t];
      confCount++;
    }
    t = end;
  }

  return {
    text: chars.join(''),
    conf: confCount > 0 ? confSum / confCount : 0.0,
  };
}

async function runRecTensor(tensor: ort.Tensor, session: ort.InferenceSession): Promise<{ text: string; conf: number }> {
  const out = await session.run({ [session.inputNames[0]]: tensor });
  return decodeCtc(out[session.outputNames[0]]);
}

async function readBoxes(sourceCanvas: OffscreenCanvas, boxes: RectBox[]): Promise<RecResult[]> {
  if (!recSession) return [];
  const results: RecResult[] = [];

  for (const box of boxes) {
    const rawCrop = cropToCanvas(sourceCanvas, box, 0);
    const tensor0 = buildRecTensor(rawCrop);
    let best: RecResult = { ...(await runRecTensor(tensor0, recSession)), turned: false };

    if (rawCrop.height >= 1.5 * rawCrop.width) {
      for (const rot of [1, -1] as const) {
        const altCrop = cropToCanvas(sourceCanvas, box, rot);
        const altRes = await runRecTensor(buildRecTensor(altCrop), recSession);
        if (altRes.conf > best.conf) {
          best = { text: altRes.text, conf: altRes.conf, turned: true };
        }
      }
    }

    if (rec2Session && !best.turned) {
      const m1 = mixedCount(best.text);
      const inv1 = invalidShare(best.text);
      const shouldTryRec2 =
        m1 >= CFG.rec2.minMixed || inv1 > 0 || best.conf < CFG.rec2.lowConfTrigger;

      if (shouldTryRec2) {
        const alt2 = await runRecTensor(tensor0, rec2Session);
        const m2 = mixedCount(alt2.text);
        const inv2 = invalidShare(alt2.text);

        if (m2 < m1) {
          best = { text: alt2.text, conf: alt2.conf, turned: false };
        } else if (m2 === m1 && inv2 < inv1) {
          best = { text: alt2.text, conf: alt2.conf, turned: false };
        } else if (m2 === m1 && inv2 === inv1 && alt2.conf > best.conf + 0.02) {
          best = { text: alt2.text, conf: alt2.conf, turned: false };
        }
      }
    }

    results.push(best);
  }

  return results;
}

// ============================================================================
// 5. Reading Order + Column XY-Cut
// ============================================================================
function parseEnum(text: string): number | null {
  const m = text.match(ENUM_RE);
  if (!m) return null;
  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
  const ascii = m[1].replace(/[๐-๙]/g, (d) => String(thaiDigits.indexOf(d)));
  return parseInt(ascii, 10);
}

function findGaps(intervals: Array<[number, number]>, minGap: number): Array<[number, number]> {
  if (intervals.length < 2) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let reach = sorted[0][1];
  for (let i = 1; i < sorted.length; i++) {
    const [lo, hi] = sorted[i];
    if (lo - reach >= minGap) out.push([reach, lo]);
    if (hi > reach) reach = hi;
  }
  return out;
}

function nextToGutter(side: number[], boxes: RectBox[], hmed: number, gutterOnRight: boolean): number[] {
  if (side.length === 0) return side;
  const g = findGaps(
    side.map((i) => [boxes[i].x0, boxes[i].x1]),
    0.8 * hmed
  );
  if (g.length === 0) return side;
  if (gutterOnRight) {
    const cut = g[g.length - 1][1];
    return side.filter((i) => boxes[i].x0 >= cut);
  }
  const cut = g[0][0];
  return side.filter((i) => boxes[i].x1 <= cut);
}

function isProseColumn(col: number[], boxes: RectBox[], hmed: number, texts: string[]): boolean {
  if (col.length < 12) return false;
  const widths = col.map((i) => boxW(boxes[i]));
  const span = Math.max(...col.map((i) => boxes[i].x1)) - Math.min(...col.map((i) => boxes[i].x0));
  const fillShare = widths.filter((w) => w >= 0.75 * span).length / widths.length;
  if (median(widths) < 7 * hmed || fillShare < 0.35) return false;

  let totalNonSpace = 0;
  let digitChars = 0;
  const uniqueLines = new Set<string>();
  for (const i of col) {
    const t = texts[i];
    uniqueLines.add(t.trim());
    for (let k = 0; k < t.length; k++) {
      if (/\s/.test(t[k])) continue;
      totalNonSpace++;
      if (DIGITS_SET.has(t[k])) digitChars++;
    }
  }
  if (totalNonSpace > 0 && digitChars > 0.3 * totalNonSpace) return false;
  if (uniqueLines.size < 0.8 * col.length) return false;
  return true;
}

function isNumberedAcross(lcol: number[], rcol: number[], boxes: RectBox[], hmed: number, texts: string[]): boolean {
  let pairs = 0;
  for (const i of lcol) {
    const a = parseEnum(texts[i]);
    if (a === null) continue;
    const cy = (boxes[i].y0 + boxes[i].y1) * 0.5;
    const hasMatch = rcol.some((j) => {
      const cyj = (boxes[j].y0 + boxes[j].y1) * 0.5;
      return parseEnum(texts[j]) === a + 1 && Math.abs(cyj - cy) <= 0.5 * hmed;
    });
    if (hasMatch) pairs++;
  }
  return pairs >= 0.5 * Math.min(lcol.length, rcol.length);
}

function startRep(lines: string[]): number {
  const st = lines
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => x.replace(DIGIT_RUN_RE, 'D').slice(0, 3));
  if (st.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const s of st) counts.set(s, (counts.get(s) || 0) + 1);
  const top2 = Array.from(counts.values())
    .sort((a, b) => b - a)
    .slice(0, 2);
  return top2.reduce((a, b) => a + b, 0) / st.length;
}

function isListPair(lcol: number[], rcol: number[], texts: string[]): boolean {
  if (!CFG.cols.listRep || lcol.length === 0 || rcol.length === 0) return false;
  const repL = startRep(lcol.map((i) => texts[i]));
  const repR = startRep(rcol.map((i) => texts[i]));
  return (repL + repR) * 0.5 >= CFG.cols.listRep;
}

function splitBlocks(idx: number[], boxes: RectBox[], hmed: number, texts: string[], depth = 0): number[][] {
  if (idx.length < 6 || depth > 12) return [idx];

  const vGaps = findGaps(
    idx.map((i) => [boxes[i].x0, boxes[i].x1]),
    0.8 * hmed
  );

  let bestCut: { gap: number; left: number[]; right: number[] } | null = null;
  for (const [g0, g1] of vGaps) {
    const left = idx.filter((i) => boxes[i].x1 <= g0);
    const right = idx.filter((i) => boxes[i].x0 >= g1);
    const lcol = nextToGutter(left, boxes, hmed, true);
    const rcol = nextToGutter(right, boxes, hmed, false);
    if (
      isProseColumn(lcol, boxes, hmed, texts) &&
      isProseColumn(rcol, boxes, hmed, texts) &&
      !isNumberedAcross(lcol, rcol, boxes, hmed, texts) &&
      !isListPair(lcol, rcol, texts)
    ) {
      const w = g1 - g0;
      if (!bestCut || w > bestCut.gap) {
        bestCut = { gap: w, left, right };
      }
    }
  }

  if (bestCut) {
    return [
      ...splitBlocks(bestCut.left, boxes, hmed, texts, depth + 1),
      ...splitBlocks(bestCut.right, boxes, hmed, texts, depth + 1),
    ];
  }

  const hGaps = findGaps(
    idx.map((i) => [boxes[i].y0, boxes[i].y1]),
    0.8 * hmed
  );
  if (hGaps.length === 0) return [idx];

  let maxHGap = hGaps[0];
  for (const g of hGaps) {
    if (g[1] - g[0] > maxHGap[1] - maxHGap[0]) maxHGap = g;
  }
  const top = idx.filter((i) => boxes[i].y1 <= maxHGap[0]);
  const bottom = idx.filter((i) => boxes[i].y0 >= maxHGap[1]);
  return [
    ...splitBlocks(top, boxes, hmed, texts, depth + 1),
    ...splitBlocks(bottom, boxes, hmed, texts, depth + 1),
  ];
}

function computeReadingOrder(boxes: RectBox[], texts: string[], subsetIndices?: number[]): number[][] {
  const idx = subsetIndices ?? boxes.map((_, i) => i);
  if (idx.length === 0) return [];

  const subBoxes = idx.map((i) => boxes[i]);
  const hmed = lineHeight(subBoxes);
  const blocks = splitBlocks(idx, boxes, hmed, texts);

  const cy = boxes.map((b) => (b.y0 + b.y1) * 0.5);
  const rx = boxes.map((b) => (b.x0 + b.x1) * 0.5);
  const hs = boxes.map((b) => boxH(b));
  const tol = 0.5 * hmed;

  const rows: number[][] = [];
  for (const blk of blocks) {
    const full = blk.filter((i) => hs[i] >= 0.6 * hmed);
    const baseFull = full.length > 0 ? full : [...blk];
    const fullSet = new Set(baseFull);
    const small = blk.filter((i) => !fullSet.has(i));

    const brows: number[][] = [];
    for (const i of [...baseFull].sort((a, b) => cy[a] - cy[b])) {
      if (brows.length > 0) {
        const lastRow = brows[brows.length - 1];
        const meanY = lastRow.reduce((s, j) => s + cy[j], 0) / lastRow.length;
        if (Math.abs(cy[i] - meanY) <= tol) {
          lastRow.push(i);
          continue;
        }
      }
      brows.push([i]);
    }

    const centres = brows.map((r) => r.reduce((s, j) => s + cy[j], 0) / r.length);
    for (const i of small) {
      let bestR = -1;
      let bestDist = Infinity;
      for (let r = 0; r < centres.length; r++) {
        const d = Math.abs(cy[i] - centres[r]);
        if (d < bestDist) {
          bestDist = d;
          bestR = r;
        }
      }
      if (bestR >= 0 && bestDist <= tol + 0.5 * hs[i]) {
        brows[bestR].push(i);
      } else {
        brows.push([i]);
        centres.push(cy[i]);
      }
    }

    const rowOrder = brows.map((_, r) => r).sort((a, b) => centres[a] - centres[b]);
    for (const r of rowOrder) {
      rows.push([...brows[r]].sort((a, b) => rx[a] - rx[b]));
    }
  }

  return rows;
}

// ============================================================================
// 6. Drop Filter + Fragment Removal + Floating Mark Attachment
// ============================================================================
function dropReason(text: string, conf: number, hratio: number | null = null): string | null {
  const rc = CFG.rec;
  if (!text) return 'empty';
  if (conf < rc.dropBelow) return 'low_confidence';

  const bare = text.replace(/ /g, '');
  let short = rc.minChars;

  if (rc.minCharsDigits !== null && bare.length > 0) {
    let allAllowed = true;
    for (let i = 0; i < bare.length; i++) {
      const ch = bare[i];
      if (!DIGITS_SET.has(ch) && !(rc.minCharsLatin && LATIN_SET.has(ch))) {
        allAllowed = false;
        break;
      }
    }
    if (allAllowed && (rc.minCharsDigitsHeight <= 0 || (hratio !== null && hratio >= rc.minCharsDigitsHeight))) {
      short = rc.minCharsDigits;
    }
  }

  if (bare.length < short) return 'too_short';
  if (conf < rc.junkBelow && invalidShare(text) > rc.junkInvalid) return 'invalid_thai';
  return null;
}

function findFragments(boxes: RectBox[], recs: RecResult[]): Set<number> {
  const out = new Set<number>();
  if (boxes.length < 3) return out;
  const hmed = lineHeight(boxes);

  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (boxH(b) >= 0.35 * hmed) continue;
    if (recs[i].text.replace(/ /g, '').length > 3) continue;

    for (let j = 0; j < boxes.length; j++) {
      if (j === i) continue;
      const c = boxes[j];
      if (boxH(c) < 0.6 * hmed) continue;
      if (
        c.x0 <= b.x1 &&
        b.x0 <= c.x1 &&
        Math.min(Math.abs(b.y0 - c.y1), Math.abs(c.y0 - b.y1)) <= 0.5 * hmed
      ) {
        out.add(i);
        break;
      }
    }
  }
  return out;
}

async function attachFloatingMarks(
  sourceCanvas: OffscreenCanvas,
  boxes: RectBox[],
  recs: RecResult[],
  frag: Set<number>
): Promise<Set<number>> {
  const mc = CFG.marks;
  const n = boxes.length;
  if (n === 0) return new Set();

  const hmed0 = lineHeight(boxes);
  const junk = boxes.map((b, i) => {
    if (frag.has(i)) return true;
    const norm = postProcessThaiOcr(fixScripts(canonical(recs[i].text)));
    return dropReason(norm, recs[i].conf, boxH(b) / hmed0) !== null;
  });

  if (!junk.some(Boolean) || junk.every(Boolean)) return new Set();

  const keptBoxes = boxes.filter((_, i) => !junk[i]);
  const hmed = lineHeight(keptBoxes);
  const frame: number[] = [];
  for (let a = 0; a < n; a++) {
    if (!junk[a] && boxW(boxes[a]) >= 1 && boxH(boxes[a]) >= 0.5 * hmed) {
      frame.push(a);
    }
  }
  if (frame.length === 0) return new Set();

  const reach = new Map<number, [number, number]>();
  for (const a of frame) reach.set(a, [0, 0]);
  const owner = new Map<number, number>();

  for (let j = 0; j < n; j++) {
    if (!junk[j]) continue;
    const bj = boxes[j];
    const jw = boxW(bj);
    const jh = boxH(bj);

    let best: { gap: number; side: 0 | 1; a: number; ext: number } | null = null;
    for (const a of frame) {
      const ba = boxes[a];
      const ha = boxH(ba);
      const overlapX = Math.min(bj.x1, ba.x1) - Math.max(bj.x0, ba.x0);
      if (jh > mc.maxHeight * ha || overlapX < 0.5 * jw) continue;

      const t0 = bj.y0 - ba.y0;
      const t1 = bj.y1 - ba.y0;
      let gap: number;
      let side: 0 | 1;
      let ext: number;

      if (t1 <= 0.5 * ha) {
        gap = Math.max(0, -t1);
        side = 0;
        ext = -t0;
      } else if (t0 >= 0.5 * ha) {
        gap = Math.max(0, t0 - ha);
        side = 1;
        ext = t1 - ha;
      } else {
        continue;
      }

      if (gap > mc.maxGap * ha || ext > mc.maxExt * ha) continue;
      if (!best || gap < best.gap || (gap === best.gap && side < best.side)) {
        best = { gap, side, a, ext };
      }
    }

    if (best) {
      owner.set(j, best.a);
      const cur = reach.get(best.a)!;
      cur[best.side] = Math.max(cur[best.side], best.ext);
    }
  }

  if (owner.size === 0) return new Set();

  let floating = false;
  for (const side of [0, 1] as const) {
    const lifted = frame.filter((a) => reach.get(a)![side] > 0);
    if (lifted.length < Math.max(mc.pageMin, mc.pageShare * frame.length)) continue;

    floating = true;
    const typ = median(lifted.map((a) => reach.get(a)![side] / boxH(boxes[a])));
    for (const a of frame) {
      if (reach.get(a)![side] > 0) continue;
      const ba = boxes[a];
      const ha = boxH(ba);
      let room = typ * ha;
      for (const b of frame) {
        if (b === a) continue;
        const bb = boxes[b];
        if (Math.min(bb.x1, ba.x1) - Math.max(bb.x0, ba.x0) <= 0) continue;
        if (side === 0 && bb.y1 <= ba.y0 + 0.5 * ha) {
          room = Math.min(room, Math.max(0, (ba.y0 - bb.y1) * 0.9));
        } else if (side === 1 && bb.y0 >= ba.y0 + 0.5 * ha) {
          room = Math.min(room, Math.max(0, (bb.y0 - ba.y1) * 0.9));
        }
      }
      reach.get(a)![side] = room;
    }
  }

  const grownIdx: number[] = [];
  const grownBoxes: RectBox[] = [];
  const H = sourceCanvas.height;

  for (const a of frame) {
    const [up, down] = reach.get(a)!;
    if (up <= 0 && down <= 0) continue;
    const ba = boxes[a];
    const ha = boxH(ba);
    grownIdx.push(a);
    grownBoxes.push({
      x0: ba.x0,
      x1: ba.x1,
      y0: Math.max(0, ba.y0 - (up > 0 ? up + mc.margin * ha : 0)),
      y1: Math.min(H - 1, ba.y1 + (down > 0 ? down + mc.margin * ha : 0)),
    });
  }

  if (grownBoxes.length === 0) return new Set();
  const reread = await readBoxes(sourceCanvas, grownBoxes);
  const done = new Set<number>();

  for (let k = 0; k < grownIdx.length; k++) {
    const a = grownIdx[k];
    const r = reread[k];
    const nextText = postProcessThaiOcr(fixScripts(canonical(r.text)));
    if (dropReason(nextText, r.conf) !== null) continue;

    const oldText = postProcessThaiOcr(fixScripts(canonical(recs[a].text)));
    if (mc.keepBase) {
      const ok = floating ? digitsOnly(nextText) === digitsOnly(oldText) : baseText(nextText) === baseText(oldText);
      if (!ok) continue;
    }

    boxes[a] = grownBoxes[k];
    recs[a] = r;
    done.add(a);
  }

  const absorbed = new Set<number>();
  for (const [j, a] of owner.entries()) {
    if (done.has(a)) absorbed.add(j);
  }
  return absorbed;
}

// ============================================================================
// 6B. Hybrid Table Extraction (Bordered Grid Lines + Borderless Column Alignment)
// ============================================================================
function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

function buildMarkdownTable(matrix: string[][]): string {
  if (matrix.length === 0) return '';
  const colCount = Math.max(...matrix.map((r) => r.length));
  if (colCount < 2) return '';

  const nonEmptyCols: number[] = [];
  for (let c = 0; c < colCount; c++) {
    if (matrix.some((row) => (row[c] ?? '').trim().length > 0)) {
      nonEmptyCols.push(c);
    }
  }
  if (nonEmptyCols.length < 2) return '';

  const cleanedRows = matrix
    .map((row) => nonEmptyCols.map((c) => escapeMarkdownCell(row[c] ?? '')))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (cleanedRows.length < 2) return '';

  const header = `| ${cleanedRows[0].join(' | ')} |`;
  const separator = `| ${nonEmptyCols.map(() => '---').join(' | ')} |`;
  const body = cleanedRows.slice(1).map((row) => `| ${row.join(' | ')} |`);

  return [header, separator, ...body].join('\n');
}

interface LineSegment1D {
  pos: number;
  start: number;
  end: number;
}

function clusterLineSegments(raw: LineSegment1D[], posTol: number, gapTol: number): LineSegment1D[] {
  if (raw.length === 0) return [];
  const sorted = [...raw].sort((a, b) => a.pos - b.pos || a.start - b.start);

  const bands: LineSegment1D[][] = [];
  for (const seg of sorted) {
    const lastBand = bands[bands.length - 1];
    if (lastBand) {
      const meanPos = lastBand.reduce((s, item) => s + item.pos, 0) / lastBand.length;
      if (Math.abs(seg.pos - meanPos) <= posTol) {
        lastBand.push(seg);
        continue;
      }
    }
    bands.push([seg]);
  }

  const merged: LineSegment1D[] = [];
  for (const band of bands) {
    const pos = band.reduce((s, item) => s + item.pos, 0) / band.length;
    const byStart = [...band].sort((a, b) => a.start - b.start);
    let curStart = byStart[0].start;
    let curEnd = byStart[0].end;

    for (let i = 1; i < byStart.length; i++) {
      if (byStart[i].start <= curEnd + gapTol) {
        curEnd = Math.max(curEnd, byStart[i].end);
      } else {
        merged.push({ pos, start: curStart, end: curEnd });
        curStart = byStart[i].start;
        curEnd = byStart[i].end;
      }
    }
    merged.push({ pos, start: curStart, end: curEnd });
  }
  return merged;
}

function clusterScalarCoords(coords: number[], tol: number): number[] {
  if (coords.length === 0) return [];
  const sorted = [...coords].sort((a, b) => a - b);
  const groups: number[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const g = groups[groups.length - 1];
    const mean = g.reduce((s, v) => s + v, 0) / g.length;
    if (sorted[i] - mean <= tol) {
      g.push(sorted[i]);
    } else {
      groups.push([sorted[i]]);
    }
  }
  return groups.map((g) => g.reduce((s, v) => s + v, 0) / g.length);
}

function extractBorderedGridTables(
  sourceCanvas: OffscreenCanvas,
  boxes: RectBox[],
  recs: RecResult[],
  frag: Set<number>,
  hmed: number
): { blocks: PageContentBlock[]; consumedBoxIndices: Set<number> } {
  const consumedBoxIndices = new Set<number>();
  const blocks: PageContentBlock[] = [];
  if (boxes.length < 4) return { blocks, consumedBoxIndices };

  const W0 = sourceCanvas.width;
  const H0 = sourceCanvas.height;
  const maxDim = 1500;
  const scale = Math.min(1, maxDim / Math.max(W0, H0));
  const w = Math.max(1, Math.round(W0 * scale));
  const h = Math.max(1, Math.round(H0 * scale));

  const scanCanvas = new OffscreenCanvas(w, h);
  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { blocks, consumedBoxIndices };

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceCanvas, 0, 0, W0, H0, 0, 0, w, h);

  const rgba = ctx.getImageData(0, 0, w, h).data;
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    const lum = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    if (lum < 195) dark[i] = 1;
  }

  const minHRun = Math.max(48, Math.round(w * 0.12));
  const minVRun = Math.max(24, Math.round(hmed * scale * 2.1));
  const rawH: LineSegment1D[] = [];
  const rawV: LineSegment1D[] = [];

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    let runStart = -1;
    for (let x = 0; x < w; x++) {
      if (dark[rowOff + x]) {
        if (runStart < 0) runStart = x;
      } else if (runStart >= 0) {
        if (x - runStart >= minHRun) {
          rawH.push({ pos: y, start: runStart, end: x - 1 });
        }
        runStart = -1;
      }
    }
    if (runStart >= 0 && w - runStart >= minHRun) {
      rawH.push({ pos: y, start: runStart, end: w - 1 });
    }
  }

  for (let x = 0; x < w; x++) {
    let runStart = -1;
    for (let y = 0; y < h; y++) {
      if (dark[y * w + x]) {
        if (runStart < 0) runStart = y;
      } else if (runStart >= 0) {
        if (y - runStart >= minVRun) {
          rawV.push({ pos: x, start: runStart, end: y - 1 });
        }
        runStart = -1;
      }
    }
    if (runStart >= 0 && h - runStart >= minVRun) {
      rawV.push({ pos: x, start: runStart, end: h - 1 });
    }
  }

  const hLines = clusterLineSegments(rawH, 4, 8);
  const vLines = clusterLineSegments(rawV, 4, 8);
  if (hLines.length < 3 || vLines.length < 3) {
    return { blocks, consumedBoxIndices };
  }

  const visitedH = new Uint8Array(hLines.length);
  const visitedV = new Uint8Array(vLines.length);
  const tol = 6;

  for (let i = 0; i < hLines.length; i++) {
    if (visitedH[i]) continue;
    const compH: LineSegment1D[] = [];
    const compV: LineSegment1D[] = [];
    const q: Array<{ kind: 'H' | 'V'; idx: number }> = [{ kind: 'H', idx: i }];
    visitedH[i] = 1;

    while (q.length > 0) {
      const cur = q.shift()!;
      if (cur.kind === 'H') {
        const hl = hLines[cur.idx];
        compH.push(hl);
        for (let j = 0; j < vLines.length; j++) {
          if (visitedV[j]) continue;
          const vl = vLines[j];
          if (
            vl.pos >= hl.start - tol &&
            vl.pos <= hl.end + tol &&
            hl.pos >= vl.start - tol &&
            hl.pos <= vl.end + tol
          ) {
            visitedV[j] = 1;
            q.push({ kind: 'V', idx: j });
          }
        }
      } else {
        const vl = vLines[cur.idx];
        compV.push(vl);
        for (let j = 0; j < hLines.length; j++) {
          if (visitedH[j]) continue;
          const hl = hLines[j];
          if (
            vl.pos >= hl.start - tol &&
            vl.pos <= hl.end + tol &&
            hl.pos >= vl.start - tol &&
            hl.pos <= vl.end + tol
          ) {
            visitedH[j] = 1;
            q.push({ kind: 'H', idx: j });
          }
        }
      }
    }

    const yGrid = clusterScalarCoords(
      compH.map((l) => l.pos / scale),
      Math.max(8, hmed * 0.45)
    );
    const xGrid = clusterScalarCoords(
      compV.map((l) => l.pos / scale),
      Math.max(8, hmed * 0.45)
    );

    if (yGrid.length < 3 || xGrid.length < 3) continue;

    const numRows = yGrid.length - 1;
    const numCols = xGrid.length - 1;
    const gx0 = xGrid[0] - 4;
    const gx1 = xGrid[xGrid.length - 1] + 4;
    const gy0 = yGrid[0] - 4;
    const gy1 = yGrid[yGrid.length - 1] + 4;

    const cellBoxIndices: number[][][] = Array.from({ length: numRows }, () =>
      Array.from({ length: numCols }, () => [])
    );
    const candidateIndices: number[] = [];

    for (let bIdx = 0; bIdx < boxes.length; bIdx++) {
      if (frag.has(bIdx) || consumedBoxIndices.has(bIdx)) continue;
      const b = boxes[bIdx];
      const cx = (b.x0 + b.x1) * 0.5;
      const cy = (b.y0 + b.y1) * 0.5;
      if (cx < gx0 || cx > gx1 || cy < gy0 || cy > gy1) continue;

      let rFound = -1;
      for (let r = 0; r < numRows; r++) {
        if (cy >= yGrid[r] - 3 && cy <= yGrid[r + 1] + 3) {
          rFound = r;
          break;
        }
      }
      let cFound = -1;
      for (let c = 0; c < numCols; c++) {
        if (cx >= xGrid[c] - 3 && cx <= xGrid[c + 1] + 3) {
          cFound = c;
          break;
        }
      }
      if (rFound >= 0 && cFound >= 0) {
        cellBoxIndices[rFound][cFound].push(bIdx);
        candidateIndices.push(bIdx);
      }
    }

    let populatedCells = 0;
    const matrix: string[][] = Array.from({ length: numRows }, () => Array(numCols).fill(''));

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const list = cellBoxIndices[r][c];
        if (list.length === 0) continue;

        list.sort((a, b) => {
          const dY = boxes[a].y0 - boxes[b].y0;
          if (Math.abs(dY) > 0.45 * hmed) return dY;
          return boxes[a].x0 - boxes[b].x0;
        });

        const parts: string[] = [];
        for (const bIdx of list) {
          const txt = normalizeBoxText(recs[bIdx].text);
          if (dropReason(txt, recs[bIdx].conf, boxH(boxes[bIdx]) / hmed) === null) {
            parts.push(txt);
          }
        }
        const joined = postProcessThaiOcr(parts.join(' ')).trim();
        if (joined.length > 0) {
          matrix[r][c] = joined;
          populatedCells++;
        }
      }
    }

    if (populatedCells < 2) continue;

    const mdTable = buildMarkdownTable(matrix);
    if (!mdTable) continue;

    for (const bIdx of candidateIndices) {
      consumedBoxIndices.add(bIdx);
    }
    blocks.push({
      y0: yGrid[0],
      y1: yGrid[yGrid.length - 1],
      text: mdTable,
      isTable: true,
    });
  }

  return { blocks, consumedBoxIndices };
}

function buildBorderlessTableFromRows(rowRun: ParsedRowInfo[], hmed: number): string | null {
  if (rowRun.length < CFG.table.minBorderlessRows) return null;

  const allSegs: RowCellSegment[] = [];
  for (const r of rowRun) {
    for (const seg of r.segments) allSegs.push(seg);
  }
  if (allSegs.length < 4) return null;

  const sortedByX = [...allSegs].sort((a, b) => a.x0 - b.x0);
  interface ColCluster {
    minX: number;
    maxX: number;
    centers: number[];
  }

  const clusters: ColCluster[] = [];
  const alignTol = Math.max(18, hmed * 1.15);

  for (const seg of sortedByX) {
    const segCenter = (seg.x0 + seg.x1) * 0.5;
    let bestIdx = -1;
    let bestScore = Infinity;

    for (let c = 0; c < clusters.length; c++) {
      const cl = clusters[c];
      const overlap = Math.min(seg.x1, cl.maxX) - Math.max(seg.x0, cl.minX);
      const meanCenter = cl.centers.reduce((s, v) => s + v, 0) / cl.centers.length;
      const leftDiff = Math.abs(seg.x0 - cl.minX);
      const centerDiff = Math.abs(segCenter - meanCenter);

      if (overlap > 0 || leftDiff <= alignTol || centerDiff <= alignTol) {
        const score = Math.min(leftDiff, centerDiff) - Math.max(0, overlap * 0.25);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = c;
        }
      }
    }

    if (bestIdx >= 0) {
      const cl = clusters[bestIdx];
      cl.minX = Math.min(cl.minX, seg.x0);
      cl.maxX = Math.max(cl.maxX, seg.x1);
      cl.centers.push(segCenter);
    } else {
      clusters.push({
        minX: seg.x0,
        maxX: seg.x1,
        centers: [segCenter],
      });
    }
  }

  clusters.sort((a, b) => a.minX - b.minX);
  if (clusters.length < 2 || clusters.length > 14) return null;

  const matrix: string[][] = [];
  let multiColRowCount = 0;

  for (const row of rowRun) {
    const cells = Array(clusters.length).fill('');
    let populatedInRow = 0;

    for (const seg of row.segments) {
      const segCenter = (seg.x0 + seg.x1) * 0.5;
      let bestCol = 0;
      let bestDist = Infinity;

      for (let c = 0; c < clusters.length; c++) {
        const cl = clusters[c];
        const overlap = Math.min(seg.x1, cl.maxX) - Math.max(seg.x0, cl.minX);
        const clCenter = (cl.minX + cl.maxX) * 0.5;
        const dist = overlap > 0 ? -overlap : Math.abs(segCenter - clCenter);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = c;
        }
      }

      if (!cells[bestCol]) populatedInRow++;
      cells[bestCol] = cells[bestCol] ? `${cells[bestCol]} ${seg.text}` : seg.text;
    }

    if (populatedInRow >= 2) multiColRowCount++;
    matrix.push(cells);
  }

  if (multiColRowCount < Math.ceil(rowRun.length * 0.6)) return null;

  return buildMarkdownTable(matrix);
}

function buildTextAndBorderlessTableBlocks(
  rows: number[][],
  boxes: RectBox[],
  recs: RecResult[],
  frag: Set<number>,
  hmed: number
): PageContentBlock[] {
  const parsedRows: ParsedRowInfo[] = [];
  const colGapThresh = Math.max(CFG.table.minColGapPx, CFG.table.colGapMultiplier * hmed);

  for (const r of rows) {
    interface ValidItem {
      x0: number;
      x1: number;
      y0: number;
      y1: number;
      text: string;
    }

    const items: ValidItem[] = [];
    for (const i of r) {
      if (frag.has(i)) continue;
      const text = normalizeBoxText(recs[i].text);
      if (dropReason(text, recs[i].conf, boxH(boxes[i]) / hmed) !== null) continue;
      items.push({
        x0: boxes[i].x0,
        x1: boxes[i].x1,
        y0: boxes[i].y0,
        y1: boxes[i].y1,
        text,
      });
    }

    if (items.length === 0) continue;

    const segments: RowCellSegment[] = [];
    let curSeg: RowCellSegment = {
      x0: items[0].x0,
      x1: items[0].x1,
      text: items[0].text,
    };

    for (let k = 1; k < items.length; k++) {
      const item = items[k];
      const gap = item.x0 - curSeg.x1;
      if (CFG.table.enabled && gap >= colGapThresh) {
        curSeg.text = postProcessThaiOcr(curSeg.text);
        segments.push(curSeg);
        curSeg = { x0: item.x0, x1: item.x1, text: item.text };
      } else {
        curSeg.x1 = Math.max(curSeg.x1, item.x1);
        curSeg.text = `${curSeg.text} ${item.text}`;
      }
    }
    curSeg.text = postProcessThaiOcr(curSeg.text);
    segments.push(curSeg);

    parsedRows.push({
      y0: Math.min(...items.map((it) => it.y0)),
      y1: Math.max(...items.map((it) => it.y1)),
      segments,
      plainText: postProcessThaiOcr(items.map((it) => it.text).join(' ')),
    });
  }

  const blocks: PageContentBlock[] = [];
  let idx = 0;

  while (idx < parsedRows.length) {
    if (CFG.table.enabled && parsedRows[idx].segments.length >= 2) {
      let end = idx + 1;
      while (
        end < parsedRows.length &&
        parsedRows[end].segments.length >= 2 &&
        parsedRows[end].y0 - parsedRows[end - 1].y1 <= CFG.table.maxRowGapMultiplier * hmed &&
        parsedRows[end].y1 >= parsedRows[end - 1].y0
      ) {
        end++;
      }

      const candidateRun = parsedRows.slice(idx, end);
      const mdTable = buildBorderlessTableFromRows(candidateRun, hmed);
      if (mdTable) {
        blocks.push({
          y0: candidateRun[0].y0,
          y1: candidateRun[candidateRun.length - 1].y1,
          text: mdTable,
          isTable: true,
        });
        idx = end;
        continue;
      }
    }

    const paraLines: string[] = [parsedRows[idx].plainText];
    const startY0 = parsedRows[idx].y0;
    let prevY0 = parsedRows[idx].y0;
    let prevY1 = parsedRows[idx].y1;
    idx++;

    while (idx < parsedRows.length) {
      if (
        CFG.table.enabled &&
        parsedRows[idx].segments.length >= 2 &&
        idx + 1 < parsedRows.length &&
        parsedRows[idx + 1].segments.length >= 2
      ) {
        break;
      }

      const row = parsedRows[idx];
      const isNewParagraph =
        CFG.join.paragraphs &&
        (row.y0 - prevY1 > CFG.join.paragraphGap * hmed || row.y1 < prevY0);

      if (isNewParagraph) break;

      paraLines.push(row.plainText);
      prevY0 = row.y0;
      prevY1 = row.y1;
      idx++;
    }

    blocks.push({
      y0: startY0,
      y1: prevY1,
      text: paraLines.join('\n'),
      isTable: false,
    });
  }

  return blocks;
}

// ============================================================================
// 7. Full Page OCR Pipeline
// ============================================================================
async function runOcrOnBitmap(pageNum: number, bitmap: ImageBitmap): Promise<void> {
  if (!detSession || !recSession) {
    bitmap.close();
    throw new Error('ยังไม่ได้โหลดโมเดล OCR กรุณากดโหลดโมเดลก่อน');
  }

  const startTime = performance.now();
  try {
    const sourceCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      throw new Error('ไม่สามารถสร้าง OffscreenCanvas 2D context ได้');
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    let detected = await detectBoxes(sourceCanvas);
    if (detected.length === 0 && sourceCanvas.height <= 200 && sourceCanvas.width >= 1.5 * sourceCanvas.height) {
      detected = [{ x0: 0, y0: 0, x1: sourceCanvas.width - 1, y1: sourceCanvas.height - 1 }];
    }

    const splitGroups = detected.map((b) => splitOne(sourceCanvas, b, CFG.det.splitGap));
    const allPieces: RectBox[] = [];
    const wholeBoxes: RectBox[] = [];

    for (let i = 0; i < detected.length; i++) {
      for (const p of splitGroups[i].pieces) allPieces.push(p);
      if (splitGroups[i].changed) wholeBoxes.push(detected[i]);
    }

    const combinedRes = await readBoxes(sourceCanvas, [...allPieces, ...wholeBoxes]);
    const finalBoxes: RectBox[] = [];
    const finalRecs: RecResult[] = [];

    let pIdx = 0;
    let wIdx = allPieces.length;

    for (let i = 0; i < detected.length; i++) {
      const grp = splitGroups[i];
      const pRes = combinedRes.slice(pIdx, pIdx + grp.pieces.length);
      pIdx += grp.pieces.length;

      if (grp.changed) {
        const altWhole = combinedRes[wIdx++];
        const nPiecesChars = pRes.reduce((s, r) => s + r.text.replace(/ /g, '').length, 0);
        const minPieceConf = Math.min(...pRes.map((r) => r.conf));
        const wholeChars = altWhole.text.replace(/ /g, '').length;

        if (minPieceConf < CFG.rec.dropBelow || nPiecesChars < 0.9 * wholeChars) {
          finalBoxes.push(detected[i]);
          finalRecs.push(altWhole);
          continue;
        }
      }

      for (let j = 0; j < grp.pieces.length; j++) {
        finalBoxes.push(grp.pieces[j]);
        finalRecs.push(pRes[j]);
      }
    }

    const frag = findFragments(finalBoxes, finalRecs);
    if (CFG.marks.enabled) {
      const absorbed = await attachFloatingMarks(sourceCanvas, finalBoxes, finalRecs, frag);
      for (const idx of absorbed) frag.add(idx);
    }

    const hmed = lineHeight(finalBoxes);
    const allTexts = finalRecs.map((r) => r.text);

    const gridResult = CFG.table.enabled
      ? extractBorderedGridTables(sourceCanvas, finalBoxes, finalRecs, frag, hmed)
      : { blocks: [], consumedBoxIndices: new Set<number>() };

    const remainingIndices: number[] = [];
    for (let i = 0; i < finalBoxes.length; i++) {
      if (!gridResult.consumedBoxIndices.has(i)) {
        remainingIndices.push(i);
      }
    }

    const rows = computeReadingOrder(finalBoxes, allTexts, remainingIndices);
    const textAndBorderlessBlocks = buildTextAndBorderlessTableBlocks(
      rows,
      finalBoxes,
      finalRecs,
      frag,
      hmed
    );

    const mergedBlocks: PageContentBlock[] = [
      ...gridResult.blocks,
      ...textAndBorderlessBlocks,
    ].sort((a, b) => a.y0 - b.y0);

    const pageText = mergedBlocks.map((b) => b.text).join('\n\n');

    const durationMs = Math.round(performance.now() - startTime);
    self.postMessage({
      type: 'OCR_PAGE_DONE',
      pageNum,
      text: pageText,
      durationMs,
    });
  } catch (err) {
    try {
      bitmap.close();
    } catch {
      // ignore
    }
    throw err;
  }
}

async function clearModelCache(): Promise<void> {
  if ('caches' in self) {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.includes('openthai') || key.includes('transformers')) {
        await caches.delete(key);
      }
    }
  }
  if (cachedOrtWasmBlobUrl) {
    URL.revokeObjectURL(cachedOrtWasmBlobUrl);
    cachedOrtWasmBlobUrl = null;
  }
  detSession = null;
  recSession = null;
  rec2Session = null;
  loadedModelKey = null;
  self.postMessage({ type: 'CACHE_CLEARED' });
}

self.addEventListener('message', async (event: MessageEvent<WorkerInMessage>) => {
  const data = event.data;

  try {
    if (data.type === 'LOAD_MODEL') {
      await loadOpenThaiModel(
        data.modelId,
        data.modelsBaseUrl,
        data.recFileName,
        data.detModelId,
        data.rec2FileName
      );
    } else if (data.type === 'RUN_OCR') {
      await runOcrOnBitmap(data.pageNum, data.bitmap);
    } else if (data.type === 'SET_OPTIONS') {
      if (typeof data.tableEnabled === 'boolean') {
        CFG.table.enabled = data.tableEnabled;
      }
    } else if (data.type === 'CLEAR_CACHE') {
      await clearModelCache();
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({
      type: 'ERROR',
      message,
    });
  }
});