// Unified Problem-Space & Solution-Space Diagram Exporters for co-arising 2.0.
// Produces deterministic Mermaid, Story Map CSV, ContextMapper (.cml), Markdown, and
// rich structured payloads consumed by the unified offline Atlas HTML viewer (atlas-viewer.mjs).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildEventMatrixFromCanonical,
  extractEventMatrixFromIngestJson,
  extractEventMatrixFromV1Tree,
  renderEventFlowYamlSnippet,
  renderEventMatrixMarkdown,
  renderEventMatrixMermaid,
} from './event-matrix.mjs';
import { renderSystemLineageMarkdown } from './system-lineage.mjs';

function sanitizeId(raw) {
  return String(raw ?? 'N').replace(/[^A-Za-z0-9_]/gu, '_');
}

function escapeMermaidLabel(raw) {
  return String(raw ?? '').replace(/"/gu, '\'').replace(/\r?\n/gu, ' ');
}

function csvCell(val) {
  const s = String(val ?? '');
  if (/[,"\r\n]/u.test(s)) return `"${s.replace(/"/gu, '""')}"`;
  return s;
}

// ── 1. Story Map (Mermaid `journey` + StoriesOnBoard/Miro CSV + 2D structured grid) ──
export function buildStoryMapDiagram(canonical) {
  const structures = canonical.structures ?? {};
  const journeys = structures.journeys ?? [];
  const stories = structures.stories ?? [];
  const useCases = structures.useCases ?? [];
  const eventFlow = structures.eventFlow ?? null;
  const storyByName = new Map(stories.map(s => [s.name, s]));

  // Derive default journey from eventFlow timelines if journeys[] is empty
  let effectiveJourneys = [];
  if (journeys.length > 0) {
    effectiveJourneys = journeys;
  } else if (eventFlow?.timelines?.length > 0) {
    effectiveJourneys = [{
      id: 'derived-eventflow-journey',
      name: `${canonical.subdomain || canonical.context} End-to-End Journey`,
      persona: (structures.roles ?? []).find(r => r.kind === 'human')?.name || 'User',
      goal: 'Derived automatically from EventFlow timelines',
      release: 'R1',
      stages: eventFlow.timelines.map(tl => ({
        name: tl.name,
        stories: [],
        useCases: [],
        screens: [],
        events: (tl.events ?? []).map(e => e.event),
      })),
    }];
  }

  const csvRows = [
    ['Journey', 'Stage', 'Release', 'Persona', 'Story', 'Goal', 'SoThat', 'UseCases', 'Screens', 'Channel', 'EmotionScore', 'PainPoints'],
  ];
  const mermaidLines = ['journey'];
  const firstJourney = effectiveJourneys[0];
  mermaidLines.push(`  title ${escapeMermaidLabel(firstJourney?.name || `${canonical.system} User Journey`)}`);

  const structuredJourneys = [];
  for (const j of effectiveJourneys) {
    const persona = j.persona || 'User';
    const stagesOut = [];
    for (const st of j.stages ?? []) {
      const stageRelease = st.release || j.release || 'R1';
      const emotion = st.emotionScore ?? 4;
      mermaidLines.push(`  section ${escapeMermaidLabel(st.name)}`);
      const stStories = st.stories ?? [];
      if (stStories.length > 0) {
        for (const sName of stStories) {
          const sObj = storyByName.get(sName);
          const rel = sObj?.release || stageRelease;
          const actor = sObj?.role || persona;
          mermaidLines.push(`    ${escapeMermaidLabel(sName)}: ${emotion}: ${escapeMermaidLabel(actor)}`);
          csvRows.push([
            j.name,
            st.name,
            rel,
            actor,
            sName,
            sObj?.goal || sObj?.description || '',
            sObj?.soThat || '',
            (st.useCases ?? sObj?.coversUseCases ?? []).join('; '),
            (st.screens ?? []).join('; '),
            st.channel || '',
            emotion,
            (st.painPoints ?? []).join('; '),
          ]);
        }
      } else {
        const label = (st.useCases ?? [])[0] || (st.events ?? [])[0] || st.name;
        mermaidLines.push(`    ${escapeMermaidLabel(label)}: ${emotion}: ${escapeMermaidLabel(persona)}`);
        csvRows.push([
          j.name,
          st.name,
          stageRelease,
          persona,
          '',
          j.goal || '',
          '',
          (st.useCases ?? []).join('; '),
          (st.screens ?? []).join('; '),
          st.channel || '',
          emotion,
          (st.painPoints ?? []).join('; '),
        ]);
      }
      stagesOut.push({
        name: st.name,
        release: stageRelease,
        channel: st.channel || null,
        emotionScore: st.emotionScore ?? null,
        painPoints: st.painPoints ?? [],
        stories: stStories.map(sn => {
          const so = storyByName.get(sn);
          return {
            name: sn,
            role: so?.role || persona,
            goal: so?.goal || so?.description || '',
            soThat: so?.soThat || '',
            release: so?.release || stageRelease,
          };
        }),
        useCases: st.useCases ?? [],
        screens: st.screens ?? [],
      });
    }
    structuredJourneys.push({
      id: j.id,
      name: j.name,
      persona,
      goal: j.goal || '',
      release: j.release || 'R1',
      stages: stagesOut,
    });
  }

  // Include orphan stories not yet placed on any journey
  const placedStories = new Set(structuredJourneys.flatMap(j => j.stages.flatMap(s => s.stories.map(x => x.name))));
  const unplacedStories = stories.filter(s => !placedStories.has(s.name));
  for (const s of unplacedStories) {
    csvRows.push([
      'Backlog',
      'Unassigned',
      s.release || 'R1',
      s.role || 'User',
      s.name,
      s.goal || s.description || '',
      s.soThat || '',
      (s.coversUseCases ?? []).join('; '),
      '',
      '',
      '',
      '',
    ]);
  }

  const csv = `${csvRows.map(r => r.map(csvCell).join(',')).join('\n')}\n`;
  const mermaid = mermaidLines.join('\n');
  const releases = [...new Set([
    ...structuredJourneys.flatMap(j => j.stages.flatMap(st => [st.release, ...st.stories.map(s => s.release)])),
    ...unplacedStories.map(s => s.release || 'R1'),
  ])].filter(Boolean).sort();

  const mdLines = [
    `# 2D User Journey & Story Map (${canonical.system}/${canonical.subdomain || canonical.context})`,
    '',
    '```mermaid',
    mermaid,
    '```',
    '',
  ];
  for (const j of structuredJourneys) {
    mdLines.push(`## ${j.name} (\`${j.id}\`) — Persona: ${j.persona}`);
    mdLines.push('| Stage | Release | Stories | Use Cases | Screens | Pain Points |');
    mdLines.push('| :--- | :---: | :--- | :--- | :--- | :--- |');
    for (const st of j.stages) {
      mdLines.push(`| ${st.name} | ${st.release} | ${st.stories.map(s => s.name).join(', ') || '—'} | ${st.useCases.join(', ') || '—'} | ${st.screens.join(', ') || '—'} | ${st.painPoints.join('; ') || '—'} |`);
    }
    mdLines.push('');
  }

  return {
    id: 'story-map',
    space: 'problem',
    category: '11-stories-journeys',
    title: '用户旅程与 2D 故事地图 (Story Map)',
    subtitle: '横向阶段骨架 × 纵向迭代切分 + 痛点/触点/CSV 导出',
    summary: `${structuredJourneys.length} 条旅程 · ${stories.length} 个用户故事 · ${useCases.length} 个用例 · 支持 Miro / StoriesOnBoard CSV 导出`,
    mermaid,
    csv,
    markdown: mdLines.join('\n'),
    structured: {
      kind: 'story-map',
      journeys: structuredJourneys,
      releases: releases.length > 0 ? releases : ['R1'],
      unplacedStories: unplacedStories.map(s => ({
        name: s.name,
        role: s.role || 'User',
        goal: s.goal || s.description || '',
        release: s.release || 'R1',
      })),
    },
  };
}

// ── 2. Use Cases & Pipelines (Sequence + Durable Pipeline Flow) ──
export function buildUseCasesDiagram(canonical) {
  const useCases = canonical.structures?.useCases ?? [];
  const pipelines = canonical.structures?.pipelines ?? [];
  const mermaidBlocks = [];
  const graphNodes = [];
  const graphEdges = [];
  const seenNodes = new Set();
  const addNode = (id, label, group, meta = {}) => {
    if (seenNodes.has(id)) return;
    seenNodes.add(id);
    graphNodes.push({ id, label, group, ...meta });
  };

  const ucMermaidParts = [];
  for (const uc of useCases) {
    const lines = ['sequenceDiagram'];
    const participants = new Map();
    const reg = (id, label) => {
      const k = sanitizeId(id);
      if (!participants.has(k)) participants.set(k, label || id);
      return k;
    };
    if (uc.actor) reg(uc.actor, uc.actor);
    for (const st of uc.steps ?? []) {
      if (st.actor) reg(st.actor, st.actor);
      if (st.aggregate) reg(st.aggregate, st.aggregate);
      if (st.pipeline) reg(`PL_${st.pipeline}`, `Pipeline:${st.pipeline}`);
      if (st.readsView) reg(`RM_${st.readsView}`, `View:${st.readsView}`);
      for (const v of st.updatesViews ?? []) reg(`RM_${v}`, `View:${v}`);
    }
    for (const [k, label] of participants) lines.push(`  participant ${k} as ${escapeMermaidLabel(label)}`);
    for (const st of uc.steps ?? []) {
      const fromLabel = st.actor ?? uc.actor ?? 'System';
      const from = reg(fromLabel, fromLabel);
      addNode(`actor:${fromLabel}`, fromLabel, 'actor');
      let targetLabel;
      let targetGroup;
      if (st.aggregate) {
        targetLabel = st.aggregate;
        targetGroup = 'aggregate';
      } else if (st.pipeline) {
        targetLabel = `Pipeline:${st.pipeline}`;
        targetGroup = 'pipeline';
      } else {
        targetLabel = 'Application';
        targetGroup = 'application';
      }
      const target = reg(targetLabel, targetLabel);
      addNode(`${targetGroup}:${targetLabel}`, targetLabel, targetGroup);
      const labelParts = [st.port, st.command].filter(Boolean);
      const callLabel = labelParts.length > 0 ? labelParts.join(' -> ') : (st.intent || st.id || 'step');
      lines.push(`  ${from}->>${target}: ${escapeMermaidLabel(callLabel)}`);
      graphEdges.push({ from: `actor:${fromLabel}`, to: `${targetGroup}:${targetLabel}`, label: callLabel });
      for (const ev of st.emissions ?? []) {
        lines.push(`  ${target}-->>${from}: emit ${escapeMermaidLabel(ev)}`);
        addNode(`event:${ev}`, ev, 'event');
        graphEdges.push({ from: `${targetGroup}:${targetLabel}`, to: `event:${ev}`, label: 'emits' });
        for (const v of st.updatesViews ?? []) {
          const vk = reg(`RM_${v}`, `View:${v}`);
          lines.push(`  ${target}->>${vk}: project ${escapeMermaidLabel(ev)}`);
          addNode(`rm:${v}`, v, 'readModel');
          graphEdges.push({ from: `event:${ev}`, to: `rm:${v}`, label: 'projects' });
        }
      }
    }
    ucMermaidParts.push({
      id: uc.id,
      name: uc.name,
      actor: uc.actor || 'User',
      intent: uc.intent || '',
      steps: uc.steps ?? [],
      extensions: uc.extensions ?? [],
      mermaid: lines.join('\n'),
    });
    mermaidBlocks.push(lines.join('\n'));
  }

  for (const pl of pipelines) {
    let prev = null;
    for (const st of pl.steps ?? []) {
      const nid = `pl:${pl.id}:${st.id}`;
      addNode(nid, `${pl.name} · ${st.name || st.id}`, 'pipeline', { saga: st.invokeSaga || null });
      if (prev) graphEdges.push({ from: prev, to: nid, label: 'next' });
      prev = nid;
    }
  }

  const primaryMermaid = mermaidBlocks[0] || 'flowchart LR\n  Empty["No useCases declared"]';
  const mdLines = [
    `# Use Cases & Pipelines (${canonical.system}/${canonical.subdomain || canonical.context})`,
    '',
    ...ucMermaidParts.flatMap(u => [`## ${u.name} (\`${u.id}\`)`, '', '```mermaid', u.mermaid, '```', '']),
  ];

  return {
    id: 'use-cases',
    space: 'problem',
    category: '12-use-cases-pipelines',
    title: '端到端用例与编排流水线 (Use Cases & Pipelines)',
    subtitle: '角色 → 端口/命令 → 聚合 → 事件 → 读模型 因果时序图',
    summary: `${useCases.length} 个端到端用例 · ${pipelines.length} 条持久化流水线`,
    mermaid: primaryMermaid,
    markdown: mdLines.join('\n'),
    structured: {
      kind: 'flow-graph',
      useCases: ucMermaidParts,
      pipelines,
      nodes: graphNodes,
      edges: graphEdges,
    },
  };
}

// ── 3. Domain Model (Aggregates, Commands, Events, Deadlines, ValueObjects, ExactTypes) ──
export function buildDomainModelDiagram(canonical) {
  const structures = canonical.structures ?? {};
  const aggregates = structures.aggregates ?? [];
  const valueObjects = structures.valueObjects ?? [];
  const exactTypes = structures.exactTypes ?? [];
  const sagas = structures.sagas ?? [];

  const lines = ['classDiagram'];
  const graphNodes = [];
  const graphEdges = [];

  for (const agg of aggregates) {
    const aid = sanitizeId(agg.name);
    lines.push(`  class ${aid} {`);
    lines.push('    <<Aggregate>>');
    for (const sf of agg.stateFields ?? []) {
      lines.push(`    +${sf.name}: ${sf.type}`);
    }
    for (const cmd of agg.commands ?? []) {
      lines.push(`    +${cmd.name}(${(cmd.parameters ?? []).map(p => p.name).join(', ')})`);
    }
    lines.push('  }');
    graphNodes.push({
      id: `agg:${agg.name}`,
      label: agg.name,
      group: 'aggregate',
      detail: `state: ${(agg.stateFields ?? []).map(f => `${f.name}:${f.type}`).join(', ') || '—'}`,
    });
    for (const cmd of agg.commands ?? []) {
      const cid = `cmd:${agg.name}.${cmd.name}`;
      graphNodes.push({
        id: cid,
        label: cmd.name,
        group: 'command',
        detail: `params: ${(cmd.parameters ?? []).map(p => `${p.name}:${p.type}`).join(', ') || '—'}`,
      });
      graphEdges.push({ from: cid, to: `agg:${agg.name}`, label: 'command' });
      for (const evName of cmd.produces ?? []) {
        graphEdges.push({ from: `agg:${agg.name}`, to: `event:${agg.name}.${evName}`, label: `via ${cmd.name}` });
      }
    }
    for (const ev of agg.events ?? []) {
      const eid = `event:${agg.name}.${ev.name}`;
      const evClass = sanitizeId(`${agg.name}_${ev.name}`);
      lines.push(`  class ${evClass} {`);
      lines.push('    <<DomainEvent>>');
      for (const f of ev.fields ?? []) lines.push(`    +${f.name}: ${f.type}`);
      lines.push('  }');
      lines.push(`  ${aid} ..> ${evClass} : emits`);
      graphNodes.push({
        id: eid,
        label: ev.name,
        group: 'event',
        detail: `fields: ${(ev.fields ?? []).map(f => `${f.name}:${f.type}${f.sensitivity ? `[${f.sensitivity}]` : ''}`).join(', ') || '—'}`,
      });
    }
    for (const dl of agg.deadlines ?? []) {
      const did = `deadline:${agg.name}.${dl.name}`;
      graphNodes.push({ id: did, label: `⏰ ${dl.name}`, group: 'deadline', detail: `${dl.stateField || ''} -> ${dl.triggerCommand || ''} (${dl.graceWindow || 'no-grace'})` });
      graphEdges.push({ from: did, to: `cmd:${agg.name}.${dl.triggerCommand}`, label: 'triggers' });
    }
    for (const rel of agg.relations ?? []) {
      const targetId = `agg:${rel.target}`;
      const targetClass = sanitizeId(rel.target);
      const [cFrom, cTo] = String(rel.cardinality || '1:N').split(':');
      const relLabel = rel.meaning ? `${rel.cardinality} · ${rel.meaning}` : rel.cardinality;
      lines.push(`  ${aid} "${cFrom || '1'}" --> "${cTo || 'N'}" ${targetClass} : ${escapeMermaidLabel(rel.meaning || rel.cardinality)}`);
      if (!graphNodes.some(n => n.id === targetId)) {
        graphNodes.push({
          id: targetId,
          label: rel.target,
          group: rel.target.includes('.') ? 'supporting' : 'aggregate',
          detail: rel.target.includes('.') ? 'cross-subdomain aggregate' : '',
        });
      }
      graphEdges.push({ from: `agg:${agg.name}`, to: targetId, label: relLabel });
    }
  }

  for (const vo of valueObjects) {
    const vid = sanitizeId(vo.name);
    lines.push(`  class ${vid} {`);
    lines.push('    <<ValueObject>>');
    for (const f of vo.fields ?? []) lines.push(`    +${f.name}: ${f.type}`);
    lines.push('  }');
  }

  for (const saga of sagas) {
    const sid = `saga:${saga.name}`;
    graphNodes.push({ id: sid, label: `Saga: ${saga.name}`, group: 'saga', detail: `triggers: ${(saga.triggers ?? []).length}` });
  }

  const mermaid = lines.join('\n');
  return {
    id: 'domain-model',
    space: 'problem',
    category: '03-06-domain-model',
    title: '领域聚合、事件与值对象模型 (Domain Model)',
    subtitle: '聚合状态机、命令、领域事件、超时 Deadline 与零浮点精确类型',
    summary: `${aggregates.length} 个聚合 · ${valueObjects.length} 个值对象 · ${exactTypes.length} 个精确类型 · ${sagas.length} 个 Saga`,
    mermaid,
    markdown: `# Domain Model (${canonical.system}/${canonical.subdomain || canonical.context})\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'flow-graph',
      nodes: graphNodes,
      edges: graphEdges,
      exactTypes,
      valueObjects,
      aggregates: aggregates.map(a => ({
        name: a.name,
        stateFields: a.stateFields,
        commands: a.commands.map(c => c.name),
        events: a.events.map(e => e.name),
        deadlines: a.deadlines ?? [],
      })),
    },
  };
}

// ── 4. Field-Level Lineage & PII Compliance Ledger ──
export function buildFieldLineageDiagram(canonical, systemLineage = null) {
  const structures = canonical.structures ?? {};
  const aggregates = structures.aggregates ?? [];
  const readModels = structures.readModels ?? [];
  const folds = canonical.eventFolds ?? [];
  const lineage = canonical.lineage ?? {};
  const compliance = structures.compliance ?? null;

  const lines = ['flowchart LR'];
  const graphNodes = [];
  const graphEdges = [];
  const seen = new Set();
  const addNode = (id, label, group, sensitivity = null) => {
    if (seen.has(id)) return;
    seen.add(id);
    graphNodes.push({ id, label, group, sensitivity });
  };

  for (const agg of aggregates) {
    for (const ev of agg.events ?? []) {
      const evId = `ev_${sanitizeId(agg.name)}_${sanitizeId(ev.name)}`;
      const hasPii = (ev.fields ?? []).some(f => f.sensitivity === 'pii' || f.sensitivity === 'secret' || f.sensitivity === 'tokenized-pii');
      const piiTag = hasPii ? ' [PII]' : '';
      lines.push(`  ${evId}["Event: ${escapeMermaidLabel(`${agg.name}.${ev.name}${piiTag}`)}"]`);
      addNode(evId, `${agg.name}.${ev.name}`, 'event', hasPii ? 'pii' : null);

      for (const cmd of agg.commands ?? []) {
        if (!(cmd.produces ?? []).includes(ev.name)) continue;
        const cmdId = `cmd_${sanitizeId(agg.name)}_${sanitizeId(cmd.name)}`;
        lines.push(`  ${cmdId}["Cmd: ${escapeMermaidLabel(`${agg.name}.${cmd.name}`)}"]`);
        lines.push(`  ${cmdId} --> ${evId}`);
        addNode(cmdId, `${agg.name}.${cmd.name}`, 'command');
        graphEdges.push({ from: cmdId, to: evId, label: `${(cmd.parameters ?? []).length} params` });
      }
    }
  }

  for (const fold of folds) {
    const evId = `ev_${sanitizeId(fold.aggregate)}_${sanitizeId(fold.event)}`;
    for (const assign of fold.assignments ?? []) {
      const stId = `st_${sanitizeId(fold.aggregate)}_${sanitizeId(assign.field)}`;
      lines.push(`  ${stId}["State: ${escapeMermaidLabel(`${fold.aggregate}.${assign.field}`)}"]`);
      lines.push(`  ${evId} -->|"fold"| ${stId}`);
      addNode(stId, `${fold.aggregate}.${assign.field}`, 'state');
      graphEdges.push({ from: evId, to: stId, label: 'post fold' });
    }
  }

  for (const rm of readModels) {
    const rmId = `rm_${sanitizeId(rm.name)}`;
    const hasPii = (rm.fields ?? []).some(f => f.sensitivity === 'pii' || f.sensitivity === 'secret');
    const vis = (rm.visibleTo ?? []).join(',') || 'default';
    lines.push(`  ${rmId}["RM: ${escapeMermaidLabel(`${rm.name} (${vis})`)}"]`);
    addNode(rmId, `${rm.name} (${vis})`, 'readModel', hasPii ? 'pii' : null);
    for (const f of rm.fields ?? []) {
      const src = String(f.source ?? '');
      const evMatch = src.match(/^eventField:([^.]+(?:\.[^.]+)?)\.([^.]+)$/u);
      if (evMatch) {
        const evRef = evMatch[1];
        const fieldName = evMatch[2];
        let aggName = rm.sourceAggregate;
        let evName = evRef;
        if (evRef.includes('.')) [aggName, evName] = evRef.split('.');
        if (!aggName) {
          const foundAgg = aggregates.find(a => (a.events ?? []).some(e => e.name === evName));
          aggName = foundAgg?.name || 'Agg';
        }
        const evId = `ev_${sanitizeId(aggName)}_${sanitizeId(evName)}`;
        lines.push(`  ${evId} -->|"${escapeMermaidLabel(`${fieldName} -> ${f.name}`)}"| ${rmId}`);
        graphEdges.push({ from: evId, to: rmId, label: `${fieldName} → ${f.name}${f.sensitivity ? ` [${f.sensitivity}]` : ''}` });
      }
      const stMatch = src.match(/^stateField:([^.]+)(?:\.([^.]+))?$/u);
      if (stMatch) {
        const aggName = stMatch[2] ? stMatch[1] : (rm.sourceAggregate || 'Agg');
        const stField = stMatch[2] || stMatch[1];
        const stId = `st_${sanitizeId(aggName)}_${sanitizeId(stField)}`;
        addNode(stId, `${aggName}.${stField}`, 'state');
        lines.push(`  ${stId} -->|"${escapeMermaidLabel(f.name)}"| ${rmId}`);
        graphEdges.push({ from: stId, to: rmId, label: `state → ${f.name}` });
      }
    }
  }

  const mermaid = systemLineage ? renderSystemLineageMermaid(systemLineage) : lines.join('\n');
  const markdown = systemLineage
    ? renderSystemLineageMarkdown(systemLineage)
    : `# Field Lineage & Compliance (${canonical.system}/${canonical.subdomain || canonical.context})\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`;

  return {
    id: 'field-lineage',
    space: 'problem',
    category: '09-lineage-compliance',
    title: systemLineage ? '跨子域字段血缘与 PII 污点追踪 (System Lineage)' : '字段血缘账本与隐私合规 (Field Lineage & PII)',
    subtitle: '命令参数 → 领域事件 → 聚合状态折叠 → 读模型投影 + 豁免台账 + 合规门禁',
    summary: systemLineage
      ? `${systemLineage.summary.subdomainCount} 子域 · ${systemLineage.summary.integrationEdgeCount} 条跨子域流 · ${systemLineage.summary.piiLeakCount} 个 PII 泄露`
      : `${graphNodes.length} 个血缘节点 · ${graphEdges.length} 条字段流 · ${(lineage.waivers ?? []).length} 项机器校验豁免`,
    mermaid,
    markdown,
    structured: {
      kind: 'flow-graph',
      nodes: graphNodes,
      edges: graphEdges,
      coverage: lineage.coverage ?? {},
      waivers: lineage.waivers ?? [],
      compliance,
      systemLineage: systemLineage ? {
        summary: systemLineage.summary,
        integrations: systemLineage.integrations,
        piiLeaks: systemLineage.piiLeaks,
      } : null,
    },
  };
}

function renderSystemLineageMermaid(systemLineage) {
  const lines = ['flowchart LR'];
  for (const s of systemLineage.subdomains ?? []) {
    lines.push(`  SD_${sanitizeId(s.subdomain)}["Subdomain: ${escapeMermaidLabel(s.subdomain)} (${s.subdomainType || 'domain'})"]`);
  }
  for (const integ of systemLineage.integrations ?? []) {
    const label = `${integ.relation} [${integ.boundary}] (${integ.fromEvent} -> ${integ.toTarget})`;
    lines.push(`  SD_${sanitizeId(integ.fromSubdomain)} -->|"${escapeMermaidLabel(label)}"| SD_${sanitizeId(integ.toSubdomain)}`);
  }
  return lines.join('\n');
}

// ── 5. Problem-Space Subdomain Map + ContextMapper (.cml) Exporter ──
export function buildSubdomainMapDiagram(canonicals, domainMap = null, systemLineage = null) {
  const subdomains = (systemLineage?.subdomains ?? canonicals.map(c => ({
    system: c.system,
    subdomain: c.subdomain || c.context,
    subdomainType: c.subdomainType || 'core',
    boundedContext: c.context,
  })));
  const integrations = systemLineage?.integrations ?? (domainMap?.integrations ?? []).map(i => ({
    id: i.id,
    fromSubdomain: i.from?.subdomain,
    fromEvent: i.from?.event,
    toSubdomain: i.to?.subdomain,
    toTarget: i.to?.command || i.to?.port,
    relation: i.relation || 'U/D-ACL',
    boundary: 'cross-subdomain',
  }));

  const mLines = ['flowchart LR'];
  const graphNodes = [];
  const graphEdges = [];
  for (const sd of subdomains) {
    const nid = `SD_${sanitizeId(sd.subdomain)}`;
    const label = `${sd.subdomain} [${sd.subdomainType || 'core'}]`;
    mLines.push(`  ${nid}["${escapeMermaidLabel(label)}"]`);
    graphNodes.push({ id: nid, label, group: sd.subdomainType || 'core', detail: `BC: ${sd.boundedContext || sd.subdomain}` });
  }
  for (const it of integrations) {
    if (!it.fromSubdomain || !it.toSubdomain) continue;
    const fromId = `SD_${sanitizeId(it.fromSubdomain)}`;
    const toId = `SD_${sanitizeId(it.toSubdomain)}`;
    const lbl = `${it.relation}: ${it.fromEvent || ''} → ${it.toTarget || ''}`;
    mLines.push(`  ${fromId} -->|"${escapeMermaidLabel(lbl)}"| ${toId}`);
    graphEdges.push({ from: fromId, to: toId, label: lbl });
  }

  // Generate standard ContextMapper (.cml) DSL!
  const cmlLines = [
    `/* Auto-generated ContextMapper (.cml) from co-arising 2.0 Truth (${subdomains[0]?.system || 'System'}) */`,
    `Domain ${sanitizeId(subdomains[0]?.system || 'EnterpriseDomain')} {`,
  ];
  const typeMap = { core: 'CORE_DOMAIN', supporting: 'SUPPORTING_DOMAIN', generic: 'GENERIC_SUBDOMAIN' };
  for (const sd of subdomains) {
    cmlLines.push(`  Subdomain ${sanitizeId(sd.subdomain)} {`);
    cmlLines.push(`    type = ${typeMap[sd.subdomainType] || 'CORE_DOMAIN'}`);
    cmlLines.push('  }');
  }
  cmlLines.push('}', '');

  const bcGroups = new Map();
  if (Array.isArray(domainMap?.boundedContexts) && domainMap.boundedContexts.length > 0) {
    for (const bc of domainMap.boundedContexts) {
      bcGroups.set(bc.name, bc.subdomains ?? []);
    }
  } else {
    for (const sd of subdomains) {
      const bcName = sd.boundedContext || sd.subdomain;
      if (!bcGroups.has(bcName)) bcGroups.set(bcName, []);
      bcGroups.get(bcName).push(sd.subdomain);
    }
  }

  for (const [bcName, sds] of bcGroups) {
    cmlLines.push(`BoundedContext ${sanitizeId(bcName)} implements ${sds.map(sanitizeId).join(', ')} {}`);
  }
  if (integrations.length > 0) {
    cmlLines.push('', `ContextMap ${sanitizeId(subdomains[0]?.system || 'System')}ContextMap {`);
    for (const bcName of bcGroups.keys()) {
      cmlLines.push(`  contains ${sanitizeId(bcName)}`);
    }
    const sdToBc = new Map();
    for (const [bcName, sds] of bcGroups) {
      for (const sd of sds) sdToBc.set(sd, bcName);
    }
    for (const it of integrations) {
      const fromBc = sanitizeId(sdToBc.get(it.fromSubdomain) || it.fromSubdomain);
      const toBc = sanitizeId(sdToBc.get(it.toSubdomain) || it.toSubdomain);
      if (fromBc !== toBc) {
        cmlLines.push(`  ${fromBc} [U,OHS,PL]->[D,ACL] ${toBc}`);
      }
    }
    cmlLines.push('}');
  }

  const cml = `${cmlLines.join('\n')}\n`;
  const mermaid = mLines.join('\n');
  return {
    id: 'subdomain-map',
    space: 'problem',
    category: '04-05-subdomain-context-map',
    title: '问题空间子域与 ACL 上下文映射 (Subdomain & Context Map)',
    subtitle: '稳定问题空间 Subdomain 集成契约 + ContextMapper (.cml) 标准导出',
    summary: `${subdomains.length} 个子域 · ${integrations.length} 条 ACL 跨子域契约 · 支持 ContextMapper .cml 导出`,
    mermaid,
    cml,
    markdown: `# Subdomain & Context Map\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n\n## ContextMapper (.cml)\n\n\`\`\`cml\n${cml}\`\`\`\n`,
    structured: {
      kind: 'flow-graph',
      nodes: graphNodes,
      edges: graphEdges,
      subdomains,
      integrations,
    },
  };
}

// ── 6. Solution Space: Onion 5-Layer Architecture & Codegen Channels ──
export function buildOnionArchitectureDiagram(canonical) {
  const structures = canonical.structures ?? {};
  const behaviors = canonical.behaviors ?? [];
  const clozeSlots = canonical.clozeSlots ?? [];
  const clozeSet = new Set(clozeSlots.map(s => s.target));

  const inboundPorts = (structures.ports ?? []).filter(p => p.direction === 'inbound');
  const outboundPorts = (structures.ports ?? []).filter(p => p.direction === 'outbound');
  const appBehs = behaviors.filter(b => b.layer === 'application');
  const domBehs = behaviors.filter(b => b.layer === 'domain');
  const aggregates = structures.aggregates ?? [];

  const lines = ['flowchart TB'];
  lines.push('  subgraph L_IF["4. Interfaces Layer (HTTP / Event / Scheduler Entrypoints)"]');
  for (const p of inboundPorts) {
    for (const op of p.operations ?? []) {
      const id = `IF_${sanitizeId(p.name)}_${sanitizeId(op.name)}`;
      const kind = op.callerKind || op.authz?.mode || 'http';
      lines.push(`    ${id}["${escapeMermaidLabel(`${p.name}.${op.name} [${kind}]`)}"]`);
    }
  }
  if (inboundPorts.length === 0) lines.push('    IF_NONE["(no inbound ports)"]');
  lines.push('  end');

  lines.push('  subgraph L_APP["3. Application Layer (Stories & Orchestration)"]');
  for (const b of appBehs) {
    const id = `APP_${sanitizeId(b.target)}`;
    const ch = clozeSet.has(b.target) ? '4B @cloze' : '4A det';
    lines.push(`    ${id}["${escapeMermaidLabel(`${b.target} [${ch}]`)}"]`);
  }
  if (appBehs.length === 0) lines.push('    APP_NONE["(no application stories)"]');
  lines.push('  end');

  lines.push('  subgraph L_DOM["1-2. Pure Domain Layer (Zero-IO Aggregates & Z3 Slices)"]');
  for (const a of aggregates) {
    const id = `DOM_${sanitizeId(a.name)}`;
    const sliceCount = domBehs.filter(b => b.target.startsWith(`${a.name}.`)).length;
    lines.push(`    ${id}["${escapeMermaidLabel(`Aggregate: ${a.name} (${sliceCount} Z3 slices)`)}"]`);
  }
  lines.push('  end');

  lines.push('  subgraph L_INFRA["5. Infrastructure Layer (Outbound Adapters & Persistence)"]');
  for (const p of outboundPorts) {
    const id = `INF_${sanitizeId(p.name)}`;
    lines.push(`    ${id}["${escapeMermaidLabel(`Adapter: ${p.name}`)}"]`);
  }
  if (canonical.readside?.materializedViews?.length > 0) {
    for (const mv of canonical.readside.materializedViews) {
      lines.push(`    MV_${sanitizeId(mv.name)}["${escapeMermaidLabel(`ReadSide MV: ${mv.name} (${mv.refreshMode || 'stream'})`)}"]`);
    }
  }
  if (outboundPorts.length === 0 && !(canonical.readside?.materializedViews?.length > 0)) {
    lines.push('    INF_NONE["(pure in-memory / no outbound ports)"]');
  }
  lines.push('  end');

  // Connect layers (DIP direction)
  lines.push('  L_IF --> L_APP');
  lines.push('  L_APP --> L_DOM');
  lines.push('  L_INFRA -.->|"implements Ports (DIP)"| L_APP');

  const mermaid = lines.join('\n');
  return {
    id: 'onion-architecture',
    space: 'solution',
    category: 'solution-onion',
    title: '洋葱五层架构与代码生成通道 (Onion 5-Layer & Channels)',
    subtitle: 'Interfaces → Application → Pure Domain ← Infrastructure（DIP 依赖倒置 + 4A 确定性 / 4B @cloze 槽位）',
    summary: `Domain ${domBehs.length} 切片 · Application ${appBehs.length} 故事 · 4A 确定性 ${canonical.verificationSummary?.deterministicCount ?? 0} · 4B @cloze ${clozeSlots.length}`,
    mermaid,
    markdown: `# Solution Space — Onion 5-Layer Architecture\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'onion-layers',
      layers: [
        {
          name: 'Interfaces (HTTP / Event / Scheduler)',
          tone: 'blue',
          items: inboundPorts.flatMap(p => (p.operations ?? []).map(op => ({
            label: `${p.name}.${op.name}`,
            badge: op.authz?.mode || op.callerKind || 'http',
          }))),
        },
        {
          name: 'Application (Orchestration & Policies)',
          tone: 'purple',
          items: appBehs.map(b => ({
            label: b.target,
            badge: clozeSet.has(b.target) ? '4B @cloze' : '4A deterministic',
          })),
        },
        {
          name: 'Pure Domain (Aggregates & Z3 Verified Slices)',
          tone: 'emerald',
          items: aggregates.map(a => ({
            label: a.name,
            badge: `${a.commands.length} cmds / ${a.events.length} evts`,
          })),
        },
        {
          name: 'Infrastructure (Outbound Ports & Materialized Views)',
          tone: 'amber',
          items: [
            ...outboundPorts.map(p => ({ label: p.name, badge: 'outbound port' })),
            ...(canonical.readside?.materializedViews ?? []).map(mv => ({
              label: mv.name,
              badge: `${mv.refreshMode || 'stream'} · ${mv.storage}`,
            })),
          ],
        },
      ],
    },
  };
}

// ── 7. Solution Space: Authz PEP / PDP Matrix ──
export function buildAuthzMatrixDiagram(canonical) {
  const authzMatrix = canonical.lineage?.authzMatrix ?? [];
  const roles = canonical.structures?.roles ?? [];
  const lines = ['flowchart LR'];
  const graphNodes = [];
  const graphEdges = [];
  const seen = new Set();
  const addNode = (id, label, group) => {
    if (seen.has(id)) return;
    seen.add(id);
    graphNodes.push({ id, label, group });
  };

  for (const row of authzMatrix) {
    const opId = `OP_${sanitizeId(row.operation)}`;
    lines.push(`  ${opId}["${escapeMermaidLabel(`${row.operation} (${row.mode || 'undeclared'})`)}"]`);
    addNode(opId, `${row.operation}`, 'operation');
    if (row.mode === 'external-pdp') {
      const pdpId = `PDP_${sanitizeId(row.policyRef || 'external')}`;
      lines.push(`  ${pdpId}{{"PDP: ${escapeMermaidLabel(row.policyRef || 'external')}"}}`);
      lines.push(`  ${pdpId} -->|"${escapeMermaidLabel(row.action || 'allow')}"| ${opId}`);
      addNode(pdpId, `PDP: ${row.policyRef || 'external'}`, 'pdp');
      graphEdges.push({ from: pdpId, to: opId, label: `${row.action || ''} (${row.scope || ''})` });
    } else if ((row.allowedRoles ?? []).length > 0) {
      for (const r of row.allowedRoles) {
        const rid = `ROLE_${sanitizeId(r)}`;
        lines.push(`  ${rid}["Role: ${escapeMermaidLabel(r)}"]`);
        lines.push(`  ${rid} -->|"${escapeMermaidLabel(row.action || row.mode)}"| ${opId}`);
        addNode(rid, r, 'role');
        graphEdges.push({ from: rid, to: opId, label: `${row.mode} · ${row.scope || ''}` });
      }
    } else {
      const callerId = `CALLER_${sanitizeId(row.mode || row.callerKind || 'public')}`;
      lines.push(`  ${callerId}["${escapeMermaidLabel(row.mode || row.callerKind || 'public')}"]`);
      lines.push(`  ${callerId} --> ${opId}`);
      addNode(callerId, row.mode || row.callerKind || 'public', 'role');
      graphEdges.push({ from: callerId, to: opId, label: row.callerKind || '' });
    }
    if (row.resource?.type) {
      const resId = `RES_${sanitizeId(row.resource.type)}`;
      const resLabel = `Resource: ${row.resource.type}${row.resource.ownerField ? ` (${row.resource.ownerField})` : ''}`;
      lines.push(`  ${resId}[("${escapeMermaidLabel(resLabel)}")]`);
      lines.push(`  ${opId} -->|"${escapeMermaidLabel(row.resource.relation || 'resource')}"| ${resId}`);
      addNode(resId, resLabel, 'resource');
      graphEdges.push({ from: opId, to: resId, label: row.resource.relation || 'resource' });
    }
    for (const ent of row.requiresEntitlement ?? []) {
      const entId = `ENT_${sanitizeId(ent.code)}`;
      lines.push(`  ${entId}{{"Entitlement: ${escapeMermaidLabel(ent.code)}"}}`);
      lines.push(`  ${entId} -.->|"requires"| ${opId}`);
      addNode(entId, `Entitlement: ${ent.code}`, 'pdp');
      graphEdges.push({ from: entId, to: opId, label: ent.matchParam ? `match:${ent.matchParam}` : 'requires' });
    }
  }
  if (authzMatrix.length === 0) lines.push('  Empty["No inbound authz operations declared"]');

  const mermaid = lines.join('\n');
  return {
    id: 'authz-matrix',
    space: 'solution',
    category: 'solution-authz',
    title: '入站权限边界与 PEP/PDP 矩阵 (Authz Boundary)',
    subtitle: 'auth-core 兼容角色映射 + External PDP (Workday/OPA/OpenFGA) + 内部触发隔离',
    summary: `${roles.length} 个角色 · ${authzMatrix.length} 个入站操作契约`,
    mermaid,
    markdown: `# Solution Space — Authz PEP/PDP Matrix\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'authz-matrix',
      roles,
      rows: authzMatrix,
      nodes: graphNodes,
      edges: graphEdges,
    },
  };
}

// ── 8. Solution Space: ReadSide Physical Materialization Topology ──
export function buildReadSideDiagram(canonical) {
  const readModels = canonical.structures?.readModels ?? [];
  const mvs = canonical.readside?.materializedViews ?? [];
  const lines = ['flowchart LR'];
  const graphNodes = [];
  const graphEdges = [];
  const seen = new Set();
  const addNode = (id, label, group, detail = '') => {
    if (seen.has(id)) return;
    seen.add(id);
    graphNodes.push({ id, label, group, detail });
  };

  for (const mv of mvs) {
    const mvId = `MV_${sanitizeId(mv.name)}`;
    const mvLabel = `${mv.name} [${mv.refreshMode || 'stream'} · ${mv.storage}]`;
    lines.push(`  ${mvId}[("${escapeMermaidLabel(mvLabel)}")]`);
    addNode(mvId, mvLabel, 'materializedView', `${mv.strategy} · ${(mv.derivedColumns ?? []).length} cols`);
    for (const rmName of mv.servesReadModels ?? []) {
      const rm = readModels.find(r => r.name === rmName);
      const rmId = `RM_${sanitizeId(rmName)}`;
      const vis = (rm?.visibleTo ?? []).join(',') || 'default';
      lines.push(`  ${rmId}["RM: ${escapeMermaidLabel(`${rmName} (${vis})`)}"]`);
      lines.push(`  ${mvId} --> ${rmId}`);
      addNode(rmId, `${rmName} (${vis})`, 'readModel', rm?.rowScope || '');
      graphEdges.push({ from: mvId, to: rmId, label: mv.strategy });
      for (const evRef of rm?.sourceEvents ?? []) {
        const evId = `EV_${sanitizeId(evRef)}`;
        lines.push(`  ${evId}["Event: ${escapeMermaidLabel(evRef)}"]`);
        lines.push(`  ${evId} --> ${mvId}`);
        addNode(evId, evRef, 'event');
        graphEdges.push({ from: evId, to: mvId, label: mv.refreshMode || 'stream' });
      }
    }
  }

  if (mvs.length === 0) {
    for (const rm of readModels) {
      const rmId = `RM_${sanitizeId(rm.name)}`;
      lines.push(`  ${rmId}["Logical RM: ${escapeMermaidLabel(rm.name)}"]`);
      addNode(rmId, rm.name, 'readModel', (rm.visibleTo ?? []).join(','));
      for (const evRef of rm.sourceEvents ?? []) {
        const evId = `EV_${sanitizeId(evRef)}`;
        lines.push(`  ${evId}["Event: ${escapeMermaidLabel(evRef)}"]`);
        lines.push(`  ${evId} --> ${rmId}`);
        addNode(evId, evRef, 'event');
        graphEdges.push({ from: evId, to: rmId, label: 'projects' });
      }
    }
  }

  const mermaid = lines.join('\n');
  return {
    id: 'readside-topology',
    space: 'solution',
    category: 'solution-readside',
    title: 'CQRS 读侧物理物化拓扑 (ReadSide Stream/Batch Topology)',
    subtitle: '事件流 → 流/批/流批一体共享物化视图 → 逻辑读模型（行级权限 & 字段脱敏）',
    summary: `${mvs.length} 张物理物化表 · 服务 ${readModels.length} 个逻辑读模型`,
    mermaid,
    markdown: `# Solution Space — ReadSide Physical Materialization\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'flow-graph',
      nodes: graphNodes,
      edges: graphEdges,
      materializedViews: mvs,
      readModels: readModels.map(r => ({
        name: r.name,
        visibleTo: r.visibleTo ?? [],
        rowScope: r.rowScope ?? null,
        fieldCount: (r.fields ?? []).length,
      })),
    },
  };
}

// ── 9. Solution Space: Layered Testing Strategy & Parallel TDD ──
export function buildTestingStrategyDiagram(canonical) {
  const t = canonical.testing ?? null;
  const lines = ['flowchart TB'];
  if (t?.layers) {
    lines.push(`  T_DOM["1. Domain: ${escapeMermaidLabel(t.layers.domain.harness)} · cov>=${t.layers.domain.minLineCoverage ?? '-'}% · mutation=${t.layers.domain.mutationGate}"]`);
    lines.push(`  T_APP["2. Application: ${escapeMermaidLabel(t.layers.application.harness)} · cov>=${t.layers.application.minLineCoverage ?? '-'}% · ${(t.layers.application.doubles ?? []).length} doubles"]`);
    lines.push(`  T_IF["3. Interfaces: ${escapeMermaidLabel(t.layers.interfaces.harness)} · authzMatrix=${t.layers.interfaces.verifyAuthzMatrix}"]`);
    lines.push(`  T_INF["4. Infrastructure: ${escapeMermaidLabel(t.layers.infrastructure.harness)} · requireTck=${t.layers.infrastructure.requireTck}"]`);
    lines.push(`  T_WT["Parallel TDD Isolation: workspaceMode=${escapeMermaidLabel(t.parallelTdd?.workspaceMode || 'share')}"]`);
    lines.push('  T_DOM --> T_APP --> T_IF --> T_INF --> T_WT');
  } else {
    lines.push('  T_DEF["Default v2 Gate: Z3 SMT + Locked Domain/App/Interfaces Oracles + Onion DIP"]');
  }

  const mermaid = lines.join('\n');
  return {
    id: 'testing-strategy',
    space: 'solution',
    category: 'solution-testing',
    title: '分层测试策略与并行 TDD 隔离 (Layered Testing & Worktree)',
    subtitle: '纯域无 Mock + 应用替身策略 + 接口鉴权实测 + 基础设施 TCK + Git Worktree 隔离',
    summary: t
      ? `Domain ${t.layers.domain.harness} · App ${t.layers.application.harness} · Worktree=${t.parallelTdd.workspaceMode}`
      : '使用默认 v2 锁定测试与 Z3 验证门禁',
    mermaid,
    markdown: `# Solution Space — Layered Testing Strategy\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'testing-strategy',
      testing: t,
    },
  };
}

// ── 10. Solution Space: BoundedContexts Deployment Topology ──
export function buildDeploymentTopologyDiagram(canonicals, domainMap = null, systemLineage = null) {
  const bcs = [];
  if (Array.isArray(domainMap?.boundedContexts) && domainMap.boundedContexts.length > 0) {
    for (const bc of domainMap.boundedContexts) {
      bcs.push({
        name: bc.name,
        deployableUnit: bc.deployableUnit || bc.name,
        subdomains: bc.subdomains ?? [],
      });
    }
  } else {
    const byBc = new Map();
    for (const c of canonicals) {
      const bcName = c.context || c.subdomain || 'default';
      if (!byBc.has(bcName)) byBc.set(bcName, []);
      byBc.get(bcName).push(c.subdomain || c.context);
    }
    for (const [name, subdomains] of byBc) {
      bcs.push({ name, deployableUnit: name, subdomains });
    }
  }

  const lines = ['flowchart LR'];
  for (const bc of bcs) {
    lines.push(`  subgraph BC_${sanitizeId(bc.name)}["BC: ${escapeMermaidLabel(bc.name)} (${escapeMermaidLabel(bc.deployableUnit)})"]`);
    for (const sd of bc.subdomains) {
      lines.push(`    SD_${sanitizeId(sd)}["Subdomain: ${escapeMermaidLabel(sd)}"]`);
    }
    lines.push('  end');
  }
  for (const it of systemLineage?.integrations ?? []) {
    const edgeOp = it.boundary === 'same-bc' ? '-->' : '==>';
    lines.push(`  SD_${sanitizeId(it.fromSubdomain)} ${edgeOp}|"${escapeMermaidLabel(`${it.boundary}: ${it.fromEvent}`)}"| SD_${sanitizeId(it.toSubdomain)}`);
  }

  const mermaid = lines.join('\n');
  let styleLabel = 'Single BoundedContext';
  if (bcs.length === 1 && bcs[0].subdomains.length > 1) {
    styleLabel = 'Modular Monolith (同进程多子域)';
  } else if (bcs.length > 1) {
    styleLabel = `Distributed Microservices (${bcs.length} BCs)`;
  }

  return {
    id: 'deployment-topology',
    space: 'solution',
    category: 'solution-deployment',
    title: '解决方案空间部署拓扑 (BoundedContexts Deployment)',
    subtitle: '问题空间子域 → 可演进限界上下文部署单元（单体 ↔ 微服务零改真源）',
    summary: `${styleLabel} · ${bcs.length} 个部署单元 · 承载 ${bcs.reduce((a, b) => a + b.subdomains.length, 0)} 个问题空间子域`,
    mermaid,
    markdown: `# Solution Space — BoundedContexts Deployment Topology\n\n\`\`\`mermaid\n${mermaid}\n\`\`\`\n`,
    structured: {
      kind: 'deployment-topology',
      style: styleLabel,
      boundedContexts: bcs,
      integrations: systemLineage?.integrations ?? [],
    },
  };
}

/**
 * Builds the complete unified Atlas Bundle across Problem Space and Solution Space.
 */
export function buildAtlasBundle({
  canonical = null,
  canonicals = null,
  systemLineage = null,
  domainMap = null,
  v1TreeDir = null,
  ingestJsonPath = null,
  title = null,
} = {}) {
  const diagrams = [];
  const canonicalList = [];
  if (Array.isArray(canonicals) && canonicals.length > 0) canonicalList.push(...canonicals);
  else if (canonical) canonicalList.push(canonical);

  let metaSystem = 'co-arising';
  let metaScope = 'atlas';
  let metaSha = '';

  // Legacy v1 tree or .ingest/*.json Event Matrix recovery mode
  if (v1TreeDir || ingestJsonPath) {
    const matrix = v1TreeDir
      ? extractEventMatrixFromV1Tree(v1TreeDir)
      : extractEventMatrixFromIngestJson(ingestJsonPath);
    metaSystem = matrix.system;
    metaScope = matrix.subdomain;
    diagrams.push({
      id: 'event-matrix',
      space: 'problem',
      category: '01-event-flow',
      title: '2D 事件矩阵与热点台账 (EventStorming Event Matrix)',
      subtitle: matrix.stats.recoveredFromAggregates > 0
        ? `已从 aggregates/*/notes/ 无损还原 ${matrix.stats.recoveredFromAggregates} 条被分散的事件便签`
        : 'Timeline 阶段 × Sequence 列序 × Step 并发泳道 + Pivotal 里程碑 + 热点裁决',
      summary: `${matrix.stats.timelineCount} 条时间线 · ${matrix.stats.eventCount} 条事件 · ${matrix.stats.pivotalCount} 个里程碑 · ${matrix.stats.hotspotCount} 个热点`,
      mermaid: renderEventMatrixMermaid(matrix),
      yamlSnippet: renderEventFlowYamlSnippet(matrix),
      markdown: renderEventMatrixMarkdown(matrix),
      structured: { kind: 'event-matrix', matrix },
    });
  }

  if (canonicalList.length > 0) {
    const primary = canonicalList[0];
    metaSystem = primary.system || 'co-arising';
    metaScope = canonicalList.length > 1
      ? canonicalList.map(c => c.subdomain || c.context).join(' + ')
      : (primary.subdomain || primary.context || 'core');
    metaSha = primary.canonicalSha256 || '';

    // Problem Space Diagrams
    if (!v1TreeDir && !ingestJsonPath) {
      const matrix = buildEventMatrixFromCanonical(primary);
      diagrams.push({
        id: 'event-matrix',
        space: 'problem',
        category: '01-event-flow',
        title: '2D 事件矩阵与热点台账 (Event Matrix)',
        subtitle: '横向时间线 × 并发泳道 × Pivotal 里程碑 + 命令/读模型/策略自动联动',
        summary: `${matrix.stats.timelineCount} 条时间线 · ${matrix.stats.eventCount} 条事件 · ${matrix.stats.pivotalCount} 个里程碑 · ${matrix.stats.hotspotCount} 个热点`,
        mermaid: renderEventMatrixMermaid(matrix),
        yamlSnippet: renderEventFlowYamlSnippet(matrix),
        markdown: renderEventMatrixMarkdown(matrix),
        structured: { kind: 'event-matrix', matrix },
      });
    }

    diagrams.push(buildStoryMapDiagram(primary));
    diagrams.push(buildUseCasesDiagram(primary));
    diagrams.push(buildDomainModelDiagram(primary));
    diagrams.push(buildFieldLineageDiagram(primary, systemLineage));
    diagrams.push(buildSubdomainMapDiagram(canonicalList, domainMap, systemLineage));

    // Solution Space Diagrams
    diagrams.push(buildOnionArchitectureDiagram(primary));
    diagrams.push(buildAuthzMatrixDiagram(primary));
    diagrams.push(buildReadSideDiagram(primary));
    diagrams.push(buildTestingStrategyDiagram(primary));
    diagrams.push(buildDeploymentTopologyDiagram(canonicalList, domainMap, systemLineage));
  }

  return {
    schemaVersion: 'co-arising.atlas-bundle/v1',
    title: title || `${metaSystem} (${metaScope}) · 真源与解空间统一图谱查看器`,
    meta: {
      system: metaSystem,
      scope: metaScope,
      canonicalSha256: metaSha,
      problemDiagramCount: diagrams.filter(d => d.space === 'problem').length,
      solutionDiagramCount: diagrams.filter(d => d.space === 'solution').length,
      totalDiagramCount: diagrams.length,
    },
    diagrams,
  };
}

/**
 * Emits all diagram artifacts (.mmd, .md, .csv, .cml, eventFlow.yaml, manifest) into outDir.
 */
export function emitDiagramBundleFiles(bundle, outDir) {
  const absDir = resolve(outDir);
  const mmdDir = join(absDir, 'diagrams');
  mkdirSync(mmdDir, { recursive: true });
  const written = [];

  for (const d of bundle.diagrams ?? []) {
    if (d.mermaid) {
      const mmdPath = join(mmdDir, `${d.id}.mmd`);
      writeFileSync(mmdPath, `${d.mermaid}\n`, 'utf8');
      written.push({ kind: 'mermaid', id: d.id, file: mmdPath });
    }
    if (d.id === 'event-matrix' && d.markdown) {
      const emPath = join(absDir, 'event-matrix.md');
      writeFileSync(emPath, d.markdown, 'utf8');
      written.push({ kind: 'event-matrix-md', id: d.id, file: emPath });
    }
    if (d.csv) {
      const csvPath = join(absDir, 'story-map.csv');
      writeFileSync(csvPath, d.csv, 'utf8');
      written.push({ kind: 'story-map-csv', id: d.id, file: csvPath });
    }
    if (d.cml) {
      const cmlPath = join(absDir, 'domain-map.cml');
      writeFileSync(cmlPath, d.cml, 'utf8');
      written.push({ kind: 'context-mapper-cml', id: d.id, file: cmlPath });
    }
  }

  const manifestPath = join(absDir, 'atlas-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify({
    schemaVersion: bundle.schemaVersion,
    title: bundle.title,
    meta: bundle.meta,
    diagrams: bundle.diagrams.map(d => ({
      id: d.id,
      space: d.space,
      category: d.category,
      title: d.title,
      summary: d.summary,
      hasCsv: Boolean(d.csv),
      hasCml: Boolean(d.cml),
    })),
  }, null, 2)}\n`, 'utf8');
  written.push({ kind: 'atlas-manifest', file: manifestPath });
  return written;
}
