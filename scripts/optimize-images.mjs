// Regenerates the optimised image derivatives from the original photo.
//
//   pic.png      (2.2 MB source, gitignored)
//     -> pic.webp    ~133 KB  modern browsers
//     -> pic.avif    ~101 KB  even smaller where supported
//     -> pic-opt.png ~740 KB  quantised fallback for ancient browsers
//
// index.html references all three through a <picture> element, so browsers
// only ever download the one they can actually decode.
//
// Requires `npm install sharp` first.
import sharp from 'sharp';
import { statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'pic.png');

const kb = p => (statSync(p).size / 1024).toFixed(0) + ' KB';

const meta = await sharp(SRC).metadata();
console.log('source   :', kb(SRC), `(${meta.width}x${meta.height})`);

const pipeline = () => sharp(SRC).rotate().resize({ width: 1122, withoutEnlargement: true });

const webp = join(ROOT, 'pic.webp');
await pipeline().webp({ quality: 82, effort: 6 }).toFile(webp);
console.log('webp q82 :', kb(webp));

try {
  const avif = join(ROOT, 'pic.avif');
  await pipeline().avif({ quality: 60, effort: 6 }).toFile(avif);
  console.log('avif q60 :', kb(avif));
} catch (e) {
  console.log('avif     : skipped ->', e.message);
}

const png = join(ROOT, 'pic-opt.png');
await pipeline().png({ quality: 82, compressionLevel: 9, effort: 10, palette: true }).toFile(png);
console.log('png pal  :', kb(png));

const savings = (1 - statSync(webp).size / statSync(SRC).size) * 100;
console.log('\nwebp is', savings.toFixed(1) + '% lighter than the original PNG.');
