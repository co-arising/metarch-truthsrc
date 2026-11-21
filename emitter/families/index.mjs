// Registration index of the unified emitter (emitter-unification plan F1).
// Importing this module registers the eight curated families; the registry
// rejects duplicates, so a family must appear here exactly once.
import { registerFamily } from '../registry.mjs';
import { family as aggregateRulesFormal } from './aggregate-rules-formal.mjs';
import { family as externalConnectorPort } from './external-connector-port.mjs';
import { family as connectorImplementation } from './connector-implementation.mjs';
import { family as projectionApplyEvent } from './projection-apply-event.mjs';
import { family as aggregateStateController } from './aggregate-state-controller.mjs';
import { family as strictSagaModule } from './strict-saga-module.mjs';
import { family as strictFixtureHost } from './strict-fixture-host.mjs';
import { family as compositionInvocationHost } from './composition-invocation-host.mjs';

const CURATED_FAMILIES = [
  aggregateRulesFormal,
  externalConnectorPort,
  connectorImplementation,
  projectionApplyEvent,
  aggregateStateController,
  strictSagaModule,
  strictFixtureHost,
  compositionInvocationHost,
];

for (const family of CURATED_FAMILIES) registerFamily(family);

export const EXPECTED_FAMILY_COUNT = CURATED_FAMILIES.length;
