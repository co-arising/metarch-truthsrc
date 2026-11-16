#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { runVerifiedProcess } from '../../lib/verification/process.mjs';
import { assertCanonicalPath, captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';

// Four public CLI calls; the existing supervisor owns deadlines and reaping.
const J = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const need = (ok, message) => { if (!ok) throw new Error(message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = file => JSON.parse(captureEvidenceFile(file).value.toString('utf8'));
const pin = file => ({ file, ...fingerprintEvidenceFile(file) });
function save(file, data) {
  assertCanonicalPath(file, { kind: 'new' });
  fs.writeFileSync(file, Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
function sourcePaths() {
  const files = [], dirs = [];
  function visit(dir) {
    assertCanonicalPath(dir); dirs.push(dir);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      need(!entry.isSymbolicLink(), 'symlink in shipped source directories');
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && (/\.(?:mjs|js)$/u.test(entry.name) || entry.name === 'generator.json')) files.push(file);
    }
  }
  for (const dir of ['lib', 'generators', 'src/core', 'bin']) visit(path.join(J, dir));
  return { files, dirs };
}
function checkPins(rows) {
  for (const row of rows) {
    const actual = pin(row.file);
    need(actual.bytes === row.bytes && actual.sha256 === row.sha256, 'replay source or expected drift: ' + row.file);
  }
}
function archivePins() {
  const file = J + '/test/reference/classic-cqrs-v2/manifest.json', manifest = json(file);
  need(Array.isArray(manifest.files), 'reference manifest files required');
  const rows = manifest.files.map(row => {
    need(typeof row.path === 'string' && path.posix.normalize(row.path) === row.path &&
      !row.path.includes('\\') && !row.path.split('/').includes('..') &&
      ['test/reference/classic-cqrs-v2/', 'test/fixtures/classic-cqrs-v2/'].some(root => row.path.startsWith(root)), 'reference manifest path outside replay assets');
    return { file: J + '/' + row.path, bytes: row.bytes, sha256: row.sha256 };
  });
  checkPins(rows);
  return [...rows, pin(file)];
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: node tools/codegen-parity/replay-classic-v2.mjs --out <new-absolute-root>\n' +
    'Node >=22.13. Darwin sandbox required. Root must be a new direct child of the physical repository .rounds/ or system temporary directory.\n' +
    'Runs baseline and timestamp-int through public generation and full-byte comparison; no tests, JVM, downloads or runtime certification.');
} else {
  let W, result;
  try {
    const [major, minor] = process.versions.node.split('.').map(Number);
    need(major > 22 || (major === 22 && minor >= 13), 'Node >=22.13 required');
    need(args.length === 2 && args[0] === '--out' && path.isAbsolute(args[1]) && path.resolve(args[1]) === args[1], 'explicit canonical --out required');
    assertCanonicalPath(J);
    const candidate = args[1], parent = path.dirname(candidate);
    assertCanonicalPath(parent);
    need(parent === J + '/.rounds' || parent === fs.realpathSync(tmpdir()), 'output parent must be physical .rounds/ or the system temporary directory');
    assertCanonicalPath(candidate, { kind: 'new' });
    fs.mkdirSync(candidate, { mode: 0o700 }); W = candidate;
    const A = W + '/actual', RT = W + '/runtime', E = W + '/evidence';
    for (const dir of [A, RT, E, RT + '/home', RT + '/tmp']) fs.mkdirSync(dir, { mode: 0o700 });
    result = { schemaVersion: 'truthsrc.classic-byte-replay/v1', verdict: 'BLOCKED', comparedFilesPerInput: 15,
      readiness: { level: 'classic-scaffold-only', runnable: false }, calls: [],
      boundary: 'Only two existing inputs, 15 complete Scala files each. Not full-family, quality, compilation or business/runtime verification.' };
    const source = sourcePaths(), reference = archivePins();
    const options = J + '/test/fixtures/classic-cqrs-f1/options.json';
    const inputs = ['baseline.json', 'timestamp-int.json'].map(name => J + '/test/fixtures/classic-cqrs-f1/' + name);
    const pins = [...new Map([...source.files.map(pin), ...reference, ...inputs.map(pin), pin(options), pin(J + '/package.json'),
      pin(J + '/tools/codegen-parity.mjs'), pin(fileURLToPath(import.meta.url)), pin(process.execPath)]
      .map(row => [row.file, row])).values()];
    save(E + '/source-before.json', pins);
    const dirs = new Set(source.dirs);
    for (const file of [...pins.map(row => row.file), E + '/placeholder', A + '/placeholder', RT + '/placeholder']) {
      for (let dir = path.dirname(file); ; dir = path.dirname(dir)) { dirs.add(dir); if (dir === path.dirname(dir)) break; }
    }
    const q = JSON.stringify;
    const system = ['/System/Library', '/usr/lib', '/Library/Apple/System/Library', '/private/var/db/dyld', '/usr/share/icu', '/private/var/db/timezone/zoneinfo'];
    const policy = '(version 1)\n(allow default)\n(deny network*)\n(deny file-write*)\n(deny file-read-data)\n' +
      '(allow file-read-data ' + system.map(dir => '(subpath ' + q(dir) + ')').join(' ') +
      ' (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom") (literal "/private/etc/localtime") ' +
      [...new Set([...pins.map(row => row.file), ...dirs])].map(file => '(literal ' + q(file) + ')').join(' ') +
      ' (subpath ' + q(A) + ') (subpath ' + q(RT) + '))\n' +
      '(allow file-write* (subpath ' + q(A) + ') (subpath ' + q(RT) + '))\n';
    const profile = E + '/sandbox.sb'; save(profile, policy);
    const sandbox = { executable: '/usr/bin/sandbox-exec', profile, profileSha256: hash(policy) };
    const env = { HOME: RT + '/home', TMPDIR: RT + '/tmp', PATH: path.dirname(process.execPath) + ':/usr/bin:/bin',
      LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC', NODE_V8_COVERAGE: '' };
    for (const variant of ['baseline', 'timestamp-int']) {
      checkPins(pins);
      const out = A + '/' + variant;
      const commands = [
        ['generate', [J + '/bin/truthsrc.js', 'generate-products', '--request', J + '/test/fixtures/classic-cqrs-v2/request-' + variant + '.json',
          '--generator', J + '/generators/scala-cqrs-classic-v2', '--out', out, '--options-json', options]],
        ['compare', [J + '/tools/codegen-parity.mjs', '--expected', J + '/test/reference/classic-cqrs-v2/' + variant, '--actual', out,
          '--scope', J + '/test/reference/classic-cqrs-v2/scope.json']],
      ];
      for (const [stage, argv] of commands) {
        const receipt = await runVerifiedProcess({ executable: process.execPath, args: argv, cwd: J, env,
          base: E + '/' + variant + '.' + stage, timeoutMs: 120000, sandbox });
        result.calls.push({ variant, stage, code: receipt.code, passed: receipt.passed, receipt: pin(receipt.paths.receipt),
          stdout: pin(receipt.paths.stdout), stderr: pin(receipt.paths.stderr) });
        need(receipt.passed && receipt.code === 0, 'public ' + stage + ' failed: ' + variant + '; see captured stderr');
        const output = json(receipt.paths.stdout);
        if (stage === 'generate') need(output.applied === true && output.readiness?.runnable === false, 'scaffold-only generation result required');
        else {
          save(E + '/' + variant + '.comparison.json', captureEvidenceFile(receipt.paths.stdout).value);
          need(output.status === 'equal' && output.counts.comparedPaths === 15 && output.counts.equalFiles === 15 &&
            output.counts.differentFiles === 0 && output.counts.unavailableFiles === 0 && output.counts.expectedInventoryFiles === 15 &&
            output.counts.actualInventoryFiles === 17 && Object.values(output.membership).every(side => !side.missing.length && !side.unexpected.length), 'complete 15-file comparison required');
        }
        checkPins(pins);
        console.log(JSON.stringify({ variant, stage, code: receipt.code, comparedFiles: stage === 'compare' ? 15 : null }));
      }
    }
    checkPins(pins); save(E + '/source-after.json', pins);
    result.verdict = 'PASS'; result.integrity = { unchanged: true, pinCount: pins.length };
  } catch (error) {
    if (result) result.failure = error.message;
    console.error(error.message); process.exitCode = 2;
  } finally {
    if (W && result) { save(W + '/completion.json', result); console.log(JSON.stringify({ verdict: result.verdict, completion: W + '/completion.json' })); }
  }
}
