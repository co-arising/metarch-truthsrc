// ReadSide & Projection Suite Bridge for scala-cqrs-play-service@2:
// Emits full 1.0 ReadSide / CQRS Projection families for every canonicalV2.structures.readModels[*]:
//   - #15 query-service                  -> application/readmodels/<view_snake>/<View>QueryService.scala
//   - #23 projection-repository-port     -> application/readmodels/<view_snake>/<View>Row.scala + repository/<View>ReadsideRepository.scala
//   - #24 projection-repository-impl     -> infrastructure/repositories/projection/<View>ReadsideRepositoryImpl.scala + <View>ReadsideSchema.scala
//   - #26 projection-apply-event         -> application/projection/handlers/<View>ApplyEvent.scala + *Semantics.scala + *ProjectionModule.scala
//   - #27 projection                     -> application/readmodels/<view_snake>/<View>ReadsideProjection.scala
//   - #28 projection-handler             -> application/readmodels/<view_snake>/<View>ReadsideProjectionHandler.scala
//   - #38b readside-bootstrap            -> infrastructure/bootstrap/<View>ReadsideBootstrap.scala (wired into ApplicationBootstrap!)
import { family as projectionApplyEventFamily } from '../../../emitter/families/projection-apply-event.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { toPascal } from '../codegen/onion-routes.mjs';
import { resolveCanonicalEventFields } from '../structure-loader.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function buildNominalIndex(canonicalV2) {
  const exactByName = new Map();
  for (const ex of canonicalV2.structures?.exactTypes ?? []) exactByName.set(ex.name, ex);
  const voByName = new Map();
  for (const vo of canonicalV2.structures?.valueObjects ?? []) voByName.set(vo.name, vo);
  return { exactByName, voByName };
}

function isNominalRecord(rt, nominalIdx) {
  return Boolean(
    rt?.kind === 'record'
    && rt.typeName
    && (nominalIdx.exactByName.has(rt.typeName) || nominalIdx.voByName.has(rt.typeName)),
  );
}

function scalaTypeOf(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'optional': return `Option[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'sequence': return `Vector[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'map': return `Map[String, ${scalaTypeOf(rt.value, nominalIdx)}]`;
    case 'record':
      if (isNominalRecord(rt, nominalIdx)) return rt.typeName;
      return 'String';
    default: return 'String';
  }
}

function defaultScalaExpr(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return '""';
  switch (rt.kind) {
    case 'int': return '0L';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'decimal': return 'BigDecimal(0)';
    case 'optional': return 'None';
    case 'sequence': return `Vector.empty[${scalaTypeOf(rt.element, nominalIdx)}]`;
    case 'map': return `Map.empty[String, ${scalaTypeOf(rt.value, nominalIdx)}]`;
    case 'record': {
      if (rt.typeName && nominalIdx.exactByName.has(rt.typeName)) {
        return `${rt.typeName}.Zero`;
      }
      const vo = rt.typeName ? nominalIdx.voByName.get(rt.typeName) : null;
      if (vo) {
        const voFields = (vo.fields ?? []).length > 0
          ? vo.fields
          : [{ name: 'value', resolvedType: { kind: 'string' } }];
        return `${vo.name}(${voFields.map(ff => defaultScalaExpr(ff.resolvedType, nominalIdx)).join(', ')})`;
      }
      return '""';
    }
    default: return '""';
  }
}

function sqlColumnType(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return 'VARCHAR(255) NOT NULL DEFAULT \'\'';
  switch (rt.kind) {
    case 'int': return 'BIGINT NOT NULL DEFAULT 0';
    case 'bool': return 'BOOLEAN NOT NULL DEFAULT FALSE';
    case 'decimal': return 'DECIMAL(38, 6) NOT NULL DEFAULT 0';
    case 'sequence': return 'TEXT NOT NULL DEFAULT \'[]\'';
    case 'map': return 'TEXT NOT NULL DEFAULT \'{}\'';
    case 'record':
      if (rt.typeName && nominalIdx.exactByName.has(rt.typeName)) return 'VARCHAR(128) NOT NULL DEFAULT \'\'';
      if (rt.typeName && nominalIdx.voByName.has(rt.typeName)) return 'TEXT NOT NULL DEFAULT \'{}\'';
      return 'VARCHAR(255) NOT NULL DEFAULT \'\'';
    case 'optional':
      switch (rt.element?.kind) {
        case 'int': return 'BIGINT NULL';
        case 'bool': return 'BOOLEAN NULL';
        case 'decimal': return 'DECIMAL(38, 6) NULL';
        case 'sequence':
        case 'map':
        case 'record': return 'TEXT NULL';
        default: return 'VARCHAR(512) NULL';
      }
    default: return 'VARCHAR(255) NOT NULL DEFAULT \'\'';
  }
}

