import { types } from 'node:util';
import { copyImmutableData } from './immutable-data.mjs';
import { FORMAL_PRODUCT_FAMILIES } from './formal-products-pure.mjs';

export const STRUCTURE_VERSION = 'truthsrc.structure/v1';
const MAX_BYTES = 8 * 1024 * 1024, MAX_DEPTH = 64, MAX_ROWS = 10000, MAX_ATOMS = 10000;
const NAME = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/;
const STRUCTURE_FILE = /^contexts\/([a-z][a-z0-9-]*)\/structures\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.structure\.yaml$/;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const child = (at, key) => ({ file: at.file, pointer: `${at.pointer}/${escape(key)}` });
const fail = (at, message) => { throw new Error(`AUTHOR_STRUCTURE: ${at.file}#${at.pointer}: ${message}`); };
const define = (object, key, value) => Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true });
const size = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
function spend(budget, bytes, at) {
  budget.bytes += bytes;
  if (budget.bytes > MAX_BYTES) fail(at, `${budget.label} exceeds 8 MiB budget`);
}
function depthCheck(depth, at) {
  if (depth > MAX_DEPTH) fail(at, 'nesting exceeds depth 64');
}
function exact(value, required, at, optional = []) {
  if (!plain(value) || required.some(key => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail(at, 'unknown or missing field');
}
function name(value, at) {
  if (typeof value !== 'string' || !NAME.test(value)) fail(at, 'readable ASCII identifier required');
}
function safeFile(file, at) {
  if (typeof file !== 'string' || !file || /[\\\x00-\x1f\x7f]/.test(file) || file.startsWith('/') ||
    /^[A-Za-z]:/.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) fail(at, 'unsafe file path');
}

// Bound the input BEFORE the immutable copier can expand a shared-object DAG.
// Like that copier, inspect descriptors, not accessors or proxy traps.
function inspect(value, at, budget, depth = 0, ancestors = new Set()) {
  depthCheck(depth, at);
  if (value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value)) {
    spend(budget, size(value), at); return;
  }
  if (!value || typeof value !== 'object' || types.isProxy(value)) fail(at, 'expected plain JSON data');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (!(array ? proto === Array.prototype : proto === Object.prototype || proto === null)) fail(at, 'expected plain JSON data');
  if (ancestors.has(value)) fail(at, 'cyclic JSON data');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors).filter(key => !(array && key === 'length'));
  if (array && (keys.length !== descriptors.length.value || keys.some((key, i) => key !== String(i)))) fail(at, 'sparse or non-JSON array');
  ancestors.add(value);
  spend(budget, 2 + Math.max(0, keys.length - 1), at);
  for (const key of keys) {
    const entry = descriptors[key];
    if (typeof key !== 'string' || !entry.enumerable || !Object.hasOwn(entry, 'value')) fail(at, 'expected enumerable data properties');
    if (!array) spend(budget, size(key) + 1, at);
    inspect(entry.value, child(at, key), budget, depth + 1, ancestors);
  }
  ancestors.delete(value);
}

