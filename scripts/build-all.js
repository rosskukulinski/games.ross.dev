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

const games = require('./games-list.js');

const staticGames = ['connect-four', 'hangman', 'number-line-monster', 'ojoj', 'sudoku', 'tic-tac-toe'];

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

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Writes dist/sw.js from scripts/sw-template.js, injecting the list of every
// built file plus a version hash derived from their contents.
function buildServiceWorker() {
  // sw.js is the worker itself; _headers and _redirects are Cloudflare Pages
  // config that is never served, so precaching them would just 404.
  const notPrecacheable = new Set(['sw.js', '_headers', '_redirects']);
  const files = collectFiles(DIST_DIR)
    .filter((file) => !notPrecacheable.has(path.basename(file)) && !file.endsWith('.map'))
    .sort();

  const template = fs.readFileSync(path.join(__dirname, 'sw-template.js'), 'utf8');

  const hash = crypto.createHash('sha256');
  // The worker's own logic is part of the version: changing how things are
  // cached has to retire the cache built by the previous logic, not reuse it.
  hash.update(template);

  const assets = [];
  const shell = [];

  for (const file of files) {
    const rel = path.relative(DIST_DIR, file).split(path.sep).join('/');
    const contents = fs.readFileSync(file);
    hash.update(rel);
    hash.update(contents);

    // Cache pages under the URL the browser actually navigates to. Cloudflare
    // Pages 308-redirects /index.html to /, and Safari refuses to serve a
    // response carrying a redirect to a navigation, so fetching by the
    // directory name is what keeps the cached copy usable offline.
    const url =
      path.basename(rel) === 'index.html' ? `./${rel.slice(0, -'index.html'.length)}` : `./${rel}`;
    assets.push([url, contents.length]);
    // Anything outside a game directory is the landing page — cached during
    // install so the arcade opens immediately, before the library finishes.
    if (!games.includes(rel.split('/')[0])) shell.push(url);
  }

  const version = hash.digest('hex').slice(0, 12);
  const totalBytes = assets.reduce((sum, [, bytes]) => sum + bytes, 0);

  const replacements = {
    __VERSION__: version,
    __ASSETS__: JSON.stringify(assets),
    __SHELL__: JSON.stringify(shell),
  };

  let source = template;
  for (const [token, value] of Object.entries(replacements)) {
    if (!source.includes(token)) {
      console.error(`❌ sw-template.js is missing the ${token} placeholder`);
      process.exit(1);
    }
    // Function form: file names must never be read as $-replacement patterns.
    source = source.replaceAll(token, () => value);
  }

  fs.writeFileSync(path.join(DIST_DIR, 'sw.js'), source);
  console.log(
    `\n📦 Service worker: ${assets.length} files, ${formatBytes(totalBytes)} offline (build ${version})`
  );
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

// Clean stale entries from dist/ (games no longer in the list, and landing
// files that have since been renamed or deleted). Files matter as much as
// directories here: dist/ is restored from the CI cache between runs, and the
// service worker precaches whatever it finds, so a leftover page would be
// shipped and cached indefinitely.
const GENERATED = new Set(['sw.js']); // written further down, after this sweep
const validEntries = new Set([...games, ...fs.readdirSync(LANDING_DIR)]);
for (const entry of fs.readdirSync(DIST_DIR)) {
  if (validEntries.has(entry) || GENERATED.has(entry)) continue;
  const fullPath = path.join(DIST_DIR, entry);
  if (fs.statSync(fullPath).isDirectory()) {
    console.log(`🧹 Removing stale: dist/${entry}/`);
    fs.rmSync(fullPath, { recursive: true });
    delete manifest.entries[entry];
  } else {
    console.log(`🧹 Removing stale: dist/${entry}`);
    fs.rmSync(fullPath);
  }
}

// Service worker — regenerated every run, since dist/ is the source of truth
// for what to precache and the version hash is what tells browsers to update.
buildServiceWorker();

// Save manifest
manifest.scriptHash = scriptHash;
saveManifest(manifest);

const total = games.length + 1; // +1 for landing
console.log(`\n🎉 Build complete! Built ${builtCount}/${total}, skipped ${skippedCount} (cached)`);
