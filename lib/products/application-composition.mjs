import { array, at, detach, equal, fail, object, text, unique } from './request.mjs';
import { API_DEPENDENCIES } from './api-contract.mjs';
import { refKey } from '../domain-products/references.mjs';
import { portableSeamsPath } from './module-seams-composition.mjs';

export const APPLICATION_BINDING_SCHEMA = 'truthsrc.application-composition-binding/v1';
export const APPLICATION_SCHEMA = 'truthsrc.application-composition/v1';
export const APPLICATION_DEPENDENCIES = Object.freeze([...API_DEPENDENCIES, { id: 'api-contract', version: '1' }]);
export const APPLICATION_RUNTIME = Object.freeze({ scala: '2.13.14', jdk: '11', play: '2.8.18', akka: '2.6.20',
  scalaPB: '0.11.14', h2: '2.2.224', leveldb: '0.12', journal: 'leveldb-java', guava: '30.1.1-jre', commonsCodec: '1.15',
  sbt: '1.4.9', sbtProtoc: '1.0.6', twirl: '1.5.1' });
const reject = (code, message, source) => fail('APPLICATION_' + code, message, source);
const token = (v, s) => { text(v, s); if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$(?![\s\S])/u.test(v)) reject('IDENTITY', 'bounded identifier required', s); };
const scalar = (v, s) => { text(v, s); if (!v.isWellFormed() || Buffer.byteLength(v, 'utf8') > 256 || /[\p{Cc}\p{Cf}]/u.test(v)) reject('IDENTITY', 'bounded UTF-8 scalar identity required', s); };

