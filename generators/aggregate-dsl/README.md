# aggregate-dsl v2 (old codegen 1:1)

Generates 3 files per aggregate (matches `golden_master/.../CreditBalance*.scala`):

- `<Name>Protocol.scala` — `object <Name>Protocol`: sealed `Command` trait (extends `CborSerializable`), case classes with `replyTo: ActorRef[<Name>Confirmation]`, `Confirmation` case class, `type <Name>CommandHandler` alias
- `<Name>Aggregate.scala` — `object <Name>Aggregate`: `commandHandler` wiring, `entityTypeKey`, `tags = Vector.tabulate(5)`
- `behaviors/<Name>Behaviors.scala` — `object <Name>Behaviors extends <Name>CommandHelpers`: `runReplyingPolicy(<Cmd>RuleRule, <Cmd>Helper)(state, cmd).replyWith(cmd.replyTo)` for handled commands; `>>> AI_PROMPT_START` + `???` for unhandled

Spec: `{package, objectName, stateType, eventType, commands: [{name, fields}], events: [...], commandHandlers: [{command}]}`

Usage: `node emit.mjs <spec.json> <out.scala>` (writes 3 files alongside out.scala)
