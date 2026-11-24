// Registration index of the unified emitter (emitter-unification plan F1).
// Importing this module registers the twelve curated families; the registry
// rejects duplicates, so a family must appear here exactly once. The first
// eight are ported verbatim from the classic tools/gen-*.mjs byte-parity
// references; the host faces (#43/#44) and the value-object family (#1) are
// handwritten-golden families — their goldens were curated against the real
// runtime (faces) or hand-authored as the style specification (value-object,
// rulings 2026-11-23), so they declare provenance 'handwritten-golden' and
// carry no tools-parity leg. The invariant rules family (#45) is a
// classic-reproduction family (ruling 2026-11-23): its golden tree pins the
// bank rules cluster's classic production bytes as the reproduction receipt.
import { registerFamily } from '../registry.mjs';
import { family as aggregateRulesFormal } from './aggregate-rules-formal.mjs';
import { family as externalConnectorPort } from './external-connector-port.mjs';
import { family as connectorImplementation } from './connector-implementation.mjs';
import { family as projectionApplyEvent } from './projection-apply-event.mjs';
import { family as aggregateStateController } from './aggregate-state-controller.mjs';
import { family as strictSagaModule } from './strict-saga-module.mjs';
import { family as strictFixtureHost } from './strict-fixture-host.mjs';
import { family as compositionInvocationHost } from './composition-invocation-host.mjs';
import { family as pipelineInvocationFace } from './pipeline-invocation-face.mjs';
import { family as effectFace } from './effect-face.mjs';
import { family as aggregateInvariantRules } from './aggregate-invariant-rules.mjs';
import { family as valueObject } from './value-object.mjs';
import { family as domainEntity } from './domain-entity.mjs';
import { family as aggregateLayer } from './aggregate-layer.mjs';
import { family as protocolLayer } from './protocol-layer.mjs';
import { family as aggregateRepository } from './aggregate-repository.mjs';
import { family as eventHandler } from './event-handler.mjs';
import { family as externalEventBridge } from './external-event-bridge.mjs';
import { family as protoSchema } from './proto-schema.mjs';
import { family as protoConverter } from './proto-converter.mjs';
import { family as serializationAdapter } from './serialization-adapter.mjs';
import { family as serviceRuntime } from './service-runtime.mjs';
import { family as projectScaffold } from './project-scaffold.mjs';
import { family as aggregateBootstrap } from './aggregate-bootstrap.mjs';

const CURATED_FAMILIES = [
  aggregateRulesFormal,
  externalConnectorPort,
  connectorImplementation,
  projectionApplyEvent,
  aggregateStateController,
  strictSagaModule,
  strictFixtureHost,
  compositionInvocationHost,
  pipelineInvocationFace,
  effectFace,
  aggregateInvariantRules,
  valueObject,
  domainEntity,
  aggregateLayer,
  protocolLayer,
  aggregateRepository,
  eventHandler,
  externalEventBridge,
  protoSchema,
  protoConverter,
  serializationAdapter,
  serviceRuntime,
  projectScaffold,
  aggregateBootstrap,
];

for (const family of CURATED_FAMILIES) registerFamily(family);

export const EXPECTED_FAMILY_COUNT = CURATED_FAMILIES.length;
