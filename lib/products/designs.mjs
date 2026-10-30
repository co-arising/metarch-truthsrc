import { array, at, equal, fail, object, resolve, text, unique } from './request.mjs';
import { checkFields, declaration } from '../domain-products/values.mjs';
import { owner, reference, refKey } from '../domain-products/references.mjs';

export const DESIGN_PLANES = Object.freeze(['strategy', 'scope', 'structure', 'skeleton', 'surface']);
const planeKinds = Object.freeze({ strategy: ['persona', 'need', 'goal'], scope: ['release', 'story', 'feature'],
  structure: ['journey', 'stage', 'target'], skeleton: ['screen', 'action', 'feedback'], surface: ['component', 'content'] });
const relationPairs = Object.freeze({
  'story-release': [['story', 'release']], 'journey-story': [['journey', 'story']],
  'stage-action': [['stage', 'action']], 'stage-screen': [['stage', 'screen']], 'screen-action': [['screen', 'action']], 'action-target': [['action', 'target']],
  uses: [['screen', 'component'], ['screen', 'content'], ['action', 'component'], ['feedback', 'component'], ['feedback', 'content']],
  contains: [['journey', 'stage'], ['screen', 'component'], ['screen', 'content'], ['component', 'content'], ['release', 'feature']],
  precedes: [['stage', 'stage'], ['screen', 'screen'], ['action', 'action']],
  supports: [['need', 'persona'], ['goal', 'need'], ['story', 'goal'], ['feature', 'story'], ['feedback', 'action'], ['component', 'screen'], ['content', 'component']],
});
const designKeys = ['id', 'version', 'artifact', 'status', 'provenance', 'approvalSource', 'references', 'nodes', 'relations'];
const nodeKey = r => JSON.stringify([refKey(r.artifact), r.kind, r.id]);
const child = (s, part) => at(s.document, s.pointer + '/' + part);
function nodeReference(r, s) {
  object(r, ['artifact', 'kind', 'id'], s); reference(r.artifact, s); text(r.kind, s); text(r.id, s);
  return r;
}
function originSource(value, canonical, s) {
  object(value, ['document', 'pointer'], s); text(value.document, s);
  if (value.document !== canonical.id) fail('DESIGN_SOURCE', 'design source must belong to its declared canonical role', s);
  resolve(canonical.value, value.pointer, value);
  return value;
}
function containerFields(r, kind, key, canonical, layout, s) {
  const d = declaration(r, layout, s);
  if (r.kind !== kind || d.source.document !== canonical.id) fail(kind === 'command' ? 'DESIGN_COMMAND' : 'DESIGN_FEEDBACK', 'exact canonical command/event reference required', s);
  const location = /^\/aggregates\/(0|[1-9][0-9]*)\/(commands|events)\/(0|[1-9][0-9]*)$/u.exec(d.source.pointer);
  if (!location || location[2] !== (kind === 'command' ? 'commands' : 'events')) fail('DESIGN_OWNER', 'command/event must identify its canonical aggregate residence', s);
  const aggregatePointer = '/aggregates/' + location[1], aggregate = resolve(canonical.value, aggregatePointer, s);
  const parent = { context: aggregate.context, kind: 'aggregate', owner: [], id: aggregate.name };
  if (!equal(owner(r), parent) || !equal(declaration(parent, layout, s).source, at(canonical.id, aggregatePointer)))
    fail('DESIGN_OWNER', 'command/event qualified owner differs from its canonical aggregate', s);
  const body = resolve(canonical.value, d.source.pointer, d.source);
  if (body.name !== r.id) fail(kind === 'command' ? 'DESIGN_COMMAND' : 'DESIGN_FEEDBACK', 'reference must identify its authored container name', s);
  const fieldKind = kind === 'command' ? 'parameter' : 'event-slot';
  const declared = layout.declarations.filter(d => d.ref.kind === fieldKind && equal(owner(d.ref), r));
  return checkFields(body[key], declared, canonical, layout, d.source.pointer + '/' + key, fieldKind, r);
}

