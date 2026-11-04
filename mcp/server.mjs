#!/usr/bin/env node
// truthsrc mcp — MCP stdio server over lib/query.mjs.
//
// Exposes every query verb as an MCP tool: the 10 base verbs
// (describe/expand/blast_radius/lineage/anchors/search/conditions/diff/
// orphans/consistency_check) plus the 12 registry-derived named verbs.
// Verbs are grown from the relation registry, not designed — when
// lib/query.mjs grows a verb, add its entry to TOOLS below.
//
// Transport: JSON-RPC 2.0 over stdio. Zero dependencies; Node >= 18.
//
// Each tool takes a tree source — `canonical` (path to compiled
// canonical.json, preferred) or `tree` (path to a truth tree dir, compiled
// in-memory) — plus the verb's own args, and returns the standard envelope
// {summary, result, next_actions[], budget{depth_used, nodes_visited}}.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  loadCanonical, buildGraph,
  describe, expand, blast_radius, lineage, anchors, search, conditions,
  diff, orphans, consistency_check,
  slices_of, events_of, commands_of, read_models_of, policies_triggered_by,
  policies_constraining, steps_of, participants_of, consumed_by,
  trigger_source_of, aggregates_referencing, contexts_depending_on,
  sagaParticipantsOf, sagaPhasesOf,
} from '../lib/query.mjs';
import { compileTree } from '../lib/compile.mjs';

const SOURCE_PROPS = {
  canonical: { type: 'string', description: 'Path to compiled canonical.json (preferred).' },
  tree: { type: 'string', description: 'Path to a truth tree directory (compiled in-memory). One of canonical/tree/store is required.' },
  store: { type: 'string', description: 'Path to a truthsrc.graphstore/v1 SQLite file (requires Node >= 22.5; fails with a clear error below that).' },
};

async function graphFor(args) {
  if (args.canonical) return buildGraph(loadCanonical(resolve(args.canonical)));
  if (args.tree) return buildGraph(JSON.parse(compileTree(resolve(args.tree))));
  if (args.store) {
    // Lazy import keeps the Node >= 18 baseline safe: graphstore only loads (and
    // only demands node:sqlite) when a caller actually selects the store source.
    const { graphFromStore } = await import('../lib/graphstore.mjs');
    return graphFromStore(resolve(args.store));
  }
  throw new Error('one of "canonical", "tree" or "store" is required');
}

const T = (name, description, properties, required, fn) => ({ name, description, properties, required, fn });

