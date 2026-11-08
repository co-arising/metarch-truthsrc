import { at, array, detach, equal, fail, object, text, unique } from '../../lib/products/request.mjs';
import { compileProductSet } from '../../lib/products/compile.mjs';
import { COMPILER, PRODUCT_SET } from '../../lib/products/registry.mjs';
import { lowerModuleSeamsTarget } from '../../lib/products/module-seams-target.mjs';
import { refKey } from '../../lib/domain-products/references.mjs';
import { resolveName, resolveNameSet, resolveArtifactPath } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';

export const productFootprint = detach([{ id: 'module-seams-contract', version: '1' }, { id: 'module-seams-composition', version: '1' }]);
const location = at('module-seams-generator');
export const sourcesOf = rows => [...new Map(rows.map(s => [JSON.stringify(s), s])).values()];
const uniquePaths = rows => [...new Set(rows)];
const suffixSource = (source, suffix) => at(source.document, source.pointer + suffix);
const select = (rows, predicate, message) => {
  const found = rows.filter(predicate);
  if (found.length !== 1) fail('MODULE_SEAMS_MODEL', message, location);
  return found[0];
};
const named = (identity, scope, space, spelling, binding = spelling) => ({
  knowledgeId: identity, scope, space, spelling, binding, prefix: [], suffix: [],
});
const explicitMember = (name, source) => resolveName({ profile: MODULAR_CANDIDATE,
  ...named(source.document + '#' + source.pointer, source.document + '#' + source.pointer, 'scala-member', name) });
const symbol = t => ({ packageName: t.packageName, name: t.name, identifier: t.identifier, path: t.path });

/** Resolve real requirement roles, replay the complete compilation, then call A's strict lower. */
export function resolveModuleSeamsTarget(raw) {
  const input = detach(raw);
  object(input, ['compilation', 'options'], location);
  const { compilation: c, options } = input;
  object(c, ['result', 'diagnostics'], location);
  if (array(c.diagnostics, location).length || !c.result || c.result.schemaVersion !== PRODUCT_SET || !equal(c.result.compiler, COMPILER))
    fail('MODULE_SEAMS_COMPILATION', 'a complete successful product compilation is required', location);
  const requirements = array(c.result.requirements, location);
  if (requirements.length !== 2 || !equal(requirements.map(r => ({ id: r.id, version: r.version })).sort((a, b) => a.id.localeCompare(b.id)), [...productFootprint].sort((a, b) => a.id.localeCompare(b.id))))
    fail('MODULE_SEAMS_COMPILATION', 'exactly both module-seams@1 requirements are required', location);
  const contract = select(requirements, r => r.id === 'module-seams-contract', 'contract requirement missing');
  const composition = select(requirements, r => r.id === 'module-seams-composition', 'composition requirement missing');
  if (contract.inputRoles?.canonical !== composition.inputRoles?.canonical)
    fail('MODULE_SEAMS_COMPILATION', 'both products must share the same canonical document', location);
  const derived = new Set(array(c.result.assemblies, location).map(a => a.id));
  const replay = compileProductSet({ schemaVersion: 'truthsrc.product-compilation/v1',
    documents: array(c.result.documents, location).filter(d => !derived.has(d.id)),
    assemblies: c.result.assemblies.map(({ provenance, ...a }) => a), requirements, options: {} });
  if (!replay.result || !equal(replay.result, c.result))
    fail('MODULE_SEAMS_COMPILATION', 'whole compilation differs from its complete replay', location);
  const document = (id, schema) => select(c.result.documents, d => d.id === id && d.schemaVersion === schema, 'requirement role document missing or wrong schema');
  return lowerModuleSeamsTarget(document(contract.inputRoles.canonical, 'truthsrc/v1'),
    document(contract.inputRoles.moduleSeamsContractBinding, 'truthsrc.module-seams-contract-binding/v1'),
    document(composition.inputRoles.moduleSeamsCompositionBinding, 'truthsrc.module-seams-composition-binding/v1'), options);
}

export function typePaths(type) {
  if (type.form === 'nominal' || type.form === 'port') return [type.symbol.path];
  if (type.form === 'component') return type.generated ? [type.symbol.path] : [];
  if (['optional', 'sequence'].includes(type.form)) return typePaths(type.element);
  if (type.form === 'map') return [...typePaths(type.key), ...typePaths(type.value)];
  if (type.form === 'either') return [...typePaths(type.left), ...typePaths(type.right)];
  return [];
}
const methodPaths = m => [...m.parameters.flatMap(p => typePaths(p.type)), ...typePaths(m.result.type)];

