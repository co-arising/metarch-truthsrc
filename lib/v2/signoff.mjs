// Human-friendly read-only Signoff documentation emitter for co-arising 2.0.
// Separates PM signoff artifacts (`signoff/`) from CQRS Read Model projections (`readModels`).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildAtlasBundle, emitDiagramBundleFiles } from './diagrams.mjs';
import { renderAtlasHtml } from './atlas-viewer.mjs';

function sanitizeMermaidId(raw) {
  return String(raw ?? 'Actor').replace(/[^A-Za-z0-9_]/gu, '_');
}

function renderUseCaseMermaid(uc) {
  const lines = ['```mermaid', 'sequenceDiagram'];
  const participants = new Map();
  const register = (id, label) => {
    const key = sanitizeMermaidId(id);
    if (!participants.has(key)) participants.set(key, label || id);
    return key;
  };

  if (uc.actor) register(uc.actor, uc.actor);
  for (const step of uc.steps ?? []) {
    if (step.actor) register(step.actor, step.actor);
    if (step.aggregate) register(step.aggregate, step.aggregate);
    if (step.pipeline) register(`pipeline_${step.pipeline}`, `Pipeline:${step.pipeline}`);
    for (const v of step.updatesViews ?? []) register(`view_${v}`, `View:${v}`);
    if (step.readsView) register(`view_${step.readsView}`, `View:${step.readsView}`);
  }

  for (const [id, label] of participants) {
    lines.push(`  participant ${id} as ${label}`);
  }

  for (const step of uc.steps ?? []) {
    const from = register(step.actor ?? uc.actor ?? 'System', step.actor ?? uc.actor ?? 'System');
    if (step.readsView) {
      const viewId = register(`view_${step.readsView}`, `View:${step.readsView}`);
      lines.push(`  ${from}->>${viewId}: query ${step.readsView}`);
    }
    let target;
    if (step.aggregate) {
      target = register(step.aggregate, step.aggregate);
    } else if (step.pipeline) {
      target = register(`pipeline_${step.pipeline}`, `Pipeline:${step.pipeline}`);
    } else {
      target = register('Application', 'Application');
    }
    const labelParts = [];
    if (step.port) labelParts.push(step.port);
    if (step.command) labelParts.push(step.command);
    if (labelParts.length === 0) labelParts.push(step.intent || step.id || 'step');
    lines.push(`  ${from}->>${target}: ${labelParts.join(' -> ')}`);
    for (const ev of step.emissions ?? []) {
      lines.push(`  ${target}-->>${from}: emit ${ev}`);
      for (const v of step.updatesViews ?? []) {
        const viewId = register(`view_${v}`, `View:${v}`);
        lines.push(`  ${target}->>${viewId}: project ${ev}`);
      }
    }
  }
  lines.push('```');
  return lines.join('\n');
}

