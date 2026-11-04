'use strict';

// sherpa-onnx ships one native npm package per platform/arch (sherpa-onnx-linux-arm64, ...),
// and npm only installs the one matching the build machine. These helpers fetch the one a
// given electron-builder target needs and drop the others from the packaged app.

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Arch } = require('builder-util');

const ROOT = path.join(__dirname, '..', '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');
const PLATFORMS = { linux: 'linux', darwin: 'darwin', win32: 'win' }; // electron-builder -> package name

/** Native package name for an electron-builder target, e.g. ('linux', arm64) -> sherpa-onnx-linux-arm64. */
function nativePackageName(electronPlatformName, arch) {
  const plat = PLATFORMS[electronPlatformName];
  const archName = Arch[arch];
  if (!plat || !archName) throw new Error(`sherpa-onnx: unsupported target ${electronPlatformName}/${archName}`);
  return `sherpa-onnx-${plat}-${archName}`;
}

function wantedVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(NODE_MODULES, 'sherpa-onnx-node', 'package.json'), 'utf8'));
  return pkg.version;
}

/** Makes sure node_modules/<name> exists, downloading it from npm when the host did not install it. */
function ensureNativePackage(name) {
  const dest = path.join(NODE_MODULES, name);
  if (fs.existsSync(path.join(dest, 'package.json'))) return;

  const version = wantedVersion();
  console.log(`  • fetching ${name}@${version} (not installed on this machine)`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sherpa-'));
  try {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const out = execFileSync(npm, ['pack', `${name}@${version}`, '--pack-destination', tmp, '--silent'], { encoding: 'utf8', shell: process.platform === 'win32' });
    const tarball = path.join(tmp, out.trim().split(/\r?\n/).pop());
    execFileSync('tar', ['-xzf', tarball, '-C', tmp]);
    fs.mkdirSync(dest, { recursive: true });
    fs.cpSync(path.join(tmp, 'package'), dest, { recursive: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Unpacked resources dir of a packed app (macOS keeps it inside the .app bundle). */
function resourcesDir(context) {
  return context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
}

/** Removes the native packages of every other platform/arch from the packed app. */
function pruneOtherNativePackages(context) {
  const keep = nativePackageName(context.electronPlatformName, context.arch);
  const dir = path.join(resourcesDir(context), 'app.asar.unpacked', 'node_modules');
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (/^sherpa-onnx-(linux|darwin|win)-/.test(entry) && entry !== keep) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
      console.log(`  • removed ${entry} from the ${keep} build`);
    }
  }
  if (!fs.existsSync(path.join(dir, keep))) throw new Error(`${keep} is missing from the packed app`);
}

module.exports = { nativePackageName, ensureNativePackage, pruneOtherNativePackages };
