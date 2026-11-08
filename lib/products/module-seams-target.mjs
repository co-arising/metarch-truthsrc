import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { refKey } from '../domain-products/references.mjs';
import { buildTargetModel } from '../scala-target/model.mjs';
import { resolveName } from '../scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../scala-target/profiles.mjs';
import { compileModuleSeamsContract } from './module-seams-contract.mjs';
import { compileModuleSeamsComposition, portableSeamsPath } from './module-seams-composition.mjs';

// Family-local, bounded ABI exclusions, matching family1's inherited/automatic
// member sets. This is not a Scala typechecker and does not alter target-model/v1.
const objectMembers = new Set(['getClass', 'notify', 'notifyAll', 'wait', 'equals', 'hashCode', 'toString', 'clone', 'finalize']);
const caseMembers = new Set([...objectMembers, 'copy', 'productArity', 'productElement', 'productElementName', 'productElementNames', 'productIterator', 'productPrefix', 'canEqual', 'companion']);
function admitMember(name, reserved, location) {
  if (reserved.has(name)) fail('MODULE_SEAMS_ABI_NAME', 'resolved member conflicts with inherited or automatic Scala API: ' + name, location);
}
function explicitMember(name, location) {
  return resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: name, scope: location.document + ':' + location.pointer,
    space: 'scala-member', spelling: name, binding: name, prefix: [], suffix: [] }).name;
}