function exactDecodeExpr(rawVar, ex) {
  if (ex.form === 'unit-decimal') {
    return `{ val parts = ${rawVar}.split("\\\\|", 2); if (parts.length == 2) scala.util.Try(BigDecimal(parts(0))).toOption.flatMap(a => ${ex.name}.create(a, parts(1)).toOption) else None }`;
  }
  return `scala.util.Try(BigDecimal(${rawVar})).toOption.flatMap(a => ${ex.name}.create(a).toOption)`;
}

function exactEncodeExpr(valExpr, ex) {
  const amtField = ex.amountField ?? (ex.form === 'unit-decimal' ? 'amount' : 'value');
  if (ex.form === 'unit-decimal') {
    const unitField = ex.unitField ?? 'currency';
    return `s"\${${valExpr}.${amtField}.bigDecimal.toPlainString}|\${${valExpr}.${unitField}}"`;
  }
  return `${valExpr}.${amtField}.bigDecimal.toPlainString`;
}

function jsEncodeExpr(valExpr, rt, nominalIdx, depth = 0) {
  if (!rt || typeof rt !== 'object') return `Json.toJson(${valExpr}.toString)`;
  const v = `v${depth}`;
  switch (rt.kind) {
    case 'int':
    case 'bool':
    case 'string':
    case 'decimal':
      return `Json.toJson(${valExpr})`;
    case 'optional':
      return `${valExpr}.map(${v} => (${jsEncodeExpr(v, rt.element, nominalIdx, depth + 1)}): play.api.libs.json.JsValue).getOrElse(play.api.libs.json.JsNull)`;
    case 'sequence':
      return `play.api.libs.json.JsArray(${valExpr}.map(${v} => (${jsEncodeExpr(v, rt.element, nominalIdx, depth + 1)}): play.api.libs.json.JsValue))`;
    case 'map':
      return `play.api.libs.json.JsObject(${valExpr}.map { case (k${depth}, ${v}) => k${depth} -> ((${jsEncodeExpr(v, rt.value, nominalIdx, depth + 1)}): play.api.libs.json.JsValue) }.toSeq)`;
    case 'record': {
      const ex = rt.typeName ? nominalIdx.exactByName.get(rt.typeName) : null;
      if (ex) return `play.api.libs.json.JsString(${exactEncodeExpr(valExpr, ex)})`;
      const vo = rt.typeName ? nominalIdx.voByName.get(rt.typeName) : null;
      if (vo) {
        const voFields = (vo.fields ?? []).length > 0 ? vo.fields : [{ name: 'value', resolvedType: { kind: 'string' } }];
        return `Json.obj(${voFields.map(ff => `${JSON.stringify(ff.name)} -> ((${jsEncodeExpr(`${valExpr}.${ff.name}`, ff.resolvedType, nominalIdx, depth + 1)}): play.api.libs.json.JsValue)`).join(', ')})`;
      }
      return `Json.toJson(${valExpr}.toString)`;
    }
    default:
      return `Json.toJson(${valExpr}.toString)`;
  }
}

function jsDecodeExpr(jsExpr, rt, nominalIdx, { isLookup = false, depth = 0 } = {}) {
  if (!rt || typeof rt !== 'object') return `${jsExpr}.asOpt[String].getOrElse("")`;
  const j = `j${depth}`;
  switch (rt.kind) {
    case 'int': return `${jsExpr}.asOpt[Long].getOrElse(0L)`;
    case 'bool': return `${jsExpr}.asOpt[Boolean].getOrElse(false)`;
    case 'string': return `${jsExpr}.asOpt[String].getOrElse("")`;
    case 'decimal': return `${jsExpr}.asOpt[BigDecimal].getOrElse(BigDecimal(0))`;
    case 'optional': {
      const optSrc = isLookup ? `${jsExpr}.toOption` : `Option(${jsExpr})`;
      return `${optSrc}.filter(_ != play.api.libs.json.JsNull).map(${j} => ${jsDecodeExpr(j, rt.element, nominalIdx, { isLookup: false, depth: depth + 1 })})`;
    }
    case 'sequence':
      return `${jsExpr}.asOpt[Vector[play.api.libs.json.JsValue]].map(_.map(${j} => ${jsDecodeExpr(j, rt.element, nominalIdx, { isLookup: false, depth: depth + 1 })})).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`;
    case 'map':
      return `${jsExpr}.asOpt[Map[String, play.api.libs.json.JsValue]].map(_.map { case (k${depth}, ${j}) => k${depth} -> ${jsDecodeExpr(j, rt.value, nominalIdx, { isLookup: false, depth: depth + 1 })} }).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`;
    case 'record': {
      const ex = rt.typeName ? nominalIdx.exactByName.get(rt.typeName) : null;
      if (ex) {
        return `${jsExpr}.asOpt[String].flatMap(s${depth} => ${exactDecodeExpr(`s${depth}`, ex)}).getOrElse(${ex.name}.Zero)`;
      }
      const vo = rt.typeName ? nominalIdx.voByName.get(rt.typeName) : null;
      if (vo) {
        const voFields = (vo.fields ?? []).length > 0 ? vo.fields : [{ name: 'value', resolvedType: { kind: 'string' } }];
        return `${vo.name}(${voFields.map(ff => `${ff.name} = ${jsDecodeExpr(`(${jsExpr} \\ ${JSON.stringify(ff.name)})`, ff.resolvedType, nominalIdx, { isLookup: true, depth: depth + 1 })}`).join(', ')})`;
      }
      return `${jsExpr}.asOpt[String].getOrElse("")`;
    }
    default:
      return `${jsExpr}.asOpt[String].getOrElse("")`;
  }
}

