// Multi-Subdomain Field Lineage, Cross-Subdomain PII Taint Tracking, and Bounded-Context
// Topology Verifier powered by Node 22 built-in SQLite (`node:sqlite` + `WITH RECURSIVE`).
//
// Problem Space: Subdomains (`subdomain`) & Domain Integrations (`domain-map.yaml`) stay stable.
// Solution Space: Bounded Contexts (`boundedContexts`) map Subdomains -> deployable services
// and can split/merge freely without breaking business truth or field lineage.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { formatType, isTypeCompatible } from '../ears/type-compat.mjs';
import { resolveCanonicalEventFields } from './structure-loader.mjs';
import { collectExprPathRoots } from './lineage.mjs';

const SYSTEM_GRAPH_SCHEMA = `
CREATE TABLE IF NOT EXISTS field_nodes (
  id TEXT PRIMARY KEY,
  subdomain TEXT NOT NULL,
  kind TEXT NOT NULL,
  owner TEXT NOT NULL,
  field TEXT NOT NULL,
  type_str TEXT NOT NULL,
  sensitivity TEXT
);
CREATE TABLE IF NOT EXISTS field_edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  meta TEXT,
  PRIMARY KEY (from_id, to_id, relation)
);
CREATE TABLE IF NOT EXISTS subdomain_edges (
  from_subdomain TEXT NOT NULL,
  to_subdomain TEXT NOT NULL,
  integration_id TEXT NOT NULL,
  PRIMARY KEY (from_subdomain, to_subdomain, integration_id)
);
CREATE INDEX IF NOT EXISTS idx_field_edges_from ON field_edges(from_id);
CREATE INDEX IF NOT EXISTS idx_field_edges_to ON field_edges(to_id);
`;

function subdomainKey(canonical) {
  return String(canonical.subdomain ?? canonical.context ?? 'default');
}