// ── tool table ───────────────────────────────────────────────────────────────
const TOOLS = [
  T('project_status',
    'Read-only current project/input/code freshness. Does not claim runtime or symbol verification.',
    { project: { type: 'string' }, out: { type: 'string' } }, ['project', 'out'],
    async (_g, a) => (await import('../lib/project/query.mjs')).statusProject(a)),
  T('project_sources',
    'Read-only project knowledge ↔ file provenance with snapshot-bound atom pointers. Exactly one knowledge or file selector; symbol/line return candidates only.',
    { project: { type: 'string' }, out: { type: 'string' }, knowledge: { type: 'string' }, file: { type: 'string' }, symbol: { type: 'string' }, line: { type: 'integer' } }, ['project', 'out'],
    async (_g, a) => (await import('../lib/project/query.mjs')).queryProject(a)),
  T('describe',
    'Describe one knowledge node: one-line summary plus its relation fan-out. Use full=true for the whole atom.',
    { ...SOURCE_PROPS, kind: { type: 'string', description: 'Node kind: event, command, slice, aggregate, policy, role, read-model, pipeline, step, field, story, scenario, use-case, value-object.' }, id: { type: 'string', description: 'Node id (kebab-case), e.g. "exception-replayed".' }, full: { type: 'boolean', description: 'Return the full atom instead of the summary.' } },
    ['kind', 'id'],
    (g, a) => describe(g, a.kind, a.id, a.full === true)),

  T('expand',
    'Walk the relation graph from a node address ("kind:id"). Filter by depth, direction (in/out/both), relation names, and a node budget. Defaults: depth=1, limit=100.',
    { ...SOURCE_PROPS, id: { type: 'string', description: 'Node address, e.g. "event:exception-replayed".' }, depth: { type: 'integer' }, direction: { type: 'string', enum: ['in', 'out', 'both'] }, relations: { type: 'array', items: { type: 'string' }, description: 'Relation names to follow, e.g. ["triggers","invokes"].' }, limit: { type: 'integer', description: 'Max nodes visited.' } },
    ['id'],
    (g, a) => expand(g, a.id, { depth: a.depth, direction: a.direction, relations: a.relations, limit: a.limit })),

  T('blast_radius',
    'May-impact analysis: walks exactly the human-adjudicated propagates=true edges. Over-approximate by design —宁多报，不漏报. Default depth=3.',
    { ...SOURCE_PROPS, id: { type: 'string', description: 'Node address, e.g. "event:exception-replayed".' }, depth: { type: 'integer' } },
    ['id'],
    (g, a) => blast_radius(g, a.id, { depth: a.depth })),

  T('lineage',
    'Field-level lineage: where a field comes from and where it flows (derives-from + lineage edges).',
    { ...SOURCE_PROPS, field: { type: 'string', description: 'Field name or "field:Event.field" address.' }, direction: { type: 'string', enum: ['in', 'out', 'both'] }, depth: { type: 'integer' } },
    ['field'],
    (g, a) => lineage(g, a.field, { direction: a.direction, depth: a.depth })),

  T('anchors',
    'Back-anchors: code locations a knowledge node is anchored to, verified against actual bytes at query time. Pass indexFile (one path or several — each pipeline owns its own index; the union is taken here). Honestly reports unanchored without an index — never faked.',
    { ...SOURCE_PROPS, kind: { type: 'string' }, id: { type: 'string' },
      indexFile: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Derived truthsrc.anchors/v1 index path(s), outside the truth tree.' },
      repoRoots: { type: 'object', additionalProperties: { type: 'string' }, description: 'Recorded repository ids mapped to explicit absolute local roots.' } },
    ['kind', 'id'],
    (g, a) => anchors(g, a.kind, a.id, { indexFile: a.indexFile, repoRoots: a.repoRoots })),

  T('search',
    'Full-text search over node names and ids, optionally restricted to one kind.',
    { ...SOURCE_PROPS, q: { type: 'string' }, kind: { type: 'string', description: 'Optional kind filter.' } },
    ['q'],
    (g, a) => search(g, a.q, a.kind ?? null)),

  T('conditions',
    'The guards and produced events of a command (its slice conditions).',
    { ...SOURCE_PROPS, command: { type: 'string', description: 'Command name.' } },
    ['command'],
    (g, a) => conditions(g, a.command)),

  T('diff',
    'Node-level diff between two canonical.json files: added / removed / changed.',
    { a: { type: 'string', description: 'Path to first canonical.json.' }, b: { type: 'string', description: 'Path to second canonical.json.' } },
    ['a', 'b'],
    (_g, a) => diff(loadCanonical(resolve(a.a)), loadCanonical(resolve(a.b)))),

  T('orphans',
    'Orphan detection: unclaimed L1 cards and pool events with no trigger source.',
    { ...SOURCE_PROPS },
    [],
    (g) => orphans(g)),

  T('consistency_check',
    'Duplicate-policy detection by (triggers, invokes) signature. Condition-level conflict checking is reported, not invented.',
    { ...SOURCE_PROPS },
    [],
    (g) => consistency_check(g)),

  T('slices_of', 'Slices owned by an aggregate.',
    { ...SOURCE_PROPS, aggregate: { type: 'string' } }, ['aggregate'], (g, a) => slices_of(g, a.aggregate)),
  T('events_of', 'Events in an aggregate\'s pool.',
    { ...SOURCE_PROPS, aggregate: { type: 'string' } }, ['aggregate'], (g, a) => events_of(g, a.aggregate)),
  T('commands_of', 'Commands a role can issue.',
    { ...SOURCE_PROPS, role: { type: 'string' } }, ['role'], (g, a) => commands_of(g, a.role)),
  T('read_models_of', 'Read models visible to a role.',
    { ...SOURCE_PROPS, role: { type: 'string' } }, ['role'], (g, a) => read_models_of(g, a.role)),
  T('policies_triggered_by', 'Policies an event triggers.',
    { ...SOURCE_PROPS, event: { type: 'string' } }, ['event'], (g, a) => policies_triggered_by(g, a.event)),
  T('policies_constraining', 'Policies constraining a slice.',
    { ...SOURCE_PROPS, slice: { type: 'string' } }, ['slice'], (g, a) => policies_constraining(g, a.slice)),
  T('steps_of', 'Steps of a pipeline.',
    { ...SOURCE_PROPS, pipeline: { type: 'string' } }, ['pipeline'], (g, a) => steps_of(g, a.pipeline)),
  T('participants_of', 'Steps and performing roles of a pipeline.',
    { ...SOURCE_PROPS, pipeline: { type: 'string' } }, ['pipeline'], (g, a) => participants_of(g, a.pipeline)),
  T('saga_participants_of', 'Logical participants and aggregate ownership of an explicit Saga product, not pipeline roles.',
    { ...SOURCE_PROPS, saga: { type: 'string' } }, ['saga'], (g, a) => sagaParticipantsOf(g, a.saga)),
  T('saga_phases_of', 'Declared Saga steps, TCC phases and aggregate-qualified commands; missing references remain diagnostics.',
    { ...SOURCE_PROPS, saga: { type: 'string' }, step: { type: 'string' } }, ['saga'], (g, a) => sagaPhasesOf(g, a.saga, a.step ?? null)),
  T('consumed_by', 'Read models deriving from a field.',
    { ...SOURCE_PROPS, field: { type: 'string' } }, ['field'], (g, a) => consumed_by(g, a.field)),
  T('trigger_source_of', 'Commands that produce an event.',
    { ...SOURCE_PROPS, event: { type: 'string' } }, ['event'], (g, a) => trigger_source_of(g, a.event)),
  T('aggregates_referencing', 'Aggregates referencing an aggregate.',
    { ...SOURCE_PROPS, aggregate: { type: 'string' } }, ['aggregate'], (g, a) => aggregates_referencing(g, a.aggregate)),
  T('contexts_depending_on', 'Bounded contexts depending on a context.',
    { ...SOURCE_PROPS, context: { type: 'string' } }, ['context'], (g, a) => contexts_depending_on(g, a.context)),
];

