// Per-file tree diff for the family-replacement program (plan F5).
//
// Before any classic template is removed, the new emitter output and the
// classic output are compared file by file and the resulting list is shown to
// the user. This tool is the fixed form of that comparison: two trees in, one
// deterministic per-file verdict out — IDENTICAL / CHANGED / ONLY-IN-OLD /
// ONLY-IN-NEW, each with byte counts and sha256 fingerprints.
//
// Usage:
//   node emitter/diff-report.mjs <oldDir> <newDir> [--json] [--fail-on-diff]
// Exit code 0 unless --fail-on-diff is passed and any difference exists
// (a diff is an expected, reportable outcome of a replacement — not an error).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const fail = (code, message) => { throw Object.assign(new Error(code + ': ' + message), { code }); };

const walkTree = (root) => {
  const files = new Map();
  const visit = (absolute, relative) => {
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = relative === '' ? entry.name : relative + '/' + entry.name;
      if (entry.isDirectory()) visit(childAbsolute, childRelative);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(childAbsolute);
        files.set(childRelative.split(path.sep).join('/'), {
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  };
  visit(root, '');
  return files;
};

export function diffTrees(oldDir, newDir) {
  for (const [label, dir] of [['old', oldDir], ['new', newDir]]) {
    if (typeof dir !== 'string' || dir.length === 0)
      {fail('EMITTER_DIFF', `${label} directory argument must be nonempty text`);}
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
      {fail('EMITTER_DIFF', `${label} directory ${JSON.stringify(dir)} does not exist or is not a directory`);}
  }
  const oldFiles = walkTree(oldDir);
  const newFiles = walkTree(newDir);
  const relatives = [...new Set([...oldFiles.keys(), ...newFiles.keys()])].sort();
  const files = relatives.map(relative => {
    const oldFile = oldFiles.get(relative);
    const newFile = newFiles.get(relative);
    if (!newFile) return { file: relative, status: 'ONLY-IN-OLD', oldBytes: oldFile.bytes, newBytes: null, oldSha256: oldFile.sha256, newSha256: null };
    if (!oldFile) return { file: relative, status: 'ONLY-IN-NEW', oldBytes: null, newBytes: newFile.bytes, oldSha256: null, newSha256: newFile.sha256 };
    const identical = oldFile.sha256 === newFile.sha256;
    return { file: relative, status: identical ? 'IDENTICAL' : 'CHANGED', oldBytes: oldFile.bytes, newBytes: newFile.bytes, oldSha256: oldFile.sha256, newSha256: newFile.sha256 };
  });
  const count = status => files.filter(file => file.status === status).length;
  return {
    oldDir,
    newDir,
    summary: {
      identical: count('IDENTICAL'),
      changed: count('CHANGED'),
      onlyInOld: count('ONLY-IN-OLD'),
      onlyInNew: count('ONLY-IN-NEW'),
      oldFiles: oldFiles.size,
      newFiles: newFiles.size,
    },
    files,
  };
}

export function runDiffCli(argv) {
  const positional = [];
  let json = false, failOnDiff = false;
  for (const arg of argv) {
    if (arg === '--json') json = true;
    else if (arg === '--fail-on-diff') failOnDiff = true;
    else positional.push(arg);
  }
  if (positional.length !== 2)
    {fail('EMITTER_USAGE', 'usage: diff-report.mjs <oldDir> <newDir> [--json] [--fail-on-diff]');}
  const report = diffTrees(positional[0], positional[1]);
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else {
    const { summary } = report;
    process.stdout.write(`old=${summary.oldFiles} files, new=${summary.newFiles} files — ` +
      `IDENTICAL ${summary.identical}, CHANGED ${summary.changed}, ONLY-IN-OLD ${summary.onlyInOld}, ONLY-IN-NEW ${summary.onlyInNew}\n`);
    for (const file of report.files) {
      if (file.status === 'IDENTICAL') continue;
      const size = old => old === null ? '-' : String(old);
      process.stdout.write(`${file.status.padEnd(11)} ${file.file}  (${size(file.oldBytes)}B → ${size(file.newBytes)}B)\n`);
    }
    if (report.files.every(file => file.status === 'IDENTICAL')) process.stdout.write('all files IDENTICAL\n');
  }
  if (failOnDiff && (report.summary.changed + report.summary.onlyInOld + report.summary.onlyInNew) > 0)
    {process.exitCode = 1;}
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    runDiffCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exitCode = 1;
  }
}