/** Finite construction ABI. Identities and implementation files are explicit technical inputs. */
export function compileApplicationComposition(rawBinding, rawCanonical, rawProducts) {
  const { binding, canonical, products } = detach({ binding: rawBinding, canonical: rawCanonical, products: rawProducts });
  object(binding, ['id', 'schemaVersion', 'value'], at('application-binding'));
  const b = binding.value, source = p => at(binding.id, p);
  object(b, ['schemaVersion', 'id', 'version', 'context', 'api', 'persistence', 'runtime', 'resources', 'config', 'limits', 'implementations', 'root'], source(''));
  object(products, APPLICATION_DEPENDENCIES.map(p => p.id), source(''));
  if (binding.schemaVersion !== APPLICATION_BINDING_SCHEMA || b.schemaVersion !== APPLICATION_BINDING_SCHEMA || b.version !== '1')
    reject('VERSION', 'explicit application-composition-binding/v1 required', source(''));
  token(b.id, source('/id'));
  const api = products['api-contract'], persistence = products['persistence-readside-contract'];
  if (b.context !== api.context || !equal(b.api, { id: api.id, version: api.version }) ||
      !equal(b.persistence, { id: persistence.id, version: persistence.version })) reject('PRODUCT', 'exact API/persistence identities required', source(''));
  if (api.source.document !== canonical.id) reject('SOURCE', 'same canonical required', source(''));
  if (!equal(b.runtime, APPLICATION_RUNTIME)) reject('RUNTIME', 'finite verified runtime versions required', source('/runtime'));
  const resources = array(b.resources, source('/resources')).map((r, i) => {
    const s = source('/resources/' + i);
    object(r, ['resourceId', 'persistenceId', 'envelopeResource'], s);
    for (const v of Object.values(r)) scalar(v, s);
    return { ...r, source: s };
  });
  if (!resources.length || resources.length > 8) reject('RESOURCES', 'one to eight explicit resource identities required', source('/resources'));
  for (const key of ['resourceId', 'persistenceId', 'envelopeResource']) unique(resources.map(r => r[key]), 'APPLICATION_IDENTITY', source('/resources'));
  const configKeys = ['journalPath', 'readsidePath', 'namespace', 'freshJournal', 'freshReadside', 'credentials'];
  object(b.config, configKeys, source('/config'));
  for (const value of Object.values(b.config)) if (typeof value !== 'string' || !/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$(?![\s\S])/u.test(value))
    reject('CONFIG', 'explicit dotted configuration key required, not a credential or path', source('/config'));
  unique(Object.values(b.config), 'APPLICATION_CONFIG', source('/config'));
  object(b.limits, ['askMillis', 'closeMillis', 'maxPending', 'bodyBytes', 'blockingThreads'], source('/limits'));
  if (!Number.isSafeInteger(b.limits.askMillis) || b.limits.askMillis < 1 || b.limits.askMillis > 5000 ||
      b.limits.closeMillis !== 10000 || b.limits.maxPending !== 64 || b.limits.bodyBytes !== 65536 || b.limits.blockingThreads !== 2)
    reject('LIMITS', 'explicit bounded request and lifecycle limits required', source('/limits'));
  object(b.root, ['id', 'actorSystem', 'ownership'], source('/root')); token(b.root.id, source('/root/id')); token(b.root.actorSystem, source('/root/actorSystem'));
  if (b.root.ownership !== 'application-owned-domain-play-owned-http') reject('OWNERSHIP', 'separate domain and HTTP ownership required', source('/root'));
  const hosts = products['domain-dependencies'].hosts;
  const implementations = array(b.implementations, source('/implementations')).map((value, i) => {
    const s = source('/implementations/' + i);
    object(value, ['id', 'version', 'role', 'port', 'symbol', 'module', 'sourceRoot', 'file', 'construction'], s);
    token(value.id, s); text(value.version, s);
    if (value.version !== '1' || value.module !== 'ext' || value.construction !== 'class' || !['computations', 'authority'].includes(value.role))
      reject('IMPLEMENTATION', 'finite external class ABI required', s);
    if (typeof value.symbol !== 'string' || !/^(?:[a-z][a-z0-9_]*\.)+[A-Z][A-Za-z0-9]*$(?![\s\S])/u.test(value.symbol))
      reject('IMPLEMENTATION', 'qualified external class name required', s);
    portableSeamsPath(value.sourceRoot, s); portableSeamsPath(value.file, s);
    if (!value.file.endsWith('.scala')) reject('IMPLEMENTATION', 'captured Scala implementation required', s);
    if (value.role === 'computations') {
      if (hosts.length !== 1 || !equal(value.port, hosts[0].id)) reject('IMPLEMENTATION', 'one explicit computation host must be implemented', s);
    } else if (value.port !== null) reject('IMPLEMENTATION', 'authority is a generated application seam, not a domain port', s);
    return { ...value, source: s };
  });
  if (implementations.length !== 2 || !equal(implementations.map(i => i.role).sort(), ['authority', 'computations']))
    reject('IMPLEMENTATION', 'exact computations and authority implementations required', source('/implementations'));
  unique(implementations.map(i => i.id), 'APPLICATION_IMPLEMENTATION', source('/implementations'));
  unique(implementations.map(i => i.symbol), 'APPLICATION_IMPLEMENTATION', source('/implementations'));
  unique(implementations.map(i => i.sourceRoot + '/' + i.file), 'APPLICATION_IMPLEMENTATION', source('/implementations'));
  const sourceRoots = [...new Set(implementations.map(i => i.sourceRoot))].map((p, i) => ({ id: 'external-' + i, module: 'ext', path: p }));
  const handwritten = implementations.map(i => ({ id: i.id, version: i.version, module: 'ext', role: 'adapter', symbol: i.symbol,
    construction: 'class', implements: i.port ?? { context: api.context, kind: 'port', owner: [], id: api.id + '-authority' },
    sourceRootKey: sourceRoots.find(r => r.path === i.sourceRoot).id, file: i.file, source: i.source, sourceRoot: i.sourceRoot }));
  return detach({ ...b, schemaVersion: APPLICATION_SCHEMA, declaration: b, source: source(''), apiSource: api.source,
    persistenceSource: persistence.source, resources, implementations, sourceRoots, handwritten });
}
