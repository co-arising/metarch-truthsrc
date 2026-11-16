# Classic CQRS scaffold @3

`classic-architecture@3` reuses the complete lossless classic metadata input and emits nine traditional source families: Protocol, CommandHelpers, Behaviors, Entity, ValueObject, InvariantRule, EventHandler, AggregateRoot and AggregateFactory. The existing banking inputs select 17 complete Scala files each. This is a **non-runnable scaffold**, not a deployable application or bank runtime profile.

The exact manifest, shipped producer and trusted marker are versioned independently of @1/@2. Every entry has the @3 footprint; the Scala writer stamp still comes from the unchanged explicit generator options. The producer reuses unstamped existing models and templates and adds two ordinary aggregate MBTs. It does not read expected outputs or accept an arbitrary source attachment.

## Public replay

From the physical repository root, using Node >=22.13 on Darwin:

```sh
node tools/codegen-parity/replay-classic-v3.mjs \
  --out "$PWD/.rounds/my-classic-v3-replay"
```

The output root must not exist and must be a direct child of the physical repository `.rounds/` or system temporary directory. Never select a golden, shared app, or old generated tree. The wrapper uses the existing sandboxed process supervisor, denies network, captures logs/receipts, and stops on failure. It invokes four public `generate-products` calls and six public full-byte comparisons, not internal renderer calls.

Actual code is under `actual/{baseline,timestamp-int}-{a,b}/app/net/imadz/banking/`. Independent Scala reference assets live in [`test/reference/classic-cqrs-v3`](../../test/reference/classic-cqrs-v3/); they came from the original successful public Scala CodegenMain runs, not from JS output.

## Ordinary aggregate boundary

Root consumes explicit state/event/behavior references and `ShardedTags`. Factory preserves the original bare-ref method, first parameterized writable-command selection, identifier handling, typed ask body, same-name overloads, imports and ten-second timeout. Optional parameter defaults remain in the model but are omitted by the fixed Scala factory template. Historical Root Saga/inline/steps/context branches are not lowered by this target and fail closed if selected through a model.

The two existing inputs have identical Root/Factory bytes; the timestamp change is in Entity. Extra legal plans are not independent Scala parity for changed Root/Factory inputs. Existing `???`, MANUAL markers, raw reply quirks and naming remain unchanged. Placeholder locations are only candidates for future handwritten-isolation ownership review, not automatically completed implementations.

Byte parity, complete source-plan dependency membership, generated Scala compilation, Plain FP/ScalaCheck quality, and application runtime are separate claims. This target does not implement Repository, adapters, bootstrap, persistence effects or deployment.
