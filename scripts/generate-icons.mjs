import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svgPath = resolve(root, 'public/icon.svg');
const svg = readFileSync(svgPath);

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(root, 'public', name));
  console.log(`Generated ${name} (${size}x${size})`);
}

// Generate favicon.ico (32x32 PNG wrapped - browsers accept PNG as .ico)
const ico32 = await sharp(svg).resize(32, 32).png().toBuffer();
writeFileSync(resolve(root, 'src/app/favicon.ico'), ico32);
console.log('Generated favicon.ico');

console.log('Done!');