function typeHasNestedOptional(rt, insideContainer = false) {
  if (!rt || typeof rt !== 'object') return false;
  if (rt.kind === 'optional') return insideContainer || typeHasNestedOptional(rt.element, true);
  if (rt.kind === 'sequence') return typeHasNestedOptional(rt.element, true);
  if (rt.kind === 'map') return typeHasNestedOptional(rt.value, true);
  return false;
}

function needsExplicitJsCodec(rt, nominalIdx) {
  return typeUsesNominal(rt, nominalIdx) || typeHasNestedOptional(rt, false);
}

function rsGetterExpr(f, nominalIdx) {
  const col = toSnake(f.name);
  const rt = f.resolvedType;
  switch (rt?.kind) {
    case 'int': return `rs.long("${col}")`;
    case 'bool': return `rs.boolean("${col}")`;
    case 'decimal': return `Option(rs.bigDecimal("${col}")).map(BigDecimal(_)).getOrElse(BigDecimal(0))`;
    case 'sequence':
      return needsExplicitJsCodec(rt, nominalIdx)
        ? `scala.util.Try(${jsDecodeExpr(`Json.parse(rs.stringOpt("${col}").getOrElse("[]"))`, rt, nominalIdx)}).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`
        : `scala.util.Try(Json.parse(rs.stringOpt("${col}").getOrElse("[]")).as[${scalaTypeOf(rt, nominalIdx)}]).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`;
    case 'map':
      return needsExplicitJsCodec(rt, nominalIdx)
        ? `scala.util.Try(${jsDecodeExpr(`Json.parse(rs.stringOpt("${col}").getOrElse("{}"))`, rt, nominalIdx)}).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`
        : `scala.util.Try(Json.parse(rs.stringOpt("${col}").getOrElse("{}")).as[${scalaTypeOf(rt, nominalIdx)}]).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`;
    case 'record': {
      const ex = rt.typeName ? nominalIdx.exactByName.get(rt.typeName) : null;
      if (ex) {
        return `rs.stringOpt("${col}").flatMap(raw => ${exactDecodeExpr('raw', ex)}).getOrElse(${ex.name}.Zero)`;
      }
      if (rt.typeName && nominalIdx.voByName.has(rt.typeName)) {
        return `scala.util.Try(${jsDecodeExpr(`Json.parse(rs.stringOpt("${col}").getOrElse("{}"))`, rt, nominalIdx)}).getOrElse(${defaultScalaExpr(rt, nominalIdx)})`;
      }
      return `rs.string("${col}")`;
    }
    case 'optional': {
      const el = rt.element;
      switch (el?.kind) {
        case 'int': return `rs.longOpt("${col}")`;
        case 'bool': return `rs.booleanOpt("${col}")`;
        case 'decimal': return `rs.bigDecimalOpt("${col}").map(BigDecimal(_))`;
        case 'sequence':
        case 'map':
          return `rs.stringOpt("${col}").flatMap(raw => scala.util.Try(${jsDecodeExpr('Json.parse(raw)', el, nominalIdx)}).toOption)`;
        case 'record': {
          const ex = el.typeName ? nominalIdx.exactByName.get(el.typeName) : null;
          if (ex) return `rs.stringOpt("${col}").flatMap(raw => ${exactDecodeExpr('raw', ex)})`;
          if (el.typeName && nominalIdx.voByName.has(el.typeName)) {
            return `rs.stringOpt("${col}").flatMap(raw => scala.util.Try(${jsDecodeExpr('Json.parse(raw)', el, nominalIdx)}).toOption)`;
          }
          return `rs.stringOpt("${col}")`;
        }
        default: return `rs.stringOpt("${col}")`;
      }
    }
    default: return `rs.string("${col}")`;
  }
}