function indexSubdomainIntoDb(db, canonical) {
  const sub = subdomainKey(canonical);
  const putNode = db.prepare(
    'INSERT OR REPLACE INTO field_nodes (id, subdomain, kind, owner, field, type_str, sensitivity) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const putEdge = db.prepare(
    'INSERT OR IGNORE INTO field_edges (from_id, to_id, relation, meta) VALUES (?, ?, ?, ?)',
  );

  const structs = canonical.structures ?? {};
  const aggByName = new Map((structs.aggregates ?? []).map(a => [a.name, a]));
  const eventFieldLookup = new Map(); // "Agg.Ev" -> Map(field -> fieldObj)
  const cmdParamLookup = new Map(); // "Agg.Cmd" -> Map(param -> paramObj)
  const portParamLookup = new Map(); // "Port.op" -> Map(param -> paramObj)
  const rmFieldLookup = new Map(); // "rmName" -> Map(field -> fieldObj)

  // 1. Aggregates: stateFields, commands, events
  for (const agg of structs.aggregates ?? []) {
    for (const sf of agg.stateFields ?? []) {
      putNode.run(`${sub}:state:${agg.name}.${sf.name}`, sub, 'state-field', agg.name, sf.name, formatType(sf.resolvedType), sf.sensitivity ?? null);
    }
    for (const cmd of agg.commands ?? []) {
      const pMap = new Map();
      for (const p of cmd.parameters ?? []) {
        pMap.set(p.name, p);
        putNode.run(`${sub}:cmd:${agg.name}.${cmd.name}.${p.name}`, sub, 'cmd-param', `${agg.name}.${cmd.name}`, p.name, formatType(p.resolvedType), null);
      }
      cmdParamLookup.set(`${agg.name}.${cmd.name}`, pMap);
    }
    for (const ev of agg.events ?? []) {
      const fMap = new Map();
      for (const f of resolveCanonicalEventFields(agg, ev)) {
        fMap.set(f.name, f);
        putNode.run(`${sub}:event:${agg.name}.${ev.name}.${f.name}`, sub, 'event-field', `${agg.name}.${ev.name}`, f.name, formatType(f.resolvedType), f.sensitivity ?? null);
      }
      eventFieldLookup.set(`${agg.name}.${ev.name}`, fMap);
    }
  }

  // 2. Ports & public endpoints
  for (const port of structs.ports ?? []) {
    for (const op of port.operations ?? []) {
      const opKey = `${port.name}.${op.name}`;
      const pMap = new Map();
      for (const p of op.parameters ?? []) {
        pMap.set(p.name, p);
        putNode.run(`${sub}:port:${opKey}.${p.name}`, sub, 'port-param', opKey, p.name, formatType(p.resolvedType), null);
      }
      portParamLookup.set(opKey, pMap);
      const isPublic = op.authz?.mode === 'public' || op.callerKind === 'anonymous';
      if (isPublic) {
        putNode.run(`${sub}:public-port:${opKey}`, sub, 'public-port', port.name, op.name, String(op.returns ?? 'Unit'), 'public');
      }
    }
  }

  // 3. ReadModels + edges from state/event -> readModel -> public-port
  for (const rm of structs.readModels ?? []) {
    const fMap = new Map();
    for (const f of rm.fields ?? []) {
      fMap.set(f.name, f);
      const rmNodeId = `${sub}:readmodel:${rm.name}.${f.name}`;
      putNode.run(rmNodeId, sub, 'readmodel-field', rm.name, f.name, formatType(f.resolvedType), f.sensitivity ?? null);
      if (f.source && f.source.startsWith('stateField:')) {
        const ref = f.source.slice('stateField:'.length).trim();
        const parts = ref.split('.');
        const aggName = parts.length === 2 ? parts[0] : rm.sourceAggregate;
        const sfName = parts.length === 2 ? parts[1] : parts[0];
        if (aggName && sfName) {
          putEdge.run(`${sub}:state:${aggName}.${sfName}`, rmNodeId, 'projects_to', null);
        }
      } else if (f.source && f.source.startsWith('eventField:')) {
        const ref = f.source.slice('eventField:'.length).trim();
        const parts = ref.split('.');
        let aggName = rm.sourceAggregate ?? null;
        let evName = null;
        let fName = null;
        if (parts.length === 3) {
          [aggName, evName, fName] = parts;
        } else if (parts.length === 2) {
          [evName, fName] = parts;
          if (!aggName) {
            const matchAgg = (structs.aggregates ?? []).find(a => (a.events ?? []).some(e => e.name === evName));
            aggName = matchAgg?.name ?? null;
          }
        }
        if (aggName && evName && fName) {
          putEdge.run(`${sub}:event:${aggName}.${evName}.${fName}`, rmNodeId, 'projects_to', null);
        }
      }
    }
    rmFieldLookup.set(rm.name, fMap);
  }

  // Link readModels returned by public ports -> public-port node
  for (const port of structs.ports ?? []) {
    for (const op of port.operations ?? []) {
      const isPublic = op.authz?.mode === 'public' || op.callerKind === 'anonymous';
      if (!isPublic || !rmFieldLookup.has(op.returns)) continue;
      const pubNodeId = `${sub}:public-port:${port.name}.${op.name}`;
      for (const fName of rmFieldLookup.get(op.returns).keys()) {
        putEdge.run(`${sub}:readmodel:${op.returns}.${fName}`, pubNodeId, 'exposed_by_public_port', null);
      }
    }
  }

  // 4. Intra-subdomain Command/State -> Event propagations
  for (const beh of canonical.behaviors ?? []) {
    if (beh.kind !== 'slice') continue;
    const aggName = beh.target.split('.')[0];
    for (const prop of beh.eventPropagations ?? []) {
      for (const b of prop.bindings ?? []) {
        const evFieldId = `${sub}:event:${aggName}.${prop.event}.${b.eventField}`;
        if (b.source === '@PROPAGATED' && b.paramName) {
          putEdge.run(`${sub}:cmd:${aggName}.${prop.command}.${b.paramName}`, evFieldId, 'propagates', prop.ruleId);
        } else if (b.source === '@FROM_STATE' && b.stateField) {
          putEdge.run(`${sub}:state:${aggName}.${b.stateField}`, evFieldId, 'snapshots', prop.ruleId);
        }
      }
    }
  }

  // 5. Intra-subdomain Event -> State folds
  for (const fold of canonical.eventFolds ?? []) {
    const agg = aggByName.get(fold.aggregate);
    const aliases = new Set(agg?.aliases ?? ['state']);
    for (const assign of fold.assignments ?? []) {
      const segs = assign.target?.segments ?? [];
      const targetRoot = segs.length > 1 && aliases.has(segs[0]) ? segs[1] : segs[0];
      if (!targetRoot) continue;
      const stateNodeId = `${sub}:state:${fold.aggregate}.${targetRoot}`;
      const roots = [];
      if (assign.target?.index) collectExprPathRoots(assign.target.index, roots);
      collectExprPathRoots(assign.value, roots);
      for (const chain of roots) {
        if (chain.length === 0) continue;
        if (chain.length > 1 && aliases.has(chain[0])) {
          if (chain[1] !== targetRoot) {
            putEdge.run(`${sub}:state:${fold.aggregate}.${chain[1]}`, stateNodeId, 'folds_into', fold.event);
          }
        } else {
          putEdge.run(`${sub}:event:${fold.aggregate}.${fold.event}.${chain[0]}`, stateNodeId, 'folds_into', fold.event);
        }
      }
    }
  }

  // 6. Intra-subdomain Port/Event -> Command dispatches
  for (const disp of canonical.lineage?.dispatches ?? []) {
    for (const b of disp.bindings ?? []) {
      if (b.source !== '@PROPAGATED') continue;
      const toId = `${sub}:cmd:${disp.target}.${b.param}`;
      if (disp.trigger && portParamLookup.has(disp.trigger)) {
        putEdge.run(`${sub}:port:${disp.trigger}.${b.param}`, toId, 'dispatches', disp.ruleId);
      } else if (disp.trigger && eventFieldLookup.has(disp.trigger)) {
        putEdge.run(`${sub}:event:${disp.trigger}.${b.param}`, toId, 'dispatches', disp.ruleId);
      }
    }
  }

  return {
    subdomain: sub,
    canonical,
    eventFieldLookup,
    cmdParamLookup,
    portParamLookup,
    rmFieldLookup,
  };
}

