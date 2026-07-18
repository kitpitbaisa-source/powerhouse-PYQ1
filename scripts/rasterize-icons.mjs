import sharp from 'sharp';
import { readFileSync } from 'fs';

async function render(svgPath, outPath, size) {
  const svg = readFileSync(svgPath);
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(outPath);
  console.log('wrote', outPath);
}

// Adaptive layers (1024x1024)
await render('assets/icon-background.svg', 'assets/icon-background.png', 1024);
await render('assets/icon-foreground.svg', 'assets/icon-foreground.png', 1024);

// Composed full icon (background + foreground) for legacy / store use
const bg = await sharp('assets/icon-background.png').toBuffer();
const fg = await sharp('assets/icon-foreground.png').toBuffer();
await sharp(bg)
  .composite([{ input: fg }])
  .png()
  .toFile('assets/icon-only.png');
console.log('wrote assets/icon-only.png');

// A rounded 512 preview for download/reference
await sharp('assets/icon-only.png').resize(512, 512).png().toFile('assets/app-icon-512.png');
console.log('wrote assets/app-icon-512.png');
