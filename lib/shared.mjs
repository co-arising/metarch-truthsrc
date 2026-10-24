// shared.mjs — tree atom parsing/serialization shared by compile, decompose & validate.
//
// Design invariants (enforced by the roundtrip gate, see roundtrip.mjs):
//   I1  Byte-deterministic: same tree → byte-identical canonical, always.
//   I2  Roundtrip identity: decompose(compile(tree)) ≡ tree, byte for byte.
//   I3  Payload verbatim: the payload block is the workshop's own JSON, never
//       rewritten, reordered, or annotated by the compiler.
//   I4  No hidden state: everything lives in the tree; canonical.json is a
//       pure projection and safe to delete at any time.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const STAGE_ORDER = [
  'eventStorming', 'commandStorming', 'aggregateDiscovery', 'subdomainExploration',
  'contextMapping', 'refining', 'storyMapping',
];

export const STAGE_CODE = {
  eventStorming: 'es', commandStorming: 'cs', aggregateDiscovery: 'ad',
  subdomainExploration: 'sd', contextMapping: 'cm', refining: 'rf', storyMapping: 'sm',
};

export const NOTE_TYPES = [
  'event', 'question', 'command', 'role', 'policy', 'aggregate', 'entity',
  'readModel', 'timer', 'externalSystem', 'context', 'subdomain', 'relation', 'field', 'story',
];

// v0.4: 13-artifact inbox layout — product directory → v0.3 stage code.
// The directory order IS the canonical product order (01..13). The stage code
// is the note's origin.stage (workshop vocabulary), so validate/compile/
// decompose treat both layouts uniformly: a note in 01-event-flow/ carries
// origin.stage=eventStorming, exactly as if it lived in inbox/eventStorming/.
// Directories absent from a given tree are simply skipped.
export const INBOX_PRODUCTS = [
  ['01-event-flow', 'eventStorming'],
  ['02-commands', 'commandStorming'],
  ['03-aggregates', 'aggregateDiscovery'],
  ['04-subdomains', 'subdomainExploration'],
  ['05-context-map', 'contextMapping'],
  ['06-aggregate-detail', 'refining'],
  ['07-aggregate-relations', 'refining'],
  ['08-message-detail', 'refining'],
  ['09-lineage', 'refining'],
  ['10-policies', 'refining'],
  ['11-stories', 'storyMapping'],
  ['12-use-cases', 'refining'],
  ['13-read-models', 'refining'],
];

// Resolve an inbox subdirectory name to its stage code.
// Returns the stage for a v0.3 stage-code dir, the mapped stage for a v0.4
// product dir, or null for anything else (caller skips it).
export function inboxDirStage(dirName) {
  if (STAGE_ORDER.includes(dirName)) return dirName;
  const hit = INBOX_PRODUCTS.find(([d]) => d === dirName);
  return hit ? hit[1] : null;
}

// List inbox subdirectories that resolve to a stage, in deterministic order.
// Each entry is { dir, stage } where dir is the on-disk directory name.
// Both v0.3 (inbox/<stage>/) and v0.4 (inbox/01-event-flow/ …) layouts are
// accepted; unknown directories are skipped. Ordering: v0.3 stage dirs in
// STAGE_ORDER, then v0.4 product dirs in INBOX_PRODUCTS order — deterministic
// either way, and a tree uses one layout or the other, not both.
export function listInboxStages(treeDir) {
  const inbox = join(treeDir, 'inbox');
  if (!existsSync(inbox)) return [];
  const names = new Set(readdirSync(inbox, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name));
  const out = [];
  for (const stage of STAGE_ORDER)
    if (names.has(stage)) out.push({ dir: stage, stage });
  for (const [dir, stage] of INBOX_PRODUCTS)
    if (names.has(dir)) out.push({ dir, stage });
  return out;
}

// Atom kinds — one file per atom; `kind` is the first header line.
//   note         L1 sticky note (inbox/<stage>/ or aggregates/<slug>/notes/)
//   policy       L1 policy with structured triggers/invokes (policies/)
//   aggregate    solution contract (aggregates/<slug>/aggregate.yaml)
//   slice        one command's vertical slice (aggregates/<slug>/slices/)
//   value-object global VO catalog (value-objects/)
//   read-model   decision view (read-models/)
//   story        user story (stories/)
//   use-cases    single flow-model file (use-cases.yaml)
//   pipeline     v0.4 (scenario A): an ordered business-step queue
//                (pipelines/<slug>.pipeline.yaml). Step vocabulary is `steps`
//                — never `stages` ("stage" is overloaded: pipeline step vs
//                equipment stage vs workshop stage).
//   scenario     v0.4 (scenario A): a narrative script / demo runbook
//                (scenarios/<slug>.scenario.yaml); free-form content.
//   saga         cross-aggregate transaction product (sagas/<slug(id)>.saga.yaml):
//                scalar identity headers + one verbatim payload JSON object.
export const ATOM_KINDS = [
  'note', 'policy', 'aggregate', 'slice', 'value-object', 'read-model', 'story', 'use-cases',
  'pipeline', 'scenario', 'saga',
];

