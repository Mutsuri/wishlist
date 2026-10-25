// แปลงไฟล์ .ico (ภาพ BMP 32 บิต) เป็นไอคอน PNG ขนาดต่าง ๆ ลง public/
// รัน: node tools/icons-from-ico.mjs <ไฟล์.ico>
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const file = process.argv[2]
if (!file) throw new Error('ใส่ path ของไฟล์ .ico')
const ico = readFileSync(file)

// เลือกภาพที่ใหญ่ที่สุดในไฟล์
let best = null
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const o = 6 + i * 16
  const e = { w: ico[o] || 256, h: ico[o + 1] || 256, off: ico.readUInt32LE(o + 12) }
  if (!best || e.w > best.w) best = e
}
if (ico.slice(best.off, best.off + 4).toString('hex') === '89504e47') throw new Error('ภาพในไฟล์เป็น PNG อยู่แล้ว ใช้ไฟล์นั้นตรง ๆ ได้')

// BMP ใน ico: BITMAPINFOHEADER แล้วตามด้วยพิกเซล BGRA เรียงจากล่างขึ้นบน
const hdr = ico.readUInt32LE(best.off)
const bpp = ico.readUInt16LE(best.off + 14)
if (bpp !== 32) throw new Error(`รองรับเฉพาะ BMP 32 บิต (ไฟล์นี้ ${bpp} บิต)`)
const { w, h } = best
const src = new Float64Array(w * h * 4) // RGBA 0..1 แบบ premultiplied
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const p = best.off + hdr + ((h - 1 - y) * w + x) * 4
    const a = ico[p + 3] / 255
    const i = (y * w + x) * 4
    src[i] = (ico[p + 2] / 255) * a
    src[i + 1] = (ico[p + 1] / 255) * a
    src[i + 2] = (ico[p] / 255) * a
    src[i + 3] = a
  }
}

// ย่อ/ขยายแบบ bilinear แล้ววางบนพื้นทึบ (iPhone ไม่รองรับไอคอนโปร่งใส จะเติมสีดำให้)
function resize(size, bg) {
  const out = Buffer.alloc((size * 3 + 1) * size)
  const sample = (x, y, c) => src[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + c]
  // ย่อมาก ๆ เฉลี่ยหลายจุด กันภาพแตก
  const ss = Math.max(1, Math.ceil(w / size))
  for (let py = 0; py < size; py++) {
    out[py * (size * 3 + 1)] = 0
    for (let px = 0; px < size; px++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = ((px + (sx + 0.5) / ss) / size) * w - 0.5
          const fy = ((py + (sy + 0.5) / ss) / size) * h - 0.5
          const x0 = Math.floor(fx)
          const y0 = Math.floor(fy)
          const tx = fx - x0
          const ty = fy - y0
          for (let c = 0; c < 4; c++) {
            acc[c] +=
              sample(x0, y0, c) * (1 - tx) * (1 - ty) +
              sample(x0 + 1, y0, c) * tx * (1 - ty) +
              sample(x0, y0 + 1, c) * (1 - tx) * ty +
              sample(x0 + 1, y0 + 1, c) * tx * ty
          }
        }
      }
      const n = ss * ss
      const a = acc[3] / n
      const o = py * (size * 3 + 1) + 1 + px * 3
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(Math.min(1, acc[c] / n + bg[c] * (1 - a)) * 255)
    }
  }
  return png(size, out)
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
function crc32(buf) {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// พื้นหลังส่วนโปร่งใส: ขาว
const BG = [1, 1, 1]
const outDir = new URL('../public/', import.meta.url)
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['favicon.png', 32]]) {
  writeFileSync(new URL(name, outDir), resize(size, BG))
  console.log(`public/${name} ${size}x${size}`)
}
let transparent = 0
for (let i = 3; i < src.length; i += 4) if (src[i] < 0.99) transparent++
console.log(`source ${w}x${h}, transparent pixels: ${transparent}`)
