import { ProductError } from '../../../../../lib/products/request.mjs';
import { signature } from '../../../../../lib/classic-architecture/types.mjs';
import { scalaIdentifier } from '../../../../../lib/classic-architecture/naming.mjs';
import { stripMargin } from '../../../../../lib/classic-architecture/text.mjs';

function customName(dataType) {
  return dataType._type === 'CustomType' ? dataType.typeName : null;
}

// Frozen readExpr: the bounded primitive/Instant/List/Id codec dispatch retains
// rsBigDecimal (undefined in the original file) and the original string fallback.
function readExpr(field, ctx) {
  const col = field.name;
  const dataType = field.dataType;
  switch (dataType._type) {
    case 'IntType': return `rs.int("${col}")`;
    case 'LongType': return `rs.long("${col}")`;
    case 'BooleanType': return `rs.boolean("${col}")`;
    case 'BigDecimalType': return `rsBigDecimal("${col}")`;
    default: return readCustomExpr(col, dataType, ctx);
  }
}

function readCustomExpr(col, dataType, ctx) {
  switch (customName(dataType)) {
    case 'Instant': return `rs.longOpt("${col}").map(java.time.Instant.ofEpochMilli)`;
    case 'List': {
      const inner = dataType.typeParameters[0];
      const innerSig = inner === undefined ? 'String' : signature(ctx.typeResolver.resolve(inner));
      return `Json.parse(rs.string("${col}")).as[List[${innerSig}]]`;
    }
    case 'Id': return `Id.of(rs.string("${col}"))`;
    default: return `rs.string("${col}")`;
  }
}

function bindExpr(field) {
  const name = scalaIdentifier(field.name);
  switch (customName(field.dataType)) {
    case 'Instant': return `view.${name}.map(x => java.lang.Long.valueOf(x.toEpochMilli)).orNull`;
    case 'List': return `Json.toJson(view.${name}).toString()`;
    case 'Id': return `view.${name}.toString`;
    default: return `view.${name}`;
  }
}

function renderUpsert(table, fields, keyColumns) {
  const cols = fields.map(field => `\`${field.name}\``).join(', ');
  const placeholders = fields.map(() => '?').join(', ');
  const updates = fields.filter(field => !keyColumns.includes(field.name))
    .map(field => `\`${field.name}\` = VALUES(\`${field.name}\`)`).join(', ');
  const binds = fields.map(bindExpr).join(',\n          ');
  return stripMargin(`DB.localTx { implicit session =>
             |  sql"""INSERT INTO ${table.tableName}
             |        (${cols})
             |        VALUES (${placeholders})
             |        ON DUPLICATE KEY UPDATE ${updates}"""
             |    .bind(
             |          ${binds}
             |        )
             |    .update.apply()
             |}`);
}

function renderQuery(query, table, fields, dtoName, ctx) {
  const terminal = customName(query.returnType) === 'Option' ? 'headOption' : 'list';
  const cols = fields.map(field => `\`${field.name}\``).join(', ');
  const where = query.parameters.length === 0 ? ''
    : '\n              WHERE ' + query.parameters.map(param => `\`${param.name}\` = ?`).join(' AND ');
  const binds = query.parameters.map(param => param.name).join(', ');
  const bindClause = binds === '' ? '' : `\n          .bind(${binds})`;
  const mapBody = fields.map(field => `${scalaIdentifier(field.name)} = ${readExpr(field, ctx)}`).join(',\n            ');
  return stripMargin(`Future {
             |      DB readOnly { implicit session =>
             |        sql"""SELECT ${cols}
             |              FROM ${table.tableName}${where}"""${bindClause}
             |          .map(rs => ${dtoName}(
             |            ${mapBody}
             |          ))
             |          .${terminal}.apply()
             |      }
             |    }`);
}

/** Syntax stays in this template; the original method-level source slot stays named bodyLogic. */
export function renderClassicJdbcBody(method, table, fields, keyColumns, dtoName, ctx) {
  if (method._type === 'UpsertMethod') return renderUpsert(table, fields, keyColumns);
  if (method._type === 'QueryMethod') return renderQuery(method, table, fields, dtoName, ctx);
  throw new ProductError('CLASSIC_PROJECTION_REPOSITORY_METHOD', `unsupported repository method ${method._type}`);
}
