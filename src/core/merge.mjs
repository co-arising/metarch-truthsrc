// merge.mjs — the diff-apply write policies (V4-7), ported from the production patch pipeline:
//
//   • mergeManualBlocks — the MANUAL-block merge (knowledge_base/design_docs/field_template/tools/
//     manifest_merge.mjs, verbatim semantics): the generated content is the BASE; the target's
//     `// ==== BEGIN MANUAL ==== … // ==== END MANUAL ====` blocks are implanted back in, anchored
//     by the nearest preceding `def` method name (same-name anchors consume their blocks in
//     appearance order — CommandHelpers' repeated helper objects). Anchor-less blocks pair by
//     group order. A target block with no staging anchor (method removed/renamed) REFUSES the
//     merge — silent block loss is the one failure this machinery exists to make impossible.
//
//   • mergeRoutesBlock — the conf/routes shared territory (live gen_api_layer index.mjs:252-271
//     block swap + apply_manifest.mjs MERGE_MARKERS discipline): the entry content IS the marker
//     block (`# >>> gen_api_layer (E301) >>>` … `# <<< gen_api_layer <<<`); the merge swaps the
//     target's marker region, byte-preserving everything outside it. Content-equal (after CRLF
//     normalization) → zero-write. No markers in the target → append (trimEnd + blank line +
//     block), prepending the generator fingerprint head when absent. Half-marker states (start
//     without end or vice versa) FAIL FAST — MarkerBlockWriter's H052/H053 discipline: a silent
//     append would produce a double start marker whose next segment swap would swallow the
//     manual territory.
//
// Deliberately NOT ported: --allow-manual-orphan (orphan blocks refuse, full stop — v0.4 has no
// exemption channel) and .gen-backup copies (truthsrc is git-native: the working tree is a git
// checkout and the VCS is the rollback).
const MANUAL_BEGIN = '// ==== BEGIN MANUAL ====';
const MANUAL_END = '// ==== END MANUAL ====';
const manualBlockRegex = /\/\/ ==== BEGIN MANUAL ====[\s\S]*?\/\/ ==== END MANUAL ====/g;

