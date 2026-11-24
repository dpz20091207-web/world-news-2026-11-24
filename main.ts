// THE WORLD - Tuesday 24 November 2026 in one picture.
// A deterministic 1024x1024 PNG drawn from scratch with a hand-written
// PNG encoder (zlib via node:zlib is stdlib). No network, no external
// assets, no randomness, no wall-clock: the same bytes every run.
//
// Run it: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (without MAKEFUN_OUTPUT_DIR it writes /output/entry.png, like the kit.)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- PNG ---

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ canvas ----

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const PAPER: RGB = [246, 241, 229];
const INK: RGB = [26, 26, 26];
const NAVY: RGB = [20, 33, 61];
const NAVY2: RGB = [31, 48, 88];
const RED: RGB = [185, 28, 28];
const GOLD: RGB = [201, 162, 39];
const GREEN: RGB = [21, 128, 61];
const GREEN_D: RGB = [20, 83, 45];
const GREEN_L: RGB = [220, 252, 231];
const WHITE: RGB = [255, 255, 255];
const CARD: RGB = [255, 255, 255];
const CARD_LINE: RGB = [214, 208, 192];
const MUTED: RGB = [107, 114, 128];
const ORANGE: RGB = [194, 65, 12];
const BLUE: RGB = [29, 78, 216];
const TEAL: RGB = [13, 116, 128];
const PURPLE: RGB = [107, 33, 168];
const YELLOW: RGB = [250, 204, 21];

class Canvas {
  buf = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(PAPER);
  }
  fill(c: RGB) {
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = c[0];
      this.buf[i * 3 + 1] = c[1];
      this.buf[i * 3 + 2] = c[2];
    }
  }
  px(x: number, y: number, c: RGB) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 3;
        this.buf[i] = c[0]; this.buf[i + 1] = c[1]; this.buf[i + 2] = c[2];
      }
    }
  }
  hline(x: number, y: number, w: number, c: RGB) { this.rect(x, y, w, 1, c); }
  vline(x: number, y: number, h: number, c: RGB) { this.rect(x, y, 1, h, c); }
  // Bresenham line, thickness w (square stamp).
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 1) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    const r = Math.floor(w / 2);
    for (;;) {
      this.rect(x - r, y - r, w, w, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB) {
    for (let y = -r; y <= r; y++) {
      const dx = Math.floor(Math.sqrt(r * r - y * y));
      this.rect(cx - dx, cy + y, dx * 2 + 1, 1, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 2) {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      for (let k = 0; k < t; k++) {
        this.px(Math.round(cx + (r - k) * Math.cos(rad)), Math.round(cy + (r - k) * Math.sin(rad)), c);
      }
    }
  }
  // Filled polygon, scanline fill.
  poly(pts: [number, number][], c: RGB) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(Math.round(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) this.rect(xs[k], y, xs[k + 1] - xs[k] + 1, 1, c);
    }
  }
  // Outlined rect (1px border).
  frame(x: number, y: number, w: number, h: number, c: RGB) {
    this.hline(x, y, w, c);
    this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c);
    this.vline(x + w - 1, y, h, c);
  }
}

// ------------------------------------------------------- 5x7 font -----
// Hand-drawn bitmap font: each glyph is 7 rows of 5 bits (MSB = left).
// Only uppercase + digits + punctuation; text is uppercased before draw.

const GLYPH: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b11111, 0b00010, 0b00100, 0b00010, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ',': [0, 0, 0, 0, 0b01100, 0b00100, 0b01000],
  ':': [0, 0b01100, 0b01100, 0, 0b01100, 0b01100, 0],
  ';': [0, 0b01100, 0b01100, 0, 0b01100, 0b00100, 0b01000],
  "'": [0b00100, 0b00100, 0b01000, 0, 0, 0, 0],
  '-': [0, 0, 0, 0b01110, 0, 0, 0],
  '+': [0, 0b00100, 0b00100, 0b01110, 0b00100, 0b00100, 0],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0, 0b00100],
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  '$': [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
  '*': [0, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
};

// Char advance in pixels at scale s: 5*s wide + 1*s gap.
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}

function drawText(cv: Canvas, x: number, y: number, raw: string, scale: number, c: RGB) {
  const s = raw.toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = GLYPH[ch] ?? GLYPH['?'];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row & (1 << (4 - col))) cv.rect(cx + col * scale, y + r * scale, scale, scale, c);
      }
    }
    cx += 6 * scale;
  }
}

