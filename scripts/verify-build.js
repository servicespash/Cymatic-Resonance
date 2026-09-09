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
        
        if (file === 'sitemap.xml') {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"') && content.includes('<urlset')) {
                console.log(`✅ ${file} has valid URLSET namespace.`);
            } else {
                console.error(`❌ ${file} has invalid content/missing namespace.`);
                process.exit(1);
            }
        }
    } else {
        console.error(`❌ ${file} missing in dist/`);
        process.exit(1);
    }
});

console.log('--- Build verification passed ---');
