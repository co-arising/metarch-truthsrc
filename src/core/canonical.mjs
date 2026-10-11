// canonical.mjs — canonical.json loader with schema-version gate.
import { readFileSync } from 'node:fs';

const vnum = (v) => Number(String(v).replace('truthsrc/v', ''));

export function loadCanonical(file, inputSchema) {
  let c;
  try { c = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`canonical malformed: ${file} (${e.message})`); }
  if (c.schemaVersion !== 'truthsrc/v1')
    throw new Error(`${file}: schemaVersion ${c.schemaVersion} not recognized (truthsrc/v1)`);
  if (vnum(c.schemaVersion) < vnum(inputSchema))
    throw new Error(`${file}: canonical ${c.schemaVersion} older than generator's declared inputSchema ${inputSchema}`);
  return c;
}