function drawTextRight(cv: Canvas, xRight: number, y: number, s: string, scale: number, c: RGB) {
  drawText(cv, xRight - textWidth(s, scale), y, s, scale, c);
}

function drawTextCenter(cv: Canvas, xCenter: number, y: number, s: string, scale: number, c: RGB) {
  drawText(cv, xCenter - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// Greedy word wrap to maxWidth px; returns lines (already uppercased by drawText).
function wrapText(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, scale) <= maxWidth || cur === '') cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// Truncate with '..' so it fits maxWidth px.
function fitText(s: string, maxWidth: number, scale: number): string {
  if (textWidth(s, scale) <= maxWidth) return s;
  let t = s;
  while (t.length > 2 && textWidth(t + '..', scale) > maxWidth) t = t.slice(0, -1);
  return t + '..';
}

// ------------------------------------------------------- pictograms ----
// Each draws inside a 48x48 box at (x, y). Simple flat shapes, bold
// outlines so they read at small size.

function picShip(cv: Canvas, x: number, y: number) {
  // Burning warship: hull, mast, orange flames, smoke.
  cv.poly([[x + 4, y + 30], [x + 44, y + 30], [x + 38, y + 40], [x + 10, y + 40]], NAVY);
  cv.rect(x + 14, y + 20, 20, 10, NAVY2);
  cv.rect(x + 22, y + 8, 3, 12, INK);
  cv.poly([[x + 16, y + 20], [x + 22, y + 6], [x + 28, y + 20]], ORANGE);
  cv.poly([[x + 19, y + 20], [x + 22, y + 11], [x + 25, y + 20]], YELLOW);
  cv.circle(x + 34, y + 12, 4, MUTED);
  cv.circle(x + 40, y + 7, 3, MUTED);
  cv.rect(x, y + 42, 48, 3, BLUE); // sea
}

function picTanker(cv: Canvas, x: number, y: number) {
  // Oil tanker with a fireball.
  cv.poly([[x + 2, y + 26], [x + 46, y + 26], [x + 42, y + 38], [x + 6, y + 38]], [60, 60, 60]);
  cv.rect(x + 6, y + 14, 26, 12, RED);
  cv.rect(x + 36, y + 18, 8, 8, WHITE);
  cv.circle(x + 20, y + 10, 6, ORANGE);
  cv.circle(x + 20, y + 10, 3, YELLOW);
  cv.rect(x, y + 40, 48, 3, BLUE);
}

function picHazard(cv: Canvas, x: number, y: number) {
  // Yellow warning triangle, black border and "!".
  cv.poly([[x + 24, y + 4], [x + 44, y + 40], [x + 4, y + 40]], YELLOW);
  cv.poly([[x + 24, y + 9], [x + 40, y + 37], [x + 8, y + 37]], [26, 26, 26]);
  cv.poly([[x + 24, y + 12], [x + 37, y + 35], [x + 11, y + 35]], YELLOW);
  cv.rect(x + 22, y + 17, 4, 11, INK);
  cv.rect(x + 22, y + 31, 4, 4, INK);
}

function picBuilding(cv: Canvas, x: number, y: number) {
  // Damaged apartment block: cracked facade, dark windows, smoke.
  cv.rect(x + 8, y + 10, 32, 32, [120, 120, 120]);
  cv.poly([[x + 8, y + 10], [x + 24, y + 10], [x + 18, y + 22], [x + 28, y + 26], [x + 8, y + 26]], [90, 90, 90]);
  cv.rect(x + 12, y + 14, 6, 6, INK);
  cv.rect(x + 30, y + 14, 6, 6, INK);
  cv.rect(x + 12, y + 30, 6, 6, INK);
  cv.rect(x + 30, y + 30, 6, 6, INK);
  cv.line(x + 24, y + 10, x + 20, y + 24, INK, 2);
  cv.circle(x + 34, y + 6, 4, MUTED);
  cv.rect(x + 4, y + 42, 40, 3, INK);
}

function picSatellite(cv: Canvas, x: number, y: number) {
  // Satellite with two solar panels and a red star.
  cv.rect(x + 18, y + 18, 12, 12, NAVY2);
  cv.rect(x + 2, y + 14, 14, 20, BLUE);
  cv.rect(x + 32, y + 14, 14, 20, BLUE);
  cv.line(x + 4, y + 17, x + 14, y + 17, WHITE, 1);
  cv.line(x + 4, y + 24, x + 14, y + 24, WHITE, 1);
  cv.line(x + 4, y + 31, x + 14, y + 31, WHITE, 1);
  cv.line(x + 34, y + 17, x + 44, y + 17, WHITE, 1);
  cv.line(x + 34, y + 24, x + 44, y + 24, WHITE, 1);
  cv.line(x + 34, y + 31, x + 44, y + 31, WHITE, 1);
  cv.line(x + 24, y + 18, x + 30, y + 8, INK, 2);
  cv.circle(x + 31, y + 7, 2, RED);
  cv.circle(x + 40, y + 40, 2, YELLOW); // distant star
  cv.circle(x + 8, y + 42, 1, WHITE);
}

function picAirliner(cv: Canvas, x: number, y: number) {
  // Passenger jet, nose right, climbing.
  cv.poly([[x + 2, y + 24], [x + 40, y + 16], [x + 46, y + 20], [x + 40, y + 24], [x + 6, y + 28]], BLUE);
  cv.rect(x + 2, y + 24, 44, 2, WHITE);
  cv.poly([[x + 18, y + 26], [x + 28, y + 38], [x + 32, y + 38], [x + 28, y + 26]], NAVY2);
  cv.poly([[x + 6, y + 16], [x + 10, y + 8], [x + 14, y + 16]], NAVY2);
  cv.rect(x + 38, y + 17, 4, 2, WHITE);
  cv.line(x + 2, y + 40, x + 46, y + 40, MUTED, 1);
}

function picChart(cv: Canvas, x: number, y: number) {
  // Falling-then-steady chart with a red arrow down.
  cv.rect(x + 6, y + 6, 2, 34, INK);
  cv.rect(x + 6, y + 38, 36, 2, INK);
  cv.line(x + 8, y + 12, x + 18, y + 22, RED, 3);
  cv.line(x + 18, y + 22, x + 28, y + 20, RED, 3);
  cv.line(x + 28, y + 20, x + 40, y + 30, RED, 3);
  cv.poly([[x + 40, y + 30], [x + 34, y + 28], [x + 40, y + 36]], RED);
}

function picPhone(cv: Canvas, x: number, y: number) {
  // Smartphone with a play button (social video).
  cv.rect(x + 12, y + 4, 24, 40, INK);
  cv.rect(x + 15, y + 8, 18, 30, [30, 180, 200]);
  cv.poly([[x + 21, y + 14], [x + 21, y + 32], [x + 31, y + 23]], WHITE);
  cv.rect(x + 20, y + 40, 8, 2, WHITE);
}

function picJetBridge(cv: Canvas, x: number, y: number) {
  // Plane nose at a jet bridge, red alert triangle.
  cv.poly([[x + 2, y + 20], [x + 26, y + 20], [x + 30, y + 26], [x + 2, y + 26]], BLUE);
  cv.rect(x + 2, y + 22, 26, 2, WHITE);
  cv.rect(x + 30, y + 14, 14, 12, [150, 150, 150]);
  cv.rect(x + 30, y + 14, 14, 3, INK);
  cv.rect(x + 8, y + 30, 3, 10, INK);
  cv.rect(x + 16, y + 30, 3, 10, INK);
  cv.poly([[x + 40, y + 34], [x + 46, y + 44], [x + 34, y + 44]], RED);
  cv.rect(x + 39, y + 37, 2, 4, WHITE);
  cv.rect(x + 39, y + 42, 2, 2, WHITE);
}

function picTrain(cv: Canvas, x: number, y: number) {
  // Express train front, speeding right.
  cv.rect(x + 6, y + 10, 30, 26, [180, 30, 30]);
  cv.rect(x + 10, y + 14, 22, 8, [180, 230, 255]);
  cv.rect(x + 6, y + 26, 30, 4, WHITE);
  cv.circle(x + 12, y + 38, 3, INK);
  cv.circle(x + 30, y + 38, 3, INK);
  cv.line(x + 2, y + 42, x + 46, y + 42, INK, 2);
  cv.line(x + 38, y + 16, x + 46, y + 16, GOLD, 2);
  cv.line(x + 38, y + 22, x + 46, y + 22, GOLD, 2);
}

function picDocument(cv: Canvas, x: number, y: number) {
  // Official paper with a name struck through in red.
  cv.rect(x + 10, y + 4, 28, 40, WHITE);
  cv.frame(x + 10, y + 4, 28, 40, INK);
  cv.rect(x + 14, y + 10, 20, 3, INK);
  cv.rect(x + 14, y + 17, 20, 2, MUTED);
  cv.rect(x + 14, y + 22, 20, 2, MUTED);
  cv.rect(x + 14, y + 27, 14, 2, MUTED);
  cv.line(x + 13, y + 16, x + 35, y + 24, RED, 3);
  cv.rect(x + 14, y + 34, 12, 6, RED);
  drawText(cv, x + 15, y + 35, 'X', 1, WHITE);
}

function picRaceCar(cv: Canvas, x: number, y: number) {
  // Low red race car with spoiler.
  cv.rect(x + 36, y + 12, 3, 10, INK);
  cv.rect(x + 34, y + 10, 10, 3, INK);
  cv.poly([[x + 6, y + 30], [x + 12, y + 20], [x + 26, y + 18], [x + 34, y + 24], [x + 42, y + 26], [x + 42, y + 30]], RED);
  cv.rect(x + 14, y + 21, 10, 5, [180, 230, 255]);
  cv.circle(x + 14, y + 32, 5, INK);
  cv.circle(x + 14, y + 32, 2, WHITE);
  cv.circle(x + 36, y + 32, 5, INK);
  cv.circle(x + 36, y + 32, 2, WHITE);
  cv.line(x + 2, y + 38, x + 46, y + 38, INK, 2);
}

function picGrounded(cv: Canvas, x: number, y: number) {
  // Parked jet with a big red X over it.
  cv.poly([[x + 4, y + 22], [x + 34, y + 18], [x + 40, y + 21], [x + 34, y + 24], [x + 6, y + 26]], MUTED);
  cv.poly([[x + 16, y + 24], [x + 24, y + 34], [x + 27, y + 34], [x + 24, y + 24]], MUTED);
  cv.line(x + 2, y + 40, x + 46, y + 40, INK, 2);
  cv.line(x + 30, y + 6, x + 44, y + 20, RED, 4);
  cv.line(x + 44, y + 6, x + 30, y + 20, RED, 4);
}

function picArena(cv: Canvas, x: number, y: number) {
  // Arena dome with crowd dots and a green exit arrow.
  cv.poly([[x + 6, y + 38], [x + 6, y + 26], [x + 24, y + 10], [x + 42, y + 26], [x + 42, y + 38]], NAVY2);
  cv.rect(x + 20, y + 26, 8, 12, YELLOW);
  cv.circle(x + 12, y + 40, 2, INK);
  cv.circle(x + 20, y + 41, 2, INK);
  cv.circle(x + 28, y + 40, 2, INK);
  cv.circle(x + 36, y + 41, 2, INK);
  cv.line(x + 40, y + 6, x + 46, y + 6, GREEN, 3);
  cv.poly([[x + 46, y + 6], [x + 40, y + 2], [x + 40, y + 10]], GREEN);
}

function picChip(cv: Canvas, x: number, y: number, s: number) {
  // Computer chip, s = side of the die in px.
  const pin = Math.max(2, Math.floor(s / 12));
  const gap = Math.floor(s / 4);
  for (let i = 0; i < 3; i++) {
    const o = Math.floor(s / 4) + i * gap;
    cv.rect(x + o, y - pin - 2, pin, pin + 2, GOLD);
    cv.rect(x + o, y + s, pin, pin + 2, GOLD);
    cv.rect(x - pin - 2, y + o, pin + 2, pin, GOLD);
    cv.rect(x + s, y + o, pin + 2, pin, GOLD);
  }
  cv.rect(x, y, s, s, GREEN_D);
  cv.frame(x, y, s, s, GOLD);
  const inner = Math.floor(s / 3);
  cv.rect(x + inner, y + inner, s - 2 * inner, s - 2 * inner, GREEN);
  cv.frame(x + inner, y + inner, s - 2 * inner, s - 2 * inner, GOLD);
}

// ------------------------------------------------------------- data -----

type Pic = (cv: Canvas, x: number, y: number) => void;

interface Story {
  region: string;
  color: RGB;
  headline: string;
  caption: string;
  pic: Pic;
}

const STORIES: Story[] = [
  { region: 'AFRICA', color: PURPLE, headline: "UKRAINE SINKS RUSSIAN WARSHIP",
    caption: 'Sea drones sank the corvette Merkury off Benghazi, Libya; cargo ship Angara also hit.', pic: picShip },
  { region: 'MIDDLE EAST', color: ORANGE, headline: 'HORMUZ ATTACKS AT WARTIME PEAK',
    caption: 'Three more tankers hit leaving the Strait; about 25 struck since 14 Nov. Iran vows to break the US blockade.', pic: picTanker },
  { region: 'MIDDLE EAST', color: ORANGE, headline: "GAZA'S POISONED GROUND",
    caption: "Oxfam report: explosives have left Gaza's air, soil and water toxic for decades.", pic: picHazard },
  { region: 'EUROPE', color: BLUE, headline: 'DYMER STRIKE KILLS 11',
    caption: 'Russian drone hits a flat north of Kyiv; 17 killed across Ukraine overnight.', pic: picBuilding },
  { region: 'SPACE', color: NAVY2, headline: 'NUCLEAR SATELLITE ALARM',
    caption: "NATO intelligence: Russia is ready to orbit a nuclear-armed satellite, Sputnik-S, before year's end.", pic: picSatellite },
  { region: 'TRADE', color: TEAL, headline: 'CHINA TO BUY 250 MORE BOEINGS?',
    caption: 'Trump says Beijing will order 250 jets on top of 200 agreed in May; unconfirmed by Boeing or China.', pic: picAirliner },
  { region: 'ASIA', color: TEAL, headline: 'CHINA CUTS MARGIN RULES',
    caption: 'Exchanges cut margin needs from 100% to 80% to steady stocks after a selloff.', pic: picChart },
  { region: 'EUROPE', color: BLUE, headline: 'TIKTOK EUROPE FOR SALE?',
    caption: "Germany and Austria push European investors to buy 75-80% of TikTok's EU business.", pic: picPhone },
  { region: 'AMERICAS', color: RED, headline: 'ICE JET-BRIDGE ARREST OUTCRY',
    caption: 'Video of masked agents dragging a father and daughter off a Seattle flight sparks fury.', pic: picJetBridge },
  { region: 'ASIA', color: TEAL, headline: 'INDIA-NEPAL TRAIN ROLLS',
    caption: "Modi and Nepal's PM Shah flag off the Saryu-Kamala Express, Ayodhya to Janakpur.", pic: picTrain },
  { region: 'ASIA', color: TEAL, headline: "TALIBAN ERASES WOMEN'S NAMES",
    caption: "Balkh province orders women's names struck from official papers, replaced with Bibi.", pic: picDocument },
  { region: 'EUROPE', color: BLUE, headline: "FERRARI'S NEW 296S",
    caption: '296 Challenge Stradale and Evo unveiled at Finali Mondiali in Spain.', pic: picRaceCar },
  { region: 'ASIA', color: TEAL, headline: 'SPICEJET IN CRISIS',
    caption: 'Pilots urge India to act as the airline grounds jets over unpaid salaries and debts.', pic: picGrounded },
  { region: 'EUROPE', color: BLUE, headline: 'MANCHESTER ARENA EVACUATED',
    caption: '12,000 flee a Don Toliver show after an unknown substance is released; 89 treated.', pic: picArena },
];

// ------------------------------------------------------------ layout ----

function masthead(cv: Canvas) {
  cv.rect(0, 0, W, 96, NAVY);
  drawText(cv, 24, 22, 'THE WORLD', 6, WHITE);
  drawText(cv, 24, 70, 'TUESDAY 24 NOVEMBER 2026', 2, GOLD);
  drawTextRight(cv, 1000, 24, '15 STORIES', 2, WHITE);
  drawTextRight(cv, 1000, 52, '7 REGIONS - ONE DAY', 2, [200, 210, 230]);
  cv.rect(0, 96, W, 4, GOLD);
}

function hero(cv: Canvas) {
  const y0 = 104, y1 = 436;
  // --- left: the chart panel ---
  cv.rect(16, y0, 454, y1 - y0, GREEN_L);
  cv.frame(16, y0, 454, y1 - y0, [150, 200, 160]);
  drawText(cv, 34, y0 + 14, '+6.51%', 4, GREEN_D);
  drawText(cv, 34, y0 + 52, 'NASDAQ', 2, GREEN_D);
  drawText(cv, 34, y0 + 74, 'BEST DAY SINCE APRIL 2025', 1, MUTED);
  picChip(cv, 392, y0 + 18, 58);
  // axes
  const ax = 36, ay = y1 - 36, aw = 414, ah = 150;
  cv.rect(ax, ay - ah, 2, ah, INK);
  cv.rect(ax, ay, aw, 2, INK);
  cv.hline(ax, ay - 50, aw, [180, 210, 185]);
  cv.hline(ax, ay - 100, aw, [180, 210, 185]);
  const pts: [number, number][] = [
    [ax + 6, ay - 8], [ax + 56, ay - 28], [ax + 106, ay - 20], [ax + 156, ay - 62],
    [ax + 206, ay - 52], [ax + 256, ay - 96], [ax + 306, ay - 86], [ax + 356, ay - 128],
    [ax + 404, ay - 146],
  ];
  // area fill under the line
  const area: [number, number][] = [...pts, [pts[pts.length - 1][0], ay], [pts[0][0], ay]];
  cv.poly(area, [187, 247, 208]);
  for (let i = 0; i + 1 < pts.length; i++) {
    cv.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], GREEN, 5);
  }
  for (const [px, py] of pts) cv.circle(px, py, 4, GREEN_D);
  drawText(cv, ax + 2, ay + 8, 'S&P 500 +4.73%', 2, GREEN_D);
  // --- right: the headline panel ---
  const tx = 486, tw = 522;
  drawText(cv, tx, y0 + 12, 'MARKETS - AMERICAS', 2, RED);
  drawText(cv, tx, y0 + 44, "WALL STREET'S", 4, INK);
  drawText(cv, tx, y0 + 80, 'BEST DAY SINCE', 4, INK);
  drawText(cv, tx, y0 + 116, 'APRIL 2025', 4, INK);
  cv.rect(tx, y0 + 158, 120, 4, GOLD);
  drawText(cv, tx, y0 + 176, 'S&P 500 +4.73%   NASDAQ +6.51%', 2, GREEN);
  const cap = wrapText('Nvidia +31% - about $1 trillion added - as Jensen Huang returns as CEO after Trump stepped in.', tw, 2);
  cap.forEach((ln, i) => drawText(cv, tx, y0 + 208 + i * 26, ln, 2, INK));
  drawText(cv, tx, y1 - 26, 'CHIP STOCKS LED THE RALLY WORLDWIDE', 1, MUTED);
}

