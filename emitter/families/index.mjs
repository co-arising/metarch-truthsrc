// Registration index of the unified emitter (emitter-unification plan F1).
// Importing this module registers the ten curated families; the registry
// rejects duplicates, so a family must appear here exactly once. The first
// eight are ported verbatim from the classic tools/gen-*.mjs byte-parity
// references; the two host faces (#43/#44) are handwritten-golden families —
// their goldens were curated against the real runtime before any generator
// existed, so they declare provenance 'handwritten-golden' (ruling 2026-11-22)
// and carry no tools-parity leg.
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
];

for (const family of CURATED_FAMILIES) registerFamily(family);

export const EXPECTED_FAMILY_COUNT = CURATED_FAMILIES.length;
