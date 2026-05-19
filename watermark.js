/**
 * watermark.js — добавляет вотермарку на все фото в assets/images/fotomatherial/
 * Запуск: node watermark.js
 */

const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const WATERMARK_TEXT = 'ДОН ГИДРО ДЕКОР · dgd61.ru';
const IMAGE_DIR      = path.join(__dirname, 'assets/images/fotomatherial');

/* ---- SVG-плашка под размер конкретного фото ---- */
function makeSVG(width, height) {
  // Размеры плашки — пропорционально ширине
  const bw      = Math.round(width * 0.27);          // ширина плашки
  const bh      = Math.round(bw * 0.33);             // высота плашки
  const margin  = Math.round(width * 0.018);         // отступ от края
  const bx      = width  - bw - margin;              // X левого края плашки
  const by      = height - bh - margin;              // Y верхнего края плашки

  const fs1     = Math.round(bw * 0.092);            // шрифт заголовка
  const fs2     = Math.round(bw * 0.075);            // шрифт домена
  const ls1     = 1;                                 // минимальный letter-spacing
  const ls2     = 2;                                 // letter-spacing домена
  const pad     = Math.round(bw * 0.08);             // внутренний отступ линии

  const cx      = bx + bw / 2;                       // центр плашки по X
  const y1      = by + Math.round(bh * 0.38);        // Y текста заголовка
  const lineY   = by + Math.round(bh * 0.57);        // Y разделительной линии
  const y2      = by + Math.round(bh * 0.82);        // Y домена

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- фон плашки -->
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}"
            rx="2"
            fill="rgba(15,19,28,0.52)"
            stroke="rgba(192,80,42,0.72)"
            stroke-width="1.2"/>
      <!-- название -->
      <text x="${cx}" y="${y1}"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fs1}"
            font-weight="700"
            letter-spacing="${ls1}"
            fill="rgba(255,255,255,0.92)">ДОН ГИДРО ДЕКОР</text>
      <!-- разделитель -->
      <line x1="${bx + pad}" y1="${lineY}" x2="${bx + bw - pad}" y2="${lineY}"
            stroke="rgba(192,80,42,0.65)" stroke-width="0.9"/>
      <!-- домен -->
      <text x="${cx}" y="${y2}"
            text-anchor="middle"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fs2}"
            font-weight="400"
            letter-spacing="${ls2}"
            fill="rgba(192,80,42,0.95)">dgd61.ru</text>
    </svg>
  `);
}

/* ---- обработка одного файла ---- */
async function processImage(filePath) {
  const os = require('os');
  // Копируем во временный файл без спецсимволов (sharp на Windows не любит скобки)
  const tmpPath = path.join(os.tmpdir(), `wm_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
  fs.copyFileSync(filePath, tmpPath);

  try {
    const meta = await sharp(tmpPath).metadata();
    const svg  = makeSVG(meta.width, meta.height);

    const buf = await sharp(tmpPath)
      .composite([{ input: svg, top: 0, left: 0 }])
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    fs.writeFileSync(filePath, buf);
    console.log(`  ✅ ${path.relative(__dirname, filePath)}`);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

/* ---- рекурсивный поиск JPG/JPEG/PNG ---- */
function findImages(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())                        result.push(...findImages(full));
    else if (/\.(jpe?g|png)$/i.test(entry.name))   result.push(full);
  }
  return result;
}

/* ---- main ---- */
async function main() {
  console.log('\n🔍 Ищем фотографии в', IMAGE_DIR);
  const images = findImages(IMAGE_DIR);
  console.log(`📸 Найдено: ${images.length} файлов\n`);

  let ok = 0, fail = 0;
  for (const img of images) {
    try {
      await processImage(img);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${img}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅ Готово: ${ok} обработано${fail ? `, ${fail} ошибок` : ''}.`);
  console.log('   Теперь запустите: git add assets/ && git commit -m "watermark: добавлены вотермарки на все фото"\n');
}

main().catch(err => { console.error(err); process.exit(1); });
