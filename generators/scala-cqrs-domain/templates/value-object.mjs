import { fqn, shouldImport, signature } from '../../../lib/classic-architecture/types.mjs';
import { commentBlock, conceptLine, paramLines } from '../../../lib/classic-architecture/knowledge.mjs';
import { assertUnhashedKnowledge } from '../models/domain-entity.mjs';
import { stripMargin } from '../../../lib/classic-architecture/text.mjs';

function renderField(field) {
  const defaultPart = field.defaultValue === null ? '' : ` = ${field.defaultValue}`;
  // ValueObjectTemplate uses raw field names here (unlike KnowledgeAnchorDoc's
  // @param identifiers). Do not curate or escape the declaration/access names.
  return `${field.name}: ${signature(field.typeRef)}${defaultPart}`;
}

// ValueObjectTemplate.scala:61-90. No macro or asOpt fallback above 22 fields;
// a default is used only for a missing key, not for an invalid present value.
function manualReadsWrites(model) {
  const name = model.selfType.name;
  const readsArgs = model.fields.map(field => {
    const lookup = `        (json \\ "${field.name}")`;
    const fieldType = signature(field.typeRef);
    return field.defaultValue === null
      ? `${lookup}.as[${fieldType}]`
      : `${lookup}.toOption.map(_.as[${fieldType}]).getOrElse(${field.defaultValue})`;
  }).join(',\n');
  const pairs = model.fields.map(field => `"${field.name}" -> d.${field.name}`);
  const groups = [];
  for (let index = 0; index < pairs.length; index += 3) {
    groups.push(pairs.slice(index, index + 3).join(', '));
  }
  const writePairs = groups.join(',\n        ');
  return stripMargin(`  implicit val jsonFormat: play.api.libs.json.OFormat[${name}] = {
    import play.api.libs.json._
    val reads = new Reads[${name}] {
      override def reads(json: JsValue): JsResult[${name}] = JsSuccess(${name}(
${readsArgs}))
    }
    val writes = new OWrites[${name}] {
      override def writes(d: ${name}): JsObject = Json.obj(
        ${writePairs})
    }
    OFormat(reads, writes)
  }`);
}

function companionBody(model) {
  const name = model.selfType.name;
  const instantNeeded = model.fields.some(field => field.typeRef.name === 'Instant');
  const hasDefaults = model.fields.some(field => field.defaultValue !== null);
  const formatExpr = hasDefaults
    ? `play.api.libs.json.Json.using[play.api.libs.json.Json.MacroOptions with play.api.libs.json.Json.DefaultValues].format[${name}]`
    : `play.api.libs.json.Json.format[${name}]`;
  const formatLine = model.fields.length > 22
    ? manualReadsWrites(model)
    : `  implicit val jsonFormat: play.api.libs.json.OFormat[${name}] = ${formatExpr}`;
  // The fixed template detects only direct Instant, not Option[Instant] or
  // collection elements, and keeps its Format private in the companion.
  const lines = instantNeeded ? [
    '  private implicit val instantFormat: play.api.libs.json.Format[java.time.Instant] = play.api.libs.json.Format(',
    '    play.api.libs.json.Reads[java.time.Instant](js => js.validate[String].map(java.time.Instant.parse)),',
    '    play.api.libs.json.Writes[java.time.Instant](i => play.api.libs.json.JsString(i.toString)))',
  ] : [];
  return [...lines, formatLine].join('\n');
}

export function renderValueObject(model) {
  assertUnhashedKnowledge(model);
  const pkgDecl = `package ${model.selfType.packageName}`;
  const importNames = [...new Set(model.dependencies
    .filter(ref => shouldImport(ref, model.selfType.packageName))
    .map(fqn)
    .sort())];
  const importDecl = importNames.map(name => `import ${name}`).join('\n');
  const body = model.logicMethods.length === 0
    ? '  // Value Object Logic Stubs'
    : model.logicMethods.join('\n');
  const parameters = model.fields.map(renderField).join(', ');
  const caseClassDef = `final case class ${model.selfType.name}(${parameters}) {\n${body}\n}`;
  const companionDef = `object ${model.selfType.name} {\n${companionBody(model)}\n}`;
  // Only the VO's own note is a concept annotation. Carrier note IDs remain
  // model/ledger facts. Own and member annotations share one comment block.
  const voDoc = commentBlock([
    ...conceptLine(model.voOwnNoteId),
    ...paramLines(model.fields),
  ]);
  const definitions = voDoc === ''
    ? [caseClassDef, companionDef]
    : [voDoc.slice(0, -1), caseClassDef, companionDef];
  // CodeGenerationDSL.SourceFile: preserve the empty import slot, the blank
  // separator after a comment Definition, and the single trailing newline.
  // The writer's stamp is deliberately not part of this complete source string.
  return [pkgDecl, importDecl, ...definitions].join('\n\n') + '\n';
}
