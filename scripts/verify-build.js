import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToVerify = ['sitemap.xml', 'robots.txt'];
const distDir = path.join(__dirname, '../dist');

console.log('--- Verifying build assets ---');

filesToVerify.forEach(file => {
    const filePath = path.join(distDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} exists in dist/`);
    } else {
        console.error(`❌ ${file} missing in dist/`);
        process.exit(1);
    }
});

console.log('--- Build verification passed ---');
