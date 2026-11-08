import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { refKey } from '../domain-products/references.mjs';
import { resolveName } from '../scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../scala-target/profiles.mjs';
import { deriveModuleSeamsContract, seamsPort, seamsMethod, signatureReferences } from './module-seams-contract.mjs';

export const COMPOSITION_BINDING_SCHEMA = 'truthsrc.module-seams-composition-binding/v1';
export const COMPOSITION_SCHEMA = 'truthsrc.module-seams-composition/v1';
export function portableSeamsPath(path, location) {
  text(path, location);
  if (/[\\\p{Cc}\p{Cf}]/u.test(path) || path.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.split('/').some(p => !p || p === '.' || p === '..' || /[<>:"|?*]/u.test(p) || /[. ]$/u.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(p)))
    fail('MODULE_SEAMS_PATH', 'portable relative path without traversal required', location);
  return path;
}
const member = (name, s) => {
  text(name, s);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) || name === '_' || ['wait', 'notify', 'notifyAll', 'getClass'].includes(name)) fail('MODULE_SEAMS_ABI_NAME', 'unescaped non-final Scala member required', s);
  resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: name, scope: s.document + ':' + s.pointer, space: 'scala-member', spelling: name, binding: name, prefix: [], suffix: [] });
  return name;
};
const roleModules = { 'pure-implementation': ['kernel'], adapter: ['glue', 'ext'], extension: ['ext'] };
export function compileModuleSeamsComposition(rawBinding, rawCanonical, suppliedContract) {
  const { binding, canonical, contract } = detach({ binding: rawBinding, canonical: rawCanonical, contract: suppliedContract });
  object(binding, ['id', 'schemaVersion', 'value'], at('composition-binding')); text(binding.id, at('composition-binding'));
  const rebuilt = deriveModuleSeamsContract(canonical);
  if (!equal(contract, rebuilt)) fail('MODULE_SEAMS_CONTRACT_DRIFT', 'composition must use the whole contract from this canonical', at(binding.id));
  object(binding, ['id', 'schemaVersion', 'value'], at(binding.id)); text(binding.id, at(binding.id));
  const b = binding.value, source = pointer => at(binding.id, pointer);
  object(b, ['schemaVersion', 'id', 'version', 'contract', 'implementations', 'bridges', 'root'], source(''));
  if (binding.schemaVersion !== COMPOSITION_BINDING_SCHEMA || b.schemaVersion !== COMPOSITION_BINDING_SCHEMA || b.version !== '1') fail('MODULE_SEAMS_VERSION', 'composition binding/v1 version 1 required', source(''));
  text(b.id, source('/id'));
  object(b.contract, ['id', 'version', 'context'], source('/contract'));
  if (!equal(b.contract, { id: contract.id, version: contract.version, context: contract.context })) fail('MODULE_SEAMS_PIN', 'exact contract identity/version/context pin required', source('/contract'));
  function methodMappings(rows, pointer, expectedPort = null) {
    const result = array(rows, source(pointer)).map((m, i) => {
      const s = source(pointer + '/' + i);
      object(m, ['method', 'delegateMember'], s); member(m.delegateMember, s);
      const { port, signature } = seamsMethod(m.method, contract, s);
      if (expectedPort && !equal(expectedPort, port.ref)) fail('MODULE_SEAMS_ABI', 'method belongs to another port', s);
      return { ...m, signature, source: s };
    });
    unique(result.map(m => JSON.stringify(m.method)), 'MODULE_SEAMS_DUPLICATE', source(pointer));
    unique(result.map(m => m.delegateMember), 'MODULE_SEAMS_DUPLICATE', source(pointer));
    if (!result.length) fail('MODULE_SEAMS_ABI', 'implementation method obligations are explicit', source(pointer));
    const ports = [...new Set(result.map(m => refKey(m.method.port)))];
    if (ports.length !== 1) fail('MODULE_SEAMS_ABI', 'one port ABI per implementation is supported', source(pointer));
    const port = seamsPort(result[0].method.port, contract, source(pointer));
    if (result.length !== port.methods.length || port.methods.some(m => !result.some(r => r.method.method === m.id))) fail('MODULE_SEAMS_ABI', 'every port method needs exactly one member mapping', source(pointer));
    return result;
  }
  const implementations = array(b.implementations, source('/implementations')).map((i, n) => {
    const p = '/implementations/' + n, s = source(p);
    object(i, ['id', 'version', 'module', 'role', 'symbol', 'construction', 'source', 'implements', 'constructor', 'methods'], s);
    text(i.id, s); text(i.version, s); text(i.symbol, s);
    if (typeof i.role !== 'string' || !Object.hasOwn(roleModules, i.role) || !roleModules[i.role].includes(i.module)) fail('MODULE_SEAMS_MODULE', 'implementation role is not allowed in this module', s);
    if (!/^(?:[a-z][a-z0-9_]*\.)+[A-Z][A-Za-z0-9]*$/u.test(i.symbol)) fail('MODULE_SEAMS_SYMBOL', 'complete portable Scala type FQN required', s);
    const parts = i.symbol.split('.'), typeName = parts.pop(), packageName = parts.join('.');
    for (const [space, spelling] of [['scala-package', packageName], ['scala-type', typeName]]) resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: i.id, scope: packageName, space, spelling, binding: spelling, prefix: [], suffix: [] });
    if (!['class', 'object'].includes(i.construction)) fail('MODULE_SEAMS_ABI', 'explicit class or object construction required', s);
    object(i.source, ['root', 'file'], source(p + '/source')); text(i.source.root, s); portableSeamsPath(i.source.file, source(p + '/source/file'));
    if (!i.source.file.endsWith('.scala')) fail('MODULE_SEAMS_PATH', 'declared member must be a Scala file', s);
    const implemented = i.implements === null ? null : seamsPort(i.implements, contract, source(p + '/implements'));
    if (i.role !== 'pure-implementation' && !implemented || i.role === 'pure-implementation' && implemented && implemented.role !== 'computation') fail('MODULE_SEAMS_IMPLEMENTS', 'adapter/extension require a port; pure implementations can only implement computations', s);
    const methods = methodMappings(i.methods, p + '/methods', i.implements);
    if (i.role === 'pure-implementation' && methods.some(m => m.signature.result.effect !== 'pure' || seamsPort(m.method.port, contract, s).role !== 'computation')) fail('MODULE_SEAMS_PURE', 'pure implementation ABI must be a computation', s);
    if (implemented && methods.some(m => m.delegateMember !== m.signature.name)) fail('MODULE_SEAMS_ABI', 'direct implementation member must use the declared Scala method name', s);
    return { ...i, context: contract.context, source: s, sourceFile: { root: i.source.root, file: i.source.file, source: source(p + '/source') }, methods, constructor: [], dependencies: [], requires: [] };
  });
  unique(implementations.map(i => i.id), 'MODULE_SEAMS_DUPLICATE', source('/implementations'));
  unique(implementations.map(i => i.symbol), 'MODULE_SEAMS_DUPLICATE', source('/implementations'));
  unique(implementations.map(i => JSON.stringify([i.sourceFile.root, i.sourceFile.file])), 'MODULE_SEAMS_DUPLICATE', source('/implementations'));
  const bridges = array(b.bridges, source('/bridges')).map((bridge, n) => {
    const p = '/bridges/' + n, s = source(p);
    object(bridge, ['id', 'port', 'delegateImplementation', 'methods'], s); text(bridge.id, s); text(bridge.delegateImplementation, s);
    const port = seamsPort(bridge.port, contract, s), delegate = implementations.find(i => i.id === bridge.delegateImplementation);
    if (port.role !== 'computation' || !delegate || delegate.role !== 'pure-implementation' || delegate.module !== 'kernel' || delegate.implements !== null) fail('MODULE_SEAMS_BRIDGE', 'bridge adapts an explicitly non-port kernel pure implementation only', s);
    const methods = methodMappings(bridge.methods, p + '/methods', bridge.port);
    for (const m of methods) if (!delegate.methods.some(d => equal(d.method, m.method) && d.delegateMember === m.delegateMember)) fail('MODULE_SEAMS_BRIDGE', 'bridge delegate must match the implementation method obligation', m.source);
    return { ...bridge, context: contract.context, module: 'kernel', role: 'bridge', implements: bridge.port, construction: 'class', methods, source: s, dependencies: [delegate.id], requires: [] };
  });
  unique([...implementations, ...bridges].map(i => i.id), 'MODULE_SEAMS_DUPLICATE', source(''));
  const components = new Map([...implementations, ...bridges].map(i => [i.id, i]));
  object(b.root, ['id', 'method', 'parameterGroups', 'result', 'bindings'], source('/root'));
  text(b.root.id, source('/root')); member(b.root.method, source('/root/method'));
  if (components.has(b.root.id)) fail('MODULE_SEAMS_DUPLICATE', 'root id conflicts with a component', source('/root'));
  seamsPort(b.root.result, contract, source('/root/result'));
  function groups(rows, pointer, key) {
    const result = array(rows, source(pointer));
    result.forEach((g, j) => {
      object(g, ['implicit', key], source(pointer + '/' + j));
      if (typeof g.implicit !== 'boolean' || g.implicit && j !== result.length - 1) fail('MODULE_SEAMS_ABI_GROUP', 'at most one implicit group, last only', source(pointer + '/' + j));
      if (!array(g[key], source(pointer + '/' + j)).length) fail('MODULE_SEAMS_ABI_GROUP', 'empty groups are not admitted; no-arg constructors use []', source(pointer + '/' + j));
    });
    return result;
  }
  const inputs = new Map(), inputNames = [];
  const parameterGroups = groups(b.root.parameterGroups, '/root/parameterGroups', 'inputs').map((g, j) => ({ implicit: g.implicit, source: source('/root/parameterGroups/' + j), inputs: g.inputs.map((i, k) => {
    const s = source('/root/parameterGroups/' + j + '/inputs/' + k);
    object(i, ['id', 'name', 'type'], s); text(i.id, s); member(i.name, s);
    if (inputs.has(i.id)) fail('MODULE_SEAMS_DUPLICATE', 'duplicate root input id', s);
    if (i.type?.form === 'technical') {
      object(i.type, ['form', 'name'], s);
      if (i.type.name !== 'ExecutionContext' || !g.implicit) fail('MODULE_SEAMS_TECHNICAL', 'only explicit implicit ExecutionContext is admitted', s);
    } else {
      signatureReferences(i.type, contract.context, contract.values, s);
      if (g.implicit) fail('MODULE_SEAMS_TECHNICAL', 'implicit business inputs are not supported', s);
    }
    const result = { ...i, source: s }; inputs.set(i.id, result); inputNames.push(i.name); return result;
  }) }));
  unique(inputNames, 'MODULE_SEAMS_DUPLICATE', source('/root/parameterGroups'));
  const bindings = array(b.root.bindings, source('/root/bindings')).map((r, n) => {
    const s = source('/root/bindings/' + n);
    object(r, ['port', 'target'], s); seamsPort(r.port, contract, s); object(r.target, ['kind', 'id'], s);
    if (!['implementation', 'bridge'].includes(r.target.kind)) fail('MODULE_SEAMS_BINDING', 'explicit implementation or bridge selection required', s);
    const c = components.get(r.target.id);
    if (!c || (r.target.kind === 'bridge') !== (c.role === 'bridge') || !equal(c.implements, r.port)) fail('MODULE_SEAMS_BINDING', 'root selection does not implement its port', s);
    return { ...r, component: c.id, source: s };
  });
  unique(bindings.map(r => refKey(r.port)), 'MODULE_SEAMS_DUPLICATE', source('/root/bindings'));
  if (bindings.length !== contract.ports.length || contract.ports.some(p => !bindings.some(r => equal(r.port, p.ref)))) fail('MODULE_SEAMS_BINDING', 'every port requires exactly one root selection', source('/root/bindings'));
  const bound = ref => bindings.find(b => equal(b.port, ref)).component;
  const inputUsage = new Set(), moduleDeps = { kernel: [], glue: ['kernel'], ext: ['kernel', 'glue'] };
  implementations.forEach((i, n) => {
    const p = '/implementations/' + n + '/constructor', raw = b.implementations[n].constructor;
    if (i.construction === 'object' && array(raw, source(p)).length) fail('MODULE_SEAMS_ABI', 'objects have no constructor arguments', source(p));
    const names = [], dependencies = [], requires = [];
    i.constructor = groups(raw, p, 'arguments').map((g, j) => ({ implicit: g.implicit, source: source(p + '/' + j), arguments: g.arguments.map((a, k) => {
      const s = source(p + '/' + j + '/arguments/' + k);
      object(a, ['name', 'from'], s); member(a.name, s); names.push(a.name);
      let valueType, component = null;
      if (a.from?.kind === 'root-input') {
        object(a.from, ['kind', 'id'], s); const input = inputs.get(a.from.id);
        if (!input) fail('MODULE_SEAMS_INPUT', 'unresolved root input', s);
        inputUsage.add(input.id); valueType = input.type;
      } else if (a.from?.kind === 'port') {
        object(a.from, ['kind', 'ref'], s); const port = seamsPort(a.from.ref, contract, s);
        valueType = { form: 'port', ref: port.ref }; component = bound(port.ref); requires.push(port.ref);
        if (i.role === 'pure-implementation' && port.role !== 'computation') fail('MODULE_SEAMS_PURE', 'pure component cannot consume effectful ports', s);
      } else if (a.from?.kind === 'component') {
        object(a.from, ['kind', 'id'], s); const dep = components.get(a.from.id);
        if (!dep) fail('MODULE_SEAMS_COMPONENT', 'unresolved constructor component', s);
        valueType = { form: 'component', id: dep.id }; component = dep.id; dependencies.push(dep.id);
      } else fail('MODULE_SEAMS_CONSTRUCTOR', 'constructor values come only from root-input, port or component', s);
      if (valueType.form === 'technical' && !g.implicit || valueType.form !== 'technical' && g.implicit) fail('MODULE_SEAMS_ABI_GROUP', 'only technical EC belongs in an implicit group', s);
      if (i.role === 'pure-implementation' && valueType.form === 'technical') fail('MODULE_SEAMS_PURE', 'kernel pure component cannot depend on ExecutionContext', s);
      if (component) {
        const dep = components.get(component);
        if (dep.module !== i.module && !moduleDeps[i.module].includes(dep.module)) fail('MODULE_SEAMS_MODULE', 'constructor concrete dependency violates module direction', s);
      }
      return { ...a, valueType, component, source: s };
    }) }));
    unique(names, 'MODULE_SEAMS_DUPLICATE', source(p));
    i.dependencies = [...new Set(dependencies)]; i.requires = requires.filter((r, j) => requires.findIndex(x => equal(x, r)) === j);
  });
  const edges = new Map([...components].map(([id, i]) => [id, new Set([...i.dependencies, ...i.requires.map(bound)])])), order = [];
  while (edges.size) {
    const ready = [...edges].filter(([, deps]) => !deps.size).map(([id]) => id).sort();
    if (!ready.length) fail('MODULE_SEAMS_COMPONENT_CYCLE', 'constructor dependency graph has a cycle', source(''));
    ready.forEach(id => { edges.delete(id); order.push(id); }); edges.forEach(deps => ready.forEach(id => deps.delete(id)));
  }
  const used = new Set();
  function visit(id) { if (used.has(id)) return; used.add(id); const c = components.get(id); [...c.dependencies, ...c.requires.map(bound)].forEach(visit); }
  bindings.forEach(r => visit(r.component));
  if (used.size !== components.size) fail('MODULE_SEAMS_UNUSED', 'unused implementation or bridge', source(''));
  if (inputUsage.size !== inputs.size) fail('MODULE_SEAMS_UNUSED', 'unused root input', source('/root/parameterGroups'));
  const root = { ...b.root, context: contract.context, module: 'root', role: 'composition', construction: 'object', parameterGroups, bindings, source: source('/root'), resultComponent: bound(b.root.result) };
  const handwritten = implementations.map(i => ({ id: i.id, version: i.version, module: i.module, role: i.role, symbol: i.symbol, construction: i.construction, implements: i.implements, sourceRootKey: i.sourceFile.root, file: i.sourceFile.file, source: i.sourceFile.source }));
  return detach({ schemaVersion: COMPOSITION_SCHEMA, id: b.id, version: b.version, context: contract.context, contract: b.contract, source: source(''), implementations, bridges, root, order, handwritten });
}