// Keep this path-only gate independent of author-surface (which calls this
// frontend). Semantic atom/header validation remains the downstream gate.
function atomResidence(file, doc, scope, at) {
  safeFile(file, at);
  const prefix = `contexts/${scope.context}/`;
  if (!file.startsWith(prefix)) fail(at, 'atom file must be inside the current context');
  if (!plain(doc)) fail(at, 'atom doc must be an object');
  const local = file.slice(prefix.length), parts = local.split('/');
  let expected;
  if (parts[0] === 'aggregates' && /^[a-z0-9-]+$/.test(parts[1] || '')) {
    if (parts.length === 3 && parts[2] === 'aggregate.yaml') expected = 'aggregate';
    if (parts.length === 4 && parts[2] === 'slices' && parts[3].endsWith('.slice.yaml')) expected = 'slice';
    if (parts.length === 4 && parts[2] === 'notes' && parts[3].endsWith('.yaml')) expected = 'note';
  } else if (parts[0] === 'formal-products') {
    if (parts.length === 3 && Object.hasOwn(FORMAL_PRODUCT_FAMILIES, parts[1]) && parts[2].endsWith('.formal.yaml')) expected = 'formal-product';
  } else if (local === 'use-cases.yaml') expected = 'use-cases';
  else {
    const catalogs = new Map([
      ['value-objects', ['.vo.yaml', 'value-object']], ['read-models', ['.rm.yaml', 'read-model']],
      ['stories', ['.story.yaml', 'story']], ['domain-services', ['.port.yaml', 'domain-service']],
      ['policies', ['.policy.yaml', 'policy']], ['pipelines', ['.pipeline.yaml', 'pipeline']],
      ['scenarios', ['.scenario.yaml', 'scenario']], ['sagas', ['.saga.yaml', 'saga']],
    ]);
    const type = catalogs.get(parts[0]);
    if (parts.length === 2 && type && parts[1].endsWith(type[0])) expected = type[1];
  }
  if (!expected || doc.kind !== expected) fail(at, 'unknown standard atom residence/kind');
}

/**
 * Pure, opt-in, non-recursive structural expansion. Paths are author-root-relative.
 * Input and expanded document trees each have an 8 MiB/64-depth budget; row and
 * output-document limits are tree-wide. Definitions are all checked for use.
 * `subtree` permits suffix navigation into identical copied JSON; `declaration`
 * does not. A template site is {file, pointer}, never an invented physical span.
 */
