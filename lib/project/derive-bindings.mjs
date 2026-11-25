// Pure, fail-closed automatic derivation of Saga, Saga-Runtime, and Execution
// technical binding documents from the canonical truth tree + project config.
//
// Convention-over-configuration: projects no longer need to hand-author
// verbose boilerplate JSON files (`bindings/implementation/*.json`) when all
// semantic facts (sagas, pipelines, value objects, exact types, sagaHosts,
// effectHosts, packages, runtimeArtifact/runtimeProfile) are already declared
// in the truth tree and `truthsrc.project.json`.
//
// Zero hardcoded business names; runtime coordinates flow through
// `lib/runtime-profile.mjs`.
import { at, fail } from '../products/request.mjs';
import { resolveRuntimeProfile } from '../runtime-profile.mjs';

export const AUTO_DERIVED_BINDING_ROLES = Object.freeze(new Set([
  'sagaBinding',
  'runtimeBinding',
  'executionBinding',
]));

export const AUTO_DERIVED_DOC_IDS = Object.freeze({
  sagaBinding: 'derived-saga-binding',
  runtimeBinding: 'derived-runtime-binding',
  executionBinding: 'derived-execution-binding',
});

const STRICT_SAGA_CAPABILITIES = Object.freeze([
  'durable-commit-decision',
  'durable-abort-decision',
  'typed-nonterminal-unknown',
  'safe-status-reattach',
  'receipt-reconciliation',
  'participant-idempotency-query',
  'pinned-definition-codec',
  'manual-evidence-authorization',
  'cancel-before-prepare-fencing',
  'durable-manifest',
]);

const RUNTIME_V2_CAPABILITIES = Object.freeze([
  'positive-int-definition-version',
  'static-participants',
  'serial-all-tcc',
  'fresh-canonical-args',
  'pinned-args-codec',
  'pinned-phase-receipt-codecs',
  'minor-unit-string-money',
  'singleton-serial-barriers',
  'confirmed-receipt-context',
  'fresh-receipt-decode',
]);

const RECEIPT_IDENTITY = Object.freeze([
  'txid',
  'definition-version',
  'args-digest',
  'participant',
  'resource',
  'step',
  'phase',
]);

const OPERATION_IDENTITY = Object.freeze([
  'txid',
  'definition-version',
  'participant',
  'resource',
  'step',
  'phase',
]);

const PHASES = Object.freeze(['prepare', 'commit', 'compensate']);

const toSymbolSegment = raw => {
  const cleaned = String(raw ?? '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+/, '');
  return cleaned && /^[A-Za-z_]/.test(cleaned) ? cleaned : '_' + cleaned;
};

const toPascal = kebab =>
  String(kebab ?? '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

function packageForContext(options, context, location) {
  const rows = (options?.packages ?? []).filter(p => p?.context === context);
  if (rows.length !== 1 || typeof rows[0]?.package !== 'string' || !rows[0].package) {
    fail('PROJECT_BINDING_DERIVE', `explicit options.packages binding for context '${context}' is required to auto-derive technical bindings`, location);
  }
  return rows[0].package;
}

function parseSlot(entry, location) {
  if (typeof entry === 'string') {
    const m = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*([A-Za-z][A-Za-z0-9_-]*)\s*$/u.exec(entry);
    if (!m) fail('PROJECT_BINDING_DERIVE', `cannot parse slot declaration: ${entry}`, location);
    return { slot: m[1], type: m[2] };
  }
  if (entry && typeof entry === 'object' && typeof entry.slot === 'string' && typeof entry.type === 'string') {
    return { slot: entry.slot, type: entry.type };
  }
  fail('PROJECT_BINDING_DERIVE', 'invalid slot declaration', location);
}

function parseBinding(entry, location) {
  if (typeof entry === 'string') {
    const m = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s*<-\s*"?([^":]+)"?\s*:\s*([A-Za-z][A-Za-z0-9_-]*)\s*$/u.exec(entry);
    if (!m) fail('PROJECT_BINDING_DERIVE', `cannot parse binding declaration: ${entry}`, location);
    return { slot: m[1], ref: m[2].trim(), type: m[3] };
  }
  if (entry && typeof entry === 'object' && typeof entry.slot === 'string' && typeof entry.type === 'string') {
    return { slot: entry.slot, ref: entry.ref ?? null, type: entry.type };
  }
  fail('PROJECT_BINDING_DERIVE', 'invalid binding declaration', location);
}