export const BANNER = '# ═══ truthsrc atom — hand-editable; contract: SCHEMA.md ═══';

// v0.5: Relation registry — the metamodel's declared relationship vocabulary,
// a first-class citizen next to ATOM_KINDS. `propagates` marks whether the
// relation carries *impact* (decided by a human domain expert per design §5 —
// the draft's flags below are the initial human ruling). blast_radius walks
// exactly the propagates=true edges. `carrier` documents how the edge is
// encoded in a v0.5 tree (see SCHEMA.md "Relation carriers"): kind-specific
// fields where the format already had them, explicit payload.links
// {relation, target} objects where it didn't.
export const RELATION_REGISTRY = [
  { id: 'R1',  from: 'aggregate',    relation: 'owns',         to: 'slice',      propagates: true,  source: '03/06', carrier: 'aggregate dir + order.commands[] → slice(command)', description: '结构归属：聚合拥有切片' },
  { id: 'R2',  from: 'aggregate',    relation: 'references',   to: 'aggregate',  propagates: true,  source: '07',    carrier: 'explicit payload.links {relation:"references", target} (07 notes carry prose only in v0.4 trees)', description: '聚合间引用（引用/基数/业务含义）' },
  { id: 'R3',  from: 'aggregate',    relation: 'emits',        to: 'event',      propagates: true,  source: '06',    carrier: 'order.events[] + slice events pool → event', description: '事件池归属' },
  { id: 'R4',  from: 'slice',        relation: 'issues',       to: 'command',    propagates: true,  source: '02/06', carrier: 'synthesized 1:1 — one command per slice (V4/V5); the command node aliases its slice', description: '切片发出命令' },
  { id: 'R5',  from: 'slice',        relation: 'emits',        to: 'event',      propagates: true,  source: '06',    carrier: 'slice payload.produces[] ∩ event pool (definitions live in the aggregate pool per V6)', description: '切片产生事件（定义归属）' },
  { id: 'R6',  from: 'command',      relation: 'produces',     to: 'event',      propagates: true,  source: '08',    carrier: 'slice payload.produces[] (guards carry the conditions — BA-4)', description: '命令产生事件，条件见 guards' },
  { id: 'R7',  from: 'event',        relation: 'triggers',     to: 'policy',     propagates: true,  source: '10',    carrier: 'policy triggers[].event (structured block; V7/V8 dual-track)', description: '事件触发政策' },
  { id: 'R8',  from: 'policy',       relation: 'constrains',   to: 'slice',      propagates: true,  source: '10',    carrier: 'explicit payload.links {relation:"constrains", target} (no carrier in v0.4 trees)', description: '政策约束切片' },
  { id: 'R9',  from: 'policy',       relation: 'invokes',      to: 'command',    propagates: true,  source: '10',    carrier: 'policy invokes[].command (structured block; V7/V8 dual-track)', description: '政策调用命令' },
  { id: 'R10', from: 'read-model',   relation: 'derives-from', to: 'field',      propagates: true,  source: '09/13', carrier: 'read-model fields[].source ("eventField:E.f" | "aggregateIdentity")', description: '读模型派生自字段（血缘）' },
  { id: 'R11', from: 'field',        relation: 'lineage',      to: 'field',      propagates: true,  source: '09',    carrier: '09-lineage note payload.links[] "A → B" arrows (chains split pairwise)', description: '字段血缘链' },
  { id: 'R12', from: 'role',         relation: 'can-issue',    to: 'command',    propagates: false, source: '02',    carrier: 'role note payload.can_issue[]', description: '角色可发命令（权限，不传播行为影响）' },
  { id: 'R13', from: 'read-model',   relation: 'visible-to',   to: 'role',       propagates: false, source: '13',    carrier: 'read-model payload.visible_to[]; inverse populated from role payload.can_view[]', description: '读模型对角色可见（权限，不传播行为影响）' },
  { id: 'R14', from: 'pipeline',     relation: 'has-step',     to: 'step',       propagates: true,  source: '01',    carrier: 'pipeline steps[] (JSON block)', description: '流程步骤' },
  { id: 'R15', from: 'step',         relation: 'performed-by', to: 'role',       propagates: false, source: '01/02', carrier: 'step.actor (absent in v0.4 trees)', description: '步骤由角色执行（参与关系）' },
  { id: 'R16', from: 'step',         relation: 'executes',     to: 'slice',      propagates: true,  source: '01/06', carrier: 'step.slice (absent in v0.4 trees)', description: '步骤执行切片' },
  { id: 'R17', from: 'story',        relation: 'covers',       to: 'use-case',   propagates: false, source: '11/12', carrier: 'explicit payload.links {relation:"covers", target} (no carrier in v0.4 trees)', description: '用户故事覆盖用例（追溯）' },
  { id: 'R18', from: 'use-case',     relation: 'realized-by',  to: 'slice',      propagates: true,  source: '12/06', carrier: 'use-cases.yaml payload (no use-cases in v0.4 pilot trees)', description: '用例由切片实现' },
  { id: 'R19', from: 'scenario',     relation: 'exercises',    to: 'pipeline',   propagates: false, source: '场景',   carrier: 'scenario script (free-form; no machine-readable carrier)', description: '场景演练流程/切片（演练路径）' },
  { id: 'R20', from: 'value-object', relation: 'used-by',      to: 'aggregate',  propagates: true,  source: '06/08', carrier: 'explicit payload.links {relation:"used-by", target} (dataType prose refs not parsed)', description: '值对象被聚合/切片/字段使用' },
  { id: 'R21', from: 'context',      relation: 'depends-on',   to: 'context',    propagates: true,  source: '05',    carrier: '05-context-map notes (prose only in v0.4 trees — needs from/to)', description: '限界上下文依赖' },
  { id: 'R22', from: 'aggregate',    relation: 'belongs-to',   to: 'subdomain',  propagates: false, source: '04',    carrier: '04-subdomains (skipped in v0.4 pilot trees — single context)', description: '聚合归属子域' },
];

