import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { compileAuthorEntries, safeAuthorFile, checkAuthorDirectory } from './author-surface.mjs';

export function authorFiles(treeDir) {
  const files = [], directories = [], aliases = new Set();
  let bytes = 0;
  const walk = (relative = '') => {
    const root = join(treeDir, relative), stat = lstatSync(root);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('AUTHOR_PATH: regular directory required: ' + root);
    for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const file = relative ? relative + '/' + entry.name : entry.name, full = join(treeDir, file), s = lstatSync(full);
      safeAuthorFile(file);
      const alias = file.normalize('NFC').toLowerCase();
      if (aliases.has(alias)) throw new Error('AUTHOR_PATH: filename alias ' + file);
      aliases.add(alias);
      if (s.isSymbolicLink() || !s.isDirectory() && !s.isFile()) throw new Error('AUTHOR_PATH: regular input required: ' + file);
      if (s.isDirectory()) { directories.push(file); walk(file); }
      else {
        bytes += s.size;
        if (bytes > 8 * 1024 * 1024) throw new Error('AUTHOR_PATH: tree exceeds 8 MiB');
        const content = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(full));
        files.push({ file, content });
      }
    }
  };
  walk();
  return { files, directories };
}
export function loadAuthorTree(treeDir) {
  const { files, directories } = authorFiles(treeDir);
  const result = compileAuthorEntries(files, { rootName: basename(resolve(treeDir)) });
  const fileNames = new Set(files.map(f => f.file));
  for (const dir of directories) checkAuthorDirectory(dir, result.context.id, fileNames);
  return result;
}