function resolveTypeDeclaration(layout, context, id) {
  return (layout?.declarations ?? []).find(
    d => d?.ref?.context === context && d.ref.kind === 'type' && (!d.ref.owner || d.ref.owner.length === 0) && d.ref.id === id
  ) ?? null;
}

function deriveSagaTypeBinding(typeId, { context, pkg, layout, exactTypes, location }) {
  const decl = resolveTypeDeclaration(layout, context, typeId);
  if (!decl) {
    if (typeId === 'Text' || typeId === 'String') {
      return {
        id: typeId,
        canonicalType: 'String',
        implementation: 'java.lang.String',
        kind: 'string',
        minLength: 1,
        maxLength: 65536,
      };
    }
    if (typeId === 'Int' || typeId === 'Long') {
      return {
        id: typeId,
        canonicalType: 'Int',
        implementation: 'java.lang.Long',
        kind: 'integer',
        minimum: -9007199254740991,
        maximum: 9007199254740991,
      };
    }
    if (typeId === 'Boolean') {
      return {
        id: typeId,
        canonicalType: 'Boolean',
        implementation: 'java.lang.Boolean',
        kind: 'boolean',
      };
    }
    fail('PROJECT_BINDING_DERIVE', `undeclared saga type '${typeId}' in context '${context}'`, location);
  }

  const exact = (exactTypes ?? []).find(
    e => e?.domain?.context === context && e.domain.kind === 'type' && e.domain.id === typeId
  );
  if (exact && exact.form === 'unit-decimal') {
    return {
      id: typeId,
      canonicalType: typeId,
      implementation: `${pkg}.domain.values.${typeId}`,
      kind: 'money',
      currency: 'ISO-4217',
      amountEncoding: 'minor-unit-string',
      scale: exact.scale,
      precision: exact.precision,
      codec: `${toSymbolSegment(context)}.${toSymbolSegment(typeId)}Codec`,
    };
  }

  const vt = decl.valueType;
  if (vt?.form === 'primitive') {
    if (vt.name === 'string') {
      return {
        id: typeId,
        canonicalType: typeId,
        implementation: `${pkg}.domain.values.${typeId}`,
        kind: 'id',
        minLength: 1,
        maxLength: 128,
      };
    }
    if (vt.name === 'integer') {
      return {
        id: typeId,
        canonicalType: typeId,
        implementation: `${pkg}.domain.values.${typeId}`,
        kind: 'integer',
        minimum: -9007199254740991,
        maximum: 9007199254740991,
      };
    }
    if (vt.name === 'boolean') {
      return {
        id: typeId,
        canonicalType: typeId,
        implementation: `${pkg}.domain.values.${typeId}`,
        kind: 'boolean',
      };
    }
  }
  fail('PROJECT_BINDING_DERIVE', `unsupported saga type shape for '${typeId}'`, location);
}

function findSagaHost(canonicalValue, sagaId, version) {
  return (canonicalValue?.sagaHosts ?? []).find(
    h => h?.saga?.ref?.id === sagaId && h?.saga?.version === version
  ) ?? null;
}

function resolveConfirmationEventRef(canonicalValue, host, stepId, phaseName, commandRef, location) {
  if (host) {
    const hostPart = (host.participants ?? []).find(p => p?.stepId === stepId);
    const hostPhase = (hostPart?.phases ?? []).find(ph => ph?.phase === phaseName);
    const ev = hostPhase?.confirmation?.event;
    if (ev?.kind === 'event' && Array.isArray(ev.owner) && ev.owner.length === 1 && typeof ev.id === 'string') {
      return { aggregate: ev.owner[0], name: ev.id };
    }
  }
  const agg = (canonicalValue?.aggregates ?? []).find(a => a?.name === commandRef?.aggregate);
  const cmd = (agg?.commands ?? []).find(c => c?.name === commandRef?.name);
  if (Array.isArray(cmd?.produces) && cmd.produces.length === 1 && typeof cmd.produces[0] === 'string') {
    return { aggregate: agg.name, name: cmd.produces[0] };
  }
  fail(
    'PROJECT_BINDING_DERIVE',
    `cannot derive confirmation eventRef for step '${stepId}' phase '${phaseName}' command '${commandRef?.aggregate}.${commandRef?.name}'`,
    location
  );
}

