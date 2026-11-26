// Source-span diagnostic formatter for co-arising 2.0 (EARS_* & V2_* file:line:col + caret snippets).
import { existsSync, readFileSync } from 'node:fs';

export function formatSourceSnippet(sourceText, { line = 1, col = 1, file = '<input>' } = {}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) return null;
  const lines = sourceText.replace(/\r\n?/gu, '\n').split('\n');
  const clampedLine = Math.max(1, Math.min(line, lines.length));
  const clampedCol = Math.max(1, col);
  const gutterWidth = String(Math.min(lines.length, clampedLine + 1)).length;
  const pad = n => String(n).padStart(gutterWidth, ' ');

  const out = [`  --> ${file}:${clampedLine}:${clampedCol}`];
  out.push(`${' '.repeat(gutterWidth)} |`);
  if (clampedLine > 1) {
    out.push(`${pad(clampedLine - 1)} | ${lines[clampedLine - 2]}`);
  }
  const targetText = lines[clampedLine - 1] ?? '';
  out.push(`${pad(clampedLine)} | ${targetText}`);
  const caretOffset = Math.max(0, Math.min(clampedCol - 1, targetText.length));
  out.push(`${' '.repeat(gutterWidth)} | ${' '.repeat(caretOffset)}^`);
  if (clampedLine < lines.length) {
    out.push(`${pad(clampedLine + 1)} | ${lines[clampedLine]}`);
  }
  return out.join('\n');
}

export function enrichDiagnostic(diag, sourceCache = new Map()) {
  const file = diag.file ?? null;
  const line = diag.line ?? diag.span?.line ?? null;
  const col = diag.col ?? diag.span?.col ?? 1;
  if (!file || !line) {
    return diag;
  }

  let sourceText = sourceCache.get(file);
  if (sourceText === undefined && existsSync(file)) {
    try {
      sourceText = readFileSync(file, 'utf8');
      sourceCache.set(file, sourceText);
    } catch {
      sourceText = null;
    }
  }

  const location = `${file}:${line}:${col}`;
  const snippet = sourceText ? formatSourceSnippet(sourceText, { line, col, file }) : null;
  return {
    ...diag,
    line,
    col,
    location,
    ...(snippet ? { snippet } : {}),
  };
}

export function enrichDiagnostics(diagnostics, sourceCache = new Map()) {
  return diagnostics.map(d => enrichDiagnostic(d, sourceCache));
}
