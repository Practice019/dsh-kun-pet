// 生成 README 展示图片：docs/logo.png、docs/preview.gif、docs/states.png
import sharp from 'file:///D:/npm-global/node_modules/@deepseek-ai/dsh/node_modules/sharp/dist/index.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const SPRITE = 'D:/test/ai_study/1/dsh-kun-like-pet/assets/spritesheet.webp'
const DOCS = 'D:/test/ai_study/1/dsh-kun-like-pet/docs'
mkdirSync(DOCS, { recursive: true })

const CW = 192, CH = 208

// ===== 1. logo.png：idle 第一帧，放大 2x =====
const logo = await sharp(SPRITE)
  .extract({ left: 0, top: 0, width: CW, height: CH })
  .resize(CW * 2, CH * 2, { kernel: 'nearest' })
  .png().toBuffer()
writeFileSync(DOCS + '/logo.png', logo)
console.log('logo.png:', logo.length, 'bytes')

// ===== 2. preview-sequence.png：idle 6 帧横排分解图 =====
const FRAME_W = 150, FRAME_H = Math.round(FRAME_W * CH / CW), gap2 = 10
const seqW = FRAME_W * 6 + gap2 * 7, seqH = FRAME_H + gap2 * 2
const seqLayers = [await sharp({ create: { width: seqW, height: seqH, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 255 } } }).png().toBuffer()]
const seqCells = []
for (let i = 0; i < 6; i++) {
  seqCells.push(sharp(SPRITE)
    .extract({ left: i * CW, top: 0, width: CW, height: CH })
    .resize(FRAME_W, FRAME_H, { kernel: 'nearest' })
    .png().toBuffer()
    .then((buf) => ({ input: buf, left: gap2 + i * (FRAME_W + gap2), top: gap2 })))
}
const seqResolved = await Promise.all(seqCells)
const seqImg = await sharp(seqLayers[0]).composite(seqResolved).png().toBuffer()
writeFileSync(DOCS + '/preview-sequence.png', seqImg)
console.log('preview-sequence.png:', seqImg.length, 'bytes')

// ===== 3. states.png：9 状态第一帧 3×3 网格 =====
const states = ['idle', 'runRight', 'runLeft', 'wave', 'jump', 'failed', 'waiting', 'working', 'review']
const cellW = 160, cellH = Math.round(160 * CH / CW), gap = 10
const gridW = cellW * 3 + gap * 4, gridH = cellH * 3 + gap * 4

const layers = [await sharp({ create: { width: gridW, height: gridH, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 255 } } }).png().toBuffer()]
const cells = []
states.forEach((st, idx) => {
  const row = Math.floor(idx / 3), col = idx % 3
  const rowIdx = { idle: 0, runRight: 1, runLeft: 2, wave: 3, jump: 4, failed: 5, waiting: 6, working: 7, review: 8 }[st]
  const left = gap + col * (cellW + gap)
  const top = gap + row * (cellH + gap)
  cells.push(sharp(SPRITE)
    .extract({ left: 0, top: rowIdx * CH, width: CW, height: CH })
    .resize(cellW, cellH, { kernel: 'nearest' })
    .png().toBuffer()
    .then((buf) => ({ input: buf, left, top })))
})
const resolved = await Promise.all(cells)
const statesImg = await sharp(layers[0]).composite(resolved).png().toBuffer()
writeFileSync(DOCS + '/states.png', statesImg)
console.log('states.png:', statesImg.length, 'bytes')
console.log('ALL DONE')
