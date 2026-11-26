// Tests for co-arising 2.0 P2 ecosystem deliverables:
//   #8 External docs & error code manual presence
//   #9 Cross-platform GitHub Actions CI matrix workflow validity
//   #10 TextMate grammar + live JSON-RPC 2.0 stdio EARS LSP (diagnostics, go-to-definition, hover)
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { encodeLspFrame } from '../lib/v2/ears-lsp.mjs';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);
const BIN = join(REPO_ROOT, 'bin/truthsrc.js');

function decodeLspFrames(rawStdout) {
  const messages = [];
  let buf = Buffer.from(rawStdout, 'utf8');
  while (buf.length > 0) {
    const headerEnd = buf.indexOf('\r\n\r\n');
    if (headerEnd < 0) break;
    const header = buf.slice(0, headerEnd).toString('utf8');
    const m = header.match(/Content-Length:\s*(\d+)/iu);
    if (!m) break;
    const len = Number(m[1]);
    const bodyStart = headerEnd + 4;
    if (buf.length < bodyStart + len) break;
    messages.push(JSON.parse(buf.slice(bodyStart, bodyStart + len).toString('utf8')));
    buf = buf.slice(bodyStart + len);
  }
  return messages;
}

test('P2 #8 + #9: external developer docs, error code manual, and cross-platform CI matrix workflow exist and are valid', () => {
  const quickstart = join(REPO_ROOT, 'knowledge_base/guides/co_arising_v2_quickstart.md');
  const grammar = join(REPO_ROOT, 'knowledge_base/reference/ears_v2_grammar_reference.md');
  const errors = join(REPO_ROOT, 'knowledge_base/reference/v2_diagnostics_error_codes.md');
  const ciFile = join(REPO_ROOT, '.github/workflows/co_arising_v2_ci.yml');

  for (const p of [quickstart, grammar, errors, ciFile]) {
    assert.ok(existsSync(p), `missing expected deliverable: ${p}`);
  }
  const errText = readFileSync(errors, 'utf8');
  for (const code of ['EARS_UNKNOWN_ENUM_LITERAL', 'EARS_UNKNOWN_TRIGGER_EVENT', 'V2_PATH_LAYER_MISMATCH', 'V2_BILINGUAL_DRIFT', 'V2_SOLVER_MISSING', 'TERRITORY_LOCKED']) {
    assert.ok(errText.includes(code), `error manual missing ${code}`);
  }
  const ciText = readFileSync(ciFile, 'utf8');
  assert.ok(ciText.includes('ubuntu-latest') && ciText.includes('macos-latest') && ciText.includes('--strict'));
});

test('P2 #10: TextMate grammar is valid JSON and `truthsrc lsp-ears` serves live diagnostics, go-to-definition, and hover over stdio', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'editor/ears-vscode/package.json'), 'utf8'));
  const langCfg = JSON.parse(readFileSync(join(REPO_ROOT, 'editor/ears-vscode/language-configuration.json'), 'utf8'));
  const tm = JSON.parse(readFileSync(join(REPO_ROOT, 'editor/ears-vscode/syntaxes/ears.tmLanguage.json'), 'utf8'));
  assert.equal(pkg.contributes.languages[0].id, 'ears');
  assert.equal(langCfg.comments.lineComment, '#');
  assert.equal(tm.scopeName, 'source.ears');
  assert.ok(JSON.stringify(tm).includes('forall') && JSON.stringify(tm).includes('切片'));

  const dir = mkdtempSync(join(tmpdir(), 'coarising-p2-lsp-'));
  try {
    mkdirSync(join(dir, 'structures'), { recursive: true });
    mkdirSync(join(dir, 'behaviors/domain'), { recursive: true });

    const structFile = join(dir, 'structures/core.yaml');
    writeFileSync(structFile, [
      'system: lsp-lab',
      'context: core',
      'aggregates:',
      '  - name: VaultGate',
      '    aliases: [gate, state]',
      '    stateFields:',
      '      - name: status',
      '        type: String',
      '        enum: ["open", "locked"]',
      '    commands:',
      '      - name: Lock',
      '        parameters: []',
      '        produces: [VaultLocked]',
      '    events:',
      '      - name: VaultLocked',
      '        fields: []',
    ].join('\n'), 'utf8');

    const earsFile = join(dir, 'behaviors/domain/vault-gate.ears');
    const earsText = [
      'slice VaultGate.Lock',
      'rules:',
      '  [VG1] IF gate.status == "typo_state" THEN SHALL reject request with BAD',
      '  [VG2] WHILE gate.status == "open" WHEN Lock SHALL emit VaultLocked',
    ].join('\n');
    writeFileSync(earsFile, earsText, 'utf8');

    const earsUri = pathToFileURL(earsFile).href;
    const structUri = pathToFileURL(structFile).href;

    const inputFrames = [
      encodeLspFrame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { processId: null, rootUri: pathToFileURL(dir).href, capabilities: {} } }),
      encodeLspFrame({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri: earsUri, languageId: 'ears', version: 1, text: earsText } } }),
      // Cursor on "VaultGate" at line 0, col 8
      encodeLspFrame({ jsonrpc: '2.0', id: 2, method: 'textDocument/definition', params: { textDocument: { uri: earsUri }, position: { line: 0, character: 8 } } }),
      // Cursor on "VaultLocked" at line 3, col 58
      encodeLspFrame({ jsonrpc: '2.0', id: 3, method: 'textDocument/hover', params: { textDocument: { uri: earsUri }, position: { line: 3, character: 58 } } }),
      // Now change document to a story inside domain/ to verify live V2_PATH_LAYER_MISMATCH diagnostic
      encodeLspFrame({
        jsonrpc: '2.0',
        method: 'textDocument/didChange',
        params: {
          textDocument: { uri: earsUri, version: 2 },
          contentChanges: [{ text: 'story MisplacedStory layer application\nrules:\n  [M1] WHEN P.run SHALL reject request with ERR\n' }],
        },
      }),
      encodeLspFrame({ jsonrpc: '2.0', id: 4, method: 'shutdown', params: null }),
      encodeLspFrame({ jsonrpc: '2.0', method: 'exit', params: null }),
    ].join('');

    const proc = spawnSync(process.execPath, [BIN, 'lsp-ears'], {
      input: inputFrames,
      encoding: 'utf8',
      timeout: 15_000,
    });
    assert.equal(proc.status, 0, proc.stderr);

    const msgs = decodeLspFrames(proc.stdout);
    const initReply = msgs.find(m => m.id === 1);
    assert.equal(initReply.result.capabilities.definitionProvider, true);
    assert.equal(initReply.result.capabilities.hoverProvider, true);

    const diagNotifs = msgs.filter(m => m.method === 'textDocument/publishDiagnostics');
    assert.ok(diagNotifs.length >= 2);
    assert.ok(diagNotifs[0].params.diagnostics.some(d => d.code === 'EARS_UNKNOWN_ENUM_LITERAL'));
    assert.ok(diagNotifs[1].params.diagnostics.some(d => d.code === 'V2_PATH_LAYER_MISMATCH'));

    const defReply = msgs.find(m => m.id === 2);
    assert.equal(defReply.result.uri, structUri);
    assert.equal(defReply.result.range.start.line, 3);

    const hoverReply = msgs.find(m => m.id === 3);
    assert.ok(hoverReply.result.contents.value.includes('VaultLocked'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
