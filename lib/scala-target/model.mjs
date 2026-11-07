import { array, at, fail, object, text, unique } from '../products/request.mjs';
import { reference, refKey, typeRefs } from '../domain-products/references.mjs';
import { MODULAR_CANDIDATE, targetProfile } from './profiles.mjs';
import { resolveNameSet, resolveArtifactPath, targetData } from './naming.mjs';

const SCHEMA = 'truthsrc.scala-target-model/v1';
const location = at('target-model');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const roleModules = {
  'pure-implementation': ['kernel'], bridge: ['kernel'], adapter: ['glue', 'ext'], extension: ['ext'], composition: ['root']
};
const rolePackages = {
  'pure-implementation': 'domain', bridge: 'domain.ports', adapter: 'infrastructure', extension: 'application', composition: 'composition'
};
const memberFields = ['id', 'spelling', 'binding', 'valueType'];
const finalMembers = ['wait', 'notify', 'notifyAll', 'getClass'];
const reservations = scope => finalMembers.map(name => ({ scope, space: 'scala-member', name, reason: 'inherited final JVM member' }));
function typeReferences(type, depth = 0) {
  if (depth > 64) fail('TARGET_TYPE_DEPTH', 'signature type exceeds nesting bound', location);
  if (type?.form === 'either') {
    object(type, ['form', 'left', 'right'], location);
    return [...typeReferences(type.left, depth + 1), ...typeReferences(type.right, depth + 1)];
  }
  if (['optional', 'sequence'].includes(type?.form)) {
    object(type, ['form', 'element'], location); return typeReferences(type.element, depth + 1);
  }
  if (type?.form === 'map') {
    object(type, ['form', 'key', 'value'], location);
    return [...typeReferences(type.key, depth + 1), ...typeReferences(type.value, depth + 1)];
  }
  if (!['primitive', 'nominal'].includes(type?.form)) fail('TARGET_TYPE', 'explicit primitive, nominal or supported container required', location);
  return typeRefs(type, location);
}
function topological(edges, code) {
  const remaining = new Map([...edges].map(([id, deps]) => [id, new Set(deps)])), result = [];
  while (remaining.size) {
    const ready = [...remaining].filter(([, deps]) => !deps.size).map(([id]) => id).sort(compare);
    if (!ready.length) fail(code, 'dependency cycle in target structure', location, [...remaining.keys()]);
    for (const id of ready) { remaining.delete(id); result.push(id); }
    for (const deps of remaining.values()) for (const id of ready) deps.delete(id);
  }
  return result;
}
const named = (identity, scope, space, value) => ({ knowledgeId: identity, scope, space,
  spelling: value.spelling, binding: value.binding, prefix: [], suffix: [] });
function members(values, scope, identity, validateType, accessor = true) {
  array(values, location); unique(values.map(value => value.id), 'TARGET_MEMBER_DUPLICATE', location);
  for (const field of values) {
    object(field, memberFields, location); text(field.id, location); validateType(field.valueType);
  }
  const names = resolveNameSet({ profile: MODULAR_CANDIDATE,
    names: values.map(field => named(identity + ':' + field.id, scope, 'scala-member', field)), reserved: accessor ? reservations(scope) : [] });
  return values.map((value, i) => ({ ...value, name: names[i].name, identifier: names[i].identifier }));
}

