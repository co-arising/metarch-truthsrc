import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { parseAuthorDoc } from './author-parse.mjs';
import { emitAuthorDoc, compileAuthorEntries } from './author-surface.mjs';

const json = value => JSON.stringify(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const name = value => String(value).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'value';
const digest = value => createHash('sha256').update(json(value)).digest('hex');
const sameKeys = values => values.every(v => plain(v) && json(Object.keys(v)) === json(Object.keys(values[0])));

function label(value, fallback) {
  if (plain(value)) {
    if (value.context && value.kind && typeof value.id === 'string') return name([value.kind, ...(value.owner || []), value.id].join('-'));
    for (const key of ['name', 'id', 'command', 'ruleId', 'ref', 'form']) if (typeof value[key] === 'string') return name(value[key]);
  }
  return name(fallback.split('-').slice(-3).join('-'));
}

function structureGroup(id, atoms, { atomTables = true, fieldTables = true } = {}) {
  const templates = {}, constants = {}, usedNames = new Set();
  const unique = initial => {
    let result = initial, i = 2;
    while (usedNames.has(result)) result = initial + '-' + i++;
    usedNames.add(result); return result;
  };
  function table(values, hint) {
    if (values.length < 2 || !sameKeys(values)) return null;
    const parameters = [], rows = values.map(() => []), columns = new Map();
    const used = new Set();
    const argument = (column, path) => {
      const columnKey = json(column);
      if (columns.has(columnKey)) return { $arg: columns.get(columnKey) };
      const base = name(path.filter(part => !/^\d+$/.test(part)).slice(-2).join('-') || 'value');
      let parameter = base, suffix = 2;
      while (used.has(parameter)) parameter = base + '-' + suffix++;
      used.add(parameter); parameters.push(parameter); columns.set(columnKey, parameter);
      column.forEach((v, i) => rows[i].push(v));
      return { $arg: parameter };
    };
    const unify = (column, path = []) => {
      if (column.every(v => isDeepStrictEqual(v, column[0]))) return structuredClone(column[0]);
      if (sameKeys(column)) return Object.fromEntries(Object.keys(column[0]).map(key => [key, unify(column.map(v => v[key]), [...path, key])]));
      if (column.every(plain) && column.every(v => Object.keys(v).length === 1)) {
        const keys = column.map(v => Object.keys(v)[0]);
        return { $object: [[argument(keys, [...path, 'name']), unify(column.map((v, i) => v[keys[i]]), [...path, 'definition'])]] };
      }
      if (column.every(Array.isArray) && column.every(v => v.length === column[0].length) && column[0].length <= 32)
        return column[0].map((_, i) => unify(column.map(v => v[i]), [...path, String(i)]));
      return argument(column, path);
    };
    const body = unify(values);
    if (!parameters.length || parameters.length > 120) return null;
    const template = { parameters, body };
    const estimate = json(template).length + json(rows).length + 80;
    if (estimate >= json(values).length * 0.82) return null;
    const key = unique(name(hint));
    templates[key] = template;
    return { $rows: { template: key, rows } };
  }
  function visit(value, path = []) {
    if (Array.isArray(value)) {
      const all = fieldTables && table(value, path.join('-'));
      if (all) return all;
      const result = [];
      for (let i = 0; i < value.length;) {
        let end = i + 1;
        if (plain(value[i])) while (end < value.length && sameKeys([value[i], value[end]])) end++;
        const compact = fieldTables && table(value.slice(i, end), [...path, String(i)].join('-'));
        if (compact) result.push(compact);
        else for (let j = i; j < end; j++) result.push(visit(value[j], [...path, String(j)]));
        i = end;
      }
      return result;
    }
    if (plain(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(v, [...path, k])]));
    return value;
  }
  const outputs = [];
  const groups = new Map();
  for (const atom of atoms) {
    const d = atom.doc;
    const group = d.kind === 'slice' ? 'slice-' + d.aggregate : d.kind === 'formal-product' ? 'formal-' + d.family : d.kind;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(atom);
  }
  for (const [family, group] of groups) {
    const atomGroups = new Map();
    const signature = value => Array.isArray(value) ? value.length + ':' + value.map(v => plain(v) ? Object.keys(v).join(',') : typeof v).join('|')
      : plain(value) ? Object.keys(value).join(',') : typeof value;
    for (const atom of group) {
      const discriminator = family === 'value-object' ? signature(atom.doc.payload.fields)
        : family === 'formal-technical-port' ? [atom.doc.payload.inputType?.form, atom.doc.payload.outputType?.form].join(':') : family;
      if (!atomGroups.has(discriminator)) atomGroups.set(discriminator, []);
      atomGroups.get(discriminator).push(atom);
    }
    for (const [discriminator, rows] of atomGroups) {
      const combined = atomTables && table(rows, family + '-' + label(rows[0].doc, discriminator));
      if (combined) outputs.push(combined);
      else for (const atom of rows) outputs.push({ file: atom.file, doc: visit(atom.doc, [label(atom.doc, family)]) });
    }
  }
  const repeated = new Map();
  const count = (value, path = []) => {
    if (plain(value) && (Object.hasOwn(value, '$arg') || Object.hasOwn(value, '$value') || Object.hasOwn(value, '$literal'))) return;
    if (plain(value) && Object.hasOwn(value, '$rows')) return;
    if (value !== null && typeof value === 'object') {
      const key = json(value);
      if (key.length >= 80 && !/"\$[a-z]+"\s*:/.test(key)) {
        const row = repeated.get(key) || { value, count: 0, hint: path.join('-') };
        row.count++; repeated.set(key, row);
      }
      for (const [k, v] of Object.entries(value)) count(v, [...path, k]);
    }
  };
  // Row arguments are opaque data. Share constants only in executable template positions.
  const countExecutable = (value, path = []) => {
    if (plain(value) && Object.hasOwn(value, '$rows')) return;
    count(value, path);
  };
  for (const [key, template] of Object.entries(templates)) countExecutable(template.body, [key]);
  for (const [i, output] of outputs.entries()) countExecutable(output, ['atom', String(i)]);
  const selected = new Map([...repeated].filter(([key, v]) => v.count >= 2 && key.length * (v.count - 1) > 35 * v.count)
    .sort((a, b) => b[0].length - a[0].length));
  const referenced = new Set();
  const replace = value => {
    if (plain(value) && (Object.hasOwn(value, '$arg') || Object.hasOwn(value, '$value') || Object.hasOwn(value, '$literal') || Object.hasOwn(value, '$rows'))) return value;
    if (value !== null && typeof value === 'object') {
      const key = json(value), candidate = selected.get(key);
      if (candidate) {
        if (!candidate.id) candidate.id = unique(label(value, candidate.hint));
        constants[candidate.id] = value; referenced.add(candidate.id);
        return { $value: candidate.id };
      }
      if (Array.isArray(value)) return value.map(replace);
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v)]));
    }
    return value;
  };
  for (const template of Object.values(templates)) template.body = replace(template.body);
  const compactAtoms = outputs.map(replace);
  return { kind: 'structure', schemaVersion: 'truthsrc.structure/v1', id,
    description: 'Shared exact protocol structures; row order and explicit business differences are preserved.',
    payload: { constants, templates, atoms: compactAtoms } };
}