function symbolicSagaArtifact(options) {
  const rp = resolveRuntimeProfile(options);
  return options?.runtimeArtifact?.symbolicTarget ?? `${rp.organization}:${rp.sagaArtifact}:${rp.sagaSymbolicVersion}`;
}

/**
 * Derive a complete `truthsrc.saga-binding/v1` document from canonical sagas,
 * sagaHosts, aggregates, layout, exactTypes, and project options.
 */
export function deriveSagaBindingDocument({ canonicalValue, context, layout, exactTypes, options, schemaVersion = 'truthsrc.saga-binding/v1' }) {
  const loc = at('project', '/roles/sagaBinding');
  const pkg = packageForContext(options, context, loc);
  const ctxSym = toSymbolSegment(context);
  const artifact = symbolicSagaArtifact(options);
  const canonicalSagas = Array.isArray(canonicalValue?.sagas) ? canonicalValue.sagas : [];
  if (!canonicalSagas.length) {
    fail('PROJECT_BINDING_DERIVE', 'cannot auto-derive sagaBinding when canonical has no sagas', loc);
  }

  const sagas = canonicalSagas.map((saga, sagaIndex) => {
    const sagaLoc = at('canonical', `/sagas/${sagaIndex}`);
    const payload = saga?.payload;
    if (!payload || typeof payload !== 'object') {
      fail('PROJECT_BINDING_DERIVE', `saga '${saga?.id}' is missing payload`, sagaLoc);
    }
    const sagaId = saga.id;
    const version = saga.version;
    const host = findSagaHost(canonicalValue, sagaId, version);
    const stemPascal = toPascal(sagaId.replace(/-v\d+$/, ''));
    const argsCodecId = host?.argsType?.ref?.id ?? `${stemPascal}Args`;

    // Collect every type referenced in this saga in deterministic declaration order.
    const typeIds = [];
    const addType = t => { if (typeof t === 'string' && t && !typeIds.includes(t)) typeIds.push(t); };
    addType(payload.transactionIdType);
    for (const trig of payload.triggers ?? []) {
      addType(trig?.idempotency?.type);
      for (const am of trig?.argsMapping ?? []) addType(am?.type);
    }
    for (const arg of payload.args ?? []) addType(parseSlot(arg, sagaLoc).type);
    for (const part of payload.participants ?? []) addType(part?.resourceRef?.type);
    for (const step of payload.steps ?? []) {
      for (const phaseName of PHASES) {
        const ph = step?.phases?.[phaseName];
        if (!ph || ph.kind === 'none') continue;
        for (const b of ph.bindings ?? []) addType(parseBinding(b, sagaLoc).type);
        for (const o of ph.outputs ?? []) addType(parseSlot(o, sagaLoc).type);
      }
    }
    for (const comp of payload.completions ?? []) {
      for (const b of comp?.bindings ?? []) addType(parseBinding(b, sagaLoc).type);
    }

    const types = typeIds.map(typeId => deriveSagaTypeBinding(typeId, { context, pkg, layout, exactTypes, location: sagaLoc }));
    const participants = (payload.participants ?? []).map(p => ({
      participantId: p.id,
      addressing: {
        resolver: `${ctxSym}.${toSymbolSegment(sagaId)}.${toSymbolSegment(p.id)}Resolver`,
        aggregate: p.aggregate,
        resourceType: p.resourceRef.type,
        mode: 'exact-resource',
      },
    }));

    const steps = (payload.steps ?? []).map(step => {
      const stepSym = toSymbolSegment(step.id);
      const phases = {};
      for (const phaseName of PHASES) {
        const ph = step?.phases?.[phaseName];
        if (!ph || ph.kind === 'none') {
          phases[phaseName] = { kind: 'none' };
          continue;
        }
        const cmdSym = toSymbolSegment(ph.commandRef.name);
        const eventRef = resolveConfirmationEventRef(canonicalValue, host, step.id, phaseName, ph.commandRef, sagaLoc);
        const outputs = (ph.outputs ?? []).map(o => {
          const parsed = parseSlot(o, sagaLoc);
          return { slot: parsed.slot, ref: `receipt:${parsed.slot}`, type: parsed.type };
        });
        phases[phaseName] = {
          kind: 'command',
          port: `${ctxSym}.${cmdSym}Port`,
          commandMapper: `${ctxSym}.${cmdSym}Mapper`,
          confirmation: {
            kind: 'durable-receipt',
            eventRef,
            mapper: `${ctxSym}.${cmdSym}Receipt`,
            outputs,
          },
          query: {
            mapper: `${ctxSym}.${toSymbolSegment(sagaId)}.${stepSym}_${phaseName}_queryMapper`,
            mode: 'read-only',
            identity: [...RECEIPT_IDENTITY],
            resultKinds: ['confirmed', 'not-executed', 'unknown'],
          },
          receipt: {
            mapper: `${ctxSym}.${toSymbolSegment(sagaId)}.${stepSym}_${phaseName}_receiptMapper`,
            version,
            durable: true,
            identity: [...RECEIPT_IDENTITY],
            payloadCompatibility: 'exact',
            evidence: 'reservation-decision-effect-reconciliation',
          },
          idempotency: {
            mapper: `${ctxSym}.${toSymbolSegment(sagaId)}.${stepSym}_${phaseName}_idempotencyMapper`,
            identity: [...OPERATION_IDENTITY],
            payloadConflict: 'reject',
            attemptIdentity: 'excluded',
          },
        };
      }
      return { stepId: step.id, phases };
    });

    const triggerMappers = (payload.triggers ?? []).map(t => ({
      triggerId: t.id,
      argsMapper: `${ctxSym}.${toSymbolSegment(t.id)}ArgsMapper`,
      idempotencyMapper: `${ctxSym}.${toSymbolSegment(t.id)}IdentityMapper`,
    }));

    const completionMappers = (payload.completions ?? []).map(c => ({
      kind: c.kind,
      mapper: `${ctxSym}.${stemPascal}${toPascal(c.kind)}Delivery`,
    }));

    return {
      sagaId,
      version,
      module: `${ctxSym}.${stemPascal}Module`,
      engine: {
        artifact,
        apiMode: 'strict',
        entrypoint: `${ctxSym}.${stemPascal}Entry`,
        capabilities: { required: [...STRICT_SAGA_CAPABILITIES] },
      },
      codec: {
        id: argsCodecId,
        version,
        compatibleVersions: [version],
        mapper: `${ctxSym}.${toSymbolSegment(argsCodecId)}Codec`,
      },
      types,
      participants,
      steps,
      triggerMappers,
      completionMappers,
    };
  });

  return {
    id: AUTO_DERIVED_DOC_IDS.sagaBinding,
    schemaVersion,
    value: { schemaVersion, sagas },
  };
}

