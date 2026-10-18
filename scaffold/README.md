# truthsrc scaffold

Seed project for code generated from a truth tree (truthsrc v0.5).
This is the **new baseline** — it replaces the old `scaffold/` in backend-codegen.

## Layout (horizontal modules, EP_Truthsrc_Standalone 批 A)

| Module | Role | Filled by |
|---|---|---|
| `modules/kernel` | Domain knowledge: aggregates, events, commands. Pure problem-space, no framework imports beyond `common-core`/`monarch-core`. | Generator |
| `modules/glue` | Framework adapters: Akka Persistence wiring, saga wiring, projections. Test-exempt zone. | Generator |
| `modules/ext` | Handwritten domain code. Module-level physical isolation — **the generator never writes here**. | Human |
| `modules/root` | Play shell: controllers, routes, DI. | Generator + human |

Dependency direction: `root → {kernel, glue, ext}`, `glue → kernel`, `ext → kernel`.
Never: `kernel → glue`, `kernel → ext`, anything → `root`.

## Engine libs (Maven Central, lockstep 0.2)

- `net.imadz %% common-core % 0.2` — shared plumbing (`CborSerializable`, etc.)
- `net.imadz %% monarch-core % 0.2` — resumable-run engine
- `net.imadz %% monarch-persistence % 0.2` — Akka Persistence wrapper (`PersistentMonarch`)
- `net.imadz %% saga-core % 0.2` — saga / transaction engine
- `net.imadz %% auth-core % 0.2` — auth (root only)

Stack pins: Scala 2.13.14, Akka 2.6.20, Play 2.8.18, sbt 1.4.9.
Resolvers: Aliyun only (no Huawei — project rule).

## Single-module variant

The generator also supports a single-module layout: same `libraryDependencies`,
all sources under one `src/`, `kernel`/`glue`/`ext` become source directories
instead of sbt subprojects. The lib set does not change — layout is orthogonal
to dependencies.

## Usage

```bash
sbt compile        # all four modules
sbt "project root" run   # Play shell
```

The generator (`generators/`) fills `kernel/` and `glue/` from
`truth/inbox/` + `truth/solution/`; `ext/` stays empty until a human writes in it.