export function traceFieldLineage(db, fieldId, { maxHops = 16 } = {}) {
  const upstreamRows = db.prepare(`
    WITH RECURSIVE up(cur_id, path, hops) AS (
      SELECT from_id, from_id || ' -> ' || to_id, 1
      FROM field_edges
      WHERE to_id = ?
      UNION ALL
      SELECT e.from_id, e.from_id || ' -> ' || u.path, u.hops + 1
      FROM up u
      JOIN field_edges e ON e.to_id = u.cur_id
      WHERE u.hops < ? AND instr(u.path, e.from_id) = 0
    )
    SELECT cur_id AS nodeId, path, hops FROM up ORDER BY hops ASC, path ASC
  `).all(fieldId, maxHops);

  const downstreamRows = db.prepare(`
    WITH RECURSIVE down(cur_id, path, hops) AS (
      SELECT to_id, from_id || ' -> ' || to_id, 1
      FROM field_edges
      WHERE from_id = ?
      UNION ALL
      SELECT e.to_id, d.path || ' -> ' || e.to_id, d.hops + 1
      FROM down d
      JOIN field_edges e ON e.from_id = d.cur_id
      WHERE d.hops < ? AND instr(d.path, e.to_id) = 0
    )
    SELECT cur_id AS nodeId, path, hops FROM down ORDER BY hops ASC, path ASC
  `).all(fieldId, maxHops);

  return {
    fieldId,
    upstream: upstreamRows,
    downstream: downstreamRows,
  };
}

function resolveDownstreamTarget(dsInfo, targetRef) {
  if (dsInfo.cmdParamLookup.has(targetRef)) {
    return { kind: 'command', prefix: `${dsInfo.subdomain}:cmd:${targetRef}`, fields: dsInfo.cmdParamLookup.get(targetRef) };
  }
  if (dsInfo.portParamLookup.has(targetRef)) {
    return { kind: 'port', prefix: `${dsInfo.subdomain}:port:${targetRef}`, fields: dsInfo.portParamLookup.get(targetRef) };
  }
  if (dsInfo.rmFieldLookup.has(targetRef)) {
    return { kind: 'readmodel', prefix: `${dsInfo.subdomain}:readmodel:${targetRef}`, fields: dsInfo.rmFieldLookup.get(targetRef) };
  }
  return null;
}

