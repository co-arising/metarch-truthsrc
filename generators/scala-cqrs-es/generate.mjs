// scala-cqrs-es — reference generator (V4-2: protocol + aggregate-root, Builder→Model→Template).
// Ported from the production CodegenMain triad; golden-master byte-verified.
// Canonical input slots (payload pass-through, see EP_Truthsrc_Codegen_V04):
//   aggregate.pkg/ctxPackage/entity/aggregateReply/persistence, command.reply, parameter.typeImport
import { protocolModel, rootModel } from './builders/models.mjs';
import { renderProtocol, renderRoot } from './templates/scala.mjs';

const emit = (a, file, kind, content) => ({
  path: `${(a.pkg ?? 'net.imadz').replaceAll('.', '/')}/${file}`,
  content, kind, schemaCategory: 'aggregate', families: [a.name], deps: [],
});

export function generate({ canonical }) {
  const entries = [];
  for (const a of canonical.aggregates ?? []) {
    entries.push(emit(a, `application/aggregates/${a.name}Protocol.scala`, 'protocol', renderProtocol(protocolModel(a))));
    entries.push(emit(a, `application/aggregates/${a.name}Aggregate.scala`, 'aggregate-root', renderRoot(rootModel(a))));
  }
  return entries;
}
