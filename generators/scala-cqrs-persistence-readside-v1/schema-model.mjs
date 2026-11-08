import { fail } from '../../lib/products/request.mjs';

/** Semantic H2 table layout; Scala and SQL templates consume the same model. */
export function readsideSchemaModel(product, index) {
  const prefix = product.store.tablePrefix;
  if (['namespace', 'event', 'state', 'offset'].includes(index.table))
    fail('PERSISTENCE_TABLE', 'index table collides with the v2 storage layout', index.source);
  const column = (name, type, size = null) => ({ name, type, size, nullable: false });
  const namespace = column('namespace_id', 'text', 256), pidKey = column('pid_key', 'digest');
  const pid = column('persistence_id', 'text', 256), resource = column('resource_id', 'text', 256);
  const sequence = column('sequence_nr', 'long'), manifest = column('manifest', 'text', 1024), payload = column('payload', 'bytes');
  return { tables: [
    { name: prefix + '_namespace', columns: [namespace, column('compatibility_key', 'digest')], key: ['namespace_id'] },
    { name: prefix + '_event', columns: [namespace, pidKey, pid, resource, column('stream_kind', 'text', 32), sequence, manifest, payload], key: ['namespace_id', 'pid_key', 'sequence_nr'] },
    { name: prefix + '_state', columns: [namespace, pidKey, pid, resource, sequence, manifest, payload], key: ['namespace_id', 'pid_key'] },
    { name: prefix + '_offset', columns: [namespace, pidKey, pid, resource, sequence], key: ['namespace_id', 'pid_key'] },
    { name: prefix + '_' + index.table, columns: [namespace, pidKey, pid, resource, column('map_key', 'text', index.keySize), column('map_value', 'text', index.valueSize)], key: ['namespace_id', 'pid_key', 'map_key'] },
  ] };
}