export function renderSystemLineageMarkdown(report) {
  const lines = [
    `# System Multi-Subdomain Field Lineage & Compliance Report (${report.system})`,
    '',
    `- **Status**: \`${report.passed ? 'PASS' : 'BLOCKED'}\``,
    `- **Subdomains**: ${report.subdomains.join(', ')}`,
    `- **Integrations**: ${report.integrations.length} (${report.integrations.filter(i => i.boundaryKind === 'cross-bc').length} cross-BC, ${report.integrations.filter(i => i.boundaryKind === 'same-bc').length} same-BC)`,
    `- **PII Taint Leaks**: ${report.piiLeaks.length}`,
    `- **Cycles**: ${report.cycles.length}`,
    '',
    '## 1. Subdomain Topology & Bounded Context Deployment Map',
    '',
    '```mermaid',
    'flowchart LR',
  ];

  const bcList = report.boundedContexts ?? [];
  const hosted = new Set();
  for (const bc of bcList) {
    const bcId = bc.name.replace(/[^A-Za-z0-9_]/gu, '_');
    lines.push(`  subgraph ${bcId}["BC: ${bc.name}"]`);
    for (const s of bc.subdomains) {
      hosted.add(s);
      const sId = s.replace(/[^A-Za-z0-9_]/gu, '_');
      lines.push(`    sub_${sId}["Subdomain: ${s}"]`);
    }
    lines.push('  end');
  }
  for (const s of report.subdomains) {
    if (!hosted.has(s)) {
      const sId = s.replace(/[^A-Za-z0-9_]/gu, '_');
      lines.push(`  sub_${sId}["Subdomain: ${s}"]`);
    }
  }
  for (const integ of report.integrations) {
    const fromId = `sub_${integ.upstreamSubdomain.replace(/[^A-Za-z0-9_]/gu, '_')}`;
    const toId = `sub_${integ.downstreamSubdomain.replace(/[^A-Za-z0-9_]/gu, '_')}`;
    const label = `${integ.upstreamEvent} -> ${integ.downstreamTarget} (${integ.boundaryKind})`;
    lines.push(`  ${fromId} -->|"${label}"| ${toId}`);
  }
  lines.push('```', '');

  if (report.integrations.length > 0) {
    lines.push('## 2. Cross-Subdomain ACL Field Mappings', '');
    lines.push('| Integration | Upstream Event | Downstream Target | Boundary | Field Mappings |');
    lines.push('| :--- | :--- | :--- | :---: | :--- |');
    for (const integ of report.integrations) {
      const mapStr = (integ.fieldMappings ?? []).map(m => `${m.from} -> ${m.to}`).join(', ') || '—';
      lines.push(`| \`${integ.id}\` | \`${integ.upstreamSubdomain}.${integ.upstreamEvent}\` | \`${integ.downstreamSubdomain}.${integ.downstreamTarget}\` | \`${integ.boundaryKind}\` | ${mapStr} |`);
    }
    lines.push('');
  }

  if (report.piiLeaks.length > 0) {
    lines.push('## 3. Multi-Hop PII / Secret Taint Leaks (BLOCKED)', '');
    for (const leak of report.piiLeaks) {
      lines.push(`- **[${leak.reason}]** \`${leak.path}\``);
    }
    lines.push('');
  }

  if (report.diagnostics.length > 0) {
    lines.push('## 4. Diagnostics', '');
    for (const d of report.diagnostics) {
      lines.push(`- **[${d.severity.toUpperCase()}] \`${d.code}\`**: ${d.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function auditSystemLineageV2({
  canonicals = [],
  domainMap = null,
  domainMapPath = null,
  dbFile = ':memory:',
  outJson = null,
  outMd = null,
  strictLineage = false,
} = {}) {
  const loadedCanonicals = canonicals.map(item => (
    typeof item === 'string' ? JSON.parse(readFileSync(resolve(item), 'utf8')) : item
  ));
  let mapDoc = domainMap;
  if (!mapDoc && domainMapPath) {
    mapDoc = parseStructuredDoc(readFileSync(resolve(domainMapPath), 'utf8'), resolve(domainMapPath));
  }

  const diagnostics = [];
  const coverageSeverity = strictLineage ? 'error' : 'warning';

  if (dbFile !== ':memory:') {
    mkdirSync(dirname(resolve(dbFile)), { recursive: true });
  }
  const db = new DatabaseSync(dbFile === ':memory:' ? ':memory:' : resolve(dbFile));
  try {
    db.exec(SYSTEM_GRAPH_SCHEMA);
    db.exec('DELETE FROM field_nodes; DELETE FROM field_edges; DELETE FROM subdomain_edges;');

    const subMap = new Map();
    for (const c of loadedCanonicals) {
      const info = indexSubdomainIntoDb(db, c);
      subMap.set(info.subdomain, info);
    }

    const system = mapDoc?.system ?? loadedCanonicals[0]?.system ?? 'default-system';

    // 1. Validate optional Solution-Space Bounded Context deployment topology
    const subdomainToBc = new Map();
    const boundedContexts = [];
    for (const bc of mapDoc?.boundedContexts ?? []) {
      const bcName = String(bc.name ?? '').trim();
      const subs = Array.isArray(bc.subdomains) ? bc.subdomains.map(String) : [];
      for (const s of subs) {
        if (!subMap.has(s)) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_SYSTEM_UNKNOWN_SUBDOMAIN',
            message: `boundedContext "${bcName}" hosts unknown subdomain "${s}"`,
          });
        } else if (subdomainToBc.has(s)) {
          diagnostics.push({
            severity: 'error',
            code: 'V2_SYSTEM_DUPLICATE_SUBDOMAIN_HOSTING',
            message: `subdomain "${s}" is hosted by multiple boundedContexts ("${subdomainToBc.get(s)}" and "${bcName}")`,
          });
        } else {
          subdomainToBc.set(s, bcName);
        }
      }
      boundedContexts.push({ name: bcName, subdomains: subs });
    }

    // 2. Validate & index Problem-Space Subdomain integrations (ACL field edges)
    const putFieldEdge = db.prepare('INSERT OR IGNORE INTO field_edges (from_id, to_id, relation, meta) VALUES (?, ?, ?, ?)');
    const putSubEdge = db.prepare('INSERT OR IGNORE INTO subdomain_edges (from_subdomain, to_subdomain, integration_id) VALUES (?, ?, ?)');
    const integrations = [];

    for (const rawInteg of mapDoc?.integrations ?? []) {
      const id = String(rawInteg.id ?? '').trim();
      const upSub = String(rawInteg.upstreamSubdomain ?? rawInteg.upstreamContext ?? '').trim();
      const upEv = String(rawInteg.upstreamEvent ?? '').trim();
      const dnSub = String(rawInteg.downstreamSubdomain ?? rawInteg.downstreamContext ?? '').trim();
      const dnTarget = String(rawInteg.downstreamTarget ?? '').trim();

      const upBc = subdomainToBc.get(upSub) ?? upSub;
      const dnBc = subdomainToBc.get(dnSub) ?? dnSub;
      const boundaryKind = upBc === dnBc ? 'same-bc' : 'cross-bc';

      const upInfo = subMap.get(upSub) ?? null;
      const dnInfo = subMap.get(dnSub) ?? null;
      if (!upInfo) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_SYSTEM_UNKNOWN_SUBDOMAIN',
          message: `integration "${id}" references unknown upstreamSubdomain "${upSub}"`,
        });
      }
      if (!dnInfo) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_SYSTEM_UNKNOWN_SUBDOMAIN',
          message: `integration "${id}" references unknown downstreamSubdomain "${dnSub}"`,
        });
      }
      if (!upInfo || !dnInfo) continue;

      putSubEdge.run(upSub, dnSub, id || `${upSub}->${dnSub}`);

      const upFields = upInfo.eventFieldLookup.get(upEv) ?? null;
      if (!upFields) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_SYSTEM_UNKNOWN_UPSTREAM_EVENT',
          message: `integration "${id}" references undeclared upstreamEvent "${upEv}" in subdomain "${upSub}"`,
        });
      }
      const dnResolved = resolveDownstreamTarget(dnInfo, dnTarget);
      if (!dnResolved) {
        diagnostics.push({
          severity: 'error',
          code: 'V2_SYSTEM_UNKNOWN_DOWNSTREAM_TARGET',
          message: `integration "${id}" references undeclared downstreamTarget "${dnTarget}" in subdomain "${dnSub}"`,
        });
      }

      const mappedDownstreamFields = new Set();
      const normalizedMappings = [];
      if (upFields && dnResolved) {
        for (const fm of rawInteg.fieldMappings ?? []) {
          const fromField = String(fm.from ?? '').trim();
          const toField = String(fm.to ?? fromField).trim();
          const srcObj = upFields.get(fromField) ?? null;
          const dstObj = dnResolved.fields.get(toField) ?? null;
          if (!srcObj) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_SYSTEM_UNKNOWN_FIELD',
              message: `integration "${id}" maps missing upstream field "${fromField}" on "${upSub}.${upEv}"`,
            });
            continue;
          }
          if (!dstObj) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_SYSTEM_UNKNOWN_FIELD',
              message: `integration "${id}" maps to missing downstream field "${toField}" on "${dnSub}.${dnTarget}"`,
            });
            continue;
          }
          const compat = isTypeCompatible(srcObj.resolvedType, dstObj.resolvedType, {
            allowOptionalWrap: true,
            allowNumericPromotion: false,
            exactScale: true,
            allowUnitDecimalUnwrap: true,
            strictNominal: false,
          });
          if (!compat) {
            diagnostics.push({
              severity: 'error',
              code: 'V2_SYSTEM_FIELD_TYPE_MISMATCH',
              message: `integration "${id}" maps "${upSub}.${upEv}.${fromField}" (${formatType(srcObj.resolvedType)}) to incompatible downstream "${dnSub}.${dnTarget}.${toField}" (${formatType(dstObj.resolvedType)})`,
            });
          }
          mappedDownstreamFields.add(toField);
          normalizedMappings.push({
            from: fromField,
            to: toField,
            fromType: formatType(srcObj.resolvedType),
            toType: formatType(dstObj.resolvedType),
          });
          putFieldEdge.run(
            `${upSub}:event:${upEv}.${fromField}`,
            `${dnResolved.prefix}.${toField}`,
            'cross_subdomain_acl',
            id,
          );
        }

        if (dnResolved.kind === 'command') {
          for (const [paramName, paramObj] of dnResolved.fields) {
            if (!mappedDownstreamFields.has(paramName) && paramObj.resolvedType?.kind !== 'optional') {
              diagnostics.push({
                severity: coverageSeverity,
                code: 'V2_SYSTEM_UNBOUND_DOWNSTREAM_PARAM',
                message: `integration "${id}" targets command "${dnSub}.${dnTarget}" requiring parameter "${paramName}: ${formatType(paramObj.resolvedType)}" that is not bound by fieldMappings`,
              });
            }
          }
        }
      }

      integrations.push({
        id,
        upstreamSubdomain: upSub,
        upstreamEvent: upEv,
        downstreamSubdomain: dnSub,
        downstreamTarget: dnTarget,
        upstreamBc: upBc,
        downstreamBc: dnBc,
        boundaryKind,
        fieldMappings: normalizedMappings,
      });
    }

    // 3. Recursive Datalog/CTE Multi-Hop PII / Secret Taint Tracking across Subdomains
    const taintRows = db.prepare(`
      WITH RECURSIVE taint(start_id, start_sub, start_sens, current_id, path, hops) AS (
        SELECT id, subdomain, sensitivity, id, id, 0
        FROM field_nodes
        WHERE sensitivity IN ('pii', 'secret')
        UNION ALL
        SELECT t.start_id, t.start_sub, t.start_sens, e.to_id, t.path || ' -> ' || e.to_id, t.hops + 1
        FROM taint t
        JOIN field_edges e ON e.from_id = t.current_id
        WHERE t.hops < 16 AND instr(t.path, e.to_id) = 0
      )
      SELECT t.start_id, t.start_sub, t.start_sens, t.current_id,
             n.subdomain AS end_sub, n.kind AS end_kind, n.sensitivity AS end_sens, t.path, t.hops
      FROM taint t
      JOIN field_nodes n ON n.id = t.current_id
      WHERE t.hops > 0
    `).all();

    const piiLeaks = [];
    const seenLeaks = new Set();
    for (const row of taintRows) {
      const endSubInfo = subMap.get(row.end_sub);
      const endCompliance = endSubInfo?.canonical?.structures?.compliance ?? null;
      let reason = null;
      if (row.end_kind === 'public-port' || (row.end_kind === 'readmodel-field' && row.end_sens === 'public')) {
        reason = 'tainted-pii-reaches-public-surface';
      } else if (
        row.start_sens === 'pii'
        && row.end_kind === 'event-field'
        && row.end_sub !== row.start_sub
        && row.end_sens !== 'tokenized-pii'
        && endCompliance?.erasureRequired === true
        && endCompliance?.piiStrategy !== 'statutory-retention'
      ) {
        reason = 'cross-subdomain-pii-reaches-erasable-immutable-event';
      }
      if (reason) {
        const key = `${reason}|${row.start_id}|${row.current_id}`;
        if (!seenLeaks.has(key)) {
          seenLeaks.add(key);
          piiLeaks.push({
            reason,
            startId: row.start_id,
            endId: row.current_id,
            hops: row.hops,
            path: row.path,
          });
          diagnostics.push({
            severity: 'error',
            code: 'V2_SYSTEM_CROSS_SUBDOMAIN_PII_LEAK',
            message: `${reason} (${row.hops} hop(s)): ${row.path}`,
          });
        }
      }
    }

    // 4. Recursive Subdomain Cycle Detection
    const cycleRows = db.prepare(`
      WITH RECURSIVE walk(start_sub, cur_sub, path, hops) AS (
        SELECT from_subdomain, to_subdomain, from_subdomain || ' -> ' || to_subdomain, 1
        FROM subdomain_edges
        UNION ALL
        SELECT w.start_sub, e.to_subdomain, w.path || ' -> ' || e.to_subdomain, w.hops + 1
        FROM walk w
        JOIN subdomain_edges e ON e.from_subdomain = w.cur_sub
        WHERE w.hops < 16 AND w.cur_sub != w.start_sub
          AND (e.to_subdomain = w.start_sub OR instr(w.path, ' -> ' || e.to_subdomain || ' -> ') = 0)
      )
      SELECT DISTINCT start_sub, path FROM walk WHERE cur_sub = start_sub
    `).all();

    const cycles = [];
    const seenCycleSets = new Set();
    for (const row of cycleRows) {
      const members = row.path.split(' -> ').slice(0, -1).sort().join(',');
      if (seenCycleSets.has(members)) continue;
      seenCycleSets.add(members);
      cycles.push(row.path);
      diagnostics.push({
        severity: 'error',
        code: 'V2_SYSTEM_SUBDOMAIN_CYCLE',
        message: `cyclic subdomain integration loop detected: ${row.path}`,
      });
    }

    const nodeCount = db.prepare('SELECT COUNT(*) AS c FROM field_nodes').get().c;
    const edgeCount = db.prepare('SELECT COUNT(*) AS c FROM field_edges').get().c;
    const passed = diagnostics.filter(d => d.severity === 'error').length === 0;

    const report = {
      schemaVersion: 'co-arising.system-lineage/v2',
      system,
      passed,
      subdomains: [...subMap.keys()],
      boundedContexts,
      integrations,
      graphStats: { nodeCount, edgeCount },
      piiLeaks,
      cycles,
      diagnostics,
      trace: (fieldId) => traceFieldLineage(db, fieldId),
    };

    if (outJson) {
      const absOut = resolve(outJson);
      mkdirSync(dirname(absOut), { recursive: true });
      const { trace: _t, ...serializable } = report;
      writeFileSync(absOut, JSON.stringify(serializable, null, 2) + '\n', 'utf8');
    }
    if (outMd) {
      const absMd = resolve(outMd);
      mkdirSync(dirname(absMd), { recursive: true });
      writeFileSync(absMd, renderSystemLineageMarkdown(report), 'utf8');
    }

    // Detach db-bound trace if db is closing; keep trace callable only if caller didn't ask to close, or expose snapshot
    const { trace: _traceFn, ...serializableReport } = report;
    const sampleTraces = {};
    if (piiLeaks.length > 0) {
      for (const leak of piiLeaks) {
        sampleTraces[leak.endId] = traceFieldLineage(db, leak.endId);
      }
    }

    return {
      ...serializableReport,
      ...(Object.keys(sampleTraces).length > 0 ? { leakTraces: sampleTraces } : {}),
    };
  } finally {
    db.close();
  }
}