export function buildTargetModel(raw) {
  const input = targetData(raw);
  object(input, ['schemaVersion', 'profile', 'contexts', 'values', 'ports', 'components', 'bindings'], location);
  if (input.schemaVersion !== SCHEMA) fail('TARGET_MODEL_VERSION', 'unsupported target model schema', location);
  const profile = targetProfile(input.profile);
  if (profile.id !== MODULAR_CANDIDATE) fail('TARGET_MODEL_PROFILE', 'modular structure cannot reinterpret a compatible target', location);
  for (const key of ['contexts', 'values', 'ports', 'components', 'bindings']) array(input[key], location);
  const modules = new Map(profile.modules.map(module => [module.id, module]));
  const module = id => { if (!modules.has(id)) fail('TARGET_MODULE', 'unknown target module', location); return modules.get(id); };
  for (const context of input.contexts) { object(context, ['id', 'packageName'], location); text(context.id, location); }
  unique(input.contexts.map(context => context.id), 'TARGET_CONTEXT_DUPLICATE', location);
  const contexts = new Map(input.contexts.map(context => [context.id, context]));
  resolveNameSet({ profile: profile.id, names: input.contexts.map(context => ({ knowledgeId: context.id, scope: 'packages',
    space: 'scala-package', spelling: context.id, binding: context.packageName, prefix: [], suffix: [] })), reserved: [] });
  const context = id => { if (!contexts.has(id)) fail('TARGET_CONTEXT', 'undeclared target context', location); return contexts.get(id); };
  const entity = (value, kind) => {
    reference(value, location);
    if (value.kind !== kind || value.owner.length) fail('TARGET_REFERENCE', 'expected top-level ' + kind + ' reference', location);
    context(value.context);
  };
  for (const value of input.values) {
    object(value, ['ref', 'spelling', 'binding', 'module', 'shape', 'fileStem', 'fields', 'variants'], location);
    entity(value.ref, 'type'); module(value.module); array(value.fields, location); array(value.variants, location);
    if (!['record', 'sum'].includes(value.shape) || value.shape === 'sum' && (value.fields.length || !value.variants.length) ||
        value.shape === 'record' && value.variants.length)
      fail('TARGET_VALUE_SHAPE', 'a record or a closed sum with explicit variant fields is required', location);
    if (value.fileStem !== null && typeof value.fileStem !== 'string') fail('TARGET_FILE_STEM', 'explicit file stem or null required', location);
    unique(value.variants.map(variant => variant.id), 'TARGET_VARIANT_DUPLICATE', location);
    for (const variant of value.variants) {
      object(variant, ['id', 'spelling', 'binding', 'fields'], location); text(variant.id, location); array(variant.fields, location);
    }
  }
  unique(input.values.map(value => refKey(value.ref)), 'TARGET_TYPE_DUPLICATE', location);
  const byType = new Map(input.values.map(value => [refKey(value.ref), value]));
  const validateType = type => {
    const references = typeReferences(type);
    for (const ref of references) if (ref.kind !== 'type' || !byType.has(refKey(ref)))
      fail('TARGET_TYPE_UNRESOLVED', 'signature refers to an undeclared nominal value', location, [ref]);
    return references;
  };
  const typeEdges = new Map(input.values.map(value => [refKey(value.ref), new Set([...value.fields, ...value.variants.flatMap(variant => variant.fields)]
    .flatMap(field => validateType(field.valueType).map(refKey)))]));
  topological(typeEdges, 'TARGET_TYPE_CYCLE');
  for (const port of input.ports) {
    object(port, ['ref', 'spelling', 'binding', 'module', 'role', 'methods'], location); entity(port.ref, 'port'); module(port.module);
    if (port.module !== 'kernel') fail('TARGET_PORT_MODULE', 'ports belong to kernel', location);
    if (!['computation', 'flow', 'repository'].includes(port.role)) fail('TARGET_PORT_ROLE', 'unsupported port responsibility', location);
    if (!array(port.methods, location).length) fail('TARGET_PORT_METHOD', 'port needs an explicit method', location);
  }
  unique(input.ports.map(port => refKey(port.ref)), 'TARGET_PORT_DUPLICATE', location);
  const byPort = new Map(input.ports.map(port => [refKey(port.ref), port]));
  const portRef = ref => {
    entity(ref, 'port');
    if (!byPort.has(refKey(ref))) fail('TARGET_PORT_UNRESOLVED', 'unknown port', location, [ref]);
    return byPort.get(refKey(ref));
  };
  const signature = new Set();
  function close(ref) {
    const key = refKey(ref), value = byType.get(key);
    if (signature.has(key)) return;
    if (value.module !== 'kernel') fail('TARGET_SIGNATURE_MODULE', 'all reachable signature values must be in kernel', location, [ref]);
    signature.add(key);
    for (const dep of typeEdges.get(key)) close(byType.get(dep).ref);
  }
  const names = [];
  const nameFor = (ref, pkg, value) => { names.push(named(refKey(ref), pkg, 'scala-type', value)); return names.length - 1; };
  const valueModels = input.values.map(value => {
    const packageName = context(value.ref.context).packageName + (value.shape === 'sum' ? '.domain' : '.domain.values');
    const scope = packageName + '.' + value.ref.id;
    const variants = resolveNameSet({ profile: profile.id, names: value.variants.map(variant => named(refKey(value.ref) + ':' + variant.id,
      scope, 'scala-type', variant)), reserved: [] });
    return { ...value, packageName, nameIndex: nameFor(value.ref, packageName, value),
      fields: members(value.fields, scope, refKey(value.ref), validateType),
      variants: value.variants.map((variant, i) => ({ ...variant, name: variants[i].name, identifier: variants[i].identifier,
        fields: members(variant.fields, scope + '.' + variant.id, refKey(value.ref) + ':' + variant.id, validateType) })) };
  });
  const portModels = input.ports.map(port => {
    const packageName = context(port.ref.context).packageName + (port.role === 'computation' ? '.domain.ports' : '.application.ports');
    const nameIndex = nameFor(port.ref, packageName, port), scope = packageName + '.' + port.ref.id;
    unique(port.methods.map(method => method.id), 'TARGET_METHOD_DUPLICATE', location);
    for (const method of port.methods) {
      object(method, ['id', 'spelling', 'binding', 'parameters', 'result'], location); text(method.id, location);
      object(method.result, ['effect', 'valueType'], location);
      if (!['pure', 'future'].includes(method.result.effect)) fail('TARGET_EFFECT', 'explicit pure or future effect required', location);
      if (port.role === 'computation' && method.result.effect !== 'pure') fail('TARGET_PURE_EFFECT', 'computation port must remain pure', location);
      for (const ref of validateType(method.result.valueType)) close(ref);
      for (const parameter of array(method.parameters, location)) for (const ref of validateType(parameter.valueType)) close(ref);
    }
    const methodNames = resolveNameSet({ profile: profile.id,
      names: port.methods.map(method => named(refKey(port.ref) + ':' + method.id, scope, 'scala-member', method)), reserved: reservations(scope) });
    return { ...port, packageName, nameIndex, methods: port.methods.map((method, i) => ({ ...method,
      name: methodNames[i].name, identifier: methodNames[i].identifier,
      parameters: members(method.parameters, scope + '.' + method.id, refKey(port.ref) + ':' + method.id, validateType, false) })) };
  });
  for (const value of input.values) if (value.module !== 'kernel') fail('TARGET_VALUE_MODULE', 'domain values belong to kernel', location);
  const componentModels = input.components.map(component => {
    object(component, ['id', 'spelling', 'binding', 'context', 'module', 'role', 'implements', 'dependencies', 'requires'], location);
    text(component.id, location); context(component.context); module(component.module);
    if (typeof component.role !== 'string' || !Object.hasOwn(roleModules, component.role) || !roleModules[component.role].includes(component.module))
      fail('TARGET_COMPONENT_MODULE', 'component responsibility is not allowed in this module', location);
    array(component.dependencies, location).forEach(id => text(id, location));
    unique(component.dependencies, 'TARGET_COMPONENT_DUPLICATE', location);
    const required = array(component.requires, location).map(portRef);
    unique(component.requires.map(refKey), 'TARGET_COMPONENT_DUPLICATE', location);
    const implemented = component.implements === null ? null : portRef(component.implements);
    if (['bridge', 'adapter', 'extension'].includes(component.role) && !implemented)
      fail('TARGET_BINDING_IMPLEMENTATION', 'an implementation must declare its port', location);
    if (['pure-implementation', 'bridge'].includes(component.role) &&
        (required.some(port => port.role !== 'computation') || implemented && implemented.role !== 'computation'))
      fail('TARGET_PURE_DEPENDENCY', 'pure implementations cannot consume effectful ports', location);
    const packageName = context(component.context).packageName + '.' + rolePackages[component.role];
    const nameIndex = names.length; names.push(named('component:' + component.id, packageName, 'scala-type', component));
    return { ...component, packageName, nameIndex };
  });
  unique(input.components.map(component => component.id), 'TARGET_COMPONENT_DUPLICATE', location);
  const byComponent = new Map(componentModels.map(component => [component.id, component]));
  for (const component of componentModels) {
    for (const id of component.dependencies) {
      const dependency = byComponent.get(id);
      if (!dependency) fail('TARGET_COMPONENT_UNRESOLVED', 'unknown concrete component dependency', location);
      if (component.module !== dependency.module && !module(component.module).dependsOn.includes(dependency.module))
        fail('TARGET_MODULE_DIRECTION', 'concrete dependency points out of its permitted module graph', location, [component.id, id]);
    }
    if (component.role === 'bridge' && (component.dependencies.length !== 1 || byComponent.get(component.dependencies[0]).role !== 'pure-implementation'))
      fail('TARGET_BRIDGE', 'a kernel bridge delegates to one same-layer pure implementation', location);
  }
  const bound = new Map();
  for (const binding of input.bindings) {
    object(binding, ['port', 'component', 'module'], location); portRef(binding.port);
    if (binding.module !== 'root') fail('TARGET_BINDING_MODULE', 'concrete bindings belong only to the composition root', location);
    const key = refKey(binding.port), component = byComponent.get(binding.component);
    if (bound.has(key)) fail('TARGET_BINDING_DUPLICATE', 'each port has one explicit composition binding', location);
    if (!component?.implements || refKey(component.implements) !== key)
      fail('TARGET_BINDING_IMPLEMENTATION', 'binding target does not implement the declared port', location);
    bound.set(key, component.id);
  }
  if (input.ports.some(port => !bound.has(refKey(port.ref)))) fail('TARGET_BINDING_MISSING', 'every declared port requires a root binding', location);
  const edges = new Map(componentModels.map(component => [component.id,
    new Set([...component.dependencies, ...component.requires.map(ref => bound.get(refKey(ref)))])]));
  const order = topological(edges, 'TARGET_COMPONENT_CYCLE');
  const resolved = resolveNameSet({ profile: profile.id, names, reserved: [] });
  const decorate = value => {
    const { nameIndex, ...model } = value, name = resolved[nameIndex];
    return { ...model, name: name.name, identifier: name.identifier,
      path: resolveArtifactPath({ profile: profile.id, module: model.module, packageName: model.packageName, typeName: model.fileStem ?? name.name }) };
  };
  const values = valueModels.map(decorate), ports = portModels.map(decorate), components = componentModels.map(decorate);
  const paths = new Map();
  for (const [kind, entries] of [['value', values], ['port', ports], ['component', components]]) for (const entry of entries) {
    const key = entry.path.normalize('NFC').toLowerCase(), prior = paths.get(key);
    if (prior && (entry.path !== prior.path || kind !== 'value' || prior.kind !== 'value' || entry.fileStem === null || prior.fileStem === null))
      fail('TARGET_PATH_COLLISION', 'only explicit same-file value groups may share an exact source path', location, [prior.path, entry.path]);
    paths.set(key, { kind, path: entry.path, fileStem: entry.fileStem });
  }
  return targetData({ schemaVersion: SCHEMA, profile: profile.id, status: 'candidate', approval: null,
    modules: profile.modules, contexts: input.contexts, values, ports, components,
    files: [...paths.values()].map(({ path }) => path).sort(compare), bindings: input.bindings, order,
    signatureClosure: [...signature].sort(compare).map(key => byType.get(key).ref) });
}