export function compactAuthorStructures(entries, { groups } = {}) {
  if (!Array.isArray(groups) || !groups.length) throw new Error('AUTHOR_COMPACT: explicit nonempty groups required');
  const before = compileAuthorEntries(entries), context = before.context.id;
  if (before.system.authoring?.structures) throw new Error('AUTHOR_COMPACT: tree already selects structure expansion');
  const byFile = new Map(entries.map(e => [e.file, e])), selected = new Set(), result = [...entries], report = [];
  function emitStructure(doc) {
    const format = (value, depth = 0) => {
      const indent = '  '.repeat(depth), pad = '  '.repeat(depth + 1);
      if (value === null || typeof value !== 'object') return json(value);
      const short = json(value);
      if (short.length <= 140 || Array.isArray(value) && value.every(v => v === null || typeof v !== 'object') && short.length <= 240) return short;
      if (Array.isArray(value)) return '[\n' + value.map(v => pad + format(v, depth + 1)).join(',\n') + '\n' + indent + ']';
      return '{\n' + Object.entries(value).map(([k, v]) => pad + json(k) + ': ' + format(v, depth + 1)).join(',\n') + '\n' + indent + '}';
    };
    const { payload, ...headers } = doc;
    return emitAuthorDoc(headers) + 'payload:\n' + format(payload).split('\n').map(l => '  ' + l).join('\n') + '\n';
  }
  for (const group of groups) {
    if (!plain(group) || Object.keys(group).some(k => !['id', 'files'].includes(k)) || !/^[a-z][a-z0-9-]*$/.test(group.id) || !Array.isArray(group.files) || !group.files.length)
      throw new Error('AUTHOR_COMPACT: each group requires id and files');
    const atoms = group.files.map(file => {
      if (!byFile.has(file) || selected.has(file) || !file.startsWith('contexts/' + context + '/') || file.endsWith('/context.yaml'))
        throw new Error('AUTHOR_COMPACT: duplicate or unknown contextual atom ' + file);
      selected.add(file);
      const doc = parseAuthorDoc(byFile.get(file).content, file);
      if (['note', 'policy', 'structure'].includes(doc.kind)) throw new Error('AUTHOR_COMPACT: historical notes and existing structures are not inferred');
      return { file, doc };
    });
    const file = `contexts/${context}/structures/${group.id}.structure.yaml`;
    const candidates = [{ atomTables: true, fieldTables: true }, { atomTables: false, fieldTables: true }, { atomTables: false, fieldTables: false }]
      .map(options => { const doc = structureGroup(group.id, atoms, options); return { doc, content: emitStructure(doc) }; })
      .sort((a, b) => Buffer.byteLength(a.content) - Buffer.byteLength(b.content));
    const { doc, content } = candidates[0];
    if (byFile.has(file) || result.some(e => e.file === file)) throw new Error('AUTHOR_COMPACT: existing structure destination ' + file);
    const oldBytes = group.files.reduce((n, f) => n + Buffer.byteLength(byFile.get(f).content), 0);
    if (Buffer.byteLength(content) >= oldBytes) throw new Error('AUTHOR_COMPACT: group does not reduce author bytes: ' + group.id);
    result.push({ file, content });
    report.push({ id: group.id, file, atoms: atoms.length, beforeBytes: oldBytes, afterBytes: Buffer.byteLength(content), templates: Object.keys(doc.payload.templates).length, constants: Object.keys(doc.payload.constants).length });
  }
  const files = result.filter(e => !selected.has(e.file)).map(entry => {
    if (entry.file !== 'system.yaml') return entry;
    const doc = parseAuthorDoc(entry.content, entry.file);
    doc.authoring = { ...doc.authoring, structures: 'truthsrc.structure/v1' };
    return { ...entry, content: emitAuthorDoc(doc) };
  }).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  const after = compileAuthorEntries(files);
  const semantic = canonical => { const { authoring, ...value } = canonical; return value; };
  if (json(semantic(before.canonical)) !== json(semantic(after.canonical))) throw new Error('AUTHOR_COMPACT: semantic projection differs');
  return { files, report, semanticSha256: digest(semantic(before.canonical)) };
}
