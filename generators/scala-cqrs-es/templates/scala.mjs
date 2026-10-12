// templates/ — renderers: model → byte-exact Scala text. No decisions here.
// Every import line comes from the model (sorted, deliberate duplicates included);
// every blank-line count mirrors the live internal templates (they are part of the corpus).
export function renderProtocol(m) {
  const { name } = m;
  const commands = m.commands
    .map((c) => `  case class ${c.name}(${c.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) extends ${name}Command`)
    .join('\n');
  const replies = m.replies
    .map((r) => `  case class ${r.name}(${r.fields.map((f) => `${f.name}: ${f.type}`).join(', ')}) extends CborSerializable`)
    .join('\n');
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${m.base}application.aggregates

${imports}

object ${name}Protocol {

  // Commands
  sealed trait ${name}Command extends CborSerializable
${commands}

  // Replies
${replies}



  // CommandHandler type alias (moved from Aggregate to break circular dependency)
  type ${name}CommandHandler = (${name}State, ${name}Command) => akka.persistence.typed.scaladsl.Effect[${name}Event, ${name}State]


}
`;
}

export function renderRoot(m) {
  const { name } = m;
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${m.base}application.aggregates

${imports}

object ${name}Aggregate {

// Commands are defined in Protocol
// Replies are defined in Protocol




  // Wiring (Separated Behavior) - Type alias now in Protocol
  def commandHandler: ${m.commandHandlerFqn} = ${name}Behaviors.apply



  val entityTypeKey: EntityTypeKey[${name}Command] = EntityTypeKey("${m.typeKey}")
  val tags: Vector[String] = Vector.tabulate(${m.tagCount})(i => s"${m.tagPrefix}-$i")


}
`;
}

