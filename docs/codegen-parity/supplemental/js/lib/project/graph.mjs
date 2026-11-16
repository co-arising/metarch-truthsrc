import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildKnowledgeSnapshot, exportKnowledgeAst, knowledgeDigest } from '../knowledge-graph.mjs';
import { SqliteKnowledgeGraphStore } from '../knowledge-sqlite.mjs';
import { readAnchorsIndex } from '../../src/core/anchors.mjs';
import { resolveSourcePointer } from '../source-index.mjs';

export const projectGraphFile = project => join(dirname(project), '.truthsrc', 'knowledge.sqlite');
export function projectKnowledgeAst(captured, { store } = {}) {
  const own = !store, repository = store || new SqliteKnowledgeGraphStore(':memory:');
  try {
    const snapshot = buildKnowledgeSnapshot(captured);
    repository.publishSnapshot(snapshot);
    return exportKnowledgeAst(repository, { project: captured.file, snapshot: snapshot.id, expectedSources: captured.sources });
  } finally { if (own) repository.close(); }
}
export function graphSelection(ast, output) {
  return { schemaVersion: 'truthsrc.project-graph/v1', snapshot: ast.snapshot,
    generation: knowledgeDigest({ snapshot: ast.snapshot, output, generator: ast.config.generator, options: ast.config.options }) };
}
export function publishProjectAnchors(store, ast, output, result, { update = false } = {}) {
  const anchors = readAnchorsIndex(readFileSync(result.anchors, 'utf8'));
  const selection = graphSelection(ast, output);
  const known = new Set(ast.sourceIndex.records.map(r => r.identity));
  for (const key of Object.keys(anchors.anchors)) if (key.startsWith('knowledge:') && !known.has(key))
    throw new Error('KNOWLEDGE_GRAPH: anchor names unknown knowledge identity');
  const associations = Object.keys(anchors.anchors).map(key => {
    const prefix = 'source:' + ast.config.canonicalId + '#';
    const origins = key.startsWith(prefix) ? resolveSourcePointer(ast.sourceIndex, key.slice(prefix.length)) : [];
    return { key, identities: [...new Set(origins.map(r=>r.identity))] };
  });
  store.publishCodeAnchors({ project: ast.project, snapshot: ast.snapshot, generation: selection.generation,
    anchors, receipt: { generator: ast.config.generator, output, ledger: result.ledger, associations }, replace: update });
  return selection;
}
