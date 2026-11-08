import assert from 'node:assert/strict';
import { copyImmutableData } from '../immutable-data.mjs';
import { sourceReference, verifyHandwrittenSources } from '../handwritten-provenance.mjs';
import { assertImplementationsUnchanged } from './implementations.mjs';

const generator = { id: 'scala-cqrs-module-seams', version: '1' };
const relation = 'declared-port-implementation';
const knowledgeKey = member => 'source:' + member.source.document + '#' + member.source.pointer;

/** Separate owner-declared file evidence, never generated ledger membership or a parsed symbol. */
export function describeImplementationSources(captured) {
  const evidence = captured.implementations;
  if (!evidence) return null;
  assertImplementationsUnchanged(evidence);
  const members = evidence.members.map(member => ({
    id: member.id, version: member.version, module: member.module,
    file: member.absoluteFile, bytes: member.bytes, sha256: member.sha256,
    declaredSymbol: member.symbol, relation, precision: 'file',
    semanticMapping: 'explicit-owner-declared-not-inferred',
    source: sourceReference(captured.request, knowledgeKey(member)),
    symbolVerified: false, spanVerified: false, runtimeVerified: false,
  }));
  return copyImmutableData({ schemaVersion: 'truthsrc.project-implementation-evidence/v1',
    roots: evidence.roots.map(root => ({ id: root.id, module: root.module, path: root.absolutePath })),
    members, files: members.length, generated: false, runtimeVerified: false });
}

/** Reuse the public handwritten verifier without publishing its anchors as generated code. */
export async function verifyImplementationSources(captured) {
  if (!captured.implementations) return null;
  const evidence = captured.implementations;
  assertImplementationsUnchanged(evidence);
  for (const root of evidence.roots) {
    const members = evidence.members.filter(member => member.sourceRootKey === root.id);
    const entries = members.map(member => ({ file: member.file, relation,
      rationale: 'Explicit composition declaration; source verification does not certify the declared Scala ABI.',
      sources: [knowledgeKey(member)] }));
    const verified = await verifyHandwrittenSources(root.absolutePath, captured.request, entries,
      { generator, allowedRelations: [relation] });
    for (const member of members) assert.equal(verified.inventory[member.file], 'sha256:' + member.sha256,
      'handwritten bytes differ from project capture');
  }
  assertImplementationsUnchanged(evidence);
  return describeImplementationSources(captured);
}
