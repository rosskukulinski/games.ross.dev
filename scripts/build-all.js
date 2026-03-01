const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DIST_DIR = path.join(ROOT, 'dist');
const LANDING_DIR = path.join(ROOT, 'landing');
const MANIFEST_PATH = path.join(ROOT, '.build-cache.json');
const SCRIPT_PATH = __filename;

const games = [
  'balloon-pop-blitz',
  'guess-the-drawing',
  'hanyverse',
  'number-line-monster',
  'ojoj',
  'pet-care-game',
  'phase-10',
  'sir-name-alot',
  'unicorn-dragon',
];

const staticGames = ['number-line-monster', 'ojoj'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.DS_Store', '.wrangler', '.playwright-mcp', '.claude']);

const forceRebuild = process.argv.includes('--force');

// --- Helpers ---

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

function computeDirectoryHash(dir) {
  const files = collectFiles(dir).sort();
  const hash = crypto.createHash('sha256');
  for (const file of files) {
    const rel = path.relative(dir, file);
    hash.update(rel);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest('hex');
}

function computeDepsHash(gameDir) {
  const lockfile = path.join(gameDir, 'package-lock.json');
  if (fs.existsSync(lockfile)) {
    return crypto.createHash('sha256').update(fs.readFileSync(lockfile)).digest('hex');
  }
  const pkgFile = path.join(gameDir, 'package.json');
  if (fs.existsSync(pkgFile)) {
    return crypto.createHash('sha256').update(fs.readFileSync(pkgFile)).digest('hex');
  }
  return null;
}

function computeFileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadManifest() {
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    } catch {
      return { scriptHash: null, entries: {} };
    }
  }
  return { scriptHash: null, entries: {} };
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

// --- Main build ---

const manifest = loadManifest();
const scriptHash = computeFileHash(SCRIPT_PATH);
const scriptChanged = scriptHash !== manifest.scriptHash;

if (scriptChanged && !forceRebuild) {
  console.log('🔧 Build script changed — rebuilding all games');
}

if (forceRebuild) {
  console.log('🔧 Force rebuild requested');
}

// Create dist/ if missing (do NOT rm -rf)
fs.mkdirSync(DIST_DIR, { recursive: true });

let builtCount = 0;
let skippedCount = 0;

for (const game of games) {
  const gameDir = path.join(GAMES_DIR, game);
  const gameDist = path.join(DIST_DIR, game);
  const isStatic = staticGames.includes(game);

  const sourceHash = computeDirectoryHash(gameDir);
  const depsHash = isStatic ? null : computeDepsHash(gameDir);
  const cached = manifest.entries[game];

  const distExists = fs.existsSync(gameDist);
  const needsBuild =
    forceRebuild ||
    scriptChanged ||
    !cached ||
    cached.sourceHash !== sourceHash ||
    !distExists;

  if (!needsBuild) {
    console.log(`⏭️  Skipping ${game} (cached)`);
    skippedCount++;
    continue;
  }

  // Clean this game's dist output
  if (distExists) {
    fs.rmSync(gameDist, { recursive: true });
  }

  if (isStatic) {
    console.log(`\n📁 Copying static game: ${game}`);
    fs.mkdirSync(gameDist, { recursive: true });
    for (const entry of fs.readdirSync(gameDir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.DS_Store') continue;
      if (/^IMG_.*\.(jpeg|png)$/i.test(entry) || entry.startsWith('Screenshot')) continue;
      copyRecursive(path.join(gameDir, entry), path.join(gameDist, entry));
    }
    console.log(`✅ ${game} → dist/${game}/`);
  } else {
    const pkgPath = path.join(gameDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      console.log(`\n⚠️  Skipping ${game}: no package.json`);
      continue;
    }

    console.log(`\n🔨 Building: ${game}`);

    // Only run npm ci/install if deps changed or node_modules missing
    const nodeModulesExists = fs.existsSync(path.join(gameDir, 'node_modules'));
    const depsChanged = !cached || cached.depsHash !== depsHash;

    if (depsChanged || !nodeModulesExists) {
      const hasLockfile = fs.existsSync(path.join(gameDir, 'package-lock.json'));
      const installCmd = hasLockfile ? 'npm ci' : 'npm install';
      console.log(`  📦 ${installCmd}`);
      try {
        execSync(installCmd, { cwd: gameDir, stdio: 'inherit' });
      } catch (err) {
        console.error(`❌ Install failed for ${game}`);
        process.exit(1);
      }
    } else {
      console.log(`  📦 Dependencies unchanged, skipping install`);
    }

    try {
      execSync('npm run build', { cwd: gameDir, stdio: 'inherit' });
    } catch (err) {
      console.error(`❌ Build failed for ${game}`);
      process.exit(1);
    }

    const buildOutput = path.join(gameDir, 'dist');
    if (!fs.existsSync(buildOutput)) {
      console.error(`❌ No dist/ output for ${game}`);
      process.exit(1);
    }

    copyRecursive(buildOutput, gameDist);
    console.log(`✅ ${game} → dist/${game}/`);
  }

  manifest.entries[game] = { sourceHash, depsHash };
  builtCount++;
}

// Landing page
const landingHash = computeDirectoryHash(LANDING_DIR);
const cachedLanding = manifest.entries['_landing'];
const landingDistExists = fs.existsSync(path.join(DIST_DIR, 'index.html'));
const landingNeedsBuild =
  forceRebuild ||
  scriptChanged ||
  !cachedLanding ||
  cachedLanding.sourceHash !== landingHash ||
  !landingDistExists;

if (landingNeedsBuild) {
  if (fs.existsSync(LANDING_DIR)) {
    console.log('\n🏠 Copying landing page');
    for (const entry of fs.readdirSync(LANDING_DIR)) {
      const dest = path.join(DIST_DIR, entry);
      if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true });
      copyRecursive(path.join(LANDING_DIR, entry), dest);
    }
    console.log('✅ Landing page copied');
    manifest.entries['_landing'] = { sourceHash: landingHash, depsHash: null };
    builtCount++;
  }
} else {
  console.log('⏭️  Skipping landing page (cached)');
  skippedCount++;
}

// Clean stale entries from dist/ (games no longer in the list)
const validDirs = new Set([...games, ...fs.readdirSync(LANDING_DIR)]);
for (const entry of fs.readdirSync(DIST_DIR)) {
  if (!validDirs.has(entry)) {
    const fullPath = path.join(DIST_DIR, entry);
    if (fs.statSync(fullPath).isDirectory() && !games.includes(entry)) {
      console.log(`🧹 Removing stale: dist/${entry}/`);
      fs.rmSync(fullPath, { recursive: true });
      delete manifest.entries[entry];
    }
  }
}

// Save manifest
manifest.scriptHash = scriptHash;
saveManifest(manifest);

const total = games.length + 1; // +1 for landing
console.log(`\n🎉 Build complete! Built ${builtCount}/${total}, skipped ${skippedCount} (cached)`);
