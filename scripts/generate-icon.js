#!/usr/bin/env node
/**
 * Generates images/icon.png using only Node.js built-ins (no external deps).
 * Run: node scripts/generate-icon.js
 */
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const W = 128, H = 128;

// ── CRC32 ──────────────────────────────────────────────────────────────────
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let v = 0xFFFFFFFF;
  for (const b of buf) v = table[(v ^ b) & 0xFF] ^ (v >>> 8);
  return (v ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const lb = Buffer.alloc(4); lb.writeUInt32BE(data.length);
  const tb = Buffer.from(type, 'ascii');
  const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([lb, tb, data, cb]);
}

// ── Pixel helpers ──────────────────────────────────────────────────────────
// rows: flat array, format per row: [filterByte, R,G,B, R,G,B, ...]
const rows = new Array(H * (W * 3 + 1)).fill(0);

function idx(x, y) { return 1 + y * (W * 3 + 1) + x * 3; }

function setPixel(x, y, r, g, b) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = idx(x, y);
  rows[i] = r; rows[i + 1] = g; rows[i + 2] = b;
}

function getPixel(x, y) {
  const i = idx(x, y);
  return [rows[i], rows[i + 1], rows[i + 2]];
}

// ── Background: blue gradient + rounded corners ────────────────────────────
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = (x + y) / (W + H - 2);
    const rx = Math.min(x, W - 1 - x);
    const ry = Math.min(y, H - 1 - y);
    const inCorner = rx < 22 && ry < 22 && Math.hypot(rx - 22, ry - 22) > 22;
    if (inCorner) {
      setPixel(x, y, 0, 0, 0);
    } else {
      setPixel(x, y,
        Math.round(0x3B + (0x1E - 0x3B) * t),
        Math.round(0x82 + (0x3A - 0x82) * t),
        Math.round(0xF6 + (0x8A - 0xF6) * t)
      );
    }
  }
}

// ── Drawing primitives (anti-aliased via pixel blending) ───────────────────
function blend(x, y, alpha) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const [r, g, b] = getPixel(x, y);
  const a = Math.min(1, alpha);
  setPixel(x, y,
    Math.round(r + (255 - r) * a),
    Math.round(g + (255 - g) * a),
    Math.round(b + (255 - b) * a)
  );
}

function drawCircleAA(cx, cy, rad, sw) {
  const r0 = rad - sw / 2, r1 = rad + sw / 2;
  for (let y = Math.floor(cy - r1 - 1); y <= Math.ceil(cy + r1 + 1); y++) {
    for (let x = Math.floor(cx - r1 - 1); x <= Math.ceil(cx + r1 + 1); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= r0 - 1 && d <= r1 + 1) {
        const alpha = 1 - Math.max(0, Math.min(1, Math.abs(d - rad) - sw / 2 + 0.5));
        blend(x, y, alpha);
      }
    }
  }
}

function drawEllipseAA(cx, cy, rx, ry, sw) {
  for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      const norm = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const dist = Math.abs(norm - 1) * Math.min(rx, ry);
      if (dist < sw / 2 + 1) {
        blend(x, y, 1 - Math.max(0, dist - sw / 2 + 0.5));
      }
    }
  }
}

function drawHLineAA(y0, x1, x2, th) {
  for (let y = Math.floor(y0 - th / 2 - 1); y <= Math.ceil(y0 + th / 2 + 1); y++) {
    const alpha = 1 - Math.max(0, Math.abs(y - y0) - th / 2 + 0.5);
    if (alpha <= 0) continue;
    for (let x = x1; x <= x2; x++) blend(x, y, alpha);
  }
}

// ── Globe ──────────────────────────────────────────────────────────────────
const GX = 64, GY = 50, GR = 30;
drawCircleAA(GX, GY, GR, 5.5);
drawEllipseAA(GX, GY, 13, GR, 4);
drawHLineAA(GY,      GX - GR + 1, GX + GR - 1, 4);
drawHLineAA(GY - 15, GX - 23,     GX + 23,     2.5);
drawHLineAA(GY + 15, GX - 23,     GX + 23,     2.5);

// ── "TR" label (pixel font, 7×5 per char, scale 3) ────────────────────────
const GLYPHS = {
  T: [
    [1,1,1,1,1],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
    [0,0,1,0,0],
  ],
  R: [
    [1,1,1,1,0],
    [1,0,0,0,1],
    [1,0,0,0,1],
    [1,1,1,1,0],
    [1,0,1,0,0],
    [1,0,0,1,0],
    [1,0,0,0,1],
  ],
};

function drawGlyph(char, ox, oy, scale) {
  const g = GLYPHS[char];
  for (let row = 0; row < g.length; row++) {
    for (let col = 0; col < g[row].length; col++) {
      if (!g[row][col]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          setPixel(ox + col * scale + dx, oy + row * scale + dy, 255, 255, 255);
        }
      }
    }
  }
}

const scale = 3;
const charW = 5 * scale;
const gap   = 2 * scale;
const totalW = charW * 2 + gap;
const startX = Math.round((W - totalW) / 2);
const startY = 88;

drawGlyph('T', startX, startY, scale);
drawGlyph('R', startX + charW + gap, startY, scale);

// ── Encode PNG ─────────────────────────────────────────────────────────────
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2;  // 8-bit RGB

const idat = zlib.deflateSync(Buffer.from(rows));
const sig  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const png  = Buffer.concat([
  sig,
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', idat),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, '..', 'images', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`Generated ${out} (${png.length} bytes)`);
