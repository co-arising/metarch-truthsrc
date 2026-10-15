// scala-cqrs-es-projection — the projection/storage face (V4-14), the engine's biggest
// unmeasured surface (~382 outputs), ported from CodegenMain's projection builders and the
// gen_projection_handlers.mjs rewriter:
//   • <View>.scala ×43 — the Akka Projection definitions (composite / single-handler /
//     multi-aggregate shapes; graph cards ride the same Jdbc-projection def)
//   • <View>On<Event>Handler.scala ×247 — skeleton + MANUAL block: the rewriter port derives
//     the mechanical form from the referenceCodes; blocks whose live text diverges (handwritten
//     MERGE-preserved content, post-fill refCode drift) ride the manual-blocks sidecar verbatim
//   • <View>Repository.scala ×44 — trait + Table companion DTO (field anchors via elementHashes)
//   • <View>RepositoryImpl[Mongo]?.scala ×44 — table/mongo/graph/vector storage forks
// KnInstanceProjection + ParkConceptDecisionViewCompositeHandler are HANDWRITTEN-FOREVER in the
// live tree (no readModel note / no generated counterpart) and are honestly absent.
// Inputs: the canonical augmented by tools/augment-api-canonical.mjs (projectionViews /
// graphViews / eventAgg / gatedReadModels slots) + options {elementHashes, manualBlocks,
// protoFields} sidecars (golden/scala-cqrs-es-projection-metarch/).
import { deriveView } from './builders/views.mjs';
import { renderProjectionDef } from './templates/projection.mjs';
import { renderHandler } from './templates/handler.mjs';
import { renderRepository, implNameOf } from './templates/repository.mjs';
import { renderImpl } from './templates/impl.mjs';

export function generate({ canonical, options = {} }) {
  const views = (canonical.projectionViews ?? []).map((v) => deriveView(v, canonical));
  const inputs = { manualBlocks: options.manualBlocks ?? {}, protoFields: options.protoFields ?? {} };
  // stale-generation relics (golden/scala-cqrs-es-projection-metarch/stale-generations.json):
  // the live tree's stamp-refresh pass (a0fca3da → 225ed28b, 2026-10-15) renewed stamps across
  // 718 files while leaving older-generation BODIES in place — the incremental gate only
  // rewrites a file when its metadata hash changes. Those bodies (older impl column/update
  // orders, pre-.toString findByKey forms, the handler-less ConceptGraph Unparked refCode) are
  // not derivable from metadata; they ride the sidecar verbatim, exactly like the handwritten
  // MANUAL blocks. Files not in the sidecar emit the current-form derivation.
  const relics = options.staleGenerations ?? {};
  const skipHandlers = new Set(relics.skipHandlers ?? []);
  const implOverrides = relics.implOverrides ?? {};
  const entries = [];

  for (const view of views) {
    const families = view.families;
    const defNoteIds = view.noteId ? [view.noteId] : undefined;
    entries.push({
      path: `app/net/imadz/metarch/application/projection/${view.name}.scala`,
      content: renderProjectionDef(view),
      kind: 'projection-def', schemaCategory: 'projection', schemaNode: view.name,
      families, deps: [], ...(defNoteIds ? { noteIds: defNoteIds } : {}),
    });

    for (const ev of view.events) {
      if (skipHandlers.has(ev.handler)) continue;
      const handlerNoteIds = ev.noteId ? [ev.noteId] : undefined;
      entries.push({
        path: `app/net/imadz/metarch/application/projection/handlers/${ev.handler}.scala`,
        content: renderHandler(view, ev.name, inputs),
        kind: 'projection-handler', schemaCategory: 'projection', schemaNode: ev.handler,
        families, deps: [], ...(handlerNoteIds ? { noteIds: handlerNoteIds } : {}),
      });
    }

    const repoNoteIds = view.noteId ? [view.noteId] : undefined;
    entries.push({
      path: `app/net/imadz/metarch/application/projection/repository/${view.name}Repository.scala`,
      content: renderRepository(view, options.elementHashes),
      kind: 'projection-repository', schemaCategory: 'projection', schemaNode: `${view.name}Repository`,
      families, deps: [], ...(repoNoteIds ? { noteIds: repoNoteIds } : {}),
    });

    const impl = implNameOf(view);
    entries.push({
      path: `app/net/imadz/metarch/infrastructure/repositories/projection/${impl}.scala`,
      content: implOverrides[`${impl}.scala`] ?? renderImpl(view, options.elementHashes),
      kind: 'projection-repository-impl', schemaCategory: 'projection', schemaNode: impl,
      families, deps: [], ...(repoNoteIds ? { noteIds: repoNoteIds } : {}),
    });
  }

  return entries;
}
