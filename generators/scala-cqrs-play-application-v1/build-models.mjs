import { at, detach, equal, fail, object, array } from '../../lib/products/request.mjs';
import { refKey } from '../../lib/domain-products/references.mjs';
import { resolveName, resolveNameSet, resolveArtifactPath, targetData } from '../../lib/scala-target/naming.mjs';
import { MODULAR_CANDIDATE } from '../../lib/scala-target/profiles.mjs';
import { buildModels as persistenceModels, productIds as persistenceIds } from '../scala-cqrs-persistence-readside-v1/build-models.mjs';
import { compileApiContract, API_BINDING_SCHEMA } from '../../lib/products/api-contract.mjs';
import { compileApplicationComposition, APPLICATION_BINDING_SCHEMA } from '../../lib/products/application-composition.mjs';

export const productIds = [...persistenceIds, 'api-contract', 'application-composition'];
const location = at('play-application');
const roles = [
  ['api', 'api', 'Api', 'kernel', 'application.api'],
  ['commands', 'commands-port', 'Commands', 'kernel', 'application.api'],
  ['queries', 'queries-port', 'Queries', 'kernel', 'application.api'],
  ['authority', 'authority', 'Authority', 'glue', 'infrastructure.web'],
  ['directory', 'resource-directory', 'Directory', 'glue', 'infrastructure.web'],
  ['codec', 'http-codec', 'HttpCodec', 'glue', 'infrastructure.web'],
  ['commandService', 'command-service', 'CommandService', 'glue', 'infrastructure.web'],
  ['queryService', 'query-service', 'QueryService', 'glue', 'infrastructure.web'],
  ['journalSource', 'journal-source', 'JournalSource', 'glue', 'infrastructure.web'],
  ['settings', 'application-settings', 'Settings', 'root', 'composition'],
  ['application', 'application-root', 'Application', 'root', 'composition'],
  ['closeReport', 'close-report', 'CloseReport', 'root', 'composition'],
  ['lifecycle', 'resource-lifecycle', 'ResourceLifecycle', 'root', 'composition'],
  ['controller', 'controller', 'Controller', 'root', 'controllers'],
  ['errors', 'http-errors', 'HttpErrors', 'root', 'controllers'],
  ['components', 'components', 'Components', 'root', 'composition'],
  ['loader', 'loader', 'Loader', 'root', 'composition'],
];
const ownRoles = new Set(roles.map(r => r[1]));
const reject = message => fail('APPLICATION_MODEL', message, location);
export function buildModels(raw) {
  const input = targetData(raw);
  object(input, ['products', 'options'], location); object(input.products, productIds, location);
  object(input.options, ['packages', 'names', 'protobuf'], location);
  const api = input.products['api-contract'], composition = input.products['application-composition'];
  const canonical = { id: api.source.document, schemaVersion: 'truthsrc/v1', value: { schemaVersion: 'truthsrc/v1', apiContracts: [{ ...api.declaration }] } };
  delete canonical.value.apiContracts[0].source;
  const baseProducts = Object.fromEntries(persistenceIds.map(id => [id, input.products[id]]));
  const checkedApi = compileApiContract({ id: 'api', schemaVersion: API_BINDING_SCHEMA,
    value: { schemaVersion: API_BINDING_SCHEMA, contract: api.declaration } }, canonical, baseProducts);
  if (!equal(checkedApi, api)) reject('API differs from its complete declaration lowering');
  const checkedComposition = compileApplicationComposition({ id: composition.source.document, schemaVersion: APPLICATION_BINDING_SCHEMA,
    value: composition.declaration }, canonical, { ...baseProducts, 'api-contract': checkedApi });
  if (!equal(checkedComposition, composition)) reject('composition differs from its complete technical lowering');
  const options = { ...input.options, names: input.options.names.filter(n => !ownRoles.has(n.role)) };
  const persistence = persistenceModels({ products: baseProducts, options });
  const overrides = input.options.names.filter(n => ownRoles.has(n.role));
  const prefix = persistence.aggregate.base.protocol.name.replace(/Protocol$/, '');
  const packageName = persistence.context.package;
  const specs = roles.map(([key, role, suffix, module, suffixPackage]) => {
    const found = overrides.filter(n => n.role === role);
    if (found.length > 1 || found.some(n => !equal(n.ref, api.aggregate))) reject('invalid application name override');
    return { key, module, spec: { knowledgeId: 'api:' + api.id + ':' + role,
      scope: packageName + '.' + suffixPackage, space: 'scala-type', spelling: prefix, binding: found[0]?.name ?? null,
      prefix: [], suffix: found.length ? [] : [suffix] } };
  });
  const reserved = persistence.family.artifacts.filter(a => a.name && a.fqn).map(a => ({ scope: a.fqn.slice(0, a.fqn.lastIndexOf('.')),
    space: 'scala-type', name: a.name, reason: 'reused domain declaration' }));
  for (const scope of new Set(specs.map(s => s.spec.scope))) for (const name of ['String', 'Long', 'Int', 'Boolean', 'Future', 'Promise', 'Option', 'Vector', 'Map',
    'ApiPrincipal', 'ResourceBinding', 'LocalCredential', 'AuthorityUnavailable', 'Action', 'AnyContent', 'ByteString', 'Request', 'RequestHeader',
    'Result', 'BodyParser', 'ControllerComponents', 'AbstractController', 'HttpErrorHandler', 'Json', 'JsObject', 'JsValue', 'JsArray',
    'Reads', 'Writes', 'Application', 'ApplicationLoader', 'BuiltInComponentsFromContext', 'EssentialFilter', 'ActorSystem', 'Scheduler',
    'Timeout', 'Configuration', 'Path', 'Files', 'Paths', 'ExecutionContext', 'Future', 'Promise', 'Deadline', 'Try', 'Success', 'Failure',
    'Executors', 'ExecutorService', 'ThreadFactory', 'Thread', 'Runnable', 'JdbcConnectionPool', 'Await'])
    if (!reserved.some(r => r.scope === scope && r.name === name)) reserved.push({ scope, space: 'scala-type', name, reason: 'application framework/helper' });
  const resolved = resolveNameSet({ profile: MODULAR_CANDIDATE, names: specs.map(s => s.spec), reserved });
  const names = Object.fromEntries(specs.map((s, i) => [s.key, { ...resolved[i], module: s.module, package: s.spec.scope,
    fqn: s.spec.scope + '.' + resolved[i].identifier, path: resolveArtifactPath({ profile: MODULAR_CANDIDATE, module: s.module,
      packageName: s.spec.scope, typeName: resolved[i].name }) }]));
  function named(spelling, scope, space, suffix = []) {
    const result = resolveName({ profile: MODULAR_CANDIDATE, knowledgeId: api.id + ':' + scope + ':' + spelling,
      scope, space, spelling, binding: null, prefix: [], suffix });
    if (space === 'scala-member' && ['wait', 'notify', 'notifyAll', 'getClass', 'hashCode', 'toString', 'equals', 'clone', 'finalize',
      'productArity', 'productElement', 'productIterator', 'productPrefix', 'productElementNames', 'productElementName', 'canEqual', 'copy'].includes(result.name))
      reject('reserved inherited member: ' + result.name);
    return result;
  }
  function carrier(type) {
    const chain = [], seen = new Set(); let current = type;
    while (current.form === 'nominal') {
      const key = refKey(current.ref), row = persistence.family.kernel.values.find(v => equal(v.ref, current.ref));
      if (!row || seen.has(key) || row.fields.length !== 1) reject('missing scalar carrier model');
      seen.add(key); chain.push({ fqn: row.fqn, accessor: row.fields[0].accessor, path: row.path }); current = row.fields[0].type;
    }
    return { primitive: current.name, chain };
  }
  const commands = api.commands.map(c => {
    const domain = persistence.aggregate.base.protocol.commands.find(d => equal(d.ref, c.command));
    const event = persistence.aggregate.base.protocol.events.find(d => equal(d.ref, c.result.event));
    if (!domain || !event) reject('missing domain command/event model');
    const method = named(c.id, names.commands.fqn, 'scala-member'), request = named(c.id, names.api.fqn, 'scala-type', ['Request']);
    if (['query', 'page', 'readiness', 'secured', 'body', 'receipts', 'execute', 'wait', 'close', 'notify', 'getClass'].includes(method.name)) reject('reserved application method');
    const fields = c.request.map(f => ({ ...f, ...named(f.field, names.api.fqn + '.' + request.name, 'scala-member'),
      carrier: carrier(f.valueType), domain: domain.fields.find(d => equal(d.ref, f.parameter)) }));
    if (new Set(fields.map(f => f.name)).size !== fields.length) reject('DTO member collision');
    return { ...c, method, requestName: request, domain, event, fields,
      results: c.result.fields.map(f => ({ ...f, carrier: carrier(f.valueType), domain: event.fields.find(d => equal(d.ref, f.slot)) })),
      resource: fields.find(f => f.location === 'path') };
  });
  if (new Set(commands.map(c => c.method.name)).size !== commands.length || new Set(commands.map(c => c.requestName.name)).size !== commands.length)
    reject('API command name collision');
  const queryFields = [api.query.output.key, api.query.output.value].map(f => named(f, names.api.fqn + '.ReceiptItem', 'scala-member'));
  if (queryFields[0].name === queryFields[1].name) reject('query field collision');
  const view = named(prefix + ' receipts', 'views.html', 'scala-member');
  return targetData({ api, composition, persistence, names, commands, resource: carrier(api.resource.valueType),
    query: { ...api.query, key: queryFields[0], value: queryFields[1], keyCarrier: carrier(api.query.keyType), valueCarrier: carrier(api.query.valueType) },
    view: { name: view.identifier, path: 'app/views/' + view.name + '.scala.html' },
    sources: [api.source, composition.source, persistence.product.source] });
}
export function resolveApplicationTarget({ compilation, options }) {
  if (!compilation?.result || compilation.diagnostics?.length) reject('complete compilation required');
  const products = Object.fromEntries(compilation.result.products.map(p => [p.id, p.payload]));
  const model = buildModels({ products, options });
  return { sourceRoots: model.composition.sourceRoots, handwritten: model.composition.handwritten, model };
}
