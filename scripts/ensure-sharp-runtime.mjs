import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

const appDir = path.resolve(process.argv[2] || '.next/standalone')
const appRequire = createRequire(path.join(appDir, 'package.json'))
const sharpVersion = appRequire('sharp/package.json').version

// A successful import alone does not prove that native image processing works.
const smokeCheck = `
  const assert = require('node:assert/strict');
  const sharp = require('sharp');
  (async () => {
    const image = await sharp({ create: {
      width: 32, height: 32, channels: 4,
      background: { r: 40, g: 120, b: 200, alpha: 0.5 },
    }}).resize(8).webp().toBuffer();
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 8);
    assert.equal(metadata.height, 8);
    assert.equal(metadata.hasAlpha, true);
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
`

function verifyRuntime() {
  return spawnSync(process.execPath, ['-e', smokeCheck], {
    cwd: appDir,
    encoding: 'utf8',
    timeout: 30_000,
  })
}

if (verifyRuntime().status === 0) {
  console.log(`Sharp ${sharpVersion}: native resize and WebP encoding passed.`)
} else {
  // Standalone output built on macOS can contain only Darwin native packages.
  // Install the exact Sharp version separately so app dependencies stay intact.
  const staging = mkdtempSync(path.join(tmpdir(), 'aimeng-sharp-'))
  try {
    console.log(`Installing Sharp ${sharpVersion} native dependencies for ${process.platform}/${process.arch}.`)
    const install = spawnSync('npm', [
      'install', '--prefix', staging, '--include=optional', '--ignore-scripts',
      '--no-audit', '--no-fund', '--no-package-lock', '--save-exact',
      `--os=${process.platform}`, `--cpu=${process.arch}`, `sharp@${sharpVersion}`,
    ], { stdio: 'inherit', timeout: 180_000 })
    if (install.error || install.status !== 0) {
      throw new Error('Could not install native image dependencies; deployment must stop.')
    }

    const sourceDir = path.join(staging, 'node_modules', '@img')
    const targetDir = path.join(appDir, 'node_modules', '@img')
    const nativePackages = readdirSync(sourceDir).filter(name => name.startsWith('sharp-'))
    if (nativePackages.length === 0) throw new Error('No native Sharp packages were installed.')
    mkdirSync(targetDir, { recursive: true })
    for (const name of nativePackages) {
      cpSync(path.join(sourceDir, name), path.join(targetDir, name), { recursive: true })
    }

    const check = verifyRuntime()
    if (check.status !== 0) {
      throw new Error(`Native image processing failed after installation: ${check.stderr || check.error}`)
    }
    console.log(`Sharp ${sharpVersion}: native resize and WebP encoding passed.`)
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}
