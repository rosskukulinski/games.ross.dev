// Launch options that work both in CI (preinstalled Chromium) and locally.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function launchOptions(): { executablePath?: string } {
  const candidates = [
    '/opt/pw-browsers/chromium',
    path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return { executablePath: c };
  return {};
}