// ── JSON-RPC over stdio ──────────────────────────────────────────────────────
const inputSchema = (t) => ({
  type: 'object',
  properties: t.properties,
  required: [...new Set(t.required)],
  additionalProperties: true,
});

async function handle(req) {
  const { id, method, params = {} } = req;
  const ok = (result) => ({ jsonrpc: '2.0', id, result });
  const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  try {
    if (method === 'initialize') {
      return ok({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'truthsrc', version: '0.5.0' },
      });
    }
    if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
      return null; // no response for notifications
    }
    if (method === 'tools/list') {
      return ok({ tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: inputSchema(t) })) });
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return err(-32602, `unknown tool: ${params.name}`);
      const args = params.arguments || {};
      for (const r of tool.required) {
        if (args[r] === undefined || args[r] === null || args[r] === '')
          return err(-32602, `missing required argument: ${r}`);
      }
      let graph = null;
      if (!['diff', 'project_status', 'project_sources'].includes(tool.name)) graph = await graphFor(args);
      const envelope = await tool.fn(graph, args);
      return ok({ content: [{ type: 'text', text: JSON.stringify(envelope, null, 2) }] });
    }
    return err(-32601, `method not found: ${method}`);
  } catch (e) {
    return err(-32603, `tool error: ${e.message}`);
  }
}

export function runMcpServer() {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      return; // not a complete JSON-RPC message — ignore
    }
    const res = await handle(req);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
}