/** Pure typed structural model. Scala expressions and all interpolation belong to templates. */
export function buildModels(raw) {
  const lowered = resolveModuleSeamsTarget(raw);
  const { contract, composition, target } = lowered;
  const valuesByRef = new Map(target.values.map(v => [refKey(v.ref), v]));
  const portsByRef = new Map(target.ports.map(p => [refKey(p.ref), p]));
  const componentsById = new Map(target.components.map(c => [c.id, c]));
  function resolveType(t) {
    if (t.form === 'primitive' || t.form === 'technical') return { ...t };
    if (t.form === 'nominal' || t.form === 'port') {
      const declaration = (t.form === 'nominal' ? valuesByRef : portsByRef).get(refKey(t.ref));
      if (!declaration) fail('MODULE_SEAMS_MODEL', 'unresolved signature identity', location);
      return { form: t.form, ref: t.ref, symbol: symbol(declaration) };
    }
    if (t.form === 'component') {
      const declaration = componentsById.get(t.id);
      if (!declaration) fail('MODULE_SEAMS_MODEL', 'unresolved component identity', location);
      const impl = composition.implementations.find(i => i.id === t.id);
      return { form: t.form, id: t.id, symbol: symbol(declaration), singleton: impl?.construction === 'object', generated: !impl };
    }
    if (['optional', 'sequence'].includes(t.form)) return { form: t.form, element: resolveType(t.element) };
    if (t.form === 'map') return { form: t.form, key: resolveType(t.key), value: resolveType(t.value) };
    if (t.form === 'either') return { form: t.form, left: resolveType(t.left), right: resolveType(t.right) };
    fail('MODULE_SEAMS_MODEL', 'unknown finite signature type', location);
  }
  function fields(targetFields, sourceFields) {
    return targetFields.map(t => {
      const f = select(sourceFields, f => f.id === t.id, 'field/parameter identity mismatch');
      return { id: f.id, ref: f.ref, name: t.name, identifier: t.identifier, type: resolveType(f.valueType), source: f.source };
    });
  }
  const values = target.values.map(t => {
    const v = select(contract.values, v => equal(v.ref, t.ref), 'value identity mismatch');
    return { ...symbol(t), ref: v.ref, shape: v.shape, source: v.source,
      fields: fields(t.fields, v.fields), variants: t.variants.map(x => {
        const v = select(contract.values, v => equal(v.ref, t.ref), 'sum identity mismatch');
        const variant = select(v.variants, v => v.id === x.id, 'variant identity mismatch');
        return { id: variant.id, ref: variant.ref, name: x.name, identifier: x.identifier, source: variant.source, fields: fields(x.fields, variant.fields) };
      }) };
  });
  const ports = target.ports.map(t => {
    const p = select(contract.ports, p => equal(p.ref, t.ref), 'port identity mismatch');
    return { ...symbol(t), ref: p.ref, source: p.source, methods: t.methods.map(m => {
      const signature = select(p.methods, s => s.id === m.id, 'method identity mismatch');
      return { id: m.id, ref: signature.ref, name: m.name, identifier: m.identifier, source: signature.source,
        parameters: fields(m.parameters, signature.parameters), result: { effect: signature.result.effect, type: resolveType(signature.result.valueType), source: signature.result.source } };
    }) };
  });
  function resolvedMethod(mapping) {
    const p = select(ports, p => equal(p.ref, mapping.method.port), 'implementation port identity mismatch');
    const m = select(p.methods, m => m.id === mapping.method.method, 'implementation method identity mismatch');
    return { ...m, delegateMember: explicitMember(mapping.delegateMember, mapping.source).identifier, mappingSource: mapping.source };
  }
  const rootTarget = componentsById.get(composition.root.id), rootScope = rootTarget.packageName + '.' + rootTarget.name + ':factory';
  const parameterGroups = composition.root.parameterGroups.map(g => ({ implicit: g.implicit, source: g.source,
    inputs: g.inputs.map(i => ({ ...i, identifier: explicitMember(i.name, i.source).identifier, type: resolveType(i.type) })) }));
  const inputs = new Map(parameterGroups.flatMap(g => g.inputs.map(i => [i.id, i])));
  const locals = resolveNameSet({ profile: MODULAR_CANDIDATE, names: composition.order.map(id => {
    const c = componentsById.get(id);
    return named('component:' + id, rootScope, 'scala-member', c.name, null);
  }), reserved: parameterGroups.flatMap(g => g.inputs).map(i => ({ scope: rootScope, space: 'scala-member', name: i.name, reason: 'factory input conflicts with generated component local' })) });
  const localById = new Map(composition.order.map((id, n) => [id, locals[n].identifier]));
  function argument(a) {
    let identifier;
    if (a.from.kind === 'root-input') identifier = inputs.get(a.from.id)?.identifier;
    else identifier = localById.get(a.component);
    if (!identifier) fail('MODULE_SEAMS_MODEL', 'unresolved ABI argument source', a.source);
    return { name: a.name, identifier, from: a.from, component: a.component, type: resolveType(a.valueType), source: a.source, fromSource: suffixSource(a.source, '/from') };
  }
  const implementations = composition.implementations.map(i => ({ id: i.id, symbol: symbol(componentsById.get(i.id)), construction: i.construction,
    source: i.source, sourceFile: i.sourceFile, implements: i.implements, methods: i.methods.map(resolvedMethod),
    constructor: i.constructor.map(g => ({ implicit: g.implicit, source: g.source, arguments: g.arguments.map(argument) })) }));
  const bridges = composition.bridges.map(b => {
    const delegate = select(implementations, i => i.id === b.delegateImplementation, 'bridge delegate missing');
    const methods = b.methods.map(resolvedMethod);
    const delegateField = resolveNameSet({ profile: MODULAR_CANDIDATE,
      names: [named('bridge:' + b.id + ':delegate', b.id + ':members', 'scala-member', 'delegate')],
      reserved: methods.map(m => ({ scope: b.id + ':members', space: 'scala-member', name: m.name, reason: 'bridge delegate field conflicts with port method' })) })[0];
    return { id: b.id, ...symbol(componentsById.get(b.id)), source: b.source, methods,
      port: symbol(portsByRef.get(refKey(b.port))), delegate: { id: delegate.id, symbol: delegate.symbol, construction: delegate.construction,
        identifier: delegateField.identifier, source: delegate.source, mappingSource: suffixSource(b.source, '/delegateImplementation'),
        // Objects have an explicit empty constructor. Classes are instantiated ONLY in the root using their entire declared ABI.
        injected: delegate.construction === 'class' } };
  });
  const initializations = composition.order.map(id => {
    const i = implementations.find(i => i.id === id);
    const bindings = composition.root.bindings.filter(b => b.component === id).map(b => b.source);
    if (i) return { ...i, identifier: localById.get(id), bindingSources: bindings };
    const b = select(bridges, b => b.id === id, 'ordered bridge missing');
    return { id, symbol: symbol(b), construction: 'class', identifier: localById.get(id), source: b.source, bindingSources: bindings,
      constructor: b.delegate.injected ? [{ implicit: false, source: b.source, arguments: [{
        name: b.delegate.identifier, identifier: localById.get(b.delegate.id), from: { kind: 'component', id: b.delegate.id }, component: b.delegate.id,
        type: resolveType({ form: 'component', id: b.delegate.id }), source: b.delegate.mappingSource, fromSource: b.delegate.mappingSource,
      }] }] : [] };
  });
  const factorySource = suffixSource(composition.root.source, '/method');
  const root = { id: composition.root.id, ...symbol(rootTarget), source: composition.root.source,
    method: explicitMember(composition.root.method, factorySource).identifier, methodSource: factorySource, parameterGroups,
    result: { type: resolveType({ form: 'port', ref: composition.root.result }), source: suffixSource(composition.root.source, '/result') },
    initializations, resultIdentifier: localById.get(composition.root.resultComponent),
    bindings: composition.root.bindings, resultBindingSource: select(composition.root.bindings, b => equal(b.port, composition.root.result), 'root result binding missing').source };
  // Generated dependencies include all declared external ABI compilation needs, NEVER handwritten logical output paths.
  // Close the external component graph in A's initialization order, including component-from
  // arguments whose concrete handwritten type is deliberately NOT a generated dependency.
  const compilationNeeds = new Map();
  const needs = id => {
    if (!compilationNeeds.has(id)) fail('MODULE_SEAMS_MODEL', 'component ABI requirements precede their initialization dependency', location);
    return compilationNeeds.get(id);
  };
  for (const id of composition.order) {
    const i = implementations.find(i => i.id === id);
    if (i) compilationNeeds.set(id, uniquePaths([
      ...(i.implements ? typePaths(resolveType({ form: 'port', ref: i.implements })) : []),
      ...i.methods.flatMap(methodPaths),
      ...i.constructor.flatMap(g => g.arguments.flatMap(a => [...typePaths(a.type), ...(a.component ? needs(a.component) : [])])),
    ]));
    else {
      const b = select(bridges, b => b.id === id, 'ordered bridge ABI requirements missing');
      compilationNeeds.set(id, uniquePaths([b.path, b.port.path, ...b.methods.flatMap(methodPaths), ...needs(b.delegate.id)]));
    }
  }
  const externalRequirements = uniquePaths(composition.order.flatMap(needs));
  const artifacts = lowered.generatedFiles.map(file => {
    const base = { ...file, kind: { value: 'value-object', port: 'module-seams-port', bridge: 'module-seams-bridge', composition: 'module-seams-composition' }[file.role] };
    if (file.role === 'value') {
      const group = values.filter(v => v.path === file.path);
      return { ...base, packageName: group[0].packageName, values: group,
        directDeps: uniquePaths(group.flatMap(v => [...v.fields, ...v.variants.flatMap(x => x.fields)].flatMap(f => typePaths(f.type))).filter(p => p !== file.path)) };
    }
    if (file.role === 'port') {
      const port = select(ports, p => p.path === file.path, 'generated port path mismatch');
      return { ...base, port, directDeps: uniquePaths(port.methods.flatMap(methodPaths)).filter(p => p !== file.path) };
    }
    if (file.role === 'bridge') {
      const bridge = select(bridges, b => b.path === file.path, 'generated bridge path mismatch');
      return { ...base, bridge, directDeps: uniquePaths([bridge.port.path, ...bridge.methods.flatMap(methodPaths),
        ...needs(bridge.delegate.id)]).filter(p => p !== file.path) };
    }
    return { ...base, root, directDeps: uniquePaths([...externalRequirements, ...bridges.map(b => b.path),
      ...parameterGroups.flatMap(g => g.inputs.flatMap(i => typePaths(i.type))), ...typePaths(root.result.type)]).filter(p => p !== file.path) };
  });
  const testSymbol = (module, pkg, name) => {
    const n = resolveName({ profile: MODULAR_CANDIDATE, ...named('module-seams-support:' + module, pkg, 'scala-type', name) });
    return { packageName: pkg, name: n.name, identifier: n.identifier,
      path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module, packageName: pkg, typeName: n.name }).replace('src/main/', 'src/test/') };
  };
  const support = [
    { role: 'build', kind: 'build', path: 'project/build.properties', sources: [contract.source, composition.source], directDeps: [] },
    { role: 'build', kind: 'build', path: 'build.sbt', sources: [contract.source, composition.source, ...lowered.handwritten.map(h => h.source)],
      directDeps: ['project/build.properties', ...artifacts.map(a => a.path)] },
    { role: 'value-shape-test', kind: 'generated-test', ...testSymbol('kernel', target.contexts[0].packageName + '.domain', 'ModuleSeamsValueShapeSpec'),
      sources: values.map(v => v.source), directDeps: uniquePaths(values.map(v => v.path)), values },
    { role: 'root-shape-test', kind: 'generated-test', ...testSymbol('root', root.packageName, 'ModuleSeamsRootShapeSpec'),
      sources: [root.source], directDeps: [root.path], root,
      shapeMethod: explicitMember('bindingShape', root.source).identifier },
  ];
  return detach({ schemaVersion: 'truthsrc.module-seams-render-model/v1', lowered, values, ports, bridges, root, artifacts, support,
    modules: target.modules.map(m => ({ ...m, identifier: explicitMember(m.id, composition.source).identifier })),
    buildSettingsIdentifier: explicitMember('moduleSeamsSettings', composition.source).identifier,
    packageName: target.contexts[0].packageName, sourceRoots: lowered.sourceRoots,
    counts: { production: artifacts.length, build: 2, test: 2, support: 4, total: artifacts.length + 4 } });
}

/** Pure lexical check of separately captured build roots; never reinterpret project-relative options. */
export function resolveBuildSourceRoots(model, rawRoots) {
  const roots = detach(rawRoots);
  array(roots, location); unique(roots.map(r => r.id), 'MODULE_SEAMS_BUILD_ROOTS', location);
  if (roots.length !== model.sourceRoots.length) fail('MODULE_SEAMS_BUILD_ROOTS', 'exact captured source root set is required', location);
  for (const r of roots) {
    object(r, ['id', 'module', 'absolutePath'], location); text(r.absolutePath, location);
    if (!r.absolutePath.startsWith('/') || /[\x00-\x1f\x7f]/u.test(r.absolutePath) || !r.absolutePath.isWellFormed() ||
        r.absolutePath.split('/').slice(1).some(p => !p || p === '.' || p === '..'))
      fail('MODULE_SEAMS_BUILD_ROOTS', 'explicit canonical absolute build path required', location);
    if (!model.sourceRoots.some(s => s.id === r.id && s.module === r.module)) fail('MODULE_SEAMS_BUILD_ROOTS', 'captured root ID/module does not match the lowered declaration', location);
  }
  return roots;
}