// Registry lookups. relationName → entry; entries valid for a from-kind.
export const relationByName = (name) => RELATION_REGISTRY.find((r) => r.relation === name);
export const relationsFrom = (fromKind) => RELATION_REGISTRY.filter((r) => r.from === fromKind);
export const propagatingRelations = () => RELATION_REGISTRY.filter((r) => r.propagates).map((r) => r.relation);

// Deterministic filename slug: camel-case aware (RequestLoan → request-loan),
// same shape as the reference implementation so trees are portable both ways.
// Per-character replacement (every non-[a-z0-9] char becomes one '-'; runs
// are NOT collapsed and edge dashes are kept) — this is the reference shape
// the metarch tree's 1,920 filenames were built with (e.g. a Chinese policy
// name yields one dash per character). Collapsing/trimming here silently
// renamed 67 atoms' files; do not "tidy" this back.
export const slug = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');

const unquote = (v) => {
  if (typeof v !== 'string' || !v.startsWith('"')) return v;
  try { return JSON.parse(v); } catch { return v; }
};
const num = (v) => (/^-?\d+$/.test(v) ? Number(v) : v);

/**
 * Parse one atom file. Shape (all YAML-ish, no dependencies):
 *   - comment/blank lines skipped
 *   - scalar header lines:  `key: value` (value: number | "quoted string" | raw)
 *   - nested maps:          `origin:` / `order:` followed by `  key: value` lines
 *                           (value may be an inline JSON array `[A, B]`)
 *   - object lists:         `triggers:` followed by `  - k: v` + `    k: v` rows
 *   - JSON blocks:          `payload:` / `events:` / `extraEvents:` where the first
 *                           indented line is `{` or `[`; continuation lines carry a
 *                           2-space prefix that is stripped; a blank line ends the block.
 * Returns one flat object (header keys + parsed blocks). Throws on malformed lines.
 */
