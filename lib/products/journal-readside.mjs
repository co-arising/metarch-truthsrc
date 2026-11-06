import { equal, fail } from './request.mjs';
import { declaration } from '../domain-products/values.mjs';
import { refKey } from '../domain-products/references.mjs';

const scalaKeywords = new Set(['abstract', 'case', 'catch', 'class', 'def', 'do', 'else', 'extends', 'false', 'final', 'finally', 'for', 'forSome', 'if', 'implicit', 'import', 'lazy', 'match', 'new', 'null', 'object', 'override', 'package', 'private', 'protected', 'return', 'sealed', 'super', 'this', 'throw', 'trait', 'try', 'true', 'type', 'val', 'var', 'while', 'with', 'yield']);
// Names are emitted unquoted. Keep this finite SQL/Scala vocabulary in sync
// with the structural schema; no normalization of an authored name is allowed.
const sqlKeywords = new Set(['all', 'alter', 'and', 'as', 'asc', 'between', 'by', 'case', 'check', 'column', 'constraint', 'create', 'database', 'default', 'delete', 'desc', 'distinct', 'drop', 'else', 'end', 'exists', 'false', 'fetch', 'for', 'foreign', 'from', 'group', 'having', 'in', 'index', 'insert', 'into', 'is', 'join', 'key', 'limit', 'not', 'null', 'offset', 'on', 'or', 'order', 'primary', 'references', 'select', 'set', 'table', 'then', 'true', 'union', 'unique', 'update', 'user', 'using', 'values', 'when', 'where']);
const basicApis = new Set(['row', 'payload', 'state', 'session', 'envelope', 'journal', 'bindings', 'schema', 'repository', 'projection', 'domain', 'namespace', 'version', 'statements', 'initialize', 'project', 'catchup', 'start', 'shutdown', 'close', 'read', 'write', 'transaction', 'ownedrows', 'checkpoint', 'stream', 'event', 'put', 'delete', 'get', 'page', 'lock', 'upsert', 'invalidate', 'frontier']);
const recordApis = new Set(['apply', 'unapply', 'copy', 'equals', 'hashcode', 'tostring', 'getclass', 'wait', 'notify', 'notifyall', 'clone', 'finalize', 'productarity', 'productelement', 'productelementname', 'productelementnames', 'productiterator', 'productprefix', 'canequal']);
const error = (code, message, source) => fail('SERVICE_JOURNAL_READSIDE_' + code, message, source);
const closed = (value, keys, source) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k)))
    error('SHAPE', 'exact journal read-side declaration fields required', source);
};
const list = (value, min, max, source) => {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    error('SHAPE', `journal read-side array requires ${min}..${max} entries`, source);
  return value;
};
const distinct = (values, source) => {
  if (new Set(values).size !== values.length) error('DUPLICATE', 'duplicate journal read-side name or reference', source);
};
const scala = (value, source) => {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$(?![\s\S])/u.test(value) || scalaKeywords.has(value))
    error('NAME', 'bounded nonkeyword Scala identifier required', source);
};
const sql = (value, source) => {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,62}$(?![\s\S])/u.test(value) || sqlKeywords.has(value) || scalaKeywords.has(value))
    error('SQL_NAME', 'bounded lowercase nonkeyword SQL identifier required', source);
};
const kind = (value, source) => {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$(?![\s\S])/u.test(value))
    error('KIND', 'bounded explicit PID kind required', source);
};
const interval = (value, min, source) => {
  if (!Number.isSafeInteger(value) || value < min || value > 60000)
    error('INTERVAL', `interval must be an integer in ${min}..60000 milliseconds`, source);
};
const resolve = (ref, layout, source) => {
  closed(ref, ['context', 'kind', 'owner', 'id'], source);
  return declaration(ref, layout, source);
};
const textual = (type, layout, source) => {
  const visited = new Set();
  while (type?.form === 'nominal') {
    closed(type, ['form', 'ref'], source);
    const row = resolve(type.ref, layout, source), key = refKey(row.ref);
    if (row.ref.kind !== 'type' || visited.has(key) || visited.size >= 64)
      error('IDENTITY_TYPE', 'identity requires an acyclic nominal text carrier', source);
    visited.add(key);
    type = row.valueType;
  }
  if (!type || !equal(type, { form: 'primitive', name: 'string' }))
    error('IDENTITY_TYPE', 'identity must be primitive string or nominal text, not optional, record or numeric', source);
};