function grid(cv: Canvas) {
  drawText(cv, 16, 444, 'AROUND THE WORLD - 14 MORE STORIES', 2, NAVY);
  cv.rect(16, 466, W - 32, 2, NAVY);
  const colW = 488, gapX = 16, x0 = 16;
  const cellH = 72, gapY = 6, y0 = 474;
  STORIES.forEach((st, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const cx = x0 + col * (colW + gapX);
    const cy = y0 + row * (cellH + gapY);
    cv.rect(cx, cy, colW, cellH, CARD);
    cv.frame(cx, cy, colW, cellH, CARD_LINE);
    cv.rect(cx, cy, 4, cellH, st.color); // region spine
    st.pic(cv, cx + 12, cy + 12);
    const tx = cx + 68, tw = colW - 68 - 10;
    drawText(cv, tx, cy + 8, st.region, 1, st.color);
    drawText(cv, tx, cy + 20, fitText(st.headline, tw, 2), 2, INK);
    const lines = wrapText(st.caption, tw, 1).slice(0, 2);
    lines.forEach((ln, k) => drawText(cv, tx, cy + 40 + k * 10, ln, 1, MUTED));
  });
}

// -------------------------------------------------------------- main ----

function main() {
  const cv = new Canvas();
  masthead(cv);
  hero(cv);
  grid(cv);
  const png = encodePNG(W, H, cv.buf);
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'entry.png'), png);
}

main();