export function parseDoc(text, file = '<atom>') {
  const lines = text.split('\n');
  const doc = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('#') || line.trim() === '') { i++; continue; }
    const m = line.match(/^(\w+):(?: (.*))?$/);
    if (!m) throw new Error(`${file}: malformed line — ${JSON.stringify(line)}`);
    const key = m[1];
    const rest = m[2];
    if (rest !== undefined && rest !== '') {
      // Inline flow collection (`key: {}` / `key: [...]`), e.g. the read-only query
      // slice's authored-empty `events: {}`. Quoted strings start with '"' and never
      // enter this branch; unquoted prose starting with '{' is not authored anywhere.
      const flow = rest.trim();
      doc[key] = (flow.startsWith('{') && flow.endsWith('}')) || (flow.startsWith('[') && flow.endsWith(']'))
        ? JSON.parse(flow) : num(unquote(rest));
      i++; continue;
    }
    // Block or nested collection: inspect the following indented lines.
    const sub = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') { if (sub.length) break; else continue; }
      if (l.startsWith('  ')) sub.push(l.slice(2));
      else break;
    }
    if (!sub.length) { doc[key] = null; i = j; continue; }
    if (sub[0].startsWith('{') || sub[0].startsWith('[')) {
      // JSON literal block — every continuation line was prefixed with exactly
      // 2 spaces by emitDoc; JSON.stringify output never contains blank lines.
      doc[key] = JSON.parse(sub.join('\n'));
      i = j;
      continue;
    }
    if (sub[0].startsWith('- ')) {
      // List: scalar rows (`- eventStorming`) or object rows
      // (`  - k: v` first line + `    k: v` continuations, e.g. triggers/invokes).
      if (!/- \w+: /.test(sub[0])) {
        doc[key] = sub.map((l) => {
          const sm = l.match(/^- (.*)$/);
          if (!sm) throw new Error(`${file}: malformed list row — ${JSON.stringify(l)}`);
          return num(unquote(sm[1]));
        });
        i = j;
        continue;
      }
      const rows = [];
      let row = null;
      for (const l of sub) {
        const rm = l.match(/^- (\w+): (.*)$/);
        if (rm) { row = { [rm[1]]: num(unquote(rm[2])) }; rows.push(row); continue; }
        const cm = l.replace(/^ {2}/, '').match(/^(\w+): (.*)$/);
        if (!cm || !row) throw new Error(`${file}: malformed list row — ${JSON.stringify(l)}`);
        row[cm[1]] = num(unquote(cm[2]));
      }
      doc[key] = rows;
      i = j;
      continue;
    }
    // Nested map (origin/order): `k: v` or inline `k: [A, B]`.
    const map = {};
    for (const l of sub) {
      const km = l.match(/^(\w+): (.*)$/);
      if (!km) throw new Error(`${file}: malformed map line — ${JSON.stringify(l)}`);
      map[km[1]] = km[2].startsWith('[') ? JSON.parse(km[2]) : num(unquote(km[2]));
    }
    doc[key] = map;
    i = j;
  }
  return doc;
}

/**
 * Serialize one atom to canonical bytes (the exact shape decompose emits).
 *   scalars : ordered [key, value] pairs — value stringified via JSON.stringify
 *             when it is a string that needs quoting is the caller's choice; we
 *             emit strings raw and let parseDoc's unquote handle quoted forms.
 *   nested  : {origin: {...}, order: {commands: [...], ...}} — flat string/number
 *             values, arrays emitted as inline JSON.
 *   objLists: {triggers: [{event, aggregate}], invokes: [...]}
 *   blocks  : {payload, events, extraEvents} — verbatim JSON, 2-space indented.
 */
export function emitDoc({ scalars = [], nested = {}, objLists = {}, blocks = {} }) {
  const L = [BANNER, ''];
  for (const [k, v] of scalars) L.push(`${k}: ${typeof v === 'string' && /^[\w.-]+$/.test(v) ? v : JSON.stringify(v)}`);
  for (const [k, obj] of Object.entries(nested)) {
    L.push(`${k}:`);
    for (const [kk, vv] of Object.entries(obj)) {
      L.push(`  ${kk}: ${Array.isArray(vv) ? JSON.stringify(vv) : vv}`);
    }
  }
  for (const [k, rows] of Object.entries(objLists)) {
    L.push(`${k}:`);
    for (const row of rows) {
      const es = Object.entries(row);
      L.push(`  - ${es[0][0]}: ${es[0][1]}`);
      for (const [kk, vv] of es.slice(1)) L.push(`    ${kk}: ${vv}`);
    }
  }
  for (const [k, v] of Object.entries(blocks)) {
    if (v === undefined) continue;
    // Authored-empty flow blocks render inline (`events: {}`) — the same form
    // parseDoc reads back as an empty collection, never a two-line literal.
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) {
      L.push(`${k}: {}`);
      continue;
    }
    const body = JSON.stringify(v, null, 2).split('\n').map((l) => `  ${l}`);
    L.push(`${k}:`, ...body);
  }
  L.push('');
  return L.join('\n');
}

// Back-compat aliases (v0.1 API): single-payload atoms.
export const parseAtom = parseDoc;
export function emitAtom({ kind, type, name, origin, payload }) {
  return emitDoc({
    scalars: [['kind', kind], ['type', type], ['name', name]],
    nested: { origin },
    blocks: { payload },
  });
}
