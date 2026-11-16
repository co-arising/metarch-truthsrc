import { fqn, signature } from '../../../lib/classic-architecture/types.mjs';
import { conventions } from '../../../lib/classic-architecture/naming.mjs';
import { InvariantRuleModel } from '../models/invariant-rule.mjs';

export function renderInvariantRule(model) {
  const fields = ['selfType', 'outputType', 'subjectType', 'triggerType', 'superInterface', 'conditions', 'dependencies'];
  if (!model || typeof model !== 'object' || Array.isArray(model)) {
    throw new TypeError('renderInvariantRule requires an InvariantRuleModel');
  }
  for (const key of Reflect.ownKeys(model)) {
    if (!fields.includes(key)) throw new TypeError(`Classic InvariantRuleModel does not admit ${String(key)}`);
  }
  // Check the structural surface without admitting a source/expected shortcut.
  model = InvariantRuleModel(
    model.selfType, model.outputType, model.subjectType, model.triggerType,
    model.superInterface, model.conditions, model.dependencies,
  );

  const pkgDecl = `package ${model.selfType.packageName}`;
  // The raw template has its own FQN filter (not shouldImport). Sort like the
  // template and DSL, but do not dedupe structurally different generic imports.
  const importDecl = model.dependencies
    .map(fqn)
    .sort()
    .filter(name => name !== '' && name !== model.selfType.packageName && !name.startsWith('java.lang'))
    .map(name => `import ${name}`)
    .join('\n');
  // Intentionally no escaping, identifier quoting or business-logic repair.
  const errorsCode = model.conditions
    .map(condition => `  private val ${condition.name}: iMadzError = iMadzError("${condition.errorCode}", "${condition.errorMsg}")`)
    .join('\n');
  const logicCode = model.conditions
    .map(condition => `    // if (${condition.logicDescription}) Left(${condition.name}) // Raw logic injection disabled`)
    .join('\n    // else ');
  const stateParamName = conventions.firstLower(model.subjectType.name);
  const triggerParamName = conventions.firstLower(model.triggerType.name);
  const applyMethodCode = `  def apply(${stateParamName}: ${signature(model.subjectType)}, ${triggerParamName}: ${signature(model.triggerType)}): Either[iMadzError, List[${signature(model.outputType)}]] = {
    /*
    >>> AI_PROMPT_START
    Context: Invariant Rule Execution
    Task: Validate conditions and generate events
    Subject: ${stateParamName}
    Trigger: ${triggerParamName}
    Defined Conditions: ${model.conditions.map(condition => condition.name).join(', ')}
    Goal: If all validations pass (logic below), return Right(List(events...)).
    <<< AI_PROMPT_END
    */
    // Logic disabled for referenced variables mismatch
    /*
    ${logicCode}
    */
${'    '}
    // Result
    {
      // TODO: All conditions passed. Generate events.
      ???
    }
  }`;
  const body = `${errorsCode}\n\n${applyMethodCode}`;
  const definition = `object ${model.selfType.name} extends ${signature(model.superInterface)} {\n${body}\n}`;
  // CodeGenerationDSL.SourceFile keeps every slot, even empty imports, and adds
  // one terminal newline. Stamping and assembly belong to the caller.
  return [pkgDecl, importDecl, definition].join('\n\n') + '\n';
}