export function renderEntity(m) {
  const { name, idType } = m;
  const state = `  case class ${name}State(${m.fields.map((f) => `${f.name}: ${f.type}${f.defaultValue ? ` = ${f.defaultValue}` : ''}`).join(', ')})`;
  const empty = `  def empty(${m.identifier}: ${idType}): ${name}State = ${name}State(${m.identifier}, ${m.fields.filter((f) => f.defaultValue).map((f) => f.defaultValue).join(', ')})`;
  const eventCases = m.events
    .map((e) => `  case class ${e.name}(${e.params.map((p) => `${p.name}: ${p.type}`).join(', ')}) extends ${name}Event`)
    .join('\n');
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${m.base}domain.entities

${imports}

object ${name}Entity {
${state}

${empty}

  sealed trait ${name}Event extends CborSerializable

${eventCases}

  type ${name}EventHandler = (${name}State, ${name}Event) => ${name}State
}
`;
}

export function renderEventHandler(m) {
  const { name } = m;
  const cases = m.events
    .map((e) => `    case event: ${e.name} =>\n      state.copy(${e.folds.map((f) => `${f.slot} = ${f.expr}`).join(', ')})`)
    .join('\n\n');
  const helpers = m.helpers
    .map((h) => `  private def ${h.name}(${h.params.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${h.returnType} = {
    /*
    >>> AI_PROMPT_START
    Context: Domain Entity Helper Method
    Task: Implement logic for ${h.name}
    Description: ${h.description}
    Input Params: ${h.params.map((p) => `${p.name}: ${p.type}`).join(', ')}
    Return: ${h.returnType}
    <<< AI_PROMPT_END
    */
    ???
  }`)
    .join('\n\n');
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${m.base}domain.entities.behaviors

${imports}

object ${name}EventHandler {
  def apply: ${name}EventHandler = (state, event) => event match {
${cases}
    case _ => state // 默认兜底，或者抛异常
  }

${helpers}
}
`;
}

export function renderRepository(m) {
  const { name } = m;
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  return `${m.header}package ${m.base}application.aggregates.repository

${imports}

/**
 * ${name}Repository: Application Layer Repository Interface for ${name}Aggregate
 * The abstraction for interacting with the Aggregate via sharding and persistence.
 */
@ImplementedBy(classOf[${m.implName}])
trait ${name}Repository {

${m.entityRefMethod}

${m.finders.map((f) => `  def ${f.name}(${f.param}): EntityRef[${name}Command]
  // Logic: ${f.logic}`).join('\n\n')}

}

`;
}

export function renderFactory(m) {
  const { name } = m;
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  const params = (ps) => ps.map((p) => `${p.name}: ${p.type}`).join(', ');
  return `${m.header}package ${m.base}application.aggregates.factories

${imports}

/**
 * ${name}AggregateFactory: Aggregate Factory for ${name}Aggregate
 * Creates and manages aggregate instances via cluster sharding
 */
class ${name}AggregateFactory @Inject() (clusterSharding: ClusterSharding)(implicit ec: ExecutionContext) {
  implicit val askTimeout: Timeout = Timeout(10.seconds)

  def ${m.refMethod.name}(${params(m.refMethod.params)}): ${m.refMethod.ret} = {
${m.refMethod.body}
  }

  def ${m.initMethod.name}(${params(m.initMethod.params)}): ${m.initMethod.ret} = {
${m.initMethod.body}
  }

}
`;
}

export function renderBehaviors(m) {
  const { name } = m;
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  const pf = `PartialFunction[${name}Command, Effect[${name}Event, ${name}State]]`;
  const writeGroup = (g) => `  private def ${g.method}(state: ${name}State): ${pf} = {
${g.handlers.map((h) => `    case cmd: ${h.command} => runReplyingPolicy(${h.ruleType}, ${h.helper})(state, cmd).replyWith(cmd.replyTo)`).join('\n')}
  }`;
  const queryGroup = m.queryHandlers.length
    ? `  private def queryBehaviors(state: ${name}State): ${pf} = {
${m.queryHandlers.map((c) => `    case cmd: ${c.command} =>
      /*
      >>> AI_PROMPT_START
      Context: Command Handler
      Task: Handle command '${c.command}'
      State: ${name}State
      Available: repo
      Expected Result: Return Effect.persist(event) or Effect.reply
      <<< AI_PROMPT_END
      */
      Effect.reply(cmd.replyTo)(???) `).join('\n')}
  }`
    : '';
  const groups = [...m.groups.map(writeGroup), queryGroup].filter(Boolean).join('\n');
  return `${m.header}package ${m.base}application.aggregates.behaviors

${imports}

object ${name}Behaviors extends ${name}CommandHelpers {

  type ${name}AggregateCommandHandler = (${name}State, ${name}Command) => Effect[${name}Event, ${name}State]
  def apply: ${name}AggregateCommandHandler = (state, command) => {
    // ==== BEGIN MANUAL ====
    ${m.chain}
    // ==== END MANUAL ====
  }

${groups}
}
`;
}

export function renderHelpers(m) {
  const { name } = m;
  const imports = m.imports.map((i) => `import ${i}`).join('\n');
  const helpers = m.helpers
    .map((h) => `  implicit object ${h.name} extends CommandHelper[${h.command}, ${m.state}, ${h.paramSig}, ${h.reply}] {
    override def toParam(state: ${m.state}, command: ${h.command}): ${h.paramSig} = {
      // ==== BEGIN MANUAL ====
      ${h.toParam} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createFailureReply(param: ${h.paramSig})(error: iMadzError): ${h.reply} = {
      // ==== BEGIN MANUAL ====
      ${h.failure} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }

    override def createSuccessReply(param: ${h.paramSig})(state: ${m.state}): ${h.reply} = {
      // ==== BEGIN MANUAL ====
      ${h.success} // 机械骨架·自定义时改此行
      // ==== END MANUAL ====
    }
  }`)
    .join('\n\n\n');
  return `${m.header}package ${m.base}application.aggregates.behaviors

${imports}


/**
 * 胶水代码库：负责将 Command 转换为 Policy 参数，并将结果包装为 Reply。
 * 这里是 AI 填空的主要战场。
 */

trait ${name}CommandHelpers {


${helpers}


}

`;
}