/**
 * Derive a complete `truthsrc.saga-runtime-binding/v2` document from canonical
 * sagas, sagaHosts, the resolved sagaBinding document, and project options.
 */
export function deriveRuntimeBindingDocument({ canonicalValue, sagaBindingDoc, options, schemaVersion = 'truthsrc.saga-runtime-binding/v2' }) {
  const loc = at('project', '/roles/runtimeBinding');
  const rp = resolveRuntimeProfile(options);
  const artifact = symbolicSagaArtifact(options);
  const canonicalSagas = Array.isArray(canonicalValue?.sagas) ? canonicalValue.sagas : [];
  if (!canonicalSagas.length) {
    fail('PROJECT_BINDING_DERIVE', 'cannot auto-derive runtimeBinding when canonical has no sagas', loc);
  }
  const bindingBySaga = new Map((sagaBindingDoc?.value?.sagas ?? []).map(s => [`${s.sagaId}@${s.version}`, s]));

  const sagas = canonicalSagas.map(saga => {
    const sagaId = saga.id;
    const version = saga.version;
    const sb = bindingBySaga.get(`${sagaId}@${version}`);
    if (!sb) {
      fail('PROJECT_BINDING_DERIVE', `missing sagaBinding entry for '${sagaId}@${version}'`, loc);
    }
    const host = findSagaHost(canonicalValue, sagaId, version);
    const pinPrefix = host?.id ? host.id.replace(/-host$/, '') : sagaId.replace(/-v\d+$/, '');
    const receiptCodecs = [];
    for (const step of saga.payload?.steps ?? []) {
      for (const phaseName of PHASES) {
        const ph = step?.phases?.[phaseName];
        if (!ph || ph.kind === 'none') continue;
        receiptCodecs.push({
          stepId: step.id,
          phase: phaseName,
          id: `${pinPrefix}-${step.id}-${phaseName}`,
          version,
          runtimeVersion: 1,
        });
      }
    }
    return {
      sagaId,
      definitionVersion: version,
      runtimeVersion: 1,
      argsCodec: {
        id: sb.codec.id,
        version: sb.codec.version,
        runtimeVersion: 1,
      },
      receiptCodecs,
    };
  });

  return {
    id: AUTO_DERIVED_DOC_IDS.runtimeBinding,
    schemaVersion,
    value: {
      schemaVersion,
      target: {
        artifact,
        artifactStatus: 'unpublished-candidate',
        apiMode: 'strict',
        definitionApi: `${rp.strictSagaPackage}.StrictSagaDefinition`,
        coordinatorApi: `${rp.strictSagaPackage}.StrictSagaCoordinator`,
        executionMode: 'static-serial-allTCC',
        capabilities: [...RUNTIME_V2_CAPABILITIES],
      },
      sagas,
    },
  };
}

