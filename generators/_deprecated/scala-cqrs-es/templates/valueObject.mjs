// valueObject.mjs — shared value-object rendering (V4-16), ported from ValueObjectTemplate:
// doc block (concept line + member @param lines in ONE block — the single-block discipline,
// see KnowledgeAnchorDoc), final case class with derived predicates (or the stub comment),
// companion jsonFormat in three shapes:
//   ≤22 fields, no defaults → Json.format macro
//   ≤22 fields with defaults → Json.using[… DefaultValues] (macro reads fall back to ctor defaults)
//   >22 fields → explicit reads/writes hand-fold (Function22 unapply wall — ConceptDelta 判例)
// Instant-member VOs prepend the private instantFormat (ISO-8601 via string).
import { headerOf } from '../builders/models.mjs';

const instantFormatLines = [
  '  private implicit val instantFormat: play.api.libs.json.Format[java.time.Instant] = play.api.libs.json.Format(',
  '    play.api.libs.json.Reads[java.time.Instant](js => js.validate[String].map(java.time.Instant.parse)),',
  '    play.api.libs.json.Writes[java.time.Instant](i => play.api.libs.json.JsString(i.toString)))',
];

export function renderValueObject(vo, env) {
  const lines = [];
  lines.push(...headerOf(env).split('\n').filter((l) => l !== ''));
  lines.push(`package ${vo.pkg}`, '');

  // imports: dependencies.filter(shouldImport).sortBy(fqn).distinct — depImportsOf is already
  // same-package-free and the Set dedupes, so the sort is the only remaining engine step.
  // Blank topology (SourceFile.code, byte-verified against five live shapes): pkg + blank;
  // non-empty import section = import lines + ONE trailing blank, empty section = THREE blanks
  // (empty decl line + its trailing + the defs join); a doc block adds block + one blank; a
  // no-doc file adds nothing before the class.
  if (vo.imports.length) lines.push(...vo.imports.map((i) => `import ${i}`), '');
  else lines.push('', '');

  // VO knowledge anchors: concept line (own noteId only — carrier ids would mint orphans) and
  // member lines fused into the SAME block (two adjacent blocks swallow the concept anchor).
  const docLines = [];
  if (vo.ownNoteId) docLines.push(`@knowledge ${vo.ownNoteId}${env.anchor(vo.ownNoteId)}`);
  for (const f of vo.fields) {
    if (!f.noteId) continue;
    const desc = f.description ? ` ${f.description}` : '';
    docLines.push(`@param ${f.name}${desc}  @knowledge ${f.noteId}${env.anchor(f.noteId)}`);
  }
  if (docLines.length) lines.push('/**', ...docLines.map((l) => ` * ${l}`), ' */', '');

  // case class: one-line signature, raw-expr defaults; body = derived predicates or the stub.
  const params = vo.fields
    .map((f) => `${f.name}: ${f.sig}${f.defaultValue ? ` = ${f.defaultValue}` : ''}`)
    .join(', ');
  lines.push(`final case class ${vo.name}(${params}) {`);
  if (vo.logicMethods.length) lines.push(...vo.logicMethods);
  else lines.push('  // Value Object Logic Stubs');
  lines.push('}', '');

  // companion
  lines.push(`object ${vo.name} {`);
  if (vo.fields.some((f) => f.sig === 'Instant')) lines.push(...instantFormatLines);
  lines.push(...formatLines(vo));
  lines.push('}');
  return lines.join('\n') + '\n';
}

function formatLines(vo) {
  const name = vo.name;
  if (vo.fields.length > 22) {
    // manual reads/writes (ValueObjectTemplate manualFormat): required members read strictly,
    // default members fall back to their ctor default (S2-100 two-arm read); writes = full key
    // set in ctor order, three pairs per line.
    const readsArgs = vo.fields.map((f) => (f.defaultValue
      ? `        (json \\ "${f.name}").toOption.map(_.as[${f.sig}]).getOrElse(${f.defaultValue})`
      : `        (json \\ "${f.name}").as[${f.sig}]`));
    readsArgs[readsArgs.length - 1] += '))';    const pairs = vo.fields.map((f) => `"${f.name}" -> d.${f.name}`);
    const writePairs = [];
    for (let i = 0; i < pairs.length; i += 3) writePairs.push(pairs.slice(i, i + 3).join(', '));
    return [
      `  implicit val jsonFormat: play.api.libs.json.OFormat[${name}] = {`,
      '    import play.api.libs.json._',
      `    val reads = new Reads[${name}] {`,
      `      override def reads(json: JsValue): JsResult[${name}] = JsSuccess(${name}(`,
      readsArgs.join(',\n'),
      '    }',
      `    val writes = new OWrites[${name}] {`,
      `      override def writes(d: ${name}): JsObject = Json.obj(`,
      `        ${writePairs.join(',\n        ')})`,
      '    }',
      '    OFormat(reads, writes)',
      '  }',
    ];
  }
  const hasDefaults = vo.fields.some((f) => f.defaultValue);
  const expr = hasDefaults
    ? `play.api.libs.json.Json.using[play.api.libs.json.Json.MacroOptions with play.api.libs.json.Json.DefaultValues].format[${name}]`
    : `play.api.libs.json.Json.format[${name}]`;
  return [`  implicit val jsonFormat: play.api.libs.json.OFormat[${name}] = ${expr}`];
}
