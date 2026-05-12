#!/usr/bin/env node
/**
 * Unpacks a Claude Design bundle (index.html) into a clean HTML file.
 * Usage: node unpack.js [input] [output]
 * Defaults: input=index.html, output=index_real.html
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputFile  = process.argv[2] || 'index.html';
const outputFile = process.argv[3] || 'index_real.html';
const assetsDir  = path.join(path.dirname(outputFile), 'assets', 'bundled');

const html = fs.readFileSync(inputFile, 'utf8');

// Extract JSON content between script tags by type
function extractScriptContent(src, type) {
  const re = new RegExp(
    `<script[^>]+type="${type.replace(/\//g, '\\/')}"[^>]*>([\\s\\S]*?)<\\/script>`,
    'i'
  );
  const m = src.match(re);
  if (!m) throw new Error(`Missing <script type="${type}"> in ${inputFile}`);
  return m[1].trim();
}

console.log('Reading manifest…');
const manifest = JSON.parse(extractScriptContent(html, '__bundler/manifest'));

console.log('Reading template…');
let template = JSON.parse(extractScriptContent(html, '__bundler/template'));

// ext_resources: map uuid → original id (filename hint)
let extResources = [];
try {
  extResources = JSON.parse(extractScriptContent(html, '__bundler/ext_resources'));
} catch (_) {}

const idByUuid = {};
for (const r of extResources) idByUuid[r.uuid] = r.id;

// Save each asset and build uuid → relative path map
const uuids = Object.keys(manifest);
console.log(`Decoding ${uuids.length} assets…`);

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const urlMap = {};

for (const uuid of uuids) {
  const entry = manifest[uuid];
  const raw = Buffer.from(entry.data, 'base64');
  let bytes = raw;

  if (entry.compressed) {
    try {
      bytes = zlib.gunzipSync(raw);
    } catch (e) {
      console.warn(`  warn: could not gunzip ${uuid}: ${e.message}`);
    }
  }

  // Derive filename
  let ext = '';
  const mime = entry.mime || '';
  const mimeExt = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/avif': '.avif',
    'font/woff2': '.woff2', 'font/woff': '.woff', 'font/ttf': '.ttf',
    'font/otf': '.otf',
    'text/css': '.css', 'application/javascript': '.js',
    'text/javascript': '.js', 'text/html': '.html',
  };
  ext = mimeExt[mime] || '';

  // Use ext_resources hint if available, otherwise uuid
  const hint = idByUuid[uuid];
  let filename;
  if (hint) {
    // sanitise: keep only safe chars
    filename = hint.replace(/[^a-zA-Z0-9._-]/g, '_') + (hint.includes('.') ? '' : ext);
  } else {
    filename = uuid + ext;
  }

  const destPath = path.join(assetsDir, filename);
  fs.writeFileSync(destPath, bytes);

  const relPath = path.relative(path.dirname(outputFile), destPath).replace(/\\/g, '/');
  urlMap[uuid] = relPath;
}

// Replace UUIDs in template
console.log('Replacing UUID placeholders…');
for (const [uuid, relPath] of Object.entries(urlMap)) {
  template = template.split(uuid).join(relPath);
}

// Strip integrity/crossorigin attributes (no longer needed with local paths)
template = template
  .replace(/\s+integrity="[^"]*"/gi, '')
  .replace(/\s+crossorigin="[^"]*"/gi, '');

fs.writeFileSync(outputFile, template, 'utf8');
console.log(`\nDone! Written to: ${outputFile}`);
console.log(`Assets saved to:  ${assetsDir}`);
