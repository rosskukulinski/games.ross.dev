const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DIST_DIR = path.join(ROOT, 'dist');
const LANDING_DIR = path.join(ROOT, 'landing');

const games = [
  'guess-the-drawing',
  'hanyverse',
  'ojoj',
  'pet-care-game',
  'phase-10',
  'sir-name-alot',
  'unicorn-dragon',
];

const staticGames = ['ojoj'];

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

// Clean dist
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Build each game
for (const game of games) {
  const gameDir = path.join(GAMES_DIR, game);
  const gameDist = path.join(DIST_DIR, game);

  if (staticGames.includes(game)) {
    console.log(`\n📁 Copying static game: ${game}`);
    fs.mkdirSync(gameDist, { recursive: true });
    for (const entry of fs.readdirSync(gameDir)) {
      if (entry === 'node_modules' || entry === '.git' || entry === '.DS_Store') continue;
      if (/^IMG_.*\.(jpeg|png)$/i.test(entry) || entry.startsWith('Screenshot')) continue;
      copyRecursive(path.join(gameDir, entry), path.join(gameDist, entry));
    }
    continue;
  }

  const pkgPath = path.join(gameDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.log(`\n⚠️  Skipping ${game}: no package.json`);
    continue;
  }

  console.log(`\n🔨 Building: ${game}`);
  const hasLockfile = fs.existsSync(path.join(gameDir, 'package-lock.json'));
  const installCmd = hasLockfile ? 'npm ci' : 'npm install';

  try {
    execSync(`${installCmd} && npm run build`, {
      cwd: gameDir,
      stdio: 'inherit',
    });
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

// Copy landing page
if (fs.existsSync(LANDING_DIR)) {
  console.log('\n🏠 Copying landing page');
  for (const entry of fs.readdirSync(LANDING_DIR)) {
    copyRecursive(path.join(LANDING_DIR, entry), path.join(DIST_DIR, entry));
  }
  console.log('✅ Landing page copied');
}

console.log('\n🎉 Build complete!');