const countOf = (src, needle) => src.split(needle).length - 1;
const extractManualBlocks = (src) => {
  const out = [];
  const re = new RegExp(manualBlockRegex.source, 'g');
  let m;
  while ((m = re.exec(src)) !== null) out.push({ text: m[0], start: m.index });
  return out;
};
// Block anchor = the nearest preceding def method name (method-level positions in multi-block
// files; null → group-order pairing).
const anchorOf = (src, blockStart) => {
  const ms = [...src.slice(0, blockStart).matchAll(/(?:override\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)];
  return ms.length ? ms[ms.length - 1][1] : null;
};

export const hasManualBlocks = (src) => countOf(src, MANUAL_BEGIN) > 0 && countOf(src, MANUAL_BEGIN) === countOf(src, MANUAL_END);

/** Mask only the interiors of validated MANUAL blocks; markers and all outside bytes remain.
 * Callers hashing bytes can pass a latin1 string and encode the result as latin1 (no UTF-8 loss). */
export function maskManualBlocks(src, label = '') {
  mergeManualBlocks(src, src, label);
  return src.replace(manualBlockRegex, MANUAL_BEGIN + MANUAL_END);
}

/** Merge the target's MANUAL blocks into the generated base. `target` must contain ≥1 paired
 *  block (the caller gates on hasManualBlocks). Throws on malformed markers and orphan blocks. */
export function mergeManualBlocks(generated, target, label = '') {
  const tBlocks = extractManualBlocks(target);
  if (!tBlocks.length) {
    // Live's mergeContent passes the generated content through wholesale here (manifest-gated
    // unreachable); truthsrc refuses — an unpaired marker means hand content past the marker
    // would be silently dropped, the exact failure class this machinery exists to prevent.
    if (countOf(target, MANUAL_BEGIN) > 0 || countOf(target, MANUAL_END) > 0) {
      throw new Error(`${label}: MANUAL 区块标记畸形（BEGIN/END 不配对）——拒绝合并`);
    }
    return generated; // no MANUAL territory at all
  }
  if (countOf(target, MANUAL_BEGIN) !== tBlocks.length || countOf(target, MANUAL_END) !== tBlocks.length) {
    throw new Error(`${label}: MANUAL 区块标记畸形（BEGIN/END 不配对）——拒绝合并`);
  }
  const tNamed = new Map(); // anchor → [text, ...] in appearance order
  const tAnon = [];
  for (const b of tBlocks) {
    const a = anchorOf(target, b.start);
    if (a === null) tAnon.push(b.text);
    else { if (!tNamed.has(a)) tNamed.set(a, []); tNamed.get(a).push(b.text); }
  }
  let out = '';
  let cursor = 0;
  let anonIdx = 0;
  const used = new Map();
  for (const b of extractManualBlocks(generated)) {
    const a = anchorOf(generated, b.start);
    out += generated.slice(cursor, b.start);
    const slots = a !== null ? tNamed.get(a) : null;
    const usedN = a !== null ? (used.get(a) || 0) : 0;
    if (a !== null && slots && usedN < slots.length) { out += slots[usedN]; used.set(a, usedN + 1); }
    else if (a === null && anonIdx < tAnon.length) { out += tAnon[anonIdx++]; }
    else out += b.text; // generated-side block with no target counterpart: keep the generated body
    cursor = b.start + b.text.length;
  }
  out += generated.slice(cursor);
  const orphanNamed = [...tNamed.entries()].filter(([a, arr]) => arr.length - (used.get(a) || 0) > 0)
    .map(([a, arr]) => `def ${a} ×${arr.length - (used.get(a) || 0)}`);
  if (orphanNamed.length || anonIdx < tAnon.length) {
    const detail = [orphanNamed.join('、'), anonIdx < tAnon.length ? `无名锚块 ${tAnon.length - anonIdx} 个` : ''].filter(Boolean).join('＋');
    throw new Error(`${label}: 目标手写块无落点（${detail}——方法已被生成器移除/改名）——拒绝合并（防静默丢块）`);
  }
  return out;
}

const ROUTES_START = '# >>> gen_api_layer (E301) >>>';
const ROUTES_END = '# <<< gen_api_layer <<<';
const normCrlf = (x) => x.replace(/\r\n/g, '\n');

/** Swap the E301 marker region of `target` for `block` (entry content). Returns
 *  { text, changed } — changed=false means content-equal (CRLF-normalized) zero-write. */
export function mergeRoutesBlock(block, target, { release = null, label = 'conf/routes' } = {}) {
  const starts = countOf(target, ROUTES_START);
  const ends = countOf(target, ROUTES_END);
  if (starts > 0 && ends > 0) {
    if (starts !== 1 || ends !== 1) {
      throw new Error(`${label}: 标记块畸形（BEGIN/END 重复 ${starts}/${ends}）——拒绝合并`);
    }
    const begin = target.indexOf(ROUTES_START);
    const end = target.indexOf(ROUTES_END) + ROUTES_END.length;
    if (end < begin) throw new Error(`${label}: 标记块逆序——拒绝合并`);
    const region = target.slice(begin, end);
    if (normCrlf(region) === normCrlf(block)) return { text: target, changed: false };
    let newRegion = block;
    // line-ending alignment: staging writes LF, a CRLF-checkout target takes the target-dominant
    // style (apply_manifest.mjs:88-91 — mixed endings would fake a whole-block diff)
    if ((target.match(/\r\n/g) || []).length > (target.match(/(?<!\r)\n/g) || []).length) {
      newRegion = newRegion.replace(/\r?\n/g, '\r\n');
    }
    return { text: target.slice(0, begin) + newRegion + target.slice(end), changed: true };
  }
  if (starts > 0 || ends > 0) {
    throw new Error(`${label}: 标记态畸形（markerStart@${starts} markerEnd@${ends}）——半标记状态不可静默合并（追加会产生双起始标记，下轮段替换将吞掉手写领地）；请手工修复标记对后重跑`);
  }
  // No markers: append (zero deletion — existing content only loses trailing whitespace), and
  // the generator fingerprint head when the file carries none (live index.mjs:263-269).
  let out = target.replace(/\s+$/, '') + '\n\n' + block + '\n';
  if (!/^# @generated by/.test(out)) {
    out = `# @generated by gen_api_layer:2026-08-26\n${release != null ? `# @knowledge-release ${release}\n` : ''}${out}`;
  }
  return { text: out, changed: true };
}