/** Pure, closed declaration gate. Returns the same store without defaults or rewrites. */
export function validateJournalReadside(store, layout, source) {
  closed(store, ['schemaVersion', 'id', 'version', 'tablePrefix', 'pollIntervalMillis', 'closeTimeoutMillis', 'streams', 'technicalKinds', 'indexes'], source);
  if (store.schemaVersion !== 'truthsrc.journal-readside/v1')
    error('VERSION', 'explicit truthsrc.journal-readside/v1 required', source);
  scala(store.id, source);
  if (typeof store.version !== 'string' || !store.version.trim() || store.version.length > 64)
    error('VERSION', 'nonempty storage/API version string of at most 64 characters required', source);
  sql(store.tablePrefix, source);
  interval(store.pollIntervalMillis, 10, source);
  interval(store.closeTimeoutMillis, 1, source);
  if (!Array.isArray(layout?.contexts) || !Array.isArray(layout?.declarations))
    error('CONTEXT', 'declared current context and reference layout required', source);
  // Service compilation supplies its artifact source. A standalone one-context
  // layout is also sufficient; never guess a context in a multi-context layout.
  const owners = layout.declarations.filter(d => d.ref.kind === 'artifact' && source && equal(d.source, source));
  const context = owners.length === 1 ? owners[0].ref.context : layout.contexts.length === 1 ? layout.contexts[0] : null;
  if (!context || !layout.contexts.includes(context)) error('CONTEXT', 'unambiguous declared service context required', source);
  for (const stream of list(store.streams, 1, 64, source)) {
    closed(stream, ['kind', 'aggregate', 'identity', 'allowEmptyIdentity', 'eventIdentities'], source);
    kind(stream.kind, source);
    if (typeof stream.allowEmptyIdentity !== 'boolean') error('SHAPE', 'explicit boolean allowEmptyIdentity required', source);
    const aggregate = resolve(stream.aggregate, layout, source).ref;
    if (aggregate.kind !== 'aggregate' || aggregate.context !== context)
      error('AGGREGATE', 'stream must name a declared aggregate in the current service context', source);
    const identity = resolve(stream.identity, layout, source);
    if (identity.ref.kind !== 'state-field' || identity.ref.context !== context || !equal(identity.ref.owner, [aggregate.id]))
      error('IDENTITY', 'identity must name a state field owned by the stream aggregate', source);
    textual(identity.valueType, layout, source);
    for (const mapping of list(stream.eventIdentities, 0, 1024, source)) {
      closed(mapping, ['event', 'field'], source);
      const event = resolve(mapping.event, layout, source).ref;
      const field = resolve(mapping.field, layout, source);
      if (event.kind !== 'event' || event.context !== context || !equal(event.owner, [aggregate.id]) ||
          field.ref.kind !== 'event-slot' || field.ref.context !== context || !equal(field.ref.owner, [aggregate.id, event.id]))
        error('EVENT_IDENTITY', 'event identity must name the matching event slot of the same aggregate', source);
      textual(field.valueType, layout, source);
    }
    distinct(stream.eventIdentities.map(m => refKey(m.event)), source);
  }
  distinct(store.streams.map(s => s.kind), source);
  distinct(store.streams.map(s => refKey(s.aggregate)), source);
  list(store.technicalKinds, 0, 64, source).forEach(k => kind(k, source));
  distinct([...store.streams.map(s => s.kind), ...store.technicalKinds], source);

  // Reserve generated companion/Session names, including case-folded class stems
  // and concatenated index/query members. Query names are local to their index.
  const members = new Set([...basicApis, ...recordApis, 'owner', 'hash', 'string', 'long', 'boolean', 'byte', 'array', 'option', 'messagedigest', 'standardcharsets']);
  const member = name => {
    const key = name.toLowerCase();
    if (members.has(key)) error('NAME_COLLISION', 'generated journal read-side member name collision: ' + name, source);
    members.add(key);
  };
  const indexes = list(store.indexes, 0, 32, source);
  for (const index of indexes) {
    closed(index, ['id', 'table', 'columns', 'key', 'queries'], source);
    scala(index.id, source);
    sql(index.table, source);
    if (['namespace', 'stream', 'event'].includes(index.table) || index.table.startsWith(store.tablePrefix + '_'))
      error('TABLE', 'index table must be an unprefixed, nonreserved SQL suffix', source);
    member(index.id); member('put' + index.id); member('delete' + index.id);
    for (const column of list(index.columns, 1, 64, source)) {
      closed(column, ['name', 'type', 'size', 'nullable'], source);
      sql(column.name, source);
      if (column.name === 'namespace' || recordApis.has(column.name))
        error('NAME_COLLISION', 'column collides with namespace or a generated record member', source);
      if (!['text', 'digest', 'long', 'boolean', 'bytes'].includes(column.type) || typeof column.nullable !== 'boolean' ||
          (column.type === 'text' ? !Number.isSafeInteger(column.size) || column.size < 1 || column.size > 2048 : column.size !== null))
        error('COLUMN', 'explicit column type, text-only bounded size and boolean nullability required', source);
    }
    distinct(index.columns.map(c => c.name), source);
    const columns = new Map(index.columns.map(c => [c.name, c]));
    const names = (value, min, max) => {
      list(value, min, max, source).forEach(name => {
        sql(name, source);
        if (!columns.has(name)) error('COLUMN_REFERENCE', 'key/query must reference a declared index column', source);
      });
      distinct(value, source);
      return value;
    };
    const key = names(index.key, 1, 8);
    if (key.some(name => columns.get(name).nullable || columns.get(name).type === 'bytes'))
      error('KEY', 'key columns must be nonnullable and cannot be bytes', source);
    const queries = list(index.queries, 0, 64, source);
    const local = new Set([index.id.toLowerCase(), ...basicApis, ...recordApis]);
    for (const query of queries) {
      closed(query, ['id', 'where', 'orderBy'], source);
      sql(query.id, source);
      if (local.has(query.id)) error('NAME_COLLISION', 'query collides with an index or basic API member', source);
      local.add(query.id);
      member(index.id + query.id);
      member(index.id + '_' + query.id);
      names(query.where, 0, 64);
      if (query.where.includes('after')) error('NAME_COLLISION', 'query equality argument collides with pagination argument', source);
      member('query' + index.id + query.id);
      const order = names(query.orderBy, 1, 64);
      if (key.some(name => !order.includes(name)))
        error('QUERY_ORDER', 'deterministic paging order must include the complete key, including any hash tie breaker', source);
    }
  }
  distinct(indexes.map(i => i.table), source);
  if (['namespace', 'stream', 'event', ...indexes.map(i => i.table)].some(t => store.tablePrefix.length + 1 + t.length > 64))
    error('TABLE', 'prefixed SQL table names must fit 64 characters', source);
  return store;
}
