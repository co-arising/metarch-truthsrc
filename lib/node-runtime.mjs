// Keep this module free of application imports: it runs before node:sqlite.
export const MIN_NODE_VERSION = '22.13.0';

export function supportsNode(version) {
  if (typeof version !== 'string') return false;
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const actual = match.slice(1).map(Number), minimum = MIN_NODE_VERSION.split('.').map(Number);
  if (!actual.every(Number.isSafeInteger)) return false;
  for (let i = 0; i < minimum.length; i++) {
    if (actual[i] !== minimum[i]) return actual[i] > minimum[i];
  }
  return true;
}

export function assertNodeRuntime(version = process.versions.node) {
  if (!supportsNode(version)) {
    throw new Error(`NODE_VERSION: truthsrc requires Node >=${MIN_NODE_VERSION}; found ${version}. Upgrade Node before running this command (built-in SQLite must be available without flags). Help and --version remain available; no project files were written.`);
  }
}
