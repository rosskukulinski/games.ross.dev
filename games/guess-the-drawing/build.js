const fs = require('fs');
const path = require('path');

const DIST_DIR = 'dist';

// Files and directories to include in the build
const ASSETS = [
    'index.html',
    'css',
    'js'
];

// Clean and create dist directory
function cleanDist() {
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR);
}

// Copy a file or directory recursively
function copyRecursive(src, dest) {
    const stats = fs.statSync(src);

    if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        const files = fs.readdirSync(src);
        for (const file of files) {
            copyRecursive(path.join(src, file), path.join(dest, file));
        }
    } else {
        fs.copyFileSync(src, dest);
    }
}

// Build
console.log('Building to dist/...');
cleanDist();

for (const asset of ASSETS) {
    const src = path.join(__dirname, asset);
    const dest = path.join(__dirname, DIST_DIR, asset);

    if (fs.existsSync(src)) {
        copyRecursive(src, dest);
        console.log(`  Copied: ${asset}`);
    } else {
        console.warn(`  Warning: ${asset} not found`);
    }
}

console.log('Build complete!');