/**
 * Derive a complete `truthsrc.execution-binding/v1` document from canonical
 * pipelines, effectHosts, the resolved sagaBinding document, layout, and options.
 */
export function deriveExecutionBindingDocument({
  canonicalValue,
  context,
  layout,
  sagaBindingDoc,
  options,
  schemaVersion = 'truthsrc.execution-binding/v1',
}) {
  const loc = at('project', '/roles/executionBinding');
  const pkg = packageForContext(options, context, loc);
  const ctxSym = toSymbolSegment(context);
  const engine = schemaVersion === 'truthsrc.execution-binding/v2' ? 'monarch-persistence/0.3.0' : 'monarch-persistence/0.2.1';
  const canonicalPipelines = Array.isArray(canonicalValue?.pipelines) ? canonicalValue.pipelines : [];
  if (!canonicalPipelines.length) {
    fail('PROJECT_BINDING_DERIVE', 'cannot auto-derive executionBinding when canonical has no pipelines', loc);
  }

  const sagaBindings = sagaBindingDoc?.value?.sagas ?? [];
  const sagaByRef = new Map(sagaBindings.map(s => [`${s.sagaId}@${s.version}`, s]));
  const effectHosts = Array.isArray(canonicalValue?.effectHosts) ? canonicalValue.effectHosts : [];

  const pipelines = canonicalPipelines.map((pipeline, idx) => {
    const pLoc = at('canonical', `/pipelines/${idx}`);
    const pipelineId = pipeline.id;
    const exec = pipeline.execution;
    if (!exec || typeof exec !== 'object') {
      fail('PROJECT_BINDING_DERIVE', `pipeline '${pipelineId}' is missing execution declaration`, pLoc);
    }
    const planVersion = exec.recovery?.planVersion;
    if (typeof planVersion !== 'string' || !planVersion) {
      fail('PROJECT_BINDING_DERIVE', `pipeline '${pipelineId}' is missing execution.recovery.planVersion`, pLoc);
    }
    const stemPascal = toPascal(pipelineId.replace(/-v\d+$/, ''));

    // Collect every type referenced in this pipeline (plus any types from invoked sagas
    // so pipeline and saga type tables stay in exact agreement).
    const typeIds = [];
    const addType = t => { if (typeof t === 'string' && t && !typeIds.includes(t)) typeIds.push(t); };
    for (const inp of exec.inputs ?? []) addType(inp?.type);
    for (const out of exec.outputs ?? []) addType(out?.type);
    for (const step of pipeline.steps ?? []) {
      const se = step?.execution;
      if (!se) continue;
      for (const r of se.reads ?? []) addType(r?.type);
      for (const w of se.writes ?? []) addType(w?.type);
      if (se.invokeSaga) {
        for (const a of se.invokeSaga.args ?? []) addType(a?.type);
        addType(se.invokeSaga.transactionIdentity?.type);
        addType(se.invokeSaga.transactionIdentity?.source?.type);
        addType(se.invokeSaga.transactionIdentity?.stageOccurrence?.type);
        const invoked = sagaByRef.get(`${se.invokeSaga.ref?.sagaId}@${se.invokeSaga.ref?.version}`);
        for (const t of invoked?.types ?? []) addType(t.id);
      }
    }

    const types = typeIds.map(id => {
      const decl = resolveTypeDeclaration(layout, context, id);
      if (!decl && (id === 'Text' || id === 'String')) {
        return { id, implementation: 'java.lang.String' };
      }
      if (!decl && (id === 'Int' || id === 'Long')) {
        return { id, implementation: 'java.lang.Long' };
      }
      if (!decl && id === 'Boolean') {
        return { id, implementation: 'java.lang.Boolean' };
      }
      return { id, implementation: `${pkg}.domain.values.${id}` };
    });

    const ports = [];
    const invocations = [];
    for (const step of pipeline.steps ?? []) {
      const se = step?.execution;
      if (!se) continue;
      if (typeof se.port === 'string' && se.port) {
        const eh = effectHosts.find(
          h => h?.pipeline?.ref?.id === pipelineId && h?.stepId === step.id && h?.port === se.port
        );
        const hasUnknown = (se.outcomes ?? []).some(o => o?.kind === 'unknown-effect');
        if (!eh && hasUnknown) {
          fail(
            'PROJECT_BINDING_DERIVE',
            `external effect step '${pipelineId}/${step.id}' port '${se.port}' requires a matching effectHost declaration to derive its idempotency key`,
            pLoc
          );
        }
        ports.push({
          id: se.port,
          implementation: `${ctxSym}.${toSymbolSegment(se.port)}`,
          effect: eh ? 'external' : 'pure',
          confirmation: eh ? 'durable-ack' : 'checkpoint',
          idempotency: eh ? { mode: 'keyed', key: eh.identity.slot } : { mode: 'none' },
          inputs: (se.reads ?? []).map(r => ({ slot: r.slot, type: r.type })),
          outputs: (se.writes ?? []).map(w => ({ slot: w.slot, type: w.type })),
          outcomes: (se.outcomes ?? []).map(o => ({ code: o.code, kind: o.kind })),
        });
      }
      if (se.invokeSaga) {
        const ref = se.invokeSaga.ref;
        const sb = sagaByRef.get(`${ref.sagaId}@${ref.version}`);
        if (!sb) {
          fail(
            'PROJECT_BINDING_DERIVE',
            `pipeline '${pipelineId}' step '${step.id}' invokes '${ref.sagaId}@${ref.version}' which is missing from sagaBinding`,
            pLoc
          );
        }
        invocations.push({
          stepId: step.id,
          ref: { sagaId: ref.sagaId, version: ref.version },
          adapter: `${ctxSym}.${stemPascal}Invocation`,
          runtime: {
            artifact: sb.engine.artifact,
            apiMode: sb.engine.apiMode,
            entrypoint: sb.engine.entrypoint,
          },
          argsCodec: {
            id: sb.codec.id,
            version: sb.codec.version,
            mapper: sb.codec.mapper,
          },
          resultCodec: {
            id: 'SagaResultCodec',
            version: sb.codec.version,
            mapper: `${ctxSym}.SagaResultCodec`,
          },
          transactionIdentity: {
            mapper: `${ctxSym}.DurableSourceStageIdentity`,
            derivation: se.invokeSaga.transactionIdentity.derivation,
            payloadCompatibility: 'exact',
          },
        });
      }
    }

    return {
      pipelineId,
      engine,
      module: `${ctxSym}.${stemPascal}Pipeline`,
      codec: {
        id: `${stemPascal}State`,
        version: planVersion,
        compatibleVersions: [planVersion],
      },
      types,
      ports,
      ...(invocations.length ? { invocations } : {}),
    };
  });

  return {
    id: AUTO_DERIVED_DOC_IDS.executionBinding,
    schemaVersion,
    value: {
      schemaVersion,
      pipelines,
      ...(sagaBindingDoc ? { sagaBindings: sagaBindingDoc.value } : {}),
    },
  };
}
