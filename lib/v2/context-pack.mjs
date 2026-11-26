// Sandwich Context Pack exporter for co-arising 2.0 Channel 4B @cloze TDD slots.
// Queries SQLite knowledge dependency graph + Canonical Model v2 so coding agents never need repo-wide grep.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { queryV2KnowledgeNeighbors } from './knowledge-db.mjs';

function findClozeBounds(filePath, slotId) {
  if (!existsSync(filePath)) return null;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  let startLine = null;
  let endLine = null;
  lines.forEach((line, idx) => {
    if (line.includes(`@cloze:start(${slotId})`)) startLine = idx + 1;
    if (line.includes(`@cloze:end(${slotId})`)) endLine = idx + 1;
  });
  if (startLine === null || endLine === null) return null;
  return { file: filePath, startLine, endLine, editableStart: startLine + 1, editableEnd: endLine - 1 };
}

export function buildSandwichContextPack({
  canonicalV2,
  dbFile = null,
  slotId,
  workspaceDir = null,
  outMd = null,
  outJson = null,
}) {
  const slot = canonicalV2.clozeSlots.find(s => s.slotId === slotId);
  if (!slot) {
    throw new Error(`V2_CONTEXT_PACK: unknown @cloze slot "${slotId}"`);
  }
  const behavior = canonicalV2.behaviors.find(b => b.target === slot.target);
  if (!behavior) {
    throw new Error(`V2_CONTEXT_PACK: behavior "${slot.target}" missing from Canonical Model v2`);
  }

  const graphNeighbors = dbFile && existsSync(dbFile)
    ? queryV2KnowledgeNeighbors(dbFile, `behavior:${behavior.target}`)
    : null;

  // Top bread: closed-over types, aggregate/port signatures
  const aggName = behavior.kind === 'slice' ? behavior.target.split('.')[0] : null;
  const aggregate = aggName
    ? canonicalV2.structures.aggregates.find(a => a.name === aggName) ?? null
    : null;
  const story = behavior.kind === 'story'
    ? canonicalV2.structures.stories.find(s => s.name === behavior.target) ?? null
    : null;

  const topBread = {
    exactTypes: canonicalV2.structures.exactTypes,
    valueObjects: canonicalV2.structures.valueObjects,
    aggregate,
    story,
    relatedGraphNodes: (graphNeighbors?.relatedNodes ?? []).map(n => ({ id: n.id, kind: n.kind, name: n.name })),
  };

  // Middle: authoritative behavior rules, axioms, externs, caller contract, and editable @cloze bounds
  const clozeFile = workspaceDir ? join(resolve(workspaceDir), `handwritten/${slotId}.cloze.ts`) : null;
  const clozeBounds = clozeFile ? findClozeBounds(clozeFile, slotId) : null;

  const middle = {
    slotId,
    target: behavior.target,
    layer: behavior.layer,
    tier: behavior.theory.tier,
    logic: behavior.theory.logic,
    hitPolicy: behavior.hitPolicy,
    callerContract: story?.callerContract ?? null,
    externs: behavior.externs,
    axioms: behavior.axioms,
    rules: behavior.rules.map(r => ({
      id: r.id,
      firstHitOrder: r.firstHitOrder,
      command: r.command,
      actions: r.actions,
      postCount: r.post.length,
    })),
    clozeBounds,
  };

  // Bottom bread: locked @CoArisingSpec acceptance criteria
  const bottomBread = {
    testIrSha256: behavior.testIr.sha256,
    lockedOracles: behavior.testIr.scenarios.flatMap(sc => (
      sc.examples.map(ex => ({
        specId: ex.ruleId,
        command: sc.command,
        outcome: ex.outcome,
        hasSecondaryWitness: Boolean(ex.secondaryWitness),
      }))
    )),
  };

  const pack = {
    schemaVersion: 'co-arising.context-pack/v2',
    canonicalSha256: canonicalV2.canonicalSha256,
    slotId,
    topBread,
    middle,
    bottomBread,
  };

  const mdLines = [
    `# Sandwich Context Pack — \`${slotId}\` (\`${behavior.target}\`)`,
    '',
    `- **Layer**: \`${behavior.layer}\` | **Tier**: \`${behavior.theory.tier}\` (${behavior.theory.logic}) | **HitPolicy**: \`${behavior.hitPolicy}\``,
    `- **Canonical SHA-256**: \`${canonicalV2.canonicalSha256.slice(0, 16)}\``,
    clozeBounds ? `- **Editable @cloze Slot**: \`${clozeBounds.file}\` lines \`${clozeBounds.editableStart}..${clozeBounds.editableEnd}\`` : '- **Editable @cloze Slot**: (not yet materialized)',
    '',
    '## 1. Top Bread — Closed-Over Types & Signatures',
    '',
    `- Exact Types: ${canonicalV2.structures.exactTypes.map(e => `\`${e.name}(scale=${e.scale})\``).join(', ') || '(none)'}`,
    `- Value Objects: ${canonicalV2.structures.valueObjects.map(v => `\`${v.name}\``).join(', ') || '(none)'}`,
    aggregate ? `- Aggregate \`${aggregate.name}\` State Fields: ${aggregate.stateFields.map(f => `\`${f.name}: ${f.type}\``).join(', ')}` : '',
    story ? `- Story \`${story.name}\` Dispatches: ${(story.dispatches ?? []).map(d => `\`${d}\``).join(', ') || '(none)'}` : '',
    '',
    '## 2. Middle — Authoritative EARS Contract & Caller Guarantees',
    '',
    ...(story?.callerContract ? [`- **@caller Contract**: \`${JSON.stringify(story.callerContract)}\``] : []),
    ...(behavior.externs.length > 0 ? [`- **Extern Predicates**: ${behavior.externs.map(e => `\`${e.name}(${e.params.join(', ')})\``).join(', ')}`] : []),
    '',
    '| Order | Rule ID | Command / Operation | Required Outcome |',
    '| --- | --- | --- | --- |',
    ...behavior.rules.map(r => {
      const ex = behavior.testIr.scenarios.flatMap(s => s.examples).find(e => e.ruleId === r.id);
      return `| ${r.firstHitOrder} | \`${r.id}\` | \`${r.command ?? '*'}\` | ${ex?.outcome ?? ''} |`;
    }),
    '',
    '## 3. Bottom Bread — Locked @CoArisingSpec Acceptance Oracles',
    '',
    ...bottomBread.lockedOracles.map(o => `- \`@CoArisingSpec(id="${o.specId}")\` — \`${o.command}\` → ${o.outcome} (${o.hasSecondaryWitness ? 'primary + anti-hardcoding secondary witness' : 'primary witness'})`),
    '',
  ].filter(l => l !== null);

  const markdown = mdLines.join('\n');

  if (outMd) {
    const absMd = resolve(outMd);
    mkdirSync(dirname(absMd), { recursive: true });
    writeFileSync(absMd, markdown, 'utf8');
  }
  if (outJson) {
    const absJson = resolve(outJson);
    mkdirSync(dirname(absJson), { recursive: true });
    writeFileSync(absJson, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  }

  return { pack, markdown, outMd: outMd ? resolve(outMd) : null, outJson: outJson ? resolve(outJson) : null };
}