function sqlBindExpr(f, nominalIdx) {
  const rt = f.resolvedType;
  if (rt?.kind === 'sequence' || rt?.kind === 'map') {
    return needsExplicitJsCodec(rt, nominalIdx)
      ? `Json.stringify(${jsEncodeExpr(`row.${f.name}`, rt, nominalIdx)})`
      : `Json.stringify(Json.toJson(row.${f.name}))`;
  }
  if (rt?.kind === 'record') {
    const ex = rt.typeName ? nominalIdx.exactByName.get(rt.typeName) : null;
    if (ex) return exactEncodeExpr(`row.${f.name}`, ex);
    if (rt.typeName && nominalIdx.voByName.has(rt.typeName)) {
      return `Json.stringify(${jsEncodeExpr(`row.${f.name}`, rt, nominalIdx)})`;
    }
  }
  if (rt?.kind === 'optional') {
    const el = rt.element;
    if (el?.kind === 'sequence' || el?.kind === 'map') {
      return `row.${f.name}.map(optV => Json.stringify(${jsEncodeExpr('optV', el, nominalIdx, 1)}))`;
    }
    if (el?.kind === 'record') {
      const ex = el.typeName ? nominalIdx.exactByName.get(el.typeName) : null;
      if (ex) return `row.${f.name}.map(optV => ${exactEncodeExpr('optV', ex)})`;
      if (el.typeName && nominalIdx.voByName.has(el.typeName)) {
        return `row.${f.name}.map(optV => Json.stringify(${jsEncodeExpr('optV', el, nominalIdx, 1)}))`;
      }
    }
  }
  return `row.${f.name}`;
}

function needsJsonCodec(rowFields, nominalIdx) {
  return rowFields.some((f) => {
    const rt = f.resolvedType;
    const k = rt?.kind;
    if (k === 'sequence' || k === 'map') return true;
    if (k === 'record' && rt.typeName && nominalIdx.voByName.has(rt.typeName)) return true;
    if (k === 'optional') {
      const ek = rt.element?.kind;
      if (ek === 'sequence' || ek === 'map') return true;
      if (ek === 'record' && rt.element.typeName && nominalIdx.voByName.has(rt.element.typeName)) return true;
    }
    return false;
  });
}

function typeUsesNominal(rt, nominalIdx) {
  if (!rt || typeof rt !== 'object') return false;
  if (isNominalRecord(rt, nominalIdx)) return true;
  if (rt.kind === 'optional' || rt.kind === 'sequence') return typeUsesNominal(rt.element, nominalIdx);
  if (rt.kind === 'map') return typeUsesNominal(rt.value, nominalIdx);
  return false;
}

function buildRowFieldsAndKey(rm) {
  const fields = (rm.fields ?? []).map(f => ({
    name: f.name,
    resolvedType: f.resolvedType ?? { kind: 'string' },
    source: f.source ?? null,
  }));
  const isString = f => (f.resolvedType?.kind ?? 'string') === 'string';
  const existingKey = fields.find(f => f.name === 'id' && isString(f))
    ?? fields.find(f => f.name.endsWith('Id') && isString(f));
  if (existingKey) {
    return { rowFields: fields, keyField: existingKey.name };
  }
  const taken = new Set(fields.map(f => f.name));
  let synthName = 'rowKey';
  if (!taken.has('id')) synthName = 'id';
  else if (!taken.has('persistenceId')) synthName = 'persistenceId';
  fields.unshift({ name: synthName, resolvedType: { kind: 'string' }, synthetic: true });
  return { rowFields: fields, keyField: synthName };
}

/**
 * Emit full ReadSide / Projection Suite for all canonicalV2.structures.readModels[*].
 */