export function renderSignoffUseCasesMarkdown(canonical) {
  const lines = [
    `# Business Signoff — User Stories, Journeys & Use Cases (${canonical.system}/${canonical.context})`,
    '',
    `> Read-only signoff document generated from Canonical Model v2 (\`canonicalSha256: ${canonical.canonicalSha256.slice(0, 12)}\`).`,
    '',
  ];

  const journeys = canonical.structures.journeys ?? [];
  if (journeys.length > 0) {
    lines.push('## User Journeys (Story Mapping)', '');
    for (const j of journeys) {
      lines.push(`### ${j.name} (\`${j.id}\`)`);
      if (j.persona) lines.push(`- **Persona**: ${j.persona}`);
      if (j.goal) lines.push(`- **Goal**: ${j.goal}`);
      if (j.release) lines.push(`- **Release**: ${j.release}`);
      lines.push('');
      if ((j.stages ?? []).length > 0) {
        lines.push('| Stage | Stories | Use Cases | Screens |');
        lines.push('| :--- | :--- | :--- | :--- |');
        for (const st of j.stages) {
          lines.push(`| ${st.name} | ${(st.stories ?? []).join(', ') || '—'} | ${(st.useCases ?? []).join(', ') || '—'} | ${(st.screens ?? []).join(', ') || '—'} |`);
        }
        lines.push('');
      }
    }
  }

  const stories = canonical.structures.stories ?? [];
  if (stories.length > 0) {
    lines.push('## User Stories', '');
    lines.push('| Story | Role | Goal | So That | Covers Use Cases |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const st of stories) {
      lines.push(`| ${st.name} | ${st.role || '—'} | ${st.goal || st.description || '—'} | ${st.soThat || '—'} | ${(st.coversUseCases ?? []).join(', ') || '—'} |`);
    }
    lines.push('');
  }

  const useCases = canonical.structures.useCases ?? [];
  if (useCases.length > 0) {
    lines.push('## Use Cases & End-to-End Flows', '');
    for (const uc of useCases) {
      lines.push(`### ${uc.name} (\`${uc.id}\`)`);
      lines.push(`- **Actor**: ${uc.actor || '—'}${uc.beneficiary ? ` (Beneficiary: ${uc.beneficiary})` : ''}`);
      if (uc.intent) lines.push(`- **Intent**: ${uc.intent}`);
      if ((uc.prdRefs ?? []).length > 0) lines.push(`- **PRD Refs**: ${uc.prdRefs.join(', ')}`);
      if ((uc.readEvidence ?? []).length > 0) lines.push(`- **Observed Read Models**: ${uc.readEvidence.join(', ')}`);
      lines.push('');
      if ((uc.steps ?? []).length > 0) {
        lines.push(renderUseCaseMermaid(uc), '');
      }
      if ((uc.extensions ?? []).length > 0) {
        lines.push('**Exception / Extension Flows:**', '');
        for (const ext of uc.extensions) {
          lines.push(`- **When**: ${ext.condition} → ${ext.behavior}`);
        }
        lines.push('');
      }
    }
  }

  const pipelines = canonical.structures.pipelines ?? [];
  if (pipelines.length > 0) {
    lines.push('## Durable Execution Pipelines', '');
    lines.push('| Pipeline | Steps | Sagas |');
    lines.push('| :--- | :--- | :--- |');
    for (const pl of pipelines) {
      const sagas = (pl.steps ?? []).map(s => s.invokeSaga).filter(Boolean);
      lines.push(`| ${pl.name} (\`${pl.id}\`) | ${(pl.steps ?? []).length} | ${sagas.join(', ') || '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function renderSignoffLineageMarkdown(canonical) {
  const lineage = canonical.lineage ?? {};
  const cov = lineage.coverage ?? {};
  const lines = [
    `# Field Lineage, Authz PEP & ReadSide Signoff Report (${canonical.system}/${canonical.context})`,
    '',
    `> Canonical SHA-256: \`${canonical.canonicalSha256}\``,
    '',
    '## 1. Field Lineage Coverage Summary',
    '',
    '| Check | Count | Items |',
    '| :--- | :---: | :--- |',
    `| Unspecified Commands | ${(cov.unspecifiedCommands ?? []).length} | ${(cov.unspecifiedCommands ?? []).join(', ') || '—'} |`,
    `| Unemitted Events | ${(cov.unemittedEvents ?? []).length} | ${(cov.unemittedEvents ?? []).join(', ') || '—'} |`,
    `| Unused \`produces\` | ${(cov.unusedProduces ?? []).length} | ${(cov.unusedProduces ?? []).join(', ') || '—'} |`,
    `| Unconsumed Numeric Event Fields | ${(cov.unconsumedNumericEventFields ?? []).length} | ${(cov.unconsumedNumericEventFields ?? []).join(', ') || '—'} |`,
    `| Unconsumed Event Fields (Total) | ${(cov.unconsumedEventFields ?? []).length} | ${(cov.unconsumedEventFields ?? []).join(', ') || '—'} |`,
    `| Dead State Fields (Neither Read Nor Written) | ${(cov.deadStateFields ?? []).length} | ${(cov.deadStateFields ?? []).join(', ') || '—'} |`,
    `| Write-Only State Fields | ${(cov.writeOnlyStateFields ?? []).length} | ${(cov.writeOnlyStateFields ?? []).join(', ') || '—'} |`,
    `| Unwritten State Fields | ${(cov.unwrittenStateFields ?? []).length} | ${(cov.unwrittenStateFields ?? []).join(', ') || '—'} |`,
    `| Unsourced ReadModel Fields | ${(cov.unsourcedReadModelFields ?? []).length} | ${(cov.unsourcedReadModelFields ?? []).join(', ') || '—'} |`,
    '',
  ];

  const waivers = lineage.waivers ?? [];
  if (waivers.length > 0) {
    lines.push('## 2. Explicit Machine-Checked Waivers', '');
    lines.push('| Target | Kind | Reason | Ref | Note |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const w of waivers) {
      lines.push(`| \`${w.target}\` | ${w.kind} | \`${w.reason}\` | ${w.ref || '—'} | ${w.note || '—'} |`);
    }
    lines.push('');
  }

  const authzMatrix = lineage.authzMatrix ?? [];
  if (authzMatrix.length > 0) {
    lines.push('## 3. Inbound Authz PEP Contract Matrix', '');
    lines.push('| Operation | Caller Kind | Mode | Action | Scope | Roles / Policy | Resource Target | Principal Bind / Entitlements |');
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const row of authzMatrix) {
      const rolesOrPolicy = row.mode === 'external-pdp'
        ? `PDP: \`${row.policyRef || '—'}\``
        : ((row.allowedRoles ?? []).join(', ') || '—');
      const resLabel = row.resource
        ? `\`${row.resource.type}\`${row.resource.ownerField ? ` (owner:${row.resource.ownerField})` : ''}${row.resource.relation ? ` [${row.resource.relation}]` : ''}`
        : '—';
      const extras = [
        ...(row.bindPrincipal ?? []).map(b => `bind:${b.param}<-${b.from}`),
        ...(row.requiresEntitlement ?? []).map(e => `ent:${e.code}${e.matchParam ? `(${e.matchParam})` : ''}`),
        ...(row.contextParams ?? []).map(c => `ctx:${c.name}<-${c.from}`),
      ].join(', ') || '—';
      lines.push(`| \`${row.operation}\` | ${row.callerKind || 'unspecified'} | \`${row.mode || 'undeclared'}\` | \`${row.action || '—'}\` | ${row.scope || '—'} | ${rolesOrPolicy} | ${resLabel} | ${extras} |`);
    }
    lines.push('');
  }

  if (canonical.readside?.materializedViews?.length > 0) {
    lines.push('## 4. ReadSide Physical Materialization Map', '');
    lines.push('| Materialized View | Strategy | Refresh Mode | Storage | Serves Logical ReadModels | Derived Columns |');
    lines.push('| :--- | :--- | :---: | :--- | :--- | :--- |');
    for (const mv of canonical.readside.materializedViews) {
      const cols = (mv.derivedColumns ?? []).map(c => `${c.name}:${c.type}`).join(', ');
      lines.push(`| \`${mv.name}\` | \`${mv.strategy}\` | \`${mv.refreshMode || 'stream'}\` | ${mv.storage} | ${(mv.servesReadModels ?? []).join(', ')} | ${cols} |`);
    }
    lines.push('');
  }

  if (canonical.testing?.layers) {
    const t = canonical.testing;
    lines.push('## 5. Layered Test Strategy & Parallel TDD Isolation', '');
    lines.push('| Layer | Harness | Min Line % | Min Branch % | Notes |');
    lines.push('| :--- | :--- | :---: | :---: | :--- |');
    lines.push(`| Domain | \`${t.layers.domain.harness}\` | ${t.layers.domain.minLineCoverage ?? '—'} | ${t.layers.domain.minBranchCoverage ?? '—'} | ruleHits=${t.layers.domain.requireAllRuleHits}, mutationGate=${t.layers.domain.mutationGate} |`);
    const doublesStr = (t.layers.application.doubles ?? []).map(d => `${d.port}:${d.strategy}`).join(', ') || 'constructor-di';
    lines.push(`| Application | \`${t.layers.application.harness}\` | ${t.layers.application.minLineCoverage ?? '—'} | ${t.layers.application.minBranchCoverage ?? '—'} | ${doublesStr} |`);
    lines.push(`| Interfaces | \`${t.layers.interfaces.harness}\` | — | — | verifyAuthzMatrix=${t.layers.interfaces.verifyAuthzMatrix} |`);
    lines.push(`| Infrastructure | \`${t.layers.infrastructure.harness}\` | — | — | requireTck=${t.layers.infrastructure.requireTck} |`);
    lines.push('');
    lines.push(`- **Parallel TDD Isolation**: \`workspaceMode=${t.parallelTdd.workspaceMode}\`, \`mergeStrategy=${t.parallelTdd.mergeStrategy}\``);
    lines.push('');
  }

  if (canonical.structures?.compliance) {
    const c = canonical.structures.compliance;
    lines.push('## 6. Regulatory & Privacy Compliance Signoff', '');
    lines.push(`- **Industry**: ${c.industry || '—'}`);
    lines.push(`- **Jurisdictions**: ${(c.jurisdictions ?? []).join(', ') || '—'}`);
    lines.push(`- **Data Residency**: \`${c.dataResidency || 'unspecified'}\` · **Erasure Required**: \`${Boolean(c.erasureRequired)}\` · **PII Strategy**: \`${c.piiStrategy || 'unspecified'}\` · **Retention**: ${c.retentionPolicy || '—'}`);
    lines.push('');
    if ((c.obligations ?? []).length > 0) {
      lines.push('| ID | Regulation | Summary | Mapped Truth Targets | Legal Signoff |');
      lines.push('| :--- | :--- | :--- | :--- | :--- |');
      for (const ob of c.obligations) {
        lines.push(`| \`${ob.id}\` | ${ob.regulation} | ${ob.summary} | ${(ob.mappedTo ?? []).join(', ') || '—'} | \`${ob.legalSignoff}\` |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function emitSignoffDocs(canonical, outSignoffDir) {
  const absDir = resolve(outSignoffDir);
  mkdirSync(absDir, { recursive: true });
  const emitted = [];

  const lineageFile = join(absDir, 'lineage.md');
  writeFileSync(lineageFile, renderSignoffLineageMarkdown(canonical), 'utf8');
  emitted.push({ kind: 'signoff-lineage', file: lineageFile });

  const hasNarrative = (canonical.structures.useCases ?? []).length > 0
    || (canonical.structures.journeys ?? []).length > 0
    || (canonical.structures.pipelines ?? []).length > 0
    || (canonical.structures.stories ?? []).some(s => s.goal || s.role);
  if (hasNarrative) {
    const ucFile = join(absDir, 'use-cases.md');
    writeFileSync(ucFile, renderSignoffUseCasesMarkdown(canonical), 'utf8');
    emitted.push({ kind: 'signoff-use-cases', file: ucFile });
  }

  // Emit complete Problem-Space + Solution-Space Diagram Bundle (.mmd, event-matrix.md, story-map.csv, domain-map.cml)
  // AND the unified self-contained offline HTML Atlas viewer (`signoff/atlas.html`).
  const bundle = buildAtlasBundle({ canonical });
  const bundleFiles = emitDiagramBundleFiles(bundle, absDir);
  for (const bf of bundleFiles) emitted.push(bf);

  const atlasHtmlFile = join(absDir, 'atlas.html');
  writeFileSync(atlasHtmlFile, renderAtlasHtml(bundle), 'utf8');
  emitted.push({ kind: 'signoff-atlas-html', file: atlasHtmlFile });

  return emitted;
}
