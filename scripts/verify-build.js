const fs = require('fs');
const path = require('path');

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