export function emitV1ReadsideSuite(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const pkgDir = packageName.split('.').join('/');
  const readModels = canonicalV2.structures?.readModels ?? [];
  const aggregates = canonicalV2.structures?.aggregates ?? [];
  const nominalIdx = buildNominalIndex(canonicalV2);
  const files = {};
  const readsideProjections = [];
  const familiesUsed = [];
  const handwrittenFiles = {};
  let projectionModuleClass = null;

  if (readModels.length === 0) {
    return { files, handwrittenFiles, readsideProjections, projectionModuleClass, familiesUsed };
  }

  const validApplyViews = [];
  const canUseApplyEventPkg = packageName.split('.').every(p => /^[a-z][a-zA-Z0-9]*$/u.test(p));

  for (const rm of readModels) {
    const rawPascal = toPascal(rm.name);
    const stem = rawPascal.replace(/View$/u, '');
    const viewName = `${stem}View`;
    const readsideName = `${stem}Readside`;
    const subPkgSeg = toSnake(readsideName);
    const subpackage = `application.readmodels.${subPkgSeg}`;
    const subDir = `app/${pkgDir}/application/readmodels/${subPkgSeg}`;
    const tableName = `${toSnake(context)}_${toSnake(viewName)}`;
    const { rowFields, keyField } = buildRowFieldsAndKey(rm);
    const keyCol = toSnake(keyField);
    const knowledgeAnchor = `// @knowledge source:${docId}#/readModels/${rm.name}`;

    // Register for service-runtime (#38) ApplicationBootstrap wiring!
    readsideProjections.push({ name: readsideName, subpackage });

    // Collect mapped domain events (via `source: eventField:[Agg.]Event.field`)
    const evMap = new Map();
    for (const f of rm.fields ?? []) {
      const src = String(f.source ?? '');
      const m = src.match(/^eventField:(?:([A-Za-z0-9_]+)\.)?([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/u);
      if (!m) continue;
      let aggName = m[1] || rm.sourceAggregate;
      const evName = m[2];
      const evField = m[3];
      if (!aggName) {
        aggName = aggregates.find(a => (a.events ?? []).some(e => e.name === evName))?.name;
      }
      if (!aggName) continue;
      const key = `${aggName}.${evName}`;
      if (!evMap.has(key)) {
        evMap.set(key, {
          aggName,
          name: evName,
          fqn: `${packageName}.domain.entities.${aggName}Entity.${evName}`,
          applyForm: 'create',
          columns: [],
        });
      }
      const aggObj = aggregates.find(a => a.name === aggName);
      const evObj = (aggObj?.events ?? []).find(e => e.name === evName);
      const evFields = aggObj && evObj ? resolveCanonicalEventFields(aggObj, evObj) : (evObj?.fields ?? []);
      const evFieldDef = evFields.find(ef => ef.name === evField);
      const evFieldType = evFieldDef?.resolvedType ?? null;
      const rmFieldType = f.resolvedType ?? null;
      let colValue = `e.${evField}`;
      if (rmFieldType?.kind === 'optional' && evFieldType && evFieldType.kind !== 'optional') {
        colValue = `Some(e.${evField})`;
      } else if (rmFieldType && rmFieldType.kind !== 'optional' && evFieldType?.kind === 'optional') {
        colValue = `e.${evField}.getOrElse(${defaultScalaExpr(rmFieldType, nominalIdx)})`;
      }
      evMap.get(key).columns.push({ name: f.name, value: colValue });
    }
    // F1 fix: also project `stateField:` / `aggregateIdentity` read models across declared `sourceEvents`
    if (evMap.size === 0 && rm.sourceAggregate) {
      const aggObj = aggregates.find(a => a.name === rm.sourceAggregate);
      if (aggObj) {
        const declaredEvNames = Array.isArray(rm.sourceEvents) && rm.sourceEvents.length > 0
          ? rm.sourceEvents
          : (aggObj.events ?? []).map(e => e.name);
        const eventFolds = canonicalV2.eventFolds ?? [];
        for (const evName of declaredEvNames) {
          const evObj = (aggObj.events ?? []).find(e => e.name === evName);
          if (!evObj) continue;
          const evFields = resolveCanonicalEventFields(aggObj, evObj);
          const fold = eventFolds.find(ef => ef.aggregate === aggObj.name && ef.event === evName);
          const foldAssigns = fold?.assignments ?? [];
          const columns = [];
          for (const f of rm.fields ?? []) {
            const src = String(f.source ?? '');
            const sfMatch = src.match(/^stateField:([A-Za-z0-9_]+)$/u);
            if (!sfMatch) continue;
            const sfName = sfMatch[1];
            const evFieldDef = evFields.find(ef => ef.name === sfName);
            const rmFieldType = f.resolvedType ?? null;
            if (evFieldDef) {
              const evFieldType = evFieldDef.resolvedType ?? null;
              let colValue = `e.${sfName}`;
              if (rmFieldType?.kind === 'optional' && evFieldType && evFieldType.kind !== 'optional') {
                colValue = `Some(e.${sfName})`;
              } else if (rmFieldType && rmFieldType.kind !== 'optional' && evFieldType?.kind === 'optional') {
                colValue = `e.${sfName}.getOrElse(${defaultScalaExpr(rmFieldType, nominalIdx)})`;
              }
              columns.push({ name: f.name, value: colValue });
              continue;
            }
            const assign = foldAssigns.find(a => a.field === sfName || a.target === sfName);
            const litVal = assign?.value?.kind === 'literal' ? assign.value.value : null;
            if (litVal !== null && litVal !== undefined) {
              if (typeof litVal === 'string') columns.push({ name: f.name, value: JSON.stringify(litVal) });
              else if (typeof litVal === 'boolean') columns.push({ name: f.name, value: String(litVal) });
              else if (typeof litVal === 'number') {
                columns.push({ name: f.name, value: rmFieldType?.kind === 'decimal' ? `BigDecimal(${JSON.stringify(String(litVal))})` : `${litVal}L` });
              }
            }
          }
          evMap.set(`${aggObj.name}.${evName}`, {
            aggName: aggObj.name,
            name: evName,
            fqn: `${packageName}.domain.entities.${aggObj.name}Entity.${evName}`,
            applyForm: 'create',
            columns,
          });
        }
      }
    }
    const mappedEvents = [...evMap.values()];

    // 1. #23 ReadModel Row + Projection Repository Port
    const usesValues = rowFields.some(f => typeUsesNominal(f.resolvedType, nominalIdx));
    const valuesImport = usesValues ? [`import ${packageName}.domain.values._`] : [];
    const rowFieldDefs = rowFields.map(f => `  ${f.name}: ${scalaTypeOf(f.resolvedType, nominalIdx)} = ${defaultScalaExpr(f.resolvedType, nominalIdx)}`);
    files[`${subDir}/${viewName}.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      ...valuesImport,
      `import ${rp.commonPackage}.CommonTypes.ReadModel`,
      '',
      `final case class ${viewName}(`,
      rowFieldDefs.join(',\n'),
      ') extends ReadModel',
      '',
    ].join('\n');

    files[`${subDir}/repository/${readsideName}Repository.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}.repository`,
      '',
      `import ${packageName}.${subpackage}.${viewName}`,
      'import scala.concurrent.Future',
      '',
      `trait ${readsideName}Repository {`,
      `  def findById(${keyField}: String): Future[Option[${viewName}]]`,
      `  def list(page: Int = 1, pageSize: Int = 50): Future[Seq[${viewName}]]`,
      `  def upsert(row: ${viewName}): Future[Unit]`,
      `  def deleteById(${keyField}: String): Future[Unit]`,
      '}',
      '',
    ].join('\n');

    // 2. #15 Query Service (CQRS Read Side Application Service)
    files[`${subDir}/${viewName}QueryService.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import javax.inject.{Inject, Singleton}',
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.Future',
      '',
      '@Singleton',
      `final class ${viewName}QueryService @Inject()(repository: ${readsideName}Repository) {`,
      `  def getById(${keyField}: String): Future[Option[${viewName}]] =`,
      `    repository.findById(${keyField})`,
      '',
      `  def list(page: Int = 1, pageSize: Int = 50): Future[Seq[${viewName}]] =`,
      '    repository.list(math.max(1, page), math.min(200, math.max(1, pageSize)))',
      '}',
      '',
    ].join('\n');

    // 3. #28 Projection Handler (matches service-runtime ApplicationBootstrap `Bindings` contract!)
    const eventImports = [...new Set(mappedEvents.map(ev => `import ${packageName}.domain.entities.${ev.aggName}Entity`))];
    const matchCases = mappedEvents.length > 0
      ? mappedEvents.map(ev => {
          const assignments = ev.columns.map(c => `${c.name} = ${c.value}`).join(', ');
          const upsertExpr = assignments.length > 0 ? `base.copy(${assignments})` : 'base';
          return [
            `      case e: ${ev.aggName}Entity.${ev.name} =>`,
            `        val base = ${viewName}(${keyField} = envelope.persistenceId)`,
            `        repository.upsert(${upsertExpr}).map(_ => Done)`,
          ].join('\n');
        })
      : [];

    files[`${subDir}/${readsideName}ProjectionHandler.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import akka.Done',
      'import akka.projection.eventsourced.EventEnvelope',
      'import akka.projection.scaladsl.Handler',
      ...valuesImport,
      ...eventImports,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.{ExecutionContext, Future}',
      '',
      `object ${readsideName}ProjectionHandler {`,
      '  /** Hook trait bound in DI for custom readside transformation or enrichment semantics. */',
      '  trait Bindings {',
      `    def onUnmatchedEvent(envelope: EventEnvelope[Any]): Future[Done] = Future.successful(Done)`,
      '  }',
      '  object DefaultBindings extends Bindings',
      '}',
      '',
      `final class ${readsideName}ProjectionHandler(`,
      `  repository: ${readsideName}Repository,`,
      `  bindings: ${readsideName}ProjectionHandler.Bindings = ${readsideName}ProjectionHandler.DefaultBindings`,
      ')(implicit ec: ExecutionContext) extends Handler[EventEnvelope[Any]] {',
      '  override def process(envelope: EventEnvelope[Any]): Future[Done] =',
      '    envelope.event match {',
      ...matchCases,
      '      case _ => bindings.onUnmatchedEvent(envelope)',
      '    }',
      '}',
      '',
    ].join('\n');

    // 4. #27 Akka Projection Definition
    files[`${subDir}/${readsideName}Projection.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import akka.actor.typed.ActorSystem',
      'import akka.persistence.query.Offset',
      'import akka.projection.ProjectionId',
      'import akka.projection.eventsourced.EventEnvelope',
      'import akka.projection.eventsourced.scaladsl.EventSourcedProvider',
      'import akka.projection.jdbc.JdbcSession',
      'import akka.projection.jdbc.scaladsl.JdbcProjection',
      'import akka.projection.scaladsl.{AtLeastOnceProjection, SourceProvider}',
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.ExecutionContext',
      '',
      `object ${readsideName}Projection {`,
      `  val ProjectionName: String = ${JSON.stringify(`${toSnake(context)}-${toSnake(readsideName)}`)};`,
      '',
      '  def sourceProvider(',
      '    system: ActorSystem[Nothing],',
      '    readJournalPluginId: String,',
      '    tag: String',
      '  ): SourceProvider[Offset, EventEnvelope[Any]] =',
      '    EventSourcedProvider.eventsByTag[Any](system, readJournalPluginId, tag)',
      '',
      '  def createHandler(',
      `    repository: ${readsideName}Repository,`,
      `    bindings: ${readsideName}ProjectionHandler.Bindings`,
      `  )(implicit ec: ExecutionContext): ${readsideName}ProjectionHandler =`,
      `    new ${readsideName}ProjectionHandler(repository, bindings)`,
      '',
      '  def projectionId(tag: String): ProjectionId =',
      '    ProjectionId(ProjectionName, tag)',
      '',
      '  def createProjection(',
      '    system: ActorSystem[Nothing],',
      '    readJournalPluginId: String,',
      '    tag: String,',
      `    repository: ${readsideName}Repository,`,
      `    bindings: ${readsideName}ProjectionHandler.Bindings,`,
      '    sessionFactory: () => JdbcSession',
      '  )(implicit ec: ExecutionContext): AtLeastOnceProjection[Offset, EventEnvelope[Any]] =',
      '    JdbcProjection.atLeastOnceAsync(',
      '      projectionId = projectionId(tag),',
      '      sourceProvider = sourceProvider(system, readJournalPluginId, tag),',
      '      sessionFactory = sessionFactory,',
      '      handler = () => createHandler(repository, bindings)',
      '    )(system)',
      '}',
      '',
    ].join('\n');

    // 5. #24 Projection Repository Implementation + Schema DDL (idiomatic Scala triple-quoted SQL!)
    const ddlCols = rowFields.map((f) => {
      const col = toSnake(f.name);
      const pk = f.name === keyField ? ' PRIMARY KEY' : '';
      return `      |  ${col} ${sqlColumnType(f.resolvedType, nominalIdx)}${pk}`;
    }).join(',\n');

    const colNames = rowFields.map(f => toSnake(f.name));
    const colPlaceholders = rowFields.map(f => `\${${sqlBindExpr(f, nominalIdx)}}`);
    const updateAssignments = rowFields.filter(f => f.name !== keyField).map(f => `${toSnake(f.name)} = EXCLUDED.${toSnake(f.name)}`).join(', ');
    const jsonImport = needsJsonCodec(rowFields, nominalIdx) ? ['import play.api.libs.json.Json'] : [];

    files[`app/${pkgDir}/infrastructure/repositories/projection/${readsideName}Schema.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.repositories.projection`,
      '',
      `object ${readsideName}Schema {`,
      `  val tableName: String = ${JSON.stringify(tableName)}`,
      '',
      '  val createTableDdl: String =',
      `    """|CREATE TABLE IF NOT EXISTS ${tableName} (`,
      ddlCols,
      '      |);""".stripMargin',
      '}',
      '',
    ].join('\n');

    files[`app/${pkgDir}/infrastructure/repositories/projection/${readsideName}RepositoryImpl.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.repositories.projection`,
      '',
      'import javax.inject.{Inject, Singleton}',
      ...valuesImport,
      `import ${packageName}.${subpackage}.${viewName}`,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      ...jsonImport,
      'import scalikejdbc._',
      'import scala.concurrent.{ExecutionContext, Future}',
      '',
      '@Singleton',
      `final class ${readsideName}RepositoryImpl @Inject()(implicit ec: ExecutionContext) extends ${readsideName}Repository {`,
      `  private def fromResultSet(rs: WrappedResultSet): ${viewName} =`,
      `    ${viewName}(`,
      rowFields.map(f => `      ${f.name} = ${rsGetterExpr(f, nominalIdx)}`).join(',\n'),
      '    )',
      '',
      `  override def findById(${keyField}: String): Future[Option[${viewName}]] = Future {`,
      '    DB.readOnly { implicit session =>',
      `      sql"SELECT ${colNames.join(', ')} FROM ${tableName} WHERE ${keyCol} = $${keyField}"`,
      '        .map(fromResultSet)',
      '        .single()',
      '        .apply()',
      '    }',
      '  }',
      '',
      `  override def list(page: Int, pageSize: Int): Future[Seq[${viewName}]] = Future {`,
      '    val offset = (math.max(1, page) - 1) * math.max(1, pageSize)',
      '    DB.readOnly { implicit session =>',
      `      sql"SELECT ${colNames.join(', ')} FROM ${tableName} ORDER BY ${keyCol} LIMIT $$pageSize OFFSET $$offset"`,
      '        .map(fromResultSet)',
      '        .list()',
      '        .apply()',
      '    }',
      '  }',
      '',
      `  override def upsert(row: ${viewName}): Future[Unit] = Future {`,
      '    DB.localTx { implicit session =>',
      updateAssignments
        ? `      sql"""|INSERT INTO ${tableName} (${colNames.join(', ')})
            |VALUES (${colPlaceholders.join(', ')})
            |ON CONFLICT (${keyCol}) DO UPDATE SET ${updateAssignments}""".stripMargin.update().apply()`
        : `      sql"""|INSERT INTO ${tableName} (${colNames.join(', ')})
            |VALUES (${colPlaceholders.join(', ')})
            |ON CONFLICT (${keyCol}) DO NOTHING""".stripMargin.update().apply()`,
      '      ()',
      '    }',
      '  }',
      '',
      `  override def deleteById(${keyField}: String): Future[Unit] = Future {`,
      '    DB.localTx { implicit session =>',
      `      sql"DELETE FROM ${tableName} WHERE ${keyCol} = $${keyField}".update().apply()`,
      '      ()',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    // 6. #38b ReadSide Bootstrap trait (mixed into ApplicationBootstrap by 1.0 service-runtime!)
    files[`app/${pkgDir}/infrastructure/bootstrap/${readsideName}Bootstrap.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.bootstrap`,
      '',
      'import akka.actor.typed.ActorSystem',
      'import akka.cluster.sharding.typed.scaladsl.ShardedDaemonProcess',
      'import akka.projection.ProjectionBehavior',
      `import ${packageName}.${subpackage}.{${readsideName}Projection, ${readsideName}ProjectionHandler}`,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      `import ${packageName}.infrastructure.persistence.ScalikeJdbcProjectionSession`,
      'import scala.concurrent.ExecutionContext',
      '',
      `trait ${readsideName}Bootstrap {`,
      `  protected def init${readsideName}Projection(`,
      '    system: ActorSystem[Nothing],',
      '    readJournalPluginId: String,',
      '    tags: Vector[String],',
      `    repository: ${readsideName}Repository,`,
      `    bindings: ${readsideName}ProjectionHandler.Bindings`,
      '  )(implicit ec: ExecutionContext): Unit = {',
      '    if (tags.nonEmpty && readJournalPluginId.nonEmpty && readJournalPluginId != "disabled") {',
      '      ShardedDaemonProcess(system).init[ProjectionBehavior.Command](',
      `        name = ${readsideName}Projection.ProjectionName,`,
      '        numberOfInstances = tags.size,',
      '        behaviorFactory = idx =>',
      '          ProjectionBehavior(',
      `            ${readsideName}Projection.createProjection(system, readJournalPluginId, tags(idx), repository, bindings, () => new ScalikeJdbcProjectionSession())`,
      '          ),',
      '        stopMessage = ProjectionBehavior.Stop',
      '      )',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    // Collect for real 1.0 #26 projection-apply-event family
    if (mappedEvents.length > 0 && canUseApplyEventPkg) {
      // Also emit the Table row companion expected by 1.0 #26 (`application.projection.repository.<Stem>Table.<ViewName>`)
      files[`app/${pkgDir}/application/projection/repository/${stem}Table.scala`] = [
        knowledgeAnchor,
        `package ${packageName}.application.projection.repository`,
        '',
        `object ${stem}Table {`,
        `  type ${viewName} = ${packageName}.${subpackage}.${viewName}`,
        `  val ${viewName} = ${packageName}.${subpackage}.${viewName}`,
        '}',
        '',
      ].join('\n');

      validApplyViews.push({
        viewLabel: rm.description || viewName,
        viewName,
        tableObject: `${stem}Table`,
        kernelClass: `${stem}ApplyEvent`,
        semanticsFace: `${stem}ApplyEventSemantics`,
        semanticsImpl: `${stem}ApplyEventSemanticsImpl`,
        identityScheme: null,
        hooks: ['emptyRow'],
        kernelHelpers: [],
        events: mappedEvents.map(ev => ({
          name: ev.name,
          fqn: ev.fqn,
          applyForm: ev.applyForm,
          columns: ev.columns,
        })),
      });

      // Handwritten isolation zone implementation for #26 <Stem>ApplyEventSemantics (never overwritten once created)
      handwrittenFiles[`handwritten/scala/${pkgDir}/infrastructure/projection/${stem}ApplyEventSemanticsImpl.scala`] = [
        `// Handwritten readside business-semantics isolation zone for ${viewName} (family #26).`,
        `// Bound by ${toPascal(context)}ProjectionModule; truthsrc generate-v2 will never overwrite this file.`,
        `package ${packageName}.infrastructure.projection`,
        '',
        `import ${packageName}.application.projection.handlers.${stem}ApplyEventSemantics`,
        `import ${packageName}.application.projection.repository.${stem}Table.${viewName}`,
        '',
        `final class ${stem}ApplyEventSemanticsImpl extends ${stem}ApplyEventSemantics {`,
        `  override def emptyRow: ${viewName} = ${viewName}()`,
        '}',
        '',
      ].join('\n');
    }
  }

  familiesUsed.push(
    'query-service',
    'projection-repository-port',
    'projection-repository-implementation',
    'projection',
    'projection-handler',
    'readside-bootstrap',
  );

  // 7. Invoke real 1.0 #26 projection-apply-event family whenever eventField mappings exist
  if (validApplyViews.length > 0) {
    try {
      const moduleName = `${toPascal(context)}ProjectionModule`;
      const paeOut = projectionApplyEventFamily.renderAll({
        schemaVersion: 'truthsrc.projection-apply-event-input/v1',
        basePackage: packageName,
        moduleName,
        views: validApplyViews,
        supplied: [],
      });
      Object.assign(files, paeOut);
      familiesUsed.push('projection-apply-event');
      projectionModuleClass = `${packageName}.infrastructure.bootstrap.${moduleName}`;
    } catch {
      // Fail-open if a readModel has non-standard eventField mappings; standard ReadSide projection files remain emitted.
    }
  }

  return { files, handwrittenFiles, readsideProjections, projectionModuleClass, familiesUsed };
}
