// Local SQLite knowledge dependency graph store for co-arising 2.0 Canonical Model v2.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const STORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  layer TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS edges (
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relation)
);
CREATE TABLE IF NOT EXISTS cloze_slots (
  slot_id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  kind TEXT NOT NULL,
  layer TEXT NOT NULL,
  tier TEXT NOT NULL,
  rule_ids TEXT NOT NULL,
  provenance TEXT
);
CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id);
`;

export function writeV2KnowledgeGraph(dbFile, canonicalV2) {
  if (dbFile !== ':memory:') {
    mkdirSync(dirname(dbFile), { recursive: true });
  }
  const db = new DatabaseSync(dbFile);
  try {
    db.exec(STORE_SCHEMA);
    db.exec('BEGIN IMMEDIATE');
    db.exec('DELETE FROM metadata; DELETE FROM nodes; DELETE FROM edges; DELETE FROM cloze_slots;');

    const putMeta = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
    putMeta.run('schemaVersion', 'co-arising.knowledge-v2/v1');
    putMeta.run('system', canonicalV2.system);
    putMeta.run('context', canonicalV2.context);
    putMeta.run('canonicalSha256', canonicalV2.canonicalSha256);

    const putNode = db.prepare('INSERT OR REPLACE INTO nodes (id, kind, name, layer, payload) VALUES (?, ?, ?, ?, ?)');
    const putEdge = db.prepare('INSERT OR IGNORE INTO edges (from_id, to_id, relation) VALUES (?, ?, ?)');
    const putCloze = db.prepare(
      'INSERT OR REPLACE INTO cloze_slots (slot_id, target, kind, layer, tier, rule_ids, provenance) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );

    for (const ex of canonicalV2.structures.exactTypes) {
      putNode.run(`exact:${ex.name}`, 'exact-type', ex.name, 'domain', JSON.stringify(ex));
    }
    for (const vo of canonicalV2.structures.valueObjects) {
      putNode.run(`vo:${vo.name}`, 'value-object', vo.name, 'domain', JSON.stringify(vo));
    }
    for (const rm of canonicalV2.structures.readModels) {
      putNode.run(`readmodel:${rm.name}`, 'read-model', rm.name, 'application', JSON.stringify(rm));
    }
    for (const port of canonicalV2.structures.ports) {
      putNode.run(`port:${port.name}`, 'port', port.name, 'application', JSON.stringify(port));
    }
    for (const agg of canonicalV2.structures.aggregates) {
      const aggId = `agg:${agg.name}`;
      putNode.run(aggId, 'aggregate', agg.name, 'domain', JSON.stringify(agg));
      for (const cmd of agg.commands) {
        const cmdId = `cmd:${agg.name}.${cmd.name}`;
        putNode.run(cmdId, 'command', `${agg.name}.${cmd.name}`, 'domain', JSON.stringify(cmd));
        putEdge.run(aggId, cmdId, 'handles');
      }
      for (const ev of agg.events) {
        const evId = `event:${agg.name}.${ev.name}`;
        putNode.run(evId, 'event', `${agg.name}.${ev.name}`, 'domain', JSON.stringify(ev));
        putEdge.run(aggId, evId, 'emits');
      }
    }

    for (const beh of canonicalV2.behaviors) {
      const behId = `behavior:${beh.target}`;
      putNode.run(behId, 'behavior', beh.target, beh.layer, JSON.stringify({
        target: beh.target,
        kind: beh.kind,
        layer: beh.layer,
        sourceFile: beh.sourceFile,
        theory: beh.theory,
        verification: beh.verification,
      }));
      if (beh.kind === 'slice') {
        const aggName = beh.target.split('.')[0];
        putEdge.run(behId, `agg:${aggName}`, 'governs');
      }
      for (const rule of beh.rules) {
        const ruleId = `rule:${beh.target}#${rule.id}`;
        putNode.run(ruleId, 'rule', rule.id, beh.layer, JSON.stringify({
          id: rule.id,
          command: rule.command,
          firstHitOrder: rule.firstHitOrder,
          actions: rule.actions,
        }));
        putEdge.run(behId, ruleId, 'contains_rule');
        for (const action of rule.actions) {
          if (action.kind === 'dispatch' && action.target) {
            const targetAgg = action.target.split('.')[0];
            putEdge.run(behId, `agg:${targetAgg}`, 'dispatches');
          }
          if (action.kind === 'expose' && action.view) {
            putEdge.run(behId, `readmodel:${action.view}`, 'exposes');
          }
        }
      }
    }

    for (const slot of canonicalV2.clozeSlots) {
      putCloze.run(
        slot.slotId,
        slot.target,
        slot.kind,
        slot.layer,
        slot.tier,
        JSON.stringify(slot.ruleIds),
        null,
      );
      putEdge.run(`cloze:${slot.slotId}`, `behavior:${slot.target}`, 'implements_cloze');
      putNode.run(`cloze:${slot.slotId}`, 'cloze-slot', slot.slotId, slot.layer, JSON.stringify(slot));
    }

    db.exec('COMMIT');

    const nodeCount = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const edgeCount = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    return { file: dbFile, nodeCount, edgeCount, clozeCount: canonicalV2.clozeSlots.length };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    db.close();
  }
}

export function queryV2KnowledgeNeighbors(dbFile, nodeId) {
  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    const nodeRow = db.prepare('SELECT * FROM nodes WHERE id = ?').get(nodeId);
    const outgoing = db.prepare('SELECT to_id AS target, relation FROM edges WHERE from_id = ?').all(nodeId);
    const incoming = db.prepare('SELECT from_id AS source, relation FROM edges WHERE to_id = ?').all(nodeId);
    const relatedIds = [...new Set([...outgoing.map(r => r.target), ...incoming.map(r => r.source)])];
    const relatedNodes = relatedIds
      .map(id => db.prepare('SELECT * FROM nodes WHERE id = ?').get(id))
      .filter(Boolean)
      .map(r => ({ ...r, payload: JSON.parse(r.payload) }));
    return {
      node: nodeRow ? { ...nodeRow, payload: JSON.parse(nodeRow.payload) } : null,
      outgoing,
      incoming,
      relatedNodes,
    };
  } finally {
    db.close();
  }
}

export function recordClozeProvenance(dbFile, slotId, provenanceRecord) {
  const db = new DatabaseSync(dbFile);
  try {
    db.prepare('UPDATE cloze_slots SET provenance = ? WHERE slot_id = ?').run(JSON.stringify(provenanceRecord), slotId);
    return true;
  } finally {
    db.close();
  }
}
