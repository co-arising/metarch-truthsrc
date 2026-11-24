# Curated Golden — `external-event-bridge` (`#46`, v1)

- **Provenance**: `handwritten-golden` (`toolsRef: null`; ruling §22, 2026-11-24).
- **Origin Audit**: Distinct from `#13 external-connector-port` and `#25 connector-implementation` (subprocess tool-gate connectors). Emits the domain external-event bridge object (`<Aggregate>ExternalEvents.scala`, `kind: 'external-event-bridge'`) on the `command-dsl` producer row.
- **Golden Artifact**:
  - `app/example/bankwealth/domain/FundOrderExternalEvents.scala` (headerless per L1; preserves 100% Scala ABI consumed by `FundOrderBehaviors.scala`).
- **Contract**: `technical-input.json` (`truthsrc.external-event-bridge-input/v1`).
