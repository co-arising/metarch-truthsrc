# Warehouse-lite persistence/readside candidate

This standalone author project selects `scala-cqrs-persistence-readside-v1`. It reuses the finite aggregate-core Warehouse business example; it is not stock accounting, a production journal, or a complete CQRS service.

- Edit business declarations only in `truth/persistence-readside/`.
- Edit explicit wire/store/index choices in `bindings/persistence.json`.
- `truthsrc.project.json` selects products and target names. Generated canonical/request/compiled/Scala/ledger/anchors are not author inputs.
- `ReservationIdentity` and event source/DataSource/ActorSystem lifetimes are caller responsibilities. No algorithm, PID parsing or source authorization is inferred.

Copy this directory OUTSIDE the installed tool before using it. In your project directory:

```sh
truthsrc validate --tree truth/persistence-readside
truthsrc roundtrip --tree truth/persistence-readside
truthsrc compile-project --project truthsrc.project.json
truthsrc generate-project --project truthsrc.project.json --out generated --plan
truthsrc generate-project --project truthsrc.project.json --out generated
truthsrc verify --project truthsrc.project.json --out generated
truthsrc view --project truthsrc.project.json --out generated
```

Wire layout expectations are explicit versioned SHA pins, initially established from the original domain PB field graph. A changed layout must fail until you make an explicit compatibility/version decision; do not blindly replace a mismatched hash. This sample supplies no upcaster or old-data migration.

The application-side adapters and the JDBC readside have separate qualification boundaries. H2 `2.2.224` file-store replay does not certify MySQL, MongoDB, production Actor journal recovery, force-kill or power-loss durability. Runtime/JVM verification is opt-in and requires independently supplied pinned tooling; the basic CLI does not download it.

This project has its own `persistence-readside` system identity. Its context/aggregate/value/port payloads preserve the original `aggregate-core-project` example's business semantics; no generated request/canonical is maintained as a second truth source.
