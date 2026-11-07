# Independent family1 reference

This hand-authored Counter/Ratio/Distance candidate is independent of the renderer. It contains seventeen project files and an external twenty-two-case oracle, plus real positive/negative host signature controls. It is not a bank model, a full modular application, a persistence/recovery example or an approved golden master.

## Author and reference surfaces

- Sole knowledge input: `scaffold/domain-kernel-project/truth/domain-kernel/`; explicit technical names/exact bindings in that project's `truthsrc.project.json`.
- `project/`: hand-authored expected Scala, protobuf and build bodies. Do not update them from renderer output to make conformance green.
- `oracle/`: independent ScalaTest expectations compiled separately against reference and generated output.
- `verify.mjs`: finite, explicitly invoked offline compiler/ScalaPB lane. Normal Node discovery does not launch it.

The eleven kernel Scala files define seven single-copy values, the pure Counter protocol and State, a minimum computation interface and RuleParams. Glue contains ExactValueCodecs, DomainConverters and real protobuf schema. There is no generated computation implementation, Actor, event fold, storage, serializer registration or root binding.

## Real verification

An explicit JDK11, offline Maven cache, protoc3.21.9 and a new absent output are required. The runner checks the fixed Scala2.13.14/ScalaPB0.11.14/ScalaTest3.2.15 closure, stages input bytes against their admitted hashes, denies networking, isolates classpaths and records actual process/compile/test evidence.

```bash
node "$TRUTHSRC_CHECKOUT/test/reference/domain-kernel/verify.mjs" \
  --java "$JAVA_HOME/bin/java" \
  --maven-cache "$MAVEN_CACHE" \
  --protoc "$PROTOC" \
  --source "$TRUTHSRC_CHECKOUT/test/reference/domain-kernel/project" \
  --oracle "$TRUTHSRC_CHECKOUT/test/reference/domain-kernel/oracle" \
  --out "$NEW_ABSOLUTE_OUTPUT" \
  --mode reference
```

Generated mode uses actual project writer output, not template copies, and requires its separate genuine `generate-project` JSON receipt:

```bash
node "$TRUTHSRC_CHECKOUT/test/reference/domain-kernel/verify.mjs" \
  --java "$JAVA_HOME/bin/java" \
  --maven-cache "$MAVEN_CACHE" \
  --protoc "$PROTOC" \
  --source "$GENERATED_SOURCE" \
  --oracle "$TRUTHSRC_CHECKOUT/test/reference/domain-kernel/oracle" \
  --source-receipt "$PROJECT_RESULT_JSON" \
  --out "$NEW_ABSOLUTE_BUILD_OUTPUT" \
  --mode generated
```

Only the declared source/oracle inventory is accepted. Actual PB generation, target compilation, independent behavior and generated smoke tests are separate phases. Expected compiler refusal needs exit1 and the named source/symbol after a positive control; missing dependencies, timeout or signal never count as a passed negative.

## Behavior and limits

The oracle covers every value root, State and Event through actual ScalaPB `toByteArray`/`parseFrom`; nested optional/empty containers, message presence, duplicate map keys, same-type field sentinels, Unicode/non-BMP, Long endpoints, exact canonical text, precision38/scale38 and precision38/scale0, unit mismatch, arithmetic, explicit defaults and Params preservation. It does not certify general PB schema evolution or arbitrary precision/scale fixture coverage beyond recorded samples.

Build files are emitted but this lane directly invokes compiler/protoc; **sbt is not executed**. Source/graph/anchors validation remains a different public project gate. Reference and generated results, current tool fingerprints and historical failures belong to the batch acceptance record; this README grants no final approval.

See [domain kernel contract](../../../docs/artifacts/scala-cqrs/DOMAIN-KERNEL.md). The reference and JVM runner are test-only and do not enter the basic CLI tarball.