/** Pure lowering, no filesystem access, producer registration or Scala bodies. */
export function lowerModuleSeamsTarget(rawCanonical, contractBinding, compositionBinding, rawOptions) {
  const { canonical, options } = detach({ canonical: rawCanonical, options: rawOptions });
  const contract = compileModuleSeamsContract(contractBinding, canonical);
  const composition = compileModuleSeamsComposition(compositionBinding, canonical, contract);
  const source = p => at('module-seams-options', p);
  object(options, ['packages', 'names', 'valueFiles', 'sourceRoots'], source(''));
  const packages = array(options.packages, source('/packages'));
  packages.forEach((p, i) => { object(p, ['context', 'package'], source('/packages/' + i)); text(p.package, source('/packages/' + i)); });
  if (packages.length !== 1 || packages[0].context !== contract.context) fail('MODULE_SEAMS_OPTIONS', 'exactly one package for the selected context required', source('/packages'));
  const selectors = [], used = new Set();
  const addSelector = (ref, role) => selectors.push({ ref, role });
  contract.values.forEach(v => {
    addSelector(v.ref, 'value'); v.fields.forEach(f => addSelector(f.ref, 'field'));
    v.variants.forEach(x => { addSelector(x.ref, 'variant'); x.fields.forEach(f => addSelector(f.ref, 'field')); });
  });
  contract.ports.forEach(p => { addSelector(p.ref, 'port'); p.methods.forEach(m => { addSelector(m.ref, 'method'); m.parameters.forEach(a => addSelector(a.ref, 'parameter')); }); });
  [...composition.implementations, ...composition.bridges, composition.root].forEach(c => addSelector({ component: c.id }, c.role));
  const names = array(options.names, source('/names'));
  names.forEach((n, i) => {
    object(n, ['ref', 'role', 'name'], source('/names/' + i)); text(n.name, source('/names/' + i));
    if (!selectors.some(s => equal(s.ref, n.ref) && s.role === n.role)) fail('MODULE_SEAMS_OPTIONS', 'unknown/unused name selector or wrong role', source('/names/' + i));
  });
  unique(names.map(n => JSON.stringify([n.ref, n.role])), 'MODULE_SEAMS_DUPLICATE', source('/names'));
  const binding = (ref, role) => { const i = names.findIndex(n => equal(n.ref, ref) && n.role === role); if (i < 0) return null; used.add(i); return names[i].name; };
  const files = array(options.valueFiles, source('/valueFiles'));
  files.forEach((f, i) => {
    object(f, ['ref', 'fileStem'], source('/valueFiles/' + i)); text(f.fileStem, source('/valueFiles/' + i));
    if (!contract.values.some(v => equal(v.ref, f.ref))) fail('MODULE_SEAMS_OPTIONS', 'file group must select a declared value', source('/valueFiles/' + i));
  });
  unique(files.map(f => refKey(f.ref)), 'MODULE_SEAMS_DUPLICATE', source('/valueFiles'));
  if (files.length !== contract.values.length) fail('MODULE_SEAMS_OPTIONS', 'every value needs an explicit file group', source('/valueFiles'));
  const roots = array(options.sourceRoots, source('/sourceRoots'));
  roots.forEach((r, i) => {
    const s = source('/sourceRoots/' + i); object(r, ['id', 'module', 'path'], s); text(r.id, s); portableSeamsPath(r.path, s);
    const members = composition.handwritten.filter(h => h.sourceRootKey === r.id);
    if (!members.length || members.some(h => h.module !== r.module)) fail('MODULE_SEAMS_OPTIONS', 'source root must be used and pinned to each member module', s);
  });
  unique(roots.map(r => r.id), 'MODULE_SEAMS_DUPLICATE', source('/sourceRoots'));
  for (let i = 0; i < roots.length; i++) for (let j = 0; j < i; j++) {
    const a = roots[i].path.normalize('NFC').toLowerCase(), b = roots[j].path.normalize('NFC').toLowerCase();
    if (a === b || a.startsWith(b + '/') || b.startsWith(a + '/')) fail('MODULE_SEAMS_OPTIONS', 'source roots must be distinct and non-overlapping (filesystem aliases still require project capture)', source('/sourceRoots/' + i));
  }
  if (composition.handwritten.some(h => !roots.some(r => r.id === h.sourceRootKey))) fail('MODULE_SEAMS_OPTIONS', 'missing source root', source('/sourceRoots'));
  const field = (f, role = 'field') => ({ id: f.id, spelling: f.name, binding: binding(f.ref, role), valueType: f.valueType });
  const values = contract.values.map(v => ({ ref: v.ref, spelling: v.name, binding: binding(v.ref, 'value'), module: 'kernel', shape: v.shape,
    fileStem: files.find(f => equal(f.ref, v.ref)).fileStem, fields: v.fields.map(f => field(f)),
    variants: v.variants.map(x => ({ id: x.id, spelling: x.name, binding: binding(x.ref, 'variant'), fields: x.fields.map(f => field(f)) })) }));
  const ports = contract.ports.map(p => ({ ref: p.ref, spelling: p.name, binding: binding(p.ref, 'port'), module: 'kernel', role: p.role,
    methods: p.methods.map(m => ({ id: m.id, spelling: m.name, binding: binding(m.ref, 'method'), parameters: m.parameters.map(a => field(a, 'parameter')),
      result: { effect: m.result.effect, valueType: m.result.valueType } })) }));
  const components = composition.implementations.map(i => {
    const name = i.symbol.split('.').at(-1), override = binding({ component: i.id }, i.role);
    if (override !== null && override !== name) fail('MODULE_SEAMS_SYMBOL', 'names cannot rename an external handwritten FQN', i.source);
    return { id: i.id, spelling: name, binding: name, context: i.context, module: i.module, role: i.role, implements: i.implements, dependencies: i.dependencies, requires: i.requires };
  });
  composition.bridges.forEach(b => components.push({ id: b.id, spelling: b.id, binding: binding({ component: b.id }, 'bridge'), context: b.context, module: b.module,
    role: 'bridge', implements: b.port, dependencies: b.dependencies, requires: [] }));
  const root = composition.root;
  components.push({ id: root.id, spelling: root.id, binding: binding({ component: root.id }, 'composition'), context: root.context, module: 'root', role: 'composition', implements: null,
    dependencies: root.bindings.map(b => b.component).filter((id, i, all) => all.indexOf(id) === i), requires: [] });
  if (used.size !== names.length) fail('MODULE_SEAMS_OPTIONS', 'unused name option', source('/names'));
  // Deliberately only v1 fields. Constructor ABI, sources and file evidence stay
  // alongside this model rather than quietly extending its input protocol.
  const target = buildTargetModel({ schemaVersion: 'truthsrc.scala-target-model/v1', profile: MODULAR_CANDIDATE,
    contexts: [{ id: contract.context, packageName: packages[0].package }], values, ports, components,
    bindings: root.bindings.map(b => ({ port: b.port, component: b.component, module: 'root' })) });
  // Test final resolved names, including explicit overrides. Method parameters
  // and factory/constructor local inputs deliberately are not case accessors.
  target.values.forEach((v, i) => {
    v.fields.forEach((f, j) => admitMember(f.name, caseMembers, contract.values[i].fields[j].source));
    v.variants.forEach((variant, j) => variant.fields.forEach((f, k) => admitMember(f.name, caseMembers, contract.values[i].variants[j].fields[k].source)));
  });
  target.ports.forEach((p, i) => p.methods.forEach((m, j) => admitMember(m.name, objectMembers, contract.ports[i].methods[j].source)));
  for (const c of [...composition.implementations, ...composition.bridges]) for (const m of c.methods)
    admitMember(explicitMember(m.delegateMember, m.source), objectMembers, m.source);
  const factorySource = at(root.source.document, root.source.pointer + '/method');
  admitMember(explicitMember(root.method, factorySource), objectMembers, factorySource);
  for (const i of composition.implementations) {
    const c = target.components.find(c => c.id === i.id);
    if (c.packageName + '.' + c.name !== i.symbol) fail('MODULE_SEAMS_SYMBOL', 'external FQN conflicts with fixed context/role package', i.source);
    if (i.implements !== null) for (const m of i.methods) {
      const p = target.ports.find(p => equal(p.ref, m.method.port)), method = p.methods.find(x => x.id === m.method.method);
      if (method.name !== m.delegateMember) fail('MODULE_SEAMS_ABI', 'renaming an implemented method conflicts with the declared external ABI', m.source);
    }
  }
  const generated = new Map();
  const add = (path, module, role, ref, source) => {
    if (!generated.has(path)) generated.set(path, { path, module, role, refs: [], sources: [] });
    const file = generated.get(path); file.refs.push(ref); file.sources.push(source);
  };
  target.values.forEach((v, i) => add(v.path, v.module, 'value', v.ref, contract.values[i].source));
  target.ports.forEach((p, i) => add(p.path, p.module, 'port', p.ref, contract.ports[i].source));
  for (const c of [...composition.bridges, root]) { const t = target.components.find(t => t.id === c.id); add(t.path, t.module, t.role, { component: c.id }, c.source); }
  const handwritten = composition.handwritten.map(h => ({ ...h, sourceRoot: roots.find(r => r.id === h.sourceRootKey).path }));
  return detach({ schemaVersion: 'truthsrc.module-seams-target/v1', contract, composition, target,
    generatedFiles: [...generated.values()].sort((a, b) => a.path.localeCompare(b.path)), handwritten, sourceRoots: roots });
}