export function expandAuthorStructures(parsedDocs, { enabled = false } = {}) {
  const inputAt = { file: '<author tree>', pointer: '' };
  if (types.isProxy(parsedDocs) || !types.isMap(parsedDocs) || Object.getPrototypeOf(parsedDocs) !== Map.prototype) fail(inputAt, 'parsedDocs must be a Map');
  if (typeof enabled !== 'boolean') fail(inputAt, 'enabled must be boolean');
  const inputBudget = { bytes: 0, label: 'input tree' }, outputBudget = { bytes: 0, label: 'expanded tree' };
  const entries = [], occupied = new Set(), structures = [], ids = new Set();
  const constants = new Map(), templates = new Map(), macro = new WeakMap();
  const documents = [], mappings = [];
  let rowCount = 0;
  for (const [file, value] of Map.prototype.entries.call(parsedDocs)) {
    const at = { file: typeof file === 'string' ? file : '<author file>', pointer: '' };
    safeFile(file, at);
    const alias = file.normalize('NFC').toLowerCase();
    if (occupied.has(alias)) fail(at, 'duplicate/alias author file');
    occupied.add(alias);
    spend(inputBudget, size(file), at);
    inspect(value, at, inputBudget);
    const doc = copyImmutableData(value, '', (pointer, message) => fail({ file, pointer }, message));
    if (!plain(doc)) fail(at, 'author doc must be an object');
    entries.push({ file, doc });
  }
  entries.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  for (const { file, doc } of entries) {
    const at = { file, pointer: '' };
    const structurePath = file.endsWith('.structure.yaml') || file.split('/').includes('structures');
    if (doc.kind !== 'structure' && !structurePath) continue;
    if (!enabled) fail(at, 'structures require enabled: true');
    const match = STRUCTURE_FILE.exec(file);
    if (!match) fail(at, 'structure file must be contexts/<context>/structures/<lower-kebab>.structure.yaml');
    exact(doc, ['kind', 'schemaVersion', 'id', 'payload'], at, ['description']);
    if (doc.kind !== 'structure' || doc.schemaVersion !== STRUCTURE_VERSION) fail(at, 'unsupported structure kind/version');
    name(doc.id, child(at, 'id'));
    if (Object.hasOwn(doc, 'description') && typeof doc.description !== 'string') fail(child(at, 'description'), 'description must be a string');
    if (ids.has(doc.id)) fail(at, 'duplicate structure id ' + doc.id);
    ids.add(doc.id);
    const payloadAt = child(at, 'payload');
    exact(doc.payload, ['constants', 'templates', 'atoms'], payloadAt);
    if (!plain(doc.payload.constants) || !plain(doc.payload.templates) || !Array.isArray(doc.payload.atoms)) fail(payloadAt, 'constants/templates objects and atoms array required');
    const scope = { file, doc, context: match[1] };
    structures.push(scope);
    for (const [family, registry] of [['constants', constants], ['templates', templates]]) {
      for (const [key, value] of Object.entries(doc.payload[family])) {
        const site = child(child(payloadAt, family), key);
        name(key, site);
        const id = `${doc.id}/${key}`;
        if (registry.has(id)) fail(site, 'duplicate definition ' + id);
        if (family === 'templates') {
          exact(value, ['parameters', 'body'], site);
          if (!Array.isArray(value.parameters)) fail(child(site, 'parameters'), 'parameters must be an array');
          value.parameters.forEach((parameter, i) => name(parameter, child(child(site, 'parameters'), i)));
          if (new Set(value.parameters).size !== value.parameters.length) fail(child(site, 'parameters'), 'duplicate parameter');
        }
        registry.set(id, { id, scope, value, at: site, used: false });
      }
    }
  }
  function reference(registry, ref, scope, at) {
    if (typeof ref !== 'string' || ref.split('/').length > 2 || ref.split('/').some(part => !NAME.test(part))) fail(at, 'invalid qualified reference');
    const id = ref.includes('/') ? ref : `${scope.doc.id}/${ref}`;
    const definition = registry.get(id);
    if (!definition) fail(at, 'dangling reference ' + id);
    return definition;
  }
  function directive(value, at) {
    if (!plain(value)) return null;
    const keys = Object.keys(value), reserved = keys.filter(key => key.startsWith('$'));
    if (!reserved.length) return null;
    if (keys.length !== 1 || !['$arg', '$value', '$literal', '$object', '$rows'].includes(keys[0])) fail(at, 'unknown or mixed directive');
    return keys[0];
  }
  // Validate all bodies even for zero-row calls. No row data or constants are
  // scanned as expressions; a literal spelling of a directive stays literal.
  function analyse(value, at, scope, parameters = null) {
    if (value === null || typeof value !== 'object') return false;
    const op = directive(value, at);
    let hasMacro = Boolean(op);
    if (op === '$arg') {
      name(value.$arg, child(at, op));
      if (!parameters?.includes(value.$arg)) fail(at, 'missing/undeclared parameter ' + value.$arg);
    } else if (op === '$value') reference(constants, value.$value, scope, child(at, op)).used = true;
    else if (op === '$rows') {
      if (parameters !== null) fail(at, '$rows/template calls are forbidden inside templates (no recursion)');
      const spec = value.$rows, site = child(at, op);
      exact(spec, ['template', 'rows'], site);
      const template = reference(templates, spec.template, scope, child(site, 'template'));
      template.used = true;
      if (!Array.isArray(spec.rows)) fail(child(site, 'rows'), 'rows must be an array');
      rowCount += spec.rows.length;
      if (rowCount > MAX_ROWS) fail(site, 'rows exceed 10000 budget');
      spec.rows.forEach((row, i) => {
        if (!Array.isArray(row) || row.length !== template.value.parameters.length) fail(child(child(site, 'rows'), i), 'row has missing or extra parameters');
      });
    } else if (op === '$object') {
      if (!Array.isArray(value.$object)) fail(child(at, op), '$object requires [key, value] pairs');
      const staticKeys = new Set();
      value.$object.forEach((pair, i) => {
        const site = child(child(at, op), i);
        if (!Array.isArray(pair) || pair.length !== 2) fail(site, '$object requires exact [key, value] pairs');
        analyse(pair[0], child(site, 0), scope, parameters);
        analyse(pair[1], child(site, 1), scope, parameters);
        const keyOp = directive(pair[0], child(site, 0));
        if (keyOp === '$arg') return;
        const key = keyOp === '$value' ? reference(constants, pair[0].$value, scope, site).value
          : keyOp === '$literal' ? pair[0].$literal : pair[0];
        if (typeof key !== 'string') fail(site, 'dynamic object key must be a string');
        if (staticKeys.has(key)) fail(site, 'duplicate dynamic object key ' + key);
        staticKeys.add(key);
      });
    } else if (!op) {
      for (const [key, entry] of Object.entries(value)) if (analyse(entry, child(at, key), scope, parameters)) hasMacro = true;
    }
    macro.set(value, hasMacro);
    return hasMacro;
  }
  for (const template of templates.values()) analyse(template.value.body, child(template.at, 'body'), template.scope, template.value.parameters);
  for (const scope of structures) scope.doc.payload.atoms.forEach((atom, i) => analyse(atom, { file: scope.file, pointer: `/payload/atoms/${i}` }, scope));
  for (const [family, registry] of [['template', templates], ['constant', constants]]) {
    for (const definition of registry.values()) if (!definition.used) fail(definition.at, `unused ${family} ${definition.id}`);
  }

  function literal(value, at, depth) {
    depthCheck(depth, at);
    if (value === null || typeof value !== 'object') { spend(outputBudget, size(value), at); return value; }
    const array = Array.isArray(value), keys = Object.keys(value), result = array ? [] : Object.create(Object.getPrototypeOf(value));
    spend(outputBudget, 2 + Math.max(0, keys.length - 1), at);
    for (const key of keys) {
      if (!array) spend(outputBudget, size(key) + 1, at);
      define(result, key, literal(value[key], child(at, key), depth + 1));
    }
    return result;
  }
  function mark(marks, pointer, at, mode, template) {
    marks.push({ pointer, authorFile: at.file, authorPointer: at.pointer, mode, ...(template ? { template } : {}) });
  }
  function rowEach(expression, at, scope, visit) {
    const template = reference(templates, expression.$rows.template, scope, child(child(at, '$rows'), 'template'));
    const templateSite = { file: template.at.file, pointer: template.at.pointer };
    expression.$rows.rows.forEach((row, i) => {
      const rowAt = child(child(child(at, '$rows'), 'rows'), i), args = new Map();
      template.value.parameters.forEach((parameter, index) => args.set(parameter, { value: row[index], at: child(rowAt, index) }));
      visit(template, args, rowAt, templateSite, i);
    });
  }
  function evaluate(value, at, scope, args, pointer, marks, depth, templateSite) {
    depthCheck(depth, at);
    if (value === null || typeof value !== 'object' || !macro.get(value)) {
      mark(marks, pointer, at, 'subtree', templateSite);
      return literal(value, at, depth);
    }
    const op = directive(value, at);
    if (op === '$arg' || op === '$value' || op === '$literal') {
      const source = op === '$arg' ? args.get(value.$arg) : op === '$value'
        ? reference(constants, value.$value, scope, child(at, op)) : { value: value.$literal, at: child(at, op) };
      mark(marks, pointer, source.at, 'subtree', templateSite);
      return literal(source.value, source.at, depth);
    }
    mark(marks, pointer, at, 'declaration', templateSite);
    if (Array.isArray(value) || op === '$rows') {
      const result = [];
      spend(outputBudget, 2, at);
      const append = (expression, site) => {
        const push = (body, bodyAt, bodyScope, bodyArgs, rowAt, bodyTemplate) => {
          if (result.length) spend(outputBudget, 1, site);
          const next = `${pointer}/${result.length}`;
          if (rowAt) mark(marks, next, rowAt, 'declaration', bodyTemplate);
          result.push(evaluate(body, bodyAt, bodyScope, bodyArgs, next, marks, depth + 1, bodyTemplate));
        };
        if (directive(expression, site) === '$rows') rowEach(expression, site, scope, (template, rowArgs, rowAt, site) =>
          push(template.value.body, child(template.at, 'body'), template.scope, rowArgs, rowAt, site));
        else push(expression, site, scope, args, null, templateSite);
      };
      if (op === '$rows') append(value, at);
      else value.forEach((entry, i) => append(entry, child(at, i)));
      return result;
    }
    const result = op === '$object' ? {} : Object.create(Object.getPrototypeOf(value));
    const pairs = op === '$object' ? value.$object : Object.entries(value);
    spend(outputBudget, 2 + Math.max(0, pairs.length - 1), at);
    pairs.forEach(([keyExpression, entry], i) => {
      const pairAt = child(child(at, '$object'), i);
      // A key source is a declaration, not a subtree of the property's value.
      const keyMarks = [];
      const key = op === '$object' ? evaluate(keyExpression, child(pairAt, 0), scope, args, '', keyMarks, depth + 1, templateSite) : keyExpression;
      if (typeof key !== 'string') fail(pairAt, 'dynamic object key must be a string');
      if (Object.hasOwn(result, key)) fail(pairAt, 'duplicate dynamic object key ' + key);
      for (const source of keyMarks) marks.push({ ...source, pointer: `${pointer}/${escape(key)}`, mode: 'declaration' });
      spend(outputBudget, op === '$object' ? 1 : size(key) + 1, at);
      const site = op === '$object' ? child(pairAt, 1) : child(at, key);
      define(result, key, evaluate(entry, site, scope, args, `${pointer}/${escape(key)}`, marks, depth + 1, templateSite));
    });
    return result;
  }
  function appendDocument(entry, at) {
    if (documents.length >= MAX_ATOMS) fail(at, 'atoms exceed 10000 budget');
    documents.push(entry);
  }
  function emitAtom(value, at, scope, args = new Map(), template, rowIndex, bodyAt = at, bodyScope = scope) {
    const marks = [];
    // The wrapper is not a document nesting level; doc itself starts at zero.
    const atom = evaluate(value, bodyAt, bodyScope, args, '', marks, -1, template);
    exact(atom, ['file', 'doc'], at);
    atomResidence(atom.file, atom.doc, scope, at);
    const alias = atom.file.normalize('NFC').toLowerCase();
    if (occupied.has(alias)) fail(at, 'duplicate/alias output or real author file collision: ' + atom.file);
    occupied.add(alias);
    appendDocument(atom, at);
    const identity = [atom.doc.id, atom.doc.name, atom.doc.payload?.id, atom.doc.payload?.name].find(v => typeof v === 'string' || typeof v === 'number') ?? atom.file;
    const label = `${scope.doc.id}:${atom.doc.kind}:${identity}${rowIndex === undefined ? '' : `:row-${rowIndex}`}`;
    const atomMappings = new Map([['', { file: atom.file, pointer: '', authorFile: at.file, authorPointer: at.pointer, mode: 'declaration', label, ...(template ? { template } : {}) }]]);
    for (const mapping of marks) {
      let projected;
      if (mapping.pointer === '' && mapping.mode === 'subtree') projected = { ...mapping, pointer: '', authorPointer: mapping.authorPointer + '/doc' };
      else if (mapping.pointer === '/doc' || mapping.pointer.startsWith('/doc/')) projected = { ...mapping, pointer: mapping.pointer.slice(4) };
      else continue;
      const existing = atomMappings.get(projected.pointer);
      if (!existing || projected.mode === 'subtree') atomMappings.set(projected.pointer, { file: atom.file, ...projected, label });
    }
    mappings.push(...atomMappings.values());
  }
  const byFile = new Map(structures.map(scope => [scope.file, scope]));
  for (const entry of entries) {
    const scope = byFile.get(entry.file);
    if (!scope) {
      spend(outputBudget, size(entry.file), { file: entry.file, pointer: '' });
      appendDocument({ file: entry.file, doc: literal(entry.doc, { file: entry.file, pointer: '' }, 0) }, { file: entry.file, pointer: '' });
      continue;
    }
    scope.doc.payload.atoms.forEach((value, i) => {
      const at = { file: scope.file, pointer: `/payload/atoms/${i}` };
      if (directive(value, at) === '$rows') rowEach(value, at, scope, (template, args, rowAt, site, rowIndex) =>
        emitAtom(template.value.body, rowAt, scope, args, site, rowIndex, child(template.at, 'body'), template.scope));
      else emitAtom(value, at, scope);
    });
  }
  documents.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  mappings.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return copyImmutableData({ documents, mappings });
}
