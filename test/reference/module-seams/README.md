# Parcel module seams — reference candidate

Independently hand-authored Scala reference **candidate**, not generated code,
not an approved golden reference, and not a runnable bank application. It isolates
module dependencies, nested port-signature closure, pure rules, constructor
injection and root-only binding. It does not modify or supersede the seven
aggregate references. Design follows `docs/artifacts/scala-cqrs/REFERENCE-DEVELOPMENT.md`;
no renderer output was used as an oracle.

## Shape

| sbt project | Production dependencies | Responsibility |
| --- | --- | --- |
| `kernel` (`modules/kernel`) | none | Domain values/errors/rule/bridge; domain and application ports |
| `glue` (`modules/glue`) | `kernel` | Read-only adapter over an explicitly supplied immutable route map |
| `ext` (`modules/ext`) | `kernel`, `glue` | Application flow depending on injected ports |
| `root` (`.`) | `kernel`, `glue`, `ext` | `ParcelModule.create(routes): QuoteFlow`, the only concrete binding |

Production uses Scala 2.13.14 standard library only. Kernel has no Actor, DI,
IO driver or implementation binding. `Future` is an application boundary, not
an IO implementation. The ext build dependency on glue is explicit even though
`DefaultQuoteFlow` imports only kernel contracts. Constructor injection does not
use a service locator or `@ImplementedBy`.

The signature graph is entirely in kernel: `QuoteRequest` contains `RouteId` and
`Vector[Parcel]`; `Parcel` contains `ParcelId`; `Quote` contains `RouteId` and
`Load`. `CapacityRule.assess` is state-free. Validation order is invalid capacity,
empty input, then input-order invalid weight / duplicate ID / checked addition,
then capacity comparison. Overflow is distinct from a representable oversized
load. IDs are opaque values; blank-ID validation is outside this candidate.
The flow forwards the resolved route and original parcels to its injected
policy and uses the resolved route ID and returned load in the quote. An absent
route bypasses the policy; a failed lookup remains a failed future.

There are no writes, events, persistence, HTTP, database, retries or durability
claims. The map is immutable. The synchronous test stubs and parasitic execution
context do not establish concurrency or thread-safety guarantees.

## Independent tests, written before the implementation

- `CapacityRuleSpec`: empty input; invalid capacities/weights (including zero and
  negative extremes); one gram; below/equal/above capacity; adjacent and separated
  duplicate IDs; equal weights with distinct IDs; exactly `Long.MaxValue`;
  overflow at early/later addition; large representable over-capacity totals;
  validation precedence; repeated calls; bridge success and every rule refusal.
- `QuoteFlowSpec`: independent repository and policy stubs; exact arguments and
  invocation counts; original route/vector forwarding; returned policy load;
  unknown-route short circuit; unchanged refusal and failed lookup; controllable
  `Promise` success/absence/failure without early completion; multiple injected
  repository/policy behaviors, including policy decisions the flow must not
  second-guess. No sleeps or global execution pool.
- `ParcelModuleSpec`: actual root wiring, route-specific success/refusal,
  duplicate/empty rules, unknown routes, separate explicit maps, and immediately
  completed read-only adapter lookups.

The tests were authored before their implementation. Execution results belong to
[the batch acceptance record](../../../docs/artifacts/TARGET-PROFILE-ACCEPTANCE.md),
not to a claim of owner approval. The runner
first compiles kernel alone against only scala-library, followed by glue, ext,
and root on their explicit dependency classpaths. It then proves the ScalaTest
classpath with an independent compiling control and compiles the actual kernel
test source without any production classes: this must fail on known `Route` /
`CapacityRule` diagnostics, not missing test dependencies. This is a reproducible
no-implementation red control, not a fabricated historical failing test run.
Kernel tests and root tests are subsequently compiled separately and the three
suites are run explicitly. Mechanical success would still not confer approval.

Seven additional independent compiler-negative pairs each get a passing control
and separate source/class output directories, outside sbt source discovery:

1. Kernel importing actual `DefaultQuoteFlow`: full classpath control vs kernel only.
2. Kernel port with `Future[Option[Vector[DefaultQuoteFlow]]]`: full signature
   closure control vs missing the outer implementation type.
3. Glue importing actual `DefaultQuoteFlow`: full classpath vs kernel + glue.
4. A kernel bridge delegating to actual ext `DefaultQuoteFlow`: full classpath
   vs kernel only (an intentionally invalid same-layer bridge replacement).
5. Actual root `ParcelModule` without implementation classpaths vs all modules.
6. Root constructor call missing `capacity` vs the complete injected constructor.
7. `QuoteFlow` implementation with a wrong result type vs its exact port result.

These are compile-time boundary controls, not a claim that the compiler enforces
layers when outer dependencies have deliberately been placed on the classpath.
The runner requires exit 1 and case-specific file/symbol diagnostics for every
expected failure; process errors, signals, timeouts and environment/dependency
errors do not count as red.

## Explicit offline verification

From any working directory, choose an **absent** output path outside every Git
worktree and outside the input/JDK/cache trees, with an existing real parent:

```sh
node "$TRUTHSRC_CHECKOUT/test/reference/module-seams/verify.mjs" \
  --java "$JAVA_HOME/bin/java" \
  --maven-cache "$MAVEN_CACHE" \
  --out "$NEW_ABSOLUTE_OUTPUT"
```

Only those three flags are accepted, exactly once, with absolute values. There
is no implicit cache, Java, output path, download, sbt invocation, shell, deletion
or background process. Existing output paths are rejected, never cleaned.
Darwin `/usr/bin/sandbox-exec` is mandatory. Each child denies network and writes
outside the new output directory, except `/dev/null`, `/dev/random`, and
`/dev/urandom`. HOME, temporary directories and working directory live there;
environment variables are rebuilt explicitly. Each JVM uses UTF-8, 512 MB maximum
heap, two active processors, disabled perf data and a 120-second timeout.

The direct compiler JVM has compiler/library/reflect 2.13.14. Production target
classpaths have **only scala-library and the declared compiled modules**, never
compiler/reflect. Test classpaths add ScalaTest core/funsuite/compatible and
Scalactic 3.2.15, scala-xml 2.1.0 and reflect. All jars must exist at explicit
Maven-coordinate paths. JAR manifest classpaths are checked to prevent implicit
unrecorded dependencies. Reference inputs, Java/release and jars are SHA-256
hashed before/after, including on an execution failure. Sources and embedded
negative fixtures are copied/written only into the output tree. Per-phase unique
stdout/stderr/metadata logs, classpath details, hashes and `execution.json` stay
there; nothing is removed. Review `execution.json` rather than interpreting an
expected compiler error as an overall failure or a dependency failure as red.

A minimal four-project `build.sbt` is supplied for structural inspection or a
separately authorized sbt environment (`sbt test` from this directory). ScalaTest
is Test-only, and both test parallelism and concurrent sbt test tasks are disabled.
The offline runner is the reproducible acceptance command; sbt may resolve tools
or write project targets and is not invoked by it.
