import { q, scalarType, wrap, unwrap } from './syntax.mjs';

export function codecTemplate(m, out) {
  const n = m.names;
  out.append(`package ${n.codec.package}

import ${n.api.fqn}._
import java.nio.charset.{CodingErrorAction, StandardCharsets}
import java.nio.{ByteBuffer, CharBuffer}
import java.util.Base64
import play.api.libs.json._
import scala.util.control.NonFatal

object ${n.codec.identifier} {
  private def scalar(value: String, max: Int = 256): Boolean = try {
    value != null && value.nonEmpty && !value.exists(Character.isISOControl) &&
      StandardCharsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT).encode(CharBuffer.wrap(value)).remaining() <= max
  } catch { case _: java.nio.charset.CharacterCodingException => false }
  private def guarded[A](body: => A): Outcome[A] = try Right(body) catch { case NonFatal(_) => Left(InvalidRequest) }
  def resource(value: String): Outcome[${scalarType(m.resource)}] = if (scalar(value)) Right(${wrap(m.resource, 'value')}) else Left(InvalidRequest)
  def decodeBody(text: String): Outcome[JsObject] = try {
    val factory = new com.fasterxml.jackson.core.JsonFactory()
    factory.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
    val parser = factory.createParser(text)
    try {
      var roots = 0
      var depth = 0
      var token = parser.nextToken()
      while (token != null) {
        if (depth == 0) roots += 1
        if (token.isStructStart) depth += 1
        if (token.isStructEnd) depth -= 1
        require(roots == 1 && depth >= 0 && depth <= 64)
        token = parser.nextToken()
      }
      require(roots == 1 && depth == 0)
    } finally parser.close()
    Json.parse(text) match { case obj: JsObject => Right(obj); case _ => Left(InvalidRequest) }
  } catch { case NonFatal(_) => Left(InvalidRequest) }
  private def string(obj: JsObject, key: String, maximum: Int = 256): String = {
    val value = (obj \\ key).as[String]
    require(scalar(value, maximum))
    value
  }
  private def long(obj: JsObject, key: String): Long = {
    val value = (obj \\ key).as[String]
    require(value.length <= 20 && value.matches("(?:0|-[1-9][0-9]*|[1-9][0-9]*)"))
    value.toLong
  }
`, [m.api.source]);
  for (const c of m.commands) {
    const body = c.fields.filter(f => f.location === 'body');
    out.append(`  def ${c.method.identifier}(resource: ${scalarType(m.resource)}, obj: JsObject): Outcome[${c.requestName.identifier}] = guarded {
    require(obj.keys == Set(${body.map(f => q(f.field)).join(', ')}))
    require(scalar(${unwrap(m.resource, 'resource')}, ${c.resource.maxLength}))
    ${c.requestName.identifier}(${c.fields.map(f => f.location === 'path' ? 'resource' : wrap(f.carrier,
      f.primitive === 'string' ? `string(obj, ${q(f.field)}, ${f.maxLength})` : f.primitive === 'integer' ? `long(obj, ${q(f.field)})` : `(obj \\ ${q(f.field)}).as[Boolean]`)).join(', ')})
  }
  def ${c.method.name}Result(result: CommandResult[${c.event.fqn}]): JsValue = result match {
    case NoChange => Json.obj("status" -> "no-change")
    case Applied(event) =>
${c.results.filter(f => f.primitive === 'string').map(f => `      require(scalar(${unwrap(f.carrier, 'event.' + f.domain.accessor)}, ${f.maxLength}), "event output outside wire contract")`).join('\n')}
      Json.obj("status" -> "applied"${c.results.map(f => ', ' + q(f.field) + ' -> ' + unwrap(f.carrier, 'event.' + f.domain.accessor) + (f.primitive === 'integer' ? '.toString' : '')).join('')})
  }
`, [c.source, ...c.fields.map(f => f.source), ...c.results.map(f => f.source)]);
  }
  out.append(`  def cursor(resource: String, value: ReceiptPosition): String = Base64.getUrlEncoder.withoutPadding().encodeToString(
    Json.stringify(Json.obj("version" -> 1, "resource" -> resource, "mapKey" -> value.mapKey, "pidKey" -> value.pidKey)).getBytes(StandardCharsets.UTF_8))
  def query(resource: String, values: Map[String, Seq[String]]): Outcome[(Option[ReceiptPosition], Int)] = guarded {
    require(values.keySet.subsetOf(Set("after", "limit")) && values.values.forall(_.size == 1))
    val limit = values.get("limit").map(_.head).map { text => require(text.matches("[1-9][0-9]?")); text.toInt }.getOrElse(${m.query.pageSize})
    require(limit >= 1 && limit <= ${m.query.maxPageSize})
    val after = values.get("after").map(_.head).map { text =>
      require(text.nonEmpty && text.length <= 2048 && text.matches("[A-Za-z0-9_-]+"))
      val bytes = Base64.getUrlDecoder.decode(text)
      val decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString
      val obj = decodeBody(decoded).fold(_ => throw new IllegalArgumentException("cursor"), identity)
      require(obj.keys == Set("version", "resource", "mapKey", "pidKey") && (obj \\ "version").as[Int] == 1 && (obj \\ "resource").as[String] == resource)
      val position = ReceiptPosition(string(obj, "mapKey"), (obj \\ "pidKey").as[String])
      require(position.pidKey.matches("[0-9a-f]{64}") && cursor(resource, position) == text)
      position
    }
    (after, limit)
  }
  def page(resource: String, result: ReceiptPage): JsValue = Json.obj(
    "rows" -> JsArray(result.rows.map(row => Json.obj(${q(m.query.output.key)} -> ${unwrap(m.query.keyCarrier, 'row.' + m.query.key.identifier)}, ${q(m.query.output.value)} -> ${unwrap(m.query.valueCarrier, 'row.' + m.query.value.identifier)}))),
    "next" -> result.next.map(cursor(resource, _)))
  def status(error: Failure): Int = error match {
    case InvalidRequest => 400
    case NotAuthenticated => 401
    case NotAuthorized | CsrfDenied => 403
    case MissingResource => 404
    case _: DomainRejected => 422
    case Unavailable => 503
    case OutcomeUnknown => 504
    case InternalFailure => 500
  }
}
`, [m.query.source, m.query.indexSource]);
}