/** Full pure reconstruction of authored design intent. No inferred pages, toast reducers or approval authority. */
export function deriveProductDesigns(canonical, layout) {
  const root = at(canonical.id, '/productDesigns');
  const rows = array(canonical.value.productDesigns, root);
  if (!rows.length || rows.length > 256) fail('DESIGN_COVERAGE', 'nonempty bounded design collection required', root);
  const designs = rows.map((d, i) => {
    const s = child(root, i);
    object(d, designKeys, s); text(d.id, s); text(d.version, s);
    const artifact = declaration(d.artifact, layout, s);
    if (artifact.ref.kind !== 'artifact' || !equal(artifact.source, s) || layout.declarations.filter(x => equal(x.ref, d.artifact)).length !== 1)
      fail('DESIGN_SOURCE', 'design artifact declaration must identify the complete canonical row', s);
    function checkedRefs(values, location) {
      array(values, location);
      values.forEach(r => {
        const declared = declaration(r, layout, location);
        if (r.context !== d.artifact.context) fail('DESIGN_OWNER', 'domain reference crosses design context owner', location);
        originSource(declared.source, canonical, location);
      });
      unique(values.map(refKey), 'DESIGN_REFERENCE', location);
      return values;
    }
    const provenance = array(d.provenance, s).map(p => originSource(p, canonical, s));
    if (!provenance.length) fail('DESIGN_SOURCE', 'nonempty authored provenance required', s);
    unique(provenance.map(p => JSON.stringify([p.document, p.pointer])), 'DESIGN_SOURCE', s);
    if (!['proposal', 'accepted', 'historical'].includes(d.status)) fail('DESIGN_STATUS', 'explicit authored design status required', s);
    if (d.status === 'accepted' && d.approvalSource === null) fail('DESIGN_APPROVAL', 'accepted design needs an explicit author decision source', s);
    if (d.approvalSource !== null) {
      originSource(d.approvalSource, canonical, s);
      if (!/^\/designDecisions\/(0|[1-9][0-9]*)$/u.test(d.approvalSource.pointer)) fail('DESIGN_APPROVAL', 'approval source must identify a complete design decision', s);
      const decision = resolve(canonical.value, d.approvalSource.pointer, d.approvalSource);
      object(decision, ['id', 'version', 'artifact', 'decision', 'author'], d.approvalSource);
      text(decision.author, d.approvalSource);
      if (decision.id !== d.id || decision.version !== d.version || !equal(decision.artifact, d.artifact) || decision.decision !== 'accept' || d.status === 'proposal')
        fail('DESIGN_APPROVAL', 'decision must explicitly accept the same design identity and version', s);
    }
    const references = checkedRefs(d.references, s);
    const rawNodes = array(d.nodes, s);
    if (!rawNodes.length || rawNodes.length > 4096) fail('DESIGN_COVERAGE', 'nonempty bounded node collection required', s);
    const nodes = rawNodes.map((n, j) => {
      const ns = child(s, 'nodes/' + j);
      object(n, ['id', 'plane', 'kind', 'label', 'references', 'action', 'feedback'], ns);
      text(n.id, ns); text(n.label, ns);
      if (!DESIGN_PLANES.includes(n.plane)) fail('DESIGN_PLANE', 'explicit supported plane required', ns);
      if (!planeKinds[n.plane].includes(n.kind)) fail('DESIGN_KIND', 'node kind does not belong to its explicit plane', ns);
      const references = checkedRefs(n.references, ns);
      let action = null, feedback = null;
      if (n.action !== null) {
        const a = n.action, as = child(ns, 'action');
        object(a, ['command', 'actor', 'intent', 'parameters'], as);
        if (n.kind !== 'action') fail('DESIGN_KIND', 'action contract belongs only on an action node', as);
        const declared = containerFields(a.command, 'command', 'parameters', canonical, layout, as);
        if (!['human', 'machine'].includes(a.actor) || !['public', 'operator', 'machine'].includes(a.intent) || (a.actor === 'machine') !== (a.intent === 'machine'))
          fail('DESIGN_INTENT', 'machine action must have explicit machine intent, never public intent', as);
        const parameters = array(a.parameters, as).map((p, k) => {
          const ps = child(as, 'parameters/' + k);
          object(p, ['parameter', 'origin', 'slot', 'from'], ps); reference(p.parameter, ps);
          const declaredParameter = declared.find(d => equal(d.ref, p.parameter));
          if (!declaredParameter) fail('DESIGN_INPUT', 'parameter must belong to the action command', ps);
          if (!['user', 'trusted-context', 'host-generated', 'propagated'].includes(p.origin)) fail('DESIGN_INPUT', 'explicit parameter origin required', ps);
          text(p.slot, ps);
          if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(p.slot)) fail('DESIGN_INPUT', 'symbolic input slot required', ps);
          if ((p.origin === 'propagated') !== (p.from !== null) || a.actor === 'machine' && p.origin === 'user')
            fail('DESIGN_INPUT', 'propagated source required; machine input cannot come from user', ps);
          if (p.from !== null) {
            const source = declaration(p.from, layout, ps);
            if (p.from.context !== d.artifact.context || !['parameter', 'event-slot', 'state-field', 'member'].includes(p.from.kind) || !equal(source.valueType, declaredParameter.valueType))
              fail('DESIGN_INPUT', 'propagated source needs the same nominal type and declared context', ps);
            originSource(source.source, canonical, ps);
          }
          return { parameter: p.parameter, valueType: declaredParameter.valueType, origin: p.origin, slot: p.slot, from: p.from, source: ps, parameterSource: declaredParameter.source };
        });
        if (!equal(parameters.map(p => p.parameter), declared.map(d => d.ref)) || new Set(parameters.map(p => p.slot)).size !== parameters.length)
          fail('DESIGN_INPUT', 'all command parameters required exactly once in canonical order with distinct input slots', as);
        action = { command: a.command, actor: a.actor, intent: a.intent, parameters, source: as };
      }
      if ((n.kind === 'action') !== (action !== null)) fail('DESIGN_KIND', 'action node requires a complete action contract', ns);
      if (n.feedback !== null) {
        const f = n.feedback, fs = child(ns, 'feedback');
        object(f, ['event', 'state', 'evidence', 'resourceKeys', 'watermark'], fs);
        if (n.kind !== 'feedback') fail('DESIGN_KIND', 'feedback contract belongs only on a feedback node', fs);
        const slots = f.event === null ? [] : containerFields(f.event, 'event', 'payloads', canonical, layout, fs);
        if (!['provisional', 'terminal'].includes(f.evidence) || !['pending', 'unknown', 'succeeded', 'rejected', 'compensated', 'failed', 'manual-required'].includes(f.state) ||
          f.evidence === 'terminal' && !['succeeded', 'rejected', 'compensated', 'failed'].includes(f.state))
          fail('DESIGN_FEEDBACK', 'unknown or pending evidence cannot claim a terminal outcome', fs);
        const eventSlot = r => {
          reference(r, fs);
          const slot = slots.find(d => equal(d.ref, r));
          if (!slot) fail('DESIGN_FEEDBACK', 'evidence slot must belong to the exact declared event', fs);
          return slot;
        };
        const resourceKeys = array(f.resourceKeys, fs).map(r => { const slot = eventSlot(r); return { ref: r, valueType: slot.valueType, source: slot.source }; });
        unique(resourceKeys.map(k => refKey(k.ref)), 'DESIGN_FEEDBACK', fs);
        let watermark = null;
        if (f.watermark !== null) {
          object(f.watermark, ['slot', 'semantics'], fs);
          const slot = eventSlot(f.watermark.slot);
          if (!['projection-position', 'business-revision'].includes(f.watermark.semantics) || slot.valueType.form !== 'primitive' || !['integer', 'string'].includes(slot.valueType.name))
            fail('DESIGN_FEEDBACK', 'explicit typed string/integer watermark semantics required', fs);
          watermark = { slot: f.watermark.slot, valueType: slot.valueType, semantics: f.watermark.semantics, source: slot.source };
        }
        if (f.evidence === 'terminal' && (f.event === null || !resourceKeys.length || watermark === null))
          fail('DESIGN_FEEDBACK', 'terminal feedback needs an event, resource evidence keys and watermark', fs);
        feedback = { event: f.event, state: f.state, evidence: f.evidence, resourceKeys, watermark, source: fs };
      }
      if ((n.kind === 'feedback') !== (feedback !== null)) fail('DESIGN_KIND', 'feedback node requires a complete evidence contract', ns);
      const consumed = [...(action ? [action.command, ...action.parameters.flatMap(p => [p.parameter, ...(p.from ? [p.from] : [])])] : []),
        ...(feedback ? [...(feedback.event ? [feedback.event] : []), ...feedback.resourceKeys.map(k => k.ref), ...(feedback.watermark ? [feedback.watermark.slot] : [])] : [])];
      if (consumed.some(r => !references.some(x => equal(x, r)))) fail('DESIGN_REFERENCE', 'node references must cover all explicit action inputs and feedback evidence', ns);
      if (references.some(r => !d.references.some(x => equal(x, r)))) fail('DESIGN_REFERENCE', 'design references must cover every node reference', ns);
      return { ref: { artifact: d.artifact, kind: n.kind, id: n.id }, plane: n.plane, label: n.label, references, action, feedback, source: ns };
    });
    unique(nodes.map(n => n.ref.id), 'DESIGN_DUPLICATE', s);
    if (DESIGN_PLANES.some(p => !nodes.some(n => n.plane === p))) fail('DESIGN_COVERAGE', 'all five planes require explicit authored nodes', s);
    const rawRelations = array(d.relations, s);
    if (rawRelations.length > 16384) fail('DESIGN_COVERAGE', 'bounded relation collection required', s);
    const relations = rawRelations.map((r, j) => {
      const rs = child(s, 'relations/' + j);
      object(r, ['id', 'kind', 'from', 'to'], rs); text(r.id, rs); text(r.kind, rs);
      nodeReference(r.from, rs); nodeReference(r.to, rs);
      if (!equal(r.from.artifact, d.artifact) || !equal(r.to.artifact, d.artifact) || !nodes.some(n => equal(n.ref, r.from)) || !nodes.some(n => equal(n.ref, r.to)))
        fail('DESIGN_OWNER', 'relation endpoints must resolve exact nodes of the same design owner', rs);
      if (equal(r.from, r.to) || !Object.hasOwn(relationPairs, r.kind) || !relationPairs[r.kind].some(pair => equal(pair, [r.from.kind, r.to.kind])))
        fail('DESIGN_RELATION', 'unsupported relation or endpoint kinds', rs);
      return { id: r.id, kind: r.kind, from: r.from, to: r.to, source: rs };
    });
    unique(relations.map(r => r.id), 'DESIGN_DUPLICATE', s);
    unique(relations.map(r => JSON.stringify([r.kind, nodeKey(r.from), nodeKey(r.to)])), 'DESIGN_DUPLICATE', s);
    for (const kind of ['contains', 'precedes']) {
      let remaining = new Set(nodes.map(n => nodeKey(n.ref))), edges = relations.filter(r => r.kind === kind);
      while (remaining.size) {
        const targets = new Set(edges.map(r => nodeKey(r.to))), roots = [...remaining].filter(r => !targets.has(r));
        if (!roots.length) fail('DESIGN_RELATION', 'contains and precedes relations must be acyclic', s);
        const removed = new Set(roots); roots.forEach(r => remaining.delete(r)); edges = edges.filter(r => !removed.has(nodeKey(r.from)));
      }
    }
    for (const n of nodes.filter(n => n.action)) {
      const targets = relations.filter(r => r.kind === 'action-target' && equal(r.from, n.ref));
      if (targets.length !== 1) fail('DESIGN_TARGET', 'each action needs one explicit action-target relationship', n.source);
      const target = nodes.find(n => equal(n.ref, targets[0].to));
      if (!equal(target.references.filter(r => r.kind === 'aggregate'), [owner(n.action.command)])) fail('DESIGN_TARGET', 'target must explicitly identify the action command aggregate owner', target.source);
    }
    return { id: d.id, version: d.version, artifact: d.artifact, status: d.status, provenance, approvalSource: d.approvalSource, references, nodes, relations, source: s };
  });
  unique(designs.map(d => d.id), 'DESIGN_DUPLICATE', root); unique(designs.map(d => refKey(d.artifact)), 'DESIGN_DUPLICATE', root);
  return { designs };
}
export function compileProductDesigns(binding, canonical, layout) {
  const result = deriveProductDesigns(canonical, layout);
  if (!equal(result, binding.value.designs)) fail('PRODUCT_PAYLOAD_MISMATCH', 'complete typed design differs from canonical reconstruction', at(binding.id, '/designs'));
  return result;
}
