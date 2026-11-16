package net.imadz.codegen.scaffolding.cqrs.template.application.transactor

import net.imadz.codegen.scaffolding.cqrs.TypeRef
import net.imadz.codegen.scaffolding.cqrs.model.application.transactor._

/** P4 Slice 2: renders the five fixture files that discharge the generated
  * SagaModule.Host obligations (types / money codec + canonical wire / args codec /
  * host / entry). Every emitted line is mechanically shaped from the
  * FixtureHostModel (admitted contract + aggregate metadata derivation); the
  * emitted host is a declaration, not a runtime certification — readiness flags
  * stay untouched. */
object FixtureHostTemplate {

  /** (selfType, content) per emitted file; writeArtifact paths derive from selfType. */
  def generateFiles(model: FixtureHostModel): Vector[(TypeRef, String)] = {
    val wireFiles = if (model.moneyCodecName.nonEmpty)
      Vector(TypeRef(model.moneyCodecName, model.packagePath) -> renderMoneyCodec(model))
    else Vector(TypeRef("StrictWire", model.packagePath) -> renderCollectionWire(model))
    val files = Vector(TypeRef("types", model.packagePath) -> renderTypes(model)) ++ wireFiles ++ Vector(
      TypeRef(model.argsCodecName, model.packagePath) -> renderArgsCodec(model),
      model.selfType -> renderHost(model), TypeRef(model.entryName, model.packagePath) -> renderEntry(model))
    if (model.moduleType.name == "SagaModule") files
    else files.map { case (ref, content) => ref -> content.replaceAll("\\bSagaModule\\b", model.moduleType.name) }
  }

  /** The emitted safety spec lives in the sbt test layout (test/<pkg>/…), routed by
    * the generator to a test source root; single-project mode only (declared P5
    * boundary — multi-project glue modules carry no verification emission). */
  def generateTestFiles(model: FixtureHostModel): Vector[(TypeRef, String)] =
    if (model.argsFields.exists(_._2.isInstanceOf[FixtureCollectionShape]))
      Vector("FixtureSafetySpec", "FixtureDeploymentNode").map(name => TypeRef(name, model.packagePath) -> renderCollectionSpec(model, name))
    else Vector(TypeRef("FixtureSafetySpec", model.packagePath) -> renderSafetySpec(model),
      TypeRef("FixtureDeploymentNode", model.packagePath) -> renderDeploymentNode(model))

  private def renderCollectionSpec(m: FixtureHostModel, name: String): String = {
    val face = m.faces.find(_.base == m.publicationFaceBase).get
    val trigger = m.triggers.find(_.sourceIsCommand).get
    val sourceStep = m.phases.head.stepId
    def phase(source: Boolean, kind: String) = m.phases.find(p => (p.stepId == sourceStep) == source && p.phaseRuntime == kind)
      .getOrElse(throw new IllegalArgumentException("bounded collection spec phase missing"))
    def command(p: FixturePhasePort) = face.protocolFqn + "." + p.commandName
    val aggregate = face.aggregateKeyFqn.stripSuffix(".entityTypeKey")
    val values = Map(
      "PACKAGE" -> m.packagePath, "ENTRY" -> m.entryName, "ENTITY" -> face.entityFqn,
      "BEHAVIORS" -> face.behaviorsFqn, "EVENT_HANDLER" -> face.eventHandlerFqn,
      "PROTOCOL_PACKAGE" -> face.protocolFqn.substring(0, face.protocolFqn.lastIndexOf('.')),
      "PROTOCOL_NAME" -> simple(face.protocolFqn), "AGGREGATE_NAME" -> simple(aggregate),
      "COMMAND_FAMILY" -> face.commandsFamilyFqn, "REPLY" -> face.replyFqn,
      "TRIGGER_NAME" -> simple(trigger.sourceFqn), "QUERY_NAME" -> simple(face.queryCommandFqn),
      "FUND_PREPARE_EVENT" -> m.fundingEventFields.head._1, "FUND_COMMIT_EVENT" -> m.fundingEventFields.last._1,
      "FUND_PREPARE_COMMAND" -> m.fundingCommands.head._1, "FUND_COMMIT_COMMAND" -> m.fundingCommands.last._1,
      "FUND_PREPARE_NAME" -> simple(m.fundingCommands.head._1), "FUND_COMMIT_NAME" -> simple(m.fundingCommands.last._1),
      "SOURCE_PREPARE_COMMAND" -> command(phase(true, "Prepare")),
      "SOURCE_COMMIT_COMMAND" -> command(phase(true, "Commit")),
      "SOURCE_COMPENSATE_COMMAND" -> command(phase(true, "Compensate")),
      "TARGET_COMPENSATE_COMMAND" -> command(phase(false, "Compensate")),
      "SOURCE_PREPARE_HELPER" -> camel(phase(true, "Prepare").stem),
      "SOURCE_COMMIT_HELPER" -> camel(phase(true, "Commit").stem),
      "SOURCE_COMPENSATE_HELPER" -> camel(phase(true, "Compensate").stem),
      "TARGET_PREPARE_HELPER" -> camel(phase(false, "Prepare").stem),
      "TARGET_COMMIT_HELPER" -> camel(phase(false, "Commit").stem),
      "TARGET_COMPENSATE_HELPER" -> camel(phase(false, "Compensate").stem),
      "PUBLICATION_COMMAND" -> m.completions.find(_.kindWire == "succeeded").get.publicationCommandFqn,
      "PREPARED_FIELD" -> m.preparedField)
    val stream = getClass.getResourceAsStream("/codegen/templates/bounded-collection-" + name + ".scala.tpl")
    require(stream != null, "bounded collection template missing")
    val original = try new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8) finally stream.close()
    val rendered = values.foldLeft(original) { case (text, (key, value)) => text.replace("@" + key + "@", value) }
    require(!"@[A-Z_]+@".r.findFirstIn(rendered).isDefined, "unresolved bounded collection template slot")
    rendered.replace(".toList", ".toVector")
  }

  private def q(s: String): String = "\"" + s + "\""
  private def camel(s: String): String = s.charAt(0).toLower + s.substring(1)
  private def simple(fqn: String): String = fqn.substring(fqn.lastIndexOf('.') + 1)

  // ---------- fixture/types.scala ----------
  private def renderTypes(m: FixtureHostModel): String = {
    val aliases = m.typeAliases.map { a =>
      if (a.money) s"  type ${a.id} = ${a.targetFqn}"
      else if (a.collection) s"  type ${a.id} = Vector[String]"
      else s"  type ${a.id} = String"
    }.mkString("\n")
    s"""package ${m.packagePath}
      |
      |/** Contract type implementations (TypeContract.implementationFqn = ${m.packagePath}.types.*).
      |  * Value identities stay the aggregate runtime types: bounded text ids are Strings,
      |  * the money type is the aggregate value object the folds mutate. */
      |object types {
      |$aliases
      |}
      |""".stripMargin
  }

  // ---------- fixture/ExactMoneyCodec.scala (+ StrictWire) ----------
  private def renderMoneyCodec(m: FixtureHostModel): String = {
    val moneyFqn = m.typeAliases.filter(_.money).map(_.targetFqn).distinct match {
      case Vector(one) => one
      case other => throw new IllegalStateException(s"fixture money codec expects exactly one money type, got ${other.mkString(", ")}")
    }
    s"""package ${m.packagePath}
      |
      |import com.google.protobuf.ByteString
      |import net.imadz.infra.saga.strict.{CodecPin, PayloadCodec}
      |import scala.util.{Failure, Success, Try}
      |
      |/** Canonical fixture wire: 4-byte big-endian length prefix + UTF-8 bytes per text
      |  * field. Prefix-free, fixed field order — encode(decode(bytes)) == bytes holds
      |  * and the coordinator enforces it at admission. */
      |object StrictWire {
      |  /** ByteString concat for canonical wire composition (protobuf ByteString has no ++). */
      |  implicit final class StrictWireOps(private val a: ByteString) extends AnyVal {
      |    def ++(b: ByteString): ByteString = a.concat(b)
      |  }
      |
      |  def lengthPrefixed(value: String): ByteString = {
      |    val utf8 = value.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      |    val out = new Array[Byte](4 + utf8.length)
      |    out(0) = ((utf8.length >>> 24) & 0xff).toByte
      |    out(1) = ((utf8.length >>> 16) & 0xff).toByte
      |    out(2) = ((utf8.length >>> 8) & 0xff).toByte
      |    out(3) = (utf8.length & 0xff).toByte
      |    utf8.copyToArray(out, 4)
      |    ByteString.copyFrom(out)
      |  }
      |  /** Reads `count` length-prefixed text fields, returning them with the unconsumed remainder. */
      |  def readPrefixed(bytes: ByteString, count: Int): Try[(Vector[String], ByteString)] = Try {
      |    val data = bytes.toByteArray
      |    var offset = 0
      |    val fields = Vector.newBuilder[String]
      |    var i = 0
      |    while (i < count) {
      |      require(offset + 4 <= data.length, s"truncated length prefix for field $$i")
      |      val len = ((data(offset) & 0xff) << 24) | ((data(offset + 1) & 0xff) << 16) |
      |        ((data(offset + 2) & 0xff) << 8) | (data(offset + 3) & 0xff)
      |      require(offset + 4 + len <= data.length, s"field $$i overruns the payload")
      |      fields += new String(data, offset + 4, len, java.nio.charset.StandardCharsets.UTF_8)
      |      offset += 4 + len
      |      i += 1
      |    }
      |    (fields.result(), ByteString.copyFrom(data, offset, data.length - offset))
      |  }
      |}
      |
      |import StrictWire._
      |
      |/** Canonical money codec (MoneyShape codecFqn = ${m.packagePath}.${m.moneyCodecName}):
      |  * exact minor-unit string + currency as two length-prefixed UTF-8 fields. */
      |object ${m.moneyCodecName} extends PayloadCodec[${moneyFqn}] {
      |  override val pin: CodecPin = CodecPin(${q(m.moneyCodecName)}, 1)
      |  override def encode(value: ${moneyFqn}): ByteString =
      |    StrictWire.lengthPrefixed(value.minorUnits) ++ StrictWire.lengthPrefixed(value.currency)
      |  override def decode(bytes: ByteString): Try[${moneyFqn}] =
      |    decodeWithRest(bytes).flatMap {
      |      case (money, leftover) if leftover.isEmpty => Success(money)
      |      case _ => Failure(new IllegalArgumentException("exact money wire: two length-prefixed fields and no trailing bytes expected"))
      |    }
      |
      |  /** Sequential parse primitive: consumes the money fields and yields the remainder
      |    * so composed codecs (args, phase receipts) can parse their declared tails. */
      |  def decodeWithRest(bytes: ByteString): Try[(${moneyFqn}, ByteString)] =
      |    StrictWire.readPrefixed(bytes, 2).flatMap {
      |      case (Vector(minorUnits, currency), rest) => Success((${moneyFqn}(minorUnits, currency), rest))
      |      case _ => Failure(new IllegalArgumentException("exact money wire: expected two length-prefixed fields"))
      |    }
      |}
      |""".stripMargin
  }

  private def renderCollectionWire(m: FixtureHostModel): String = s"""package ${m.packagePath}

import com.google.protobuf.ByteString
import scala.util.Try

/** Canonical bounded scalar collections: count, then UTF-8 length-prefixed elements. */
object StrictWire {
  implicit final class StrictWireOps(private val value: ByteString) extends AnyVal {
    def ++(other: ByteString): ByteString = value.concat(other)
  }
  def lengthPrefixed(value: String): ByteString = {
    require(value != null, "null text")
    val utf8 = value.getBytes(java.nio.charset.StandardCharsets.UTF_8)
    ByteString.copyFrom(java.nio.ByteBuffer.allocate(4 + utf8.length).putInt(utf8.length).put(utf8).array())
  }
  def readPrefixed(bytes: ByteString, count: Int): Try[(Vector[String], ByteString)] = Try {
    val data = bytes.toByteArray
    var offset = 0
    val fields = Vector.newBuilder[String]
    var i = 0
    while (i < count) {
      require(offset + 4 <= data.length, "truncated length prefix")
      val length = java.nio.ByteBuffer.wrap(data, offset, 4).getInt
      offset += 4
      require(length >= 0 && length <= data.length - offset, "invalid field length")
      val decoded = java.nio.charset.StandardCharsets.UTF_8.newDecoder()
        .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
        .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
        .decode(java.nio.ByteBuffer.wrap(data, offset, length)).toString
      fields += decoded
      offset += length
      i += 1
    }
    (fields.result(), ByteString.copyFrom(data, offset, data.length - offset))
  }
  def lengthPrefixedAll(values: Vector[String]): ByteString = {
    require(values != null && values.size <= 64, "bounded collection required")
    values.foldLeft(ByteString.copyFrom(java.nio.ByteBuffer.allocate(4).putInt(values.size).array())) {
      case (bytes, value) => bytes.concat(lengthPrefixed(value))
    }
  }
  def readPrefixedAll(bytes: ByteString): Try[(Vector[String], ByteString)] = Try {
    require(bytes.size >= 4, "truncated collection count")
    val count = java.nio.ByteBuffer.wrap(bytes.substring(0, 4).toByteArray).getInt
    require(count >= 0 && count <= 64, "invalid bounded collection count")
    count
  }.flatMap(count => readPrefixed(bytes.substring(4), count))
}
"""

  // ---------- fixture/ArgsCodec.scala ----------
  private def renderArgsCodec(m: FixtureHostModel): String = {
    val (textFields, moneyFields) = splitWire(m.argsFields)
    val encode = encodeChain(m.argsFields, m.moneyCodecName).replace(" ++\n        ", " ++\n    ")
    val decode = if (m.argsFields.exists(_._2.isInstanceOf[FixtureCollectionShape]))
      decodeFields(m.argsFqn, "args", m.argsFields, m.moneyCodecName)
    else decodeChain(m.argsFqn, "args", textFields, moneyFields, m.moneyCodecName)
    s"""package ${m.packagePath}
      |
      |import com.google.protobuf.ByteString
      |import net.imadz.infra.saga.strict.{CodecPin, PayloadCodec}
      |import scala.util.{Failure, Success, Try}
      |import StrictWire._
      |
      |/** Canonical args codec (ArgsCodecContract.mapperFqn = ${m.packagePath}.${m.argsCodecName},
      |  * runtime pin CodecPin(${q(m.argsPinId)}, ${m.argsPinVersion})): field order is the declared
      |  * args slot order; the coordinator enforces encode(decode(bytes)) == bytes at admission. */
      |final class ${m.argsCodecName} extends PayloadCodec[${m.argsFqn}] {
      |  override val pin: CodecPin = CodecPin(${q(m.argsPinId)}, ${m.argsPinVersion})
      |  override def encode(value: ${m.argsFqn}): ByteString =
      |    $encode
      |  override def decode(bytes: ByteString): Try[${m.argsFqn}] =
      |$decode
      |}
      |""".stripMargin
  }

  private def splitWire(fields: Vector[(String, FixtureWireShape)]): (Vector[String], Vector[String]) =
    (fields.collect { case (n, FixtureTextShape) => n }, fields.collect { case (n, FixtureMoneyShape) => n })

  /** Canonical decode: one length-prefixed text run, then the money tail through the
    * exact money codec; trailing bytes are refused (canonical round trip). */
  private def decodeChain(resultType: String, what: String, textFields: Vector[String],
                          moneyFields: Vector[String], moneyCodec: String): String = {
    val vectorPattern = if (textFields.isEmpty) "Vector()" else "Vector(" + textFields.mkString(", ") + ")"
    val construct = resultType + "(" + (textFields ++ moneyFields).mkString(", ") + ")"
    val body = new StringBuilder
    body ++= s"    StrictWire.readPrefixed(bytes, ${textFields.size}).flatMap { case ($vectorPattern, rest0) =>\n"
    moneyFields.zipWithIndex.foreach { case (f, i) =>
      val in = if (i == 0) "rest0" else s"rest$i"
      body ++= s"      $moneyCodec.decodeWithRest($in).flatMap { case ($f, rest${i + 1}) =>\n"
    }
    val tailRest = if (moneyFields.isEmpty) "rest0" else s"rest${moneyFields.size}"
    body ++= s"        if ($tailRest.isEmpty) Success($construct)\n"
    body ++= s"        else Failure(new IllegalArgumentException(${q(s"$what wire: trailing bytes after the declared fields")}))\n"
    moneyFields.indices.foreach(_ => body ++= "      }\n")
    body ++= "    }"
    body.toString
  }

  private def decodeFields(resultType: String, what: String, fields: Vector[(String, FixtureWireShape)], moneyCodec: String): String = {
    val body = new StringBuilder
    fields.zipWithIndex.foreach { case ((name, shape), index) =>
      val source = if (index == 0) "bytes" else "rest" + index
      val next = "rest" + (index + 1)
      val read = shape match {
        case FixtureTextShape => s"StrictWire.readPrefixed($source, 1).flatMap { case (Vector($name), $next) =>"
        case _: FixtureCollectionShape => s"StrictWire.readPrefixedAll($source).flatMap { case ($name, $next) =>"
        case FixtureMoneyShape => s"$moneyCodec.decodeWithRest($source).flatMap { case ($name, $next) =>"
      }
      body ++= "    " + read + "\n"
    }
    val rest = if (fields.isEmpty) "bytes" else "rest" + fields.size
    body ++= s"      if ($rest.isEmpty) Success($resultType(${fields.map(_._1).mkString(", ")}))\n"
    body ++= s"      else Failure(new IllegalArgumentException(${q(what + " wire: trailing bytes after the declared fields")}))\n"
    fields.foreach(_ => body ++= "    }\n")
    body.toString
  }

  /** Canonical encode from declared wire fields (text run first, money tail). */
  private def encodeChain(fields: Vector[(String, FixtureWireShape)], moneyCodec: String): String =
    fields.map {
      case (name, FixtureTextShape)  => s"StrictWire.lengthPrefixed(value.$name)"
      case (name, FixtureMoneyShape) => s"$moneyCodec.encode(value.$name)"
      case (name, _: FixtureCollectionShape) => s"StrictWire.lengthPrefixedAll(value.$name)"
    }.mkString(" ++\n        ")

  // ---------- fixture/FixtureHost.scala ----------
  private def renderHost(m: FixtureHostModel): String = {
    val module = m.moduleType.name
    val faceImports = m.faces.map { f =>
      val pkg = f.protocolFqn.substring(0, f.protocolFqn.lastIndexOf('.'))
      s"import $pkg.{${f.base}Aggregate, ${f.base}Protocol}"
    }.mkString("\n")
    val faceHelpers = m.faces.map { f =>
      val c = camel(f.base)
      s"""  private def ${c}EntityRef(id: String): akka.cluster.sharding.typed.scaladsl.EntityRef[${f.base}Protocol.${simple(f.commandsFamilyFqn)}] =
         |    sharding.entityRefFor(${f.aggregateKeyFqn}, id)
         |
         |  /** Durable command ask: the aggregate replies through EventSourcedBehavior
         |    * thenReply, so a None error is a persisted-fact confirmation. */
         |  private def ${c}ReplyAsk(id: String, construct: akka.actor.typed.ActorRef[${f.base}Protocol.${simple(f.replyFqn)}] => ${f.base}Protocol.${simple(f.commandsFamilyFqn)}): Future[${f.base}Protocol.${simple(f.replyFqn)}] =
         |    ${c}EntityRef(id).ask(construct)
         |
         |  /** Read-only state ask (the aggregate's query-command face) for evidence queries. */
         |  private def ${c}StateAsk(id: String): Future[${f.base}Protocol.${simple(f.queryReplyFqn)}] =
         |    ${c}EntityRef(id).ask(replyTo => ${f.base}Protocol.${simple(f.queryCommandFqn)}(replyTo))""".stripMargin
    }.mkString("\n\n")
    val resourceDefs = m.resourceMembers.map { member =>
      s"""  override def ${member}Contract: AddressContract = SagaModule.${member}Contract
         |  override def $member(resource: String): String = resource // exact-resource addressing; no I/O"""
    }.mkString("\n")
    val capabilitySet = m.supportedCapabilities.map(q).mkString(", ")
    val invariantSet = m.businessInvariants.map(q).mkString(", ")
    val safetyRequire = m.safetyChecks.map { case (field, expected) => s"requirements.$field == ${q(expected)}" }.mkString(" &&\n      ")
    val typeIds = m.typeAliases.map(_.id).map(q).mkString(", ")
    val ports = m.phases.map(renderPort(m, _)).mkString("\n\n")
    val triggers = m.triggers.map(renderTrigger(m, _)).mkString("\n\n")
    val completions = m.completions.map(renderCompletion(m, _)).mkString("\n\n")
    val evidenceNote = if (m.phases.exists(_.terminalEvidence.nonEmpty))
      "  * Money phases re-read durable facts after replies: exact Prepare value, and\n" +
        "  * terminal marker without opposite/live conflicts. Terminal receipts are txid-only;\n" +
        "  * absence is controlled-profile, not production fencing or full-payload evidence.\n"
    else ""

    s"""package ${m.packagePath}
      |
      |import akka.actor.typed.{ActorSystem, Scheduler}
      |import akka.actor.typed.scaladsl.AskPattern._
      |import akka.cluster.sharding.typed.scaladsl.ClusterSharding
      |import akka.persistence.typed.PersistenceId
      |import akka.util.Timeout
      |import com.google.protobuf.ByteString
      |import net.imadz.infra.saga.strict._
      |$faceImports
      |import scala.concurrent.{ExecutionContext, Future}
      |import scala.util.{Failure, Success, Try}
      |import StrictWire._
      |
      |/** Generated fixture host: the concrete SagaModule.Host for the ${module} example.
      |  * Declarations, not runtime certification — upstream readiness flags stay untouched.
      |  *   - execute = ask the aggregate entity with the phase command; a None error is a
      |  *     persisted-fact confirmation, a guard rejection persisted no events and reports
      |  *     NotExecuted(safeToRetry = true) — the TCC auto-compensate path;
      |  *   - prepare query = four-field precise determination: the state field whose
      |  *     writtenBy lineage names the confirmation event and the txid slot contains(txid);
      |  *   - commit/compensate query = the phase-marker fields (SCHEMA.md P5): the
      |  *     committed/compensated maps put-keyed by every confirmation, contains(txid)
      |  *     precise determination — Confirmed skips re-execution of a durable fact;
      |${evidenceNote}  *   - ask failures = Unknown (a timeout is never an absence). */
      |object FixtureHost {
      |  /** What this emitted implementation actually provides — requireImplemented declares
      |    * against this set, never against an echo of the contract. */
      |  val SupportedCapabilities: Set[String] = Set($capabilitySet)
      |  val DeclaredInvariants: Set[String] = Set($invariantSet)
      |}
      |
      |final class FixtureHost(system: ActorSystem[_], sharding: ClusterSharding)(implicit ec: ExecutionContext) extends ${module}.Host {
      |  import ${module}._
      |
      |  private val canonicalArgsCodec = new ${m.argsCodecName}
      |  // Ask enablers in scope for every port body and helper (AskPattern contract).
      |  private implicit val askTimeout: Timeout = Timeout(settings.interactionTimeout)
      |  private implicit val askScheduler: Scheduler = system.scheduler
      |
      |  override def argsCodec: PayloadCodec[Args] = canonicalArgsCodec
      |  // Explicit reconcile budget; interactionTimeout carries the contract phase pin.
      |  override def settings: StrictSagaCoordinator.Settings =
      |    StrictSagaCoordinator.Settings(scala.concurrent.duration.FiniteDuration(${m.interactionTimeoutMs}, java.util.concurrent.TimeUnit.MILLISECONDS), 32)
      |
      |  // Fail closed when the requirement set exceeds what this implementation declares.
      |  // Returning normally is a host declaration, not runtime certification.
      |  override def requireImplemented(requirements: HostRequirements, types: Vector[TypeContract], argsCodec: ArgsCodecContract): Unit = {
      |    val unsupported = requirements.capabilities.filterNot(FixtureHost.SupportedCapabilities)
      |    require(unsupported.isEmpty, s"fixture host capabilities not implemented: $${unsupported.mkString(", ")}")
      |    require(
      |      $safetyRequire,
      |      "safety contract drift against the generated fixture host")
      |    require(requirements.totalDeadlineMs > 0 && requirements.maxParticipants > 0 && requirements.maxInFlight > 0 &&
      |      requirements.maxAttempts > 0 && requirements.phaseTimeoutMs > 0 && requirements.queryTimeoutMs > 0,
      |      "deadline/admission requirements must be positive")
      |    require(requirements.durableManifest, "fixture host requires the durable manifest")
      |    require(requirements.businessInvariants.forall(FixtureHost.DeclaredInvariants), "undeclared business invariant")
      |    require(argsCodec.runtimePin == CodecPin(${q(m.argsPinId)}, ${m.argsPinVersion}), "args codec pin drift")
      |    require(types.map(_.id).toSet == Set($typeIds), "type contract drift against the generated fixture types")
      |  }
      |
      |  override def requireIndependentNamespace(persistenceId: PersistenceId): Unit =
      |    require(persistenceId.id.startsWith(${q(m.namespacePrefix + "/")}),
      |      s"independent strict persistence namespace required (prefix \\"${m.namespacePrefix}/\\"), got $${persistenceId.id}")
      |
      |$faceHelpers
      |
      |$resourceDefs
      |
      |$ports
      |
      |$triggers
      |
      |$completions
      |}
      |""".stripMargin
  }

  private def renderPort(m: FixtureHostModel, p: FixturePhasePort): String = {
    val module = m.moduleType.name
    // Module naming: member/contract are lower-first, the binding trait is upper-first.
    val member = p.stem.charAt(0).toLower + p.stem.substring(1)
    val traitName = p.stem.charAt(0).toUpper + p.stem.substring(1) + "HostBinding"
    val contractVal = member + "BindingContract"
    val face = m.faces.find(_.base == p.faceBase).getOrElse(throw new IllegalStateException(s"port ${p.stem}: no face ${p.faceBase}"))
    val c = camel(face.base)
    val (textFields, moneyFields) = splitWire(p.receiptFields)
    val encode = encodeChain(p.receiptFields, m.moneyCodecName)
    val decode = if (p.receiptFields.exists(_._2.isInstanceOf[FixtureCollectionShape]))
      decodeFields(simple(p.receiptType), p.stem + " receipt", p.receiptFields, m.moneyCodecName)
    else decodeChain(simple(p.receiptType), s"${p.stem} receipt", textFields, moneyFields, m.moneyCodecName)
    val valueObserver = p.prepareValueEvidence.map { ev =>
      val receipt = p.receiptExpr.replace("input." + ev.valueSlot, "durable")
      s"""    private def observe(identity: OperationIdentity, input: ${p.inputType}, absent: => PhaseOutcome[${p.receiptType}]): Future[PhaseOutcome[${p.receiptType}]] =
         |      ${c}StateAsk(input.${p.resourceSlotName}).map { view =>
         |        if (view.state.committed.contains(input.${p.txidSlot}) || view.state.compensated.contains(input.${p.txidSlot}))
         |          Unknown(identity, "MONEY_PREPARE_TERMINAL_FACT: Prepare evidence is no longer live")
         |        else view.state.${ev.mapField}.get(input.${p.txidSlot}) match {
         |          case Some(durable) if durable != null && input.${ev.valueSlot} != null &&
         |              durable.minorUnits == input.${ev.valueSlot}.minorUnits && durable.currency == input.${ev.valueSlot}.currency =>
         |            ConfirmedReceipt(identity, $receipt)
         |          case Some(_) => Unknown(identity, "MONEY_PREPARE_PAYLOAD_CONFLICT: durable amount or currency differs")
         |          case None => absent
         |        }
         |      }.recover { case ex => Unknown(identity, s"phase evidence query failed: $${ex.getMessage}") }
         |""".stripMargin
    }.getOrElse("")
    val terminalObserver = p.terminalEvidence.map { ev =>
      s"""    private def observe(identity: OperationIdentity, input: ${p.inputType}, absent: => PhaseOutcome[${p.receiptType}]): Future[PhaseOutcome[${p.receiptType}]] =
         |      ${c}StateAsk(input.${p.resourceSlotName}).map { view =>
         |        if (view.state.${ev.oppositeMap}.contains(input.${p.txidSlot}) ||
         |            (view.state.${ev.markerMap}.contains(input.${p.txidSlot}) && view.state.${ev.liveMap}.contains(input.${p.txidSlot})))
         |          Unknown(identity, "MONEY_TERMINAL_FACT_CONFLICT: opposite terminal or terminal/live facts coexist")
         |        else view.state.${ev.markerMap}.get(input.${p.txidSlot}) match {
         |          case Some(durable) if durable != null && durable.minorUnits != null && durable.minorUnits.nonEmpty &&
         |              durable.currency != null && durable.currency.nonEmpty =>
         |            ConfirmedReceipt(identity, ${p.receiptExpr})
         |          case Some(_) => Unknown(identity, "MONEY_TERMINAL_FACT_UNAVAILABLE: durable terminal value is unavailable")
         |          case None => absent
         |        }
         |      }.recover { case ex => Unknown(identity, s"phase evidence query failed: $${ex.getMessage}") }
         |""".stripMargin
    }.getOrElse("")
    val queryBody = if (p.prepareValueEvidence.nonEmpty)
      s"""      observe(identity, input, NotExecuted(identity, "durable Prepare state has no transaction fact (controlled profile only)", safeToRetry = true))"""
    else if (p.terminalEvidence.nonEmpty)
      s"""      observe(identity, input, NotExecuted(identity, "durable aggregate state has no terminal fact for this phase (controlled profile only)", safeToRetry = true))"""
    else p.evidenceMapField match {
      case Some(mapField) =>
        s"""      ${c}StateAsk(input.resource).map { view =>
           |        if (view.state.$mapField.contains(input.${p.txidSlot}))
           |          ConfirmedReceipt(identity, ${p.receiptExpr})
           |        else
           |          NotExecuted(identity, s"durable aggregate state: $mapField does not contain txid $$input.${p.txidSlot}", safeToRetry = true)
           |      }.recover { case ex => Unknown(identity, s"phase evidence query failed: $${ex.getMessage}") }""".stripMargin
      case None =>
        s"""      Future.successful(Unknown(identity,
           |        "no durable phase-mark evidence field was derivable for this phase (fail-degraded; declare the SCHEMA.md P5 phase-marker convention)"))""".stripMargin
    }
    val executeBody = if (p.prepareValueEvidence.nonEmpty)
      s"""      ${c}ReplyAsk(input.${p.resourceSlotName}, replyTo => ${p.commandExpr}).flatMap {
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(None) =>
         |          observe(identity, input, Unknown(identity, "MONEY_PREPARE_ACK_WITHOUT_FACT: successful reply has no durable Prepare value"))
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(Some(error)) =>
         |          observe(identity, input, NotExecuted(identity, s"aggregate rejected $${error.code}: $${error.message}; no events persisted", safeToRetry = true))
         |      }.recover { case ex => Unknown(identity, s"Prepare interaction failed: $${ex.getMessage}") }""".stripMargin
    else if (p.terminalEvidence.nonEmpty)
      s"""      ${c}ReplyAsk(input.${p.resourceSlotName}, replyTo => ${p.commandExpr}).flatMap {
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(None) =>
         |          observe(identity, input, Unknown(identity, "MONEY_TERMINAL_ACK_WITHOUT_FACT: successful reply has no durable terminal value"))
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(Some(error)) =>
         |          observe(identity, input, NotExecuted(identity, s"aggregate rejected $${error.code}: $${error.message}; no events persisted (controlled profile only)", safeToRetry = true))
         |      }.recover { case ex => Unknown(identity, s"terminal interaction failed: $${ex.getMessage}") }""".stripMargin
    else
      s"""      ${c}ReplyAsk(input.resource, replyTo => ${p.commandExpr}).map {
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(None) =>
         |          ConfirmedReceipt(identity, ${p.receiptExpr})
         |        case ${face.base}Protocol.${simple(face.replyFqn)}(Some(error)) =>
         |          NotExecuted(identity, s"aggregate rejected $${error.code}: $${error.message}; no events persisted", safeToRetry = true)
         |      }""".stripMargin
    s"""  def ${member}Binding: $module.$traitName = new $module.$traitName {
       |${valueObserver}${terminalObserver}    private val codec: PayloadCodec[${p.receiptType}] = new PayloadCodec[${p.receiptType}] {
       |      override val pin: CodecPin = CodecPin(${q(p.pinId)}, ${p.pinVersion})
       |      override def encode(value: ${p.receiptType}): ByteString =
       |        $encode
       |      override def decode(bytes: ByteString): Try[${p.receiptType}] =
       |$decode
       |    }
       |    override def contract: PhaseContract = $module.$contractVal
       |    override def receiptCodec: PayloadCodec[${p.receiptType}] = codec
       |    override def querySafety: QuerySafety = QuerySafety.DeclaredReadOnly
       |    override def execute(identity: OperationIdentity, input: ${p.inputType}): Future[PhaseOutcome[${p.receiptType}]] =
       |$executeBody
       |    override def query(identity: OperationIdentity, input: ${p.inputType}): Future[PhaseOutcome[${p.receiptType}]] =
       |$queryBody
       |  }""".stripMargin
  }

  private def renderTrigger(m: FixtureHostModel, t: FixtureTriggerModel): String = {
    val module = m.moduleType.name
    val boundsChecks = t.argSources.flatMap {
      case (slot, Some((min, max))) =>
        Some(s"""    require(source.$slot != null && source.$slot.length >= $min && source.$slot.length <= $max,
                |      ${q(s"trigger slot $slot outside the declared bounded text shape")})""".stripMargin)
      case (_, None) => None
    }.mkString("\n")
    val moneyChecks = t.moneySlots.map { slot =>
      s"""    require(source.$slot != null && source.$slot.currency != null && source.$slot.currency.nonEmpty,
         |      ${q(s"trigger money slot $slot carries no currency")})""".stripMargin
    }.mkString("\n")
    val collectionChecks = t.collectionSlots.map { case (slot, bounds) =>
      s"""    require(source.$slot != null && source.$slot.size >= ${bounds.minItems} && source.$slot.size <= ${bounds.maxItems} &&
         |      source.$slot.forall(v => v != null && v.length >= ${bounds.minLength} && v.length <= ${bounds.maxLength}),
         |      ${q("trigger collection slot " + slot + " outside the declared bounded sequence shape")})""".stripMargin
    }.mkString("\n")
    val args = t.argSources.map { case (slot, _) =>
      s"source.$slot" + (if (t.collectionSlots.exists(_._1 == slot)) ".toVector" else "")
    }.mkString(", ")
    s"""  def ${t.member}: $module.${simple(t.bindingType)} = new $module.${simple(t.bindingType)} {
       |    override def contract: TriggerContract = $module.${t.contractMember}
       |    // Whole typed trigger, including the explicit idempotency source; never first/drop remaining.
       |    override def map(source: ${t.sourceFqn}): $module.TriggerStart = {
       |${Vector(boundsChecks, collectionChecks).filter(_.nonEmpty).mkString("\n")}
       |$moneyChecks
       |      $module.TriggerStart(source.${t.idempotencyField}, $module.Args($args))
       |    }
       |  }""".stripMargin
  }

  private def renderCompletion(m: FixtureHostModel, c: FixtureCompletionModel): String = {
    val module = m.moduleType.name
    val bindingType = simple(c.bindingType)
    val construct = c.eventFqn + "(" + c.eventArgs.map(a => s"input.$a").mkString(", ") + ")"
    s"""  def ${c.member}: $module.$bindingType = new $module.$bindingType {
       |    override def contract: CompletionContract = $module.${c.contractMember}
       |    override def map(identity: TransactionIdentity, input: ${c.inputType}): ${c.eventFqn} = $construct
       |  }""".stripMargin
  }

  // ---------- fixture/StrictSagaEntry.scala ----------
  private def renderEntry(m: FixtureHostModel): String = {
    val module = m.moduleType.name
    val faceImports = m.faces.map { f =>
      val pkg = f.protocolFqn.substring(0, f.protocolFqn.lastIndexOf('.'))
      s"import $pkg.${f.base}Protocol"
    }.mkString("\n")
    val commandTrigger = m.triggers.find(_.sourceIsCommand).getOrElse(throw new IllegalStateException(
      "fixture entry: the contract declares no command trigger — the start face has no source"))
    val familyFqn = m.completions.headOption.map(_.eventFamilyFqn).getOrElse(throw new IllegalStateException(
      "fixture entry: the contract declares no completions"))
    val kindMember = m.completions.map(c => c.kindWire -> c.member).toMap
    val dispatch = m.completions.map { c =>
      s"""      case ${q(c.kindWire)} => $module.${c.member}Event(identity, args, host)""".stripMargin
    }.mkString("\n")
    val pubFace = m.faces.find(_.base == m.publicationFaceBase).getOrElse(throw new IllegalStateException(
      s"fixture entry: no publication face ${m.publicationFaceBase}"))
    val publishDispatch = m.completions.map { c =>
      s"""      case ev: ${c.eventFqn} => entityRef.ask(replyTo => ${c.publicationCommandFqn}(identity.transactionId, replyTo))"""
        .stripMargin
    }.mkString("\n")
    val eventTriggers = m.triggers.filterNot(_.sourceIsCommand)
    val eventDispatch = eventTriggers.map { t =>
      s"""        case ev: ${t.sourceFqn} => coordinator ! SagaModule.${t.member}Start(ev, host, replySink)"""
    }.mkString("\n")
    val succeededBranch = kindMember.get("succeeded").map(member => s"""      case StrictStatus.Succeeded => Some(${q("succeeded")})""")
    val compensatedBranch = for { _ <- kindMember.get("compensated"); _ <- kindMember.get("rejected-before-effects") }
      yield s"""      case StrictStatus.Aborted =>
               |        val prepareConfirmed = state.evidence.values.exists {
               |          case Evidence.Confirmed(op, _) => op.phase == Phase.Prepare
               |          case _ => false
               |        }
               |        Some(if (prepareConfirmed) ${q("compensated")} else ${q("rejected-before-effects")})""".stripMargin
    val recoveryBranch = kindMember.get("recovery-required").map(_ => s"""      case StrictStatus.RecoveryRequired => Some(${q("recovery-required")})""")
    val statusMatch = Vector(succeededBranch, compensatedBranch, recoveryBranch).flatten.mkString("\n")

    s"""package ${m.packagePath}
      |
      |import akka.actor.typed.{ActorRef, ActorSystem, Scheduler}
      |import akka.actor.typed.scaladsl.AskPattern._
      |import akka.actor.typed.scaladsl.Behaviors
      |import akka.cluster.sharding.typed.scaladsl.ClusterSharding
      |import akka.cluster.typed.{ClusterSingleton, SingletonActor}
      |import akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal
      |import akka.persistence.query.PersistenceQuery
      |import akka.persistence.query.EventEnvelope
      |import akka.persistence.typed.PersistenceId
      |import akka.stream.{KillSwitches, Materializer, SystemMaterializer, UniqueKillSwitch}
      |import akka.stream.scaladsl.{Keep, Sink}
      |import akka.util.Timeout
      |import net.imadz.infra.saga.strict._
      |$faceImports
      |import scala.concurrent.{ExecutionContext, Future}
      |import scala.concurrent.duration._
      |
      |/** Binding entrypoint (${m.packagePath}.${m.entryName}): spawns the strict coordinator in the
      |  * independent "${m.namespacePrefix}/" persistence namespace, wires the command trigger and
      |  * exposes the terminal-completion mapping plus the durable idempotent result publication
      |  * onto the aggregate journal (SCHEMA.md P5 result-publication convention: the mapped
      |  * result event's producing command is asked on the initiating entity, where the
      |  * map-absent sagaResults guard makes republication an empty success). The event
      |  * trigger path is wired by installEventSource: the shared durable journal's live
      |  * event stream drives the idempotent Start from persisted trigger events and owns
      |  * the terminal result publication — the only event source every node of a physical
      |  * multi-JVM cluster observes. */
      |object ${m.entryName} {
      |  val NamespacePrefix = ${q(m.namespacePrefix)}
      |  def persistenceId: PersistenceId = PersistenceId.ofUniqueId(s"$$NamespacePrefix/$${SagaModule.Name}")
      |
      |  def spawn(system: ActorSystem[_], sharding: ClusterSharding, reconcileToken: String)(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {
      |    require(reconcileToken != null && reconcileToken.nonEmpty, "explicit reconciliation token required (manual-evidence-authorization)")
      |    val host = new FixtureHost(system, sharding)
      |    system.systemActorOf(SagaModule.behavior(persistenceId, host, FixtureReconcileAuthorizer(reconcileToken)),
      |      s"$$${"{SagaModule.Name}"}-strict-saga-coordinator")
      |  }
      |
      |  /** Cluster-topology spawn: exactly one coordinator cluster-wide (a singleton), with
      |    * every node holding a proxy ActorRef. Spawning the same persistenceId on several
      |    * nodes through systemActorOf would be a persistence-identity collision. */
      |  def spawnClusterSingleton(system: ActorSystem[_], sharding: ClusterSharding, reconcileToken: String)(implicit ec: ExecutionContext): ActorRef[StrictSagaCoordinator.Command] = {
      |    require(reconcileToken != null && reconcileToken.nonEmpty, "explicit reconciliation token required (manual-evidence-authorization)")
      |    val host = new FixtureHost(system, sharding)
      |    ClusterSingleton(system).init(SingletonActor(
      |      SagaModule.behavior(persistenceId, host, FixtureReconcileAuthorizer(reconcileToken)),
      |      s"$$${"{SagaModule.Name}"}-strict-saga-coordinator"))
      |  }
      |
      |  /** Command-trigger wiring: map the typed trigger to the idempotent Start. */
      |  def start(coordinator: ActorRef[StrictSagaCoordinator.Command], host: SagaModule.Host,
      |            source: ${commandTrigger.sourceFqn}, replyTo: ActorRef[StrictSagaCoordinator.Reply]): StrictSagaCoordinator.Start =
      |    SagaModule.${commandTrigger.member}Start(source, host, replyTo)
      |
      |  /** Event-trigger AND completion wiring — the deployment-face event-stream source.
      |    * Subscribes to the shared durable journal's live event stream through Persistence
      |    * Query and (a) drives the coordinator's idempotent Start from each persisted trigger
      |    * event, (b) owns the completion side: the coordinator's own terminal markers
      |    * (StrictEvent.Succeeded/Aborted on this coordinator's journal id) are answered with
      |    * a GetStatus and the durable idempotent result publication onto the aggregate
      |    * journal — in a physical multi-JVM cluster the journal is the only event source
      |    * every node observes, so the deployment wiring that triggers a saga also publishes
      |    * its result. Idempotency: a coordinator Start with the same identity and args
      |    * returns the existing state (no double-start), and publishCompletion rides the
      |    * aggregate's map-absent sagaResults guard (no double-publish). Install once per
      |    * system (the reply sink is a named system actor). Stream failure surfaces as an
      |    * absent trigger/publish: journal liveness is a deployment precondition this wiring
      |    * cannot restore. */
      |  def installEventSource(system: ActorSystem[_], sharding: ClusterSharding,
      |                         coordinator: ActorRef[StrictSagaCoordinator.Command])(implicit ec: ExecutionContext): UniqueKillSwitch = {
      |    val host = new FixtureHost(system, sharding)
      |    implicit val mat: Materializer = SystemMaterializer(system).materializer
      |    val replySink = system.systemActorOf(
      |      Behaviors.receiveMessage[StrictSagaCoordinator.Reply](_ => Behaviors.same),
      |      s"$$${"{SagaModule.Name}"}-event-source-reply-sink")
      |    val coordinatorJournalId = s"$$NamespacePrefix/$${SagaModule.Name}"
      |    val readJournal = PersistenceQuery(system).readJournalFor[ScalaDslMongoReadJournal]("akka-contrib-mongodb-persistence-readjournal")
      |    readJournal.allEvents()
      |      .viaMat(KillSwitches.single)(Keep.right)
      |      .toMat(Sink.foreach[EventEnvelope] {
      |        case envelope if envelope.persistenceId == coordinatorJournalId =>
      |          envelope.event match {
      |            case StrictEvent.Succeeded | StrictEvent.Aborted =>
      |              // Completion side (this source owns it): the coordinator holds exactly one
      |              // transaction per lifetime, so at the terminal marker its current state IS
      |              // that terminal state — no cross-transaction race window exists.
      |              implicit val scheduler: Scheduler = system.scheduler
      |              implicit val timeout: Timeout = Timeout(15.seconds)
      |              coordinator.ask(replyTo => StrictSagaCoordinator.GetStatus(replyTo)).map {
      |                case StrictSagaCoordinator.Status(state) if state.terminal =>
      |                  publishCompletion(sharding, host, state).failed.foreach { t =>
      |                    Console.err.println(s"[${m.entryName}-event-source] completion publish failed (idempotent retry is safe): $$t")
      |                  }
      |                case _ => () // non-terminal snapshot (stale marker replay) — nothing to publish
      |              }.failed.foreach(t => Console.err.println(s"[${m.entryName}-event-source] terminal status query failed: $$t"))
      |            case _ => () // coordinator non-terminal events (intents, evidence, reconcile)
      |          }
      |        case envelope =>
      |          envelope.event match {
      |$eventDispatch
      |            case _ => () // non-trigger journal events: participant folds, results, other aggregates
      |          }
      |      })(Keep.left)
      |      .run()
      |  }
      |
      |  def status(coordinator: ActorRef[StrictSagaCoordinator.Command])(implicit timeout: Timeout, scheduler: Scheduler, ec: ExecutionContext): Future[StrictState] =
      |    coordinator.ask(replyTo => StrictSagaCoordinator.GetStatus(replyTo)).map {
      |      case StrictSagaCoordinator.Status(state) => state
      |      case other => throw new IllegalStateException(s"unexpected coordinator reply: $$other")
      |    }
      |
      |  /** Terminal-state to completion-event mechanical mapping: non-terminal states map to
      |    * None; an Aborted state with any confirmed prepare is compensated, otherwise
      |    * rejected-before-effects. The mapped event value is returned to the caller. */
      |  def completionEvent(identity: TransactionIdentity, args: SagaModule.Args, host: SagaModule.Host, state: StrictState): Option[${familyFqn}] = {
      |    val kind = state.status match {
      |$statusMatch
      |      case _ => None
      |    }
      |    kind.map {
      |$dispatch
      |      case other => throw new IllegalStateException(s"unmapped completion kind: $$other")
      |    }
      |  }
      |
      |  /** Durable, idempotent result publication (P5): decode the state's identity and args,
      |    * map the terminal state to its result event and ask the event's producing command on
      |    * the initiating entity (${m.publicationSlot}). Reply None = the result event was
      |    * persisted, or a republication hit the succeed-empty guard (idempotent, zero events).
      |    * Non-terminal states fail explicitly; ask failures surface to the caller, whose
      |    * retry stays idempotent by the aggregate guard. */
      |  def publishCompletion(sharding: ClusterSharding, host: SagaModule.Host, state: StrictState)(implicit timeout: Timeout, scheduler: Scheduler, ec: ExecutionContext): Future[${pubFace.replyFqn}] = {
      |    val identity = state.identity.getOrElse(throw new IllegalStateException("publishCompletion: state carries no transaction identity"))
      |    val args = host.argsCodec.decode(state.argsBytes).get
      |    val event = completionEvent(identity, args, host, state).getOrElse(throw new IllegalStateException("publishCompletion: state is not terminal — nothing to publish"))
      |    val entityRef = sharding.entityRefFor(${pubFace.aggregateKeyFqn}, args.${m.publicationSlot})
      |    event match {
      |$publishDispatch
      |      case other => throw new IllegalStateException(s"unmapped publication event: $$other")
      |    }
      |  }
      |}
      |
      |/** Synchronous, I/O-free authorization (ReconcileAuthorizer contract): Right is the
      |  * principal recorded for the reconciliation. No lenient default. */
      |final case class FixtureReconcileAuthorizer(expected: String) extends ReconcileAuthorizer {
      |  override def authorize(identity: TransactionIdentity, token: String): Either[String, String] = {
      |    val provided = if (token == null) Array.emptyByteArray else token.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      |    val expectedBytes = if (expected == null) Array.emptyByteArray else expected.getBytes(java.nio.charset.StandardCharsets.UTF_8)
      |    if (expectedBytes.length > 0 && java.security.MessageDigest.isEqual(provided, expectedBytes)) Right("fixture-reconciler")
      |    else Left("reconciliation token mismatch")
      |  }
      |}
      |""".stripMargin
  }

  // ---------- test/fixture/FixtureSafetySpec.scala (P5 verification emission) ----------
  private def renderSafetySpec(m: FixtureHostModel): String = {
    val face = m.faces.find(_.base == m.publicationFaceBase).getOrElse(throw new IllegalStateException(
      s"fixture safety spec: no publication face ${m.publicationFaceBase}"))
    val protocol = simple(face.protocolFqn)
    val moneyFqn = m.typeAliases.filter(_.money).map(_.targetFqn).distinct match {
      case Vector(one) => one
      case other => throw new IllegalStateException(s"fixture safety spec expects exactly one money type, got ${other.mkString(", ")}")
    }
    val firstStepId = m.phases.headOption.getOrElse(throw new IllegalStateException("fixture safety spec: contract declares no phases")).stepId
    val sourcePorts = m.phases.filter(_.stepId == firstStepId)
    val trigger = m.triggers.find(_.sourceIsCommand).getOrElse(throw new IllegalStateException(
      "fixture safety spec: the contract declares no command trigger"))
    val otherSlot = trigger.argSources.map(_._1)
      .filterNot(s => s == trigger.idempotencyField || s == m.publicationSlot || trigger.moneySlots.contains(s)) match {
      case Vector(one) => one
      case other => throw new IllegalStateException(s"fixture safety spec: trigger maps ${other.size} non-identity/non-source text slots, expected exactly one target slot")
    }
    def startArgExpr(slot: String): String =
      if (slot == trigger.idempotencyField) "opId"
      else if (trigger.moneySlots.contains(slot)) "amount"
      else if (slot == m.publicationSlot) "From"
      else if (slot == otherSlot) "To"
      else throw new IllegalStateException(s"fixture safety spec: unmapped trigger slot \"$slot\"")
    val startArgs = trigger.argSources.map(s => startArgExpr(s._1)).mkString(", ")
    // Suite-A helpers: one per first-participant phase, values substituted by slot role.
    def helperShape(p: FixturePhasePort, slot: String): FixtureWireShape =
      p.commandSlotShapes.find(_._1 == slot).map(_._2)
        .getOrElse(throw new IllegalStateException(s"fixture safety spec: port ${p.stem} slot \"$slot\" carries no wire shape"))
    def helperParam(p: FixturePhasePort, slot: String): String =
      if (slot == p.txidSlot) "txid: String"
      else if (slot == p.resourceSlotName) "id: String"
      else if (helperShape(p, slot) == FixtureMoneyShape) "amount: " + m.typeAliases.filter(_.money).map(_.targetFqn).distinct.head
      else throw new IllegalStateException(s"fixture safety spec: port ${p.stem} slot \"$slot\" is neither the txid, the resource nor a money slot")
    def helperArg(p: FixturePhasePort, slot: String): String =
      if (slot == p.txidSlot) "txid"
      else if (slot == p.resourceSlotName) "id"
      else if (helperShape(p, slot) == FixtureMoneyShape) "amount"
      else throw new IllegalStateException(s"fixture safety spec: unmapped command slot \"$slot\" on port ${p.stem}")
    val sourceHelpers = sourcePorts.map { p =>
      val params = p.commandSlots.map(sl => helperParam(p, sl)).mkString(", ")
      val args = p.commandSlots.map(sl => helperArg(p, sl)).mkString(", ")
      s"""  private def ${camel(p.stem)}(kit: ActorTestKit, ref: ActorRef[$protocol.${simple(face.commandsFamilyFqn)}], $params): $protocol.${simple(face.replyFqn)} =
         |    askNow(kit, ref)(replyTo => $protocol.${p.commandName}($args, replyTo))""".stripMargin
    }.mkString("\n\n")
    // Funding seed: the target participant's prepare+commit confirmation pair.
    val seedEvents = m.fundingSeedEvents.map { case (eventFqn, slots) =>
      val args = slots.map {
        case (sl, FixtureTextShape)  => "txid"
        case (sl, FixtureMoneyShape) => "SeedAmount"
        case (sl, other) => throw new IllegalStateException(s"fixture safety spec: funding seed slot \"$sl\" shape $other unmapped")
      }.mkString(", ")
      s"$eventFqn($args)"
    }.mkString(", ")
    val publication = m.completions.headOption.getOrElse(throw new IllegalStateException(
      "fixture safety spec: contract declares no completions"))
    val pubCmd = publication.publicationCommandFqn
    val pubKind = publication.kindWire
    val entry = m.entryName
    val moneyT = m.typeAliases.filter(_.money).map(_.targetFqn).distinct.head
    val faceImports = {
      val protocolPkg = face.protocolFqn.substring(0, face.protocolFqn.lastIndexOf('.'))
      val aggregateObject = face.aggregateKeyFqn.substring(0, face.aggregateKeyFqn.lastIndexOf('.'))
      val entityPkg = face.entityFqn.substring(0, face.entityFqn.lastIndexOf('.'))
      val behaviorsPkg = face.behaviorsFqn.substring(0, face.behaviorsFqn.lastIndexOf('.'))
      val handlerPkg = face.eventHandlerFqn.substring(0, face.eventHandlerFqn.lastIndexOf('.'))
      s"import $protocolPkg.{${simple(aggregateObject)}, ${simple(face.protocolFqn)}}\n" +
        s"import $entityPkg.${simple(face.entityFqn)}\n" +
        s"import $behaviorsPkg.${simple(face.behaviorsFqn)}\n" +
        s"import $handlerPkg.${simple(face.eventHandlerFqn)}"
    }

    s"""package ${m.packagePath}
      |
      |import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}
      |import akka.actor.typed.scaladsl.AskPattern._
      |import akka.actor.testkit.typed.scaladsl.ActorTestKit
      |import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityRef}
      |import akka.cluster.typed.Cluster
      |import akka.persistence.typed.PersistenceId
      |import akka.persistence.testkit.scaladsl.PersistenceTestKit
      |import akka.util.Timeout
      |import com.typesafe.config.{Config, ConfigFactory}
      |import net.imadz.infra.saga.strict.{Evidence, Phase, StrictSagaCoordinator, StrictState, StrictStatus}
      |import akka.actor.typed.scaladsl.adapter._
      |import org.scalatest.funsuite.AnyFunSuite
      |
      |$faceImports
      |
      |import scala.concurrent.{Await, ExecutionContext}
      |import scala.concurrent.duration._
      |
      |/** P5 business-safety verification of the generated fixture (emitted, not hand-written):
      |  *   - A aggregate conservation and idempotency over the phase-marker folds;
      |  *   - B the full TCC saga through the host: succeeded / business-rejected
      |  *     (rejected-before-effects) / explicit abort after both prepares (compensated),
      |  *     each with the durable sagaResults publication;
      |  *   - C coordinator recovery: an interrupted saga resumes to a terminal state;
      |  *   - D the deployment face against a shared MongoDB journal: D1 two clustered systems
      |  *     over ONE durable journal (direct start), D2 the journal event-stream source
      |  *     (the persisted trigger event starts the saga, no direct coordinator call),
      |  *     D3 physical two-JVM deployment — event-driven across processes. Each D test
      |  *     fails honestly (assume) when MongoDB is unreachable; run-scoped databases keep
      |  *     runs isolated and leave the journal as evidence.
      |  * Test-scoped currency XTS (the ISO-4217 test code). A/B/C fund through the
      |  * persistence test kit (no invented semantics); the D family funds through the
      |  * aggregate's own command face — the production-honest path a real journal demands. */
      |class FixtureSafetySpec extends AnyFunSuite {
      |
      |  private val Money = $moneyT
      |  private val Currency = "XTS"
      |  private val SeedAmount = Money("100000", Currency)
      |  private val From = "alice"
      |  private val To = "bob"
      |  private val ReconcileToken = "safety-spec-reconcile-token"
      |
      |  private def singleNodeConfig(): Config = ConfigFactory.parseString(
      |    \"\"\"
      |      akka.loglevel = "WARNING"
      |      akka.actor.provider = "local"
      |      akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |      akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |      akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshots"
      |      akka.persistence.testkit.snapshots.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
      |    \"\"\".stripMargin).withFallback(ConfigFactory.load())
      |
      |  private def clusterConfig(port: Int, seeds: String): Config = ConfigFactory.parseString(
      |    s\"\"\"
      |      akka.loglevel = "WARNING"
      |      akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |      akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshots"
      |      akka.actor.provider = cluster
      |      akka.remote.artery.canonical.hostname = "127.0.0.1"
      |      akka.remote.artery.canonical.port = $$port
      |      akka.remote.artery.bind.hostname = "127.0.0.1"
      |      akka.remote.artery.bind.port = $$port
      |      akka.persistence.journal.plugin = "akka.persistence.testkit.journal"
      |      akka.persistence.testkit.journal.class = "akka.persistence.testkit.PersistenceTestKitPlugin"
      |      akka.persistence.snapshot-store.plugin = "akka.persistence.testkit.snapshots"
      |      akka.persistence.testkit.snapshots.class = "akka.persistence.testkit.PersistenceTestKitSnapshotPlugin"
      |      akka.cluster.seed-nodes = [$$seeds]
      |      akka.cluster.jmx.multi-mbeans-in-same-jvm = on
      |    \"\"\".stripMargin).withFallback(ConfigFactory.load())
      |
      |  private def aggregateBehavior(entityId: String): Behavior[$protocol.${simple(face.commandsFamilyFqn)}] =
      |    akka.persistence.typed.scaladsl.EventSourcedBehavior(
      |      persistenceId = PersistenceId(${face.aggregateKeyFqn}.name, entityId),
      |      emptyState = ${face.entityFqn}.empty(entityId),
      |      commandHandler = ${face.behaviorsFqn}.apply,
      |      eventHandler = ${face.eventHandlerFqn}.apply)
      |
      |  /** Funds an account through the contract's own fund-entry fold pair, seeded into the
      |    * journal before the entity spawns (the recovery fold applies it at spawn). */
      |  private def seedFunds(kit: ActorTestKit, entityId: String, txid: String): Unit =
      |    PersistenceTestKit(kit.system).persistForRecovery(
      |      PersistenceId(${face.aggregateKeyFqn}.name, entityId).id,
      |      Vector($seedEvents))
      |
      |  private def askNow[Cmd, Res](kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[Cmd])(f: ActorRef[Res] => Cmd): Res = {
      |    implicit val system: ActorSystem[_] = kit.system
      |    implicit val timeout: Timeout = Timeout(10.seconds)
      |    Await.result(ref.ask(f), 10.seconds)
      |  }
      |
      |  private def stateOf(kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[$protocol.${simple(face.commandsFamilyFqn)}]) =
      |    askNow(kit, ref)(replyTo => $protocol.${simple(face.queryCommandFqn)}(replyTo)).state
      |
      |  private def balance(kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[$protocol.${simple(face.commandsFamilyFqn)}]): BigInt =
      |    BigInt(stateOf(kit, ref).accountBalance(Currency).minorUnits)
      |
      |  private def initSharding(kit: ActorTestKit): ClusterSharding = {
      |    val sharding = ClusterSharding(kit.system)
      |    sharding.init(Entity(${face.aggregateKeyFqn})(ctx => aggregateBehavior(ctx.entityId)))
      |    sharding
      |  }
      |
      |  private def entityRef(sharding: ClusterSharding, id: String): EntityRef[$protocol.${simple(face.commandsFamilyFqn)}] =
      |    sharding.entityRefFor(${face.aggregateKeyFqn}, id)
      |
      |  private def awaitMembers(kit: ActorTestKit, n: Int): Unit = {
      |    val deadline = System.currentTimeMillis() + 30000L
      |    while (Cluster(kit.system).state.members.size < n && System.currentTimeMillis() < deadline) Thread.sleep(200)
      |    require(Cluster(kit.system).state.members.size >= n, s"cluster did not reach $$n members")
      |  }
      |
      |  private def awaitTerminal(kit: ActorTestKit, coordinator: ActorRef[StrictSagaCoordinator.Command]): StrictState = {
      |    implicit val system: ActorSystem[_] = kit.system
      |    implicit val ec: ExecutionContext = kit.system.executionContext
      |    implicit val timeout: Timeout = Timeout(10.seconds)
      |    val deadline = System.currentTimeMillis() + 60000L
      |    var s = Await.result($entry.status(coordinator), 10.seconds)
      |    while (!s.terminal && s.status != StrictStatus.RecoveryRequired && System.currentTimeMillis() < deadline) {
      |      Thread.sleep(200)
      |      s = Await.result($entry.status(coordinator), 10.seconds)
      |    }
      |    s
      |  }
      |
      |  private def startSaga(kit: ActorTestKit, sharding: ClusterSharding, coordinator: ActorRef[StrictSagaCoordinator.Command], opId: String, amount: $moneyT): Unit = {
      |    implicit val system: ActorSystem[_] = kit.system
      |    implicit val ec: ExecutionContext = kit.system.executionContext
      |    val host = new FixtureHost(kit.system, sharding)
      |    val probe = kit.createTestProbe[StrictSagaCoordinator.Reply]()
      |    val source = $protocol.${simple(trigger.sourceFqn)}(opId, $startArgs, kit.createTestProbe[$protocol.${simple(face.replyFqn)}]().ref)
      |    coordinator ! $entry.start(coordinator, host, source, probe.ref)
      |  }
      |
      |  // ---------- deployment-face helpers (shared MongoDB journal) ----------
      |
      |  private val MongoHostPort = sys.env.getOrElse("SAGA_MONGO_HOSTPORT", "127.0.0.1:27017")
      |  private def mongoUri(db: String): String = s"mongodb://$$MongoHostPort/$$db"
      |
      |  private def mongoReachable(): Boolean = try {
      |    val parts = MongoHostPort.split(":")
      |    val socket = new java.net.Socket()
      |    try socket.connect(new java.net.InetSocketAddress(parts(0), parts(1).toInt), 2000) finally socket.close()
      |    true
      |  } catch { case _: Throwable => false }
      |
      |  /** Deployment-face config: the shared Mongo journal/snapshot stores plus the live
      |    * read journal under the RxMongo driver extension (the scaffold's Mongo 6 line).
      |    * Everything else inherits the application conf chain — allow-java-serialization
      |    * stays off, strict and app payloads ride their strict serializers. */
      |  private def mongoClusterConfig(port: Int, seeds: String, uri: String): Config = ConfigFactory.parseString(
      |    s\"\"\"
      |      akka.loglevel = "WARNING"
      |      akka.actor.provider = cluster
      |      akka.remote.artery.canonical.hostname = "127.0.0.1"
      |      akka.remote.artery.canonical.port = $$port
      |      akka.remote.artery.bind.hostname = "127.0.0.1"
      |      akka.remote.artery.bind.port = $$port
      |      akka.cluster.seed-nodes = [$$seeds]
      |      akka.cluster.jmx.multi-mbeans-in-same-jvm = on
      |      akka.persistence.journal.plugin = "akka-contrib-mongodb-persistence-journal"
      |      akka.persistence.snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"
      |      akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"
      |      akka.contrib.persistence.mongodb.mongo.mongouri = "$$uri"
      |    \"\"\".stripMargin).withFallback(ConfigFactory.load())
      |
      |  /** Deployment-face funding: the aggregate's own command face against the shared
      |    * journal — a real journal is not out-of-band seedable, and command seeding is the
      |    * production-honest path (the same folds the persistence test-kit seeds fake). */
      |  private def seedFundsByCommands(kit: ActorTestKit, sharding: ClusterSharding, entityId: String, txid: String): Unit = {
      |    val ref = entityRef(sharding, entityId)
      |    val r1 = askNow(kit, ref)(replyTo => $protocol.RecordIncomingCredits(txid, "deployment-seed", SeedAmount, replyTo))
      |    assert(r1.error.isEmpty, s"funding record failed for $$entityId: $${r1.error}")
      |    val r2 = askNow(kit, ref)(replyTo => $protocol.CommitIncomingCredits(txid, "deployment-seed", replyTo))
      |    assert(r2.error.isEmpty, s"funding commit failed for $$entityId: $${r2.error}")
      |  }
      |
      |$sourceHelpers
      |
      |  // ---------- A: aggregate conservation and idempotency ----------
      |
      |  test("A1 aggregate conservation: commit books exactly the prepared amount and leaves the marker") {
      |    val kit = ActorTestKit("SafetyAggregateA1", singleNodeConfig())
      |    try {
      |      seedFunds(kit, "a1", "seed-a1")
      |      val ref = kit.spawn(aggregateBehavior("a1"))
      |      val r1 = ${camel(sourcePorts.find(_.phaseRuntime == "Prepare").get.stem)}(kit, ref, "tx-a1-1", "a1", Money("100", Currency))
      |      assert(r1.error.isEmpty)
      |      assert(balance(kit, ref) == BigInt("99900"))
      |      assert(stateOf(kit, ref).reservedAmount("tx-a1-1").minorUnits == "100")
      |      val r2 = ${camel(sourcePorts.find(_.phaseRuntime == "Commit").get.stem)}(kit, ref, "tx-a1-1", "a1")
      |      assert(r2.error.isEmpty)
      |      val s = stateOf(kit, ref)
      |      assert(balance(kit, ref) == BigInt("99900"))
      |      assert(s.committed("tx-a1-1").minorUnits == "100")
      |      assert(!s.reservedAmount.contains("tx-a1-1"))
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  test("A2 aggregate conservation: compensation restores the balance and leaves the marker") {
      |    val kit = ActorTestKit("SafetyAggregateA2", singleNodeConfig())
      |    try {
      |      seedFunds(kit, "a2", "seed-a2")
      |      val ref = kit.spawn(aggregateBehavior("a2"))
      |      ${camel(sourcePorts.find(_.phaseRuntime == "Prepare").get.stem)}(kit, ref, "tx-a2-1", "a2", Money("50", Currency))
      |      val r = ${camel(sourcePorts.find(_.phaseRuntime == "Compensate").get.stem)}(kit, ref, "tx-a2-1", "a2")
      |      assert(r.error.isEmpty)
      |      val s = stateOf(kit, ref)
      |      assert(balance(kit, ref) == BigInt("100000"))
      |      assert(s.compensated("tx-a2-1").minorUnits == "50")
      |      assert(!s.reservedAmount.contains("tx-a2-1"))
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  test("A3 aggregate idempotency: replays and result republication are empty successes") {
      |    val kit = ActorTestKit("SafetyAggregateA3", singleNodeConfig())
      |    try {
      |      seedFunds(kit, "a3", "seed-a3")
      |      val ref = kit.spawn(aggregateBehavior("a3"))
      |      // duplicate prepare while prepared: succeed-empty, no double effect (the 60008 rule)
      |      ${camel(sourcePorts.find(_.phaseRuntime == "Prepare").get.stem)}(kit, ref, "tx-a3-1", "a3", Money("30", Currency))
      |      val replay = ${camel(sourcePorts.find(_.phaseRuntime == "Prepare").get.stem)}(kit, ref, "tx-a3-1", "a3", Money("30", Currency))
      |      assert(replay.error.isEmpty)
      |      assert(stateOf(kit, ref).reservedAmount("tx-a3-1").minorUnits == "30")
      |      assert(balance(kit, ref) == BigInt("99970"))
      |      // result republication: the second publish hits the succeed-empty guard, zero events
      |      val first = askNow(kit, ref)(replyTo => $pubCmd("tx-a3-result", replyTo))
      |      assert(first.error.isEmpty)
      |      val second = askNow(kit, ref)(replyTo => $pubCmd("tx-a3-result", replyTo))
      |      assert(second.error.isEmpty)
      |      val s = stateOf(kit, ref)
      |      assert(s.sagaResults.get("tx-a3-result").contains(${q(pubKind)}))
      |      assert(s.sagaResults.size == 1)
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  // ---------- B: the full TCC saga through the host ----------
      |
      |  private def assertPublished(kit: ActorTestKit, sharding: ClusterSharding, state: StrictState, expectedKind: String): Unit = {
      |    implicit val system: ActorSystem[_] = kit.system
      |    implicit val ec: ExecutionContext = kit.system.executionContext
      |    implicit val timeout: Timeout = Timeout(10.seconds)
      |    val reply = Await.result($entry.publishCompletion(sharding, new FixtureHost(kit.system, sharding), state), 10.seconds)
      |    assert(reply.error.isEmpty)
      |    assert(stateOf(kit, entityRef(sharding, From)).sagaResults.get(state.identity.get.transactionId).contains(expectedKind))
      |  }
      |
      |  /** Deployment-face completion assertion: the event-stream source OWNS the result
      |    * publication — poll the aggregate's durable sagaResults ledger until the mapped
      |    * kind appears (the publish rides the terminal marker's read-journal hop). */
      |  private def awaitPublished(kit: ActorTestKit, sharding: ClusterSharding, txId: String, expectedKind: String): Unit = {
      |    val deadline = System.currentTimeMillis() + 30000L
      |    var ledger: Map[String, String] = Map.empty
      |    while (!ledger.get(txId).contains(expectedKind) && System.currentTimeMillis() < deadline) {
      |      Thread.sleep(200)
      |      ledger = stateOf(kit, entityRef(sharding, From)).sagaResults
      |    }
      |    assert(ledger.get(txId).contains(expectedKind), s"the event source did not publish '$$expectedKind' for $$txId within 30s — ledger: $$ledger")
      |  }
      |
      |  test("B1 full saga: succeeded transfer books the exact amounts and publishes the ledger") {
      |    val port = freePort()
      |    val kit = ActorTestKit("SafetySagaB1", clusterConfig(port, s"\\"akka://SafetySagaB1@127.0.0.1:$$port\\""))
      |    try {
      |      val sharding = initSharding(kit)
      |      awaitMembers(kit, 1)
      |      seedFunds(kit, From, "seed-b1-from")
      |      seedFunds(kit, To, "seed-b1-to")
      |      implicit val ec: ExecutionContext = kit.system.executionContext
      |      val coordinator = $entry.spawnClusterSingleton(kit.system, sharding, ReconcileToken)
      |      startSaga(kit, sharding, coordinator, "op-b1", Money("100", Currency))
      |      val state = awaitTerminal(kit, coordinator)
      |      assert(state.status == StrictStatus.Succeeded)
      |      assert(balance(kit, entityRef(sharding, From)) == BigInt("99900"))
      |      assert(balance(kit, entityRef(sharding, To)) == BigInt("100100"))
      |      assertPublished(kit, sharding, state, "succeeded")
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  test("B2 full saga: business rejection compensates before effects and records the kind") {
      |    val port = freePort()
      |    val kit = ActorTestKit("SafetySagaB2", clusterConfig(port, s"\\"akka://SafetySagaB2@127.0.0.1:$$port\\""))
      |    try {
      |      val sharding = initSharding(kit)
      |      awaitMembers(kit, 1)
      |      seedFunds(kit, From, "seed-b2-from")
      |      seedFunds(kit, To, "seed-b2-to")
      |      implicit val ec: ExecutionContext = kit.system.executionContext
      |      val coordinator = $entry.spawnClusterSingleton(kit.system, sharding, ReconcileToken)
      |      startSaga(kit, sharding, coordinator, "op-b2", Money("999999", Currency))
      |      val state = awaitTerminal(kit, coordinator)
      |      assert(state.status == StrictStatus.Aborted)
      |      assert(balance(kit, entityRef(sharding, From)) == BigInt("100000"))
      |      assert(balance(kit, entityRef(sharding, To)) == BigInt("100000"))
      |      assertPublished(kit, sharding, state, "rejected-before-effects")
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |${renderMoneyPrepareEvidenceSpec(m)}
      |${renderMoneyTerminalEvidenceSpec(m)}
      |${renderMoneyPrepareTerminalBarrierSpec(m)}
      |${renderMoneyIncomingPositiveSpec(m)}
      |  // ---------- C: coordinator recovery ----------
      |
      |  test("C1 recovery: an interrupted saga resumes to a terminal state") {
      |    val port = freePort()
      |    val kit = ActorTestKit("SafetyRecoveryC1", clusterConfig(port, s"\\"akka://SafetyRecoveryC1@127.0.0.1:$$port\\""))
      |    try {
      |      val sharding = initSharding(kit)
      |      awaitMembers(kit, 1)
      |      seedFunds(kit, From, "seed-c1-from")
      |      seedFunds(kit, To, "seed-c1-to")
      |      implicit val system: ActorSystem[_] = kit.system
      |      implicit val ec: ExecutionContext = kit.system.executionContext
      |      val coordinator = $entry.spawn(kit.system, sharding, ReconcileToken)
      |      startSaga(kit, sharding, coordinator, "op-c1", Money("20", Currency))
      |      Thread.sleep(250) // mid-flight: the pinned interaction timeout is 1000ms
      |      // Kill through the classic cell (PoisonPill is cell-intercepted regardless of
      |    // the typed behavior's internal state) and await termination on a death watch.
      |      coordinator.toClassic ! akka.actor.PoisonPill
      |      // Re-spawn only succeeds once the old actor (same system-actor name) is dead —
      |    // the loop itself is the termination gate; the pill is cell-intercepted.
      |      var again: ActorRef[StrictSagaCoordinator.Command] = null
      |      val respawnDeadline = System.currentTimeMillis() + 20000L
      |      while (again == null && System.currentTimeMillis() < respawnDeadline) {
      |        try again = $entry.spawn(kit.system, sharding, ReconcileToken)
      |        catch { case _: Throwable => Thread.sleep(200) }
      |      }
      |      require(again != null, "the interrupted coordinator did not terminate in time")
      |      // RecoveryCompleted is inert by runtime design (reconcile-before-resume): the
      |      // recovered coordinator holds the interrupted transaction until an authorized
      |      // bounded Reconcile resumes it — the queries re-read the durable evidence.
      |      implicit val timeout: Timeout = Timeout(10.seconds)
      |      val recovered = Await.result($entry.status(again), 10.seconds)
      |      require(recovered.identity.isDefined, "recovered state carries no identity")
      |      val reconcileProbe = kit.createTestProbe[StrictSagaCoordinator.Reply]()
      |      again ! StrictSagaCoordinator.Reconcile(recovered.identity.get, ReconcileToken, 32, reconcileProbe.ref)
      |      val state = awaitTerminal(kit, again)
      |      assert(state.terminal || state.status == StrictStatus.RecoveryRequired)
      |      // Outcome-bounded conservation: succeeded moved exactly the amount; aborted restored it;
      |      // RecoveryRequired awaits authorized reconciliation (manual path, out of spec scope).
      |      if (state.status == StrictStatus.Succeeded) {
      |        assert(balance(kit, entityRef(sharding, From)) == BigInt("99980"))
      |        assert(balance(kit, entityRef(sharding, To)) == BigInt("100020"))
      |      } else if (state.status == StrictStatus.Aborted) {
      |        assert(balance(kit, entityRef(sharding, From)) == BigInt("100000"))
      |        assert(balance(kit, entityRef(sharding, To)) == BigInt("100000"))
      |      } else assert(state.status == StrictStatus.RecoveryRequired)
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  // ---------- D: the deployment face (shared MongoDB journal) ----------
      |
      |  test("D1 shared durable journal: two clustered systems complete a transfer over one Mongo journal") {
      |    assume(mongoReachable(), s"MongoDB not reachable at $$MongoHostPort — the deployment face (D1-D3) requires the shared durable journal")
      |    val uri = mongoUri(s"strict_deployment_d1_$${System.nanoTime()}")
      |    val portA = freePort()
      |    val kitA = ActorTestKit("SafetyClusterD1", mongoClusterConfig(portA, s"\\"akka://SafetyClusterD1@127.0.0.1:$$portA\\"", uri))
      |    val kitB = ActorTestKit("SafetyClusterD1", mongoClusterConfig(freePort(), s"\\"akka://SafetyClusterD1@127.0.0.1:$$portA\\"", uri))
      |    try {
      |      val shardingA = initSharding(kitA)
      |      val shardingB = initSharding(kitB)
      |      awaitMembers(kitA, 2)
      |      awaitMembers(kitB, 2)
      |      // One shared journal: fund once through the aggregate's own command face — every
      |      // node reads the same durable state (the per-system test-kit journals are gone).
      |      seedFundsByCommands(kitA, shardingA, From, "seed-d1-from")
      |      seedFundsByCommands(kitA, shardingA, To, "seed-d1-to")
      |      implicit val ec: ExecutionContext = kitB.system.executionContext
      |      // ClusterSingleton runs the coordinator on the cluster's OLDEST member — every
      |      // node must init the singleton; the returned proxies route cluster-wide.
      |      val coordinatorA = $entry.spawnClusterSingleton(kitA.system, shardingA, ReconcileToken)
      |      val coordinatorB = $entry.spawnClusterSingleton(kitB.system, shardingB, ReconcileToken)
      |      startSaga(kitB, shardingB, coordinatorB, "op-d1", Money("100", Currency))
      |      val state = awaitTerminal(kitB, coordinatorB)
      |      assert(state.status == StrictStatus.Succeeded)
      |      // Balances verified through BOTH systems' sharding proxies — cross-node asks
      |      // against one shared durable journal.
      |      assert(balance(kitA, entityRef(shardingA, From)) == BigInt("99900"))
      |      assert(balance(kitB, entityRef(shardingB, To)) == BigInt("100100"))
      |      assertPublished(kitA, shardingA, state, "succeeded")
      |    } finally { kitB.shutdownTestKit(); kitA.shutdownTestKit() }
      |  }
      |
      |  test("D2 event-stream source: the persisted trigger event starts the saga with no direct coordinator call") {
      |    assume(mongoReachable(), s"MongoDB not reachable at $$MongoHostPort — the deployment face (D1-D3) requires the shared durable journal")
      |    val port = freePort()
      |    val kit = ActorTestKit("SafetyEventSourceD2", mongoClusterConfig(port, s"\\"akka://SafetyEventSourceD2@127.0.0.1:$$port\\"", mongoUri(s"strict_deployment_d2_$${System.nanoTime()}")))
      |    try {
      |      val sharding = initSharding(kit)
      |      awaitMembers(kit, 1)
      |      seedFundsByCommands(kit, sharding, From, "seed-d2-from")
      |      seedFundsByCommands(kit, sharding, To, "seed-d2-to")
      |      implicit val ec: ExecutionContext = kit.system.executionContext
      |      val coordinator = $entry.spawnClusterSingleton(kit.system, sharding, ReconcileToken)
      |      // Install the journal event-stream source BEFORE the command: whatever the
      |      // stream's catch-up semantics, the trigger event persists after the install.
      |      $entry.installEventSource(kit.system, sharding, coordinator)
      |      // Send the command to the AGGREGATE (never the coordinator): the persisted
      |      // trigger event is what starts the saga.
      |      val opId = "op-d2-" + System.currentTimeMillis()
      |      val amount = Money("100", Currency)
      |      val commandReply = askNow(kit, entityRef(sharding, From))(replyTo =>
      |        $protocol.${simple(trigger.sourceFqn)}(opId, $startArgs, replyTo))
      |      assert(commandReply.error.isEmpty)
      |      val state = awaitTerminal(kit, coordinator)
      |      assert(state.status == StrictStatus.Succeeded)
      |      assert(state.identity.get.transactionId == opId)
      |      assert(balance(kit, entityRef(sharding, From)) == BigInt("99900"))
      |      assert(balance(kit, entityRef(sharding, To)) == BigInt("100100"))
      |      // No manual publish here: the event-stream source owns the completion side.
      |      awaitPublished(kit, sharding, opId, "succeeded")
      |    } finally kit.shutdownTestKit()
      |  }
      |
      |  test("D3 physical two-JVM deployment: an event-driven saga across two processes and one journal") {
      |    assume(mongoReachable(), s"MongoDB not reachable at $$MongoHostPort — the deployment face (D1-D3) requires the shared durable journal")
      |    val classpath = System.getProperty("java.class.path")
      |    assume(classpath.split(java.io.File.pathSeparator).exists(p => p.contains("target") && p.contains("scala-2.13")),
      |      "D3 requires Test/fork — java.class.path must carry the application test classpath")
      |    val uri = mongoUri(s"strict_deployment_d3_$${System.nanoTime()}")
      |    val portSeed = freePort()
      |    val seedAddr = s"\\"akka://SafetyClusterD3@127.0.0.1:$$portSeed\\""
      |    val evidenceDir = new java.io.File("target/deployment-face")
      |    evidenceDir.mkdirs()
      |    val javaBin = s"$${System.getProperty("java.home")}/bin/java"
      |    def node(args: Seq[String], log: String): java.lang.Process =
      |      new java.lang.ProcessBuilder((Vector(javaBin, "-cp", classpath, "${m.packagePath}.FixtureDeploymentNode") ++ args): _*)
      |        .redirectOutput(new java.io.File(evidenceDir, log))
      |        .redirectErrorStream(true)
      |        .start()
      |    val opId = "op-d3-" + System.currentTimeMillis()
      |    val seed = node(Vector("seed", portSeed.toString, seedAddr, uri), "d3-seed.log")
      |    try {
      |      // Head start: wait until the seed node's artery port accepts connections.
      |      val seedUp = System.currentTimeMillis() + 30000L
      |      var bound = false
      |      while (!bound && System.currentTimeMillis() < seedUp) {
      |        try { val s = new java.net.Socket("127.0.0.1", portSeed); s.close(); bound = true }
      |        catch { case _: Throwable => Thread.sleep(200) }
      |      }
      |      assert(bound, "seed node did not bind its artery port in 30s — see target/deployment-face/d3-seed.log")
      |      val join = node(Vector("join", freePort().toString, seedAddr, uri, opId, From, To, "100"), "d3-join.log")
      |      try {
      |        val joinDone = join.waitFor(180, java.util.concurrent.TimeUnit.SECONDS)
      |        assert(joinDone, "join node did not finish in 180s — see target/deployment-face/d3-join.log and d3-seed.log")
      |        assert(join.exitValue() == 0, s"join node failed (exit $${join.exitValue()}) — see target/deployment-face/d3-join.log and d3-seed.log")
      |        val source = scala.io.Source.fromFile(new java.io.File(evidenceDir, "d3-join.log"))
      |        val out = try source.mkString finally source.close()
      |        assert(out.contains(s"D3-RESULT status=Succeeded op=$$opId"), s"join node did not report a succeeded transfer — output: $$out")
      |        assert(out.contains("alice=99900") && out.contains("bob=100100"), s"balances wrong — output: $$out")
      |      } finally if (join.isAlive) join.destroy()
      |    } finally {
      |      if (seed.isAlive) { seed.destroy(); seed.waitFor(10, java.util.concurrent.TimeUnit.SECONDS) }
      |    }
      |  }
      |
      |  private def freePort(): Int = {
      |    val socket = new java.net.ServerSocket(0)
      |    try socket.getLocalPort finally socket.close()
      |  }
      |
      |  test("D4 physical two-JVM failover: coordinator-node loss converges through singleton migration and an authorized reconcile") {
      |    assume(mongoReachable(), s"MongoDB not reachable at $$MongoHostPort — the deployment face (D1-D4) requires the shared durable journal")
      |    val classpath = System.getProperty("java.class.path")
      |    assume(classpath.split(java.io.File.pathSeparator).exists(p => p.contains("target") && p.contains("scala-2.13")),
      |      "D4 requires Test/fork — java.class.path must carry the application test classpath")
      |    val uri = mongoUri(s"strict_deployment_d4_$${System.nanoTime()}")
      |    val portSeed = freePort()
      |    val seedAddr = s"\\"akka://SafetyClusterD4@127.0.0.1:$$portSeed\\""
      |    val evidenceDir = new java.io.File("target/deployment-face")
      |    evidenceDir.mkdirs()
      |    val javaBin = s"$${System.getProperty("java.home")}/bin/java"
      |    def node(args: Seq[String], log: String): java.lang.Process =
      |      new java.lang.ProcessBuilder((Vector(javaBin, "-cp", classpath, "${m.packagePath}.FixtureDeploymentNode") ++ args): _*)
      |        .redirectOutput(new java.io.File(evidenceDir, log))
      |        .redirectErrorStream(true)
      |        .start()
      |    def tailOf(log: java.io.File): String = {
      |      val s = scala.io.Source.fromFile(log)
      |      try s.mkString finally s.close()
      |    }
      |    val opId = "op-d4-" + System.currentTimeMillis()
      |    val seed = node(Vector("seed", portSeed.toString, seedAddr, uri), "d4-seed.log")
      |    try {
      |      // Head start: wait until the seed node's artery port accepts connections.
      |      val seedUp = System.currentTimeMillis() + 30000L
      |      var bound = false
      |      while (!bound && System.currentTimeMillis() < seedUp) {
      |        try { val s = new java.net.Socket("127.0.0.1", portSeed); s.close(); bound = true }
      |        catch { case _: Throwable => Thread.sleep(200) }
      |      }
      |      assert(bound, "seed node did not bind its artery port in 30s — see target/deployment-face/d4-seed.log")
      |      val joinLog = new java.io.File(evidenceDir, "d4-join.log")
      |      val join = node(Vector("failover", freePort().toString, seedAddr, uri, opId, From, To, "100"), "d4-join.log")
      |      try {
      |        // Destroy the coordinator node as early as the transaction is observable
      |        // (identity defined). Whatever instant the loss lands — before the Start,
      |        // mid-flight or after the terminal marker — the deployment converges: the
      |        // recovered journal state resumes on the migrated singleton and the authorized
      |        // reconcile completes the saga (the deterministic mid-flight kill semantics
      |        // are C1's domain; here the physical topology is the subject).
      |        val started = System.currentTimeMillis() + 60000L
      |        var seen = false
      |        while (!seen && System.currentTimeMillis() < started) {
      |          if (joinLog.exists() && tailOf(joinLog).contains("D4-STARTED")) seen = true
      |          else Thread.sleep(25)
      |        }
      |        assert(seen, "failover node never reported D4-STARTED in 60s — see target/deployment-face/d4-join.log")
      |        seed.destroy() // SIGTERM → CoordinatedShutdown → graceful cluster leave → singleton migrates
      |        seed.waitFor(30, java.util.concurrent.TimeUnit.SECONDS)
      |        val joinDone = join.waitFor(180, java.util.concurrent.TimeUnit.SECONDS)
      |        assert(joinDone, "failover node did not finish in 180s — see target/deployment-face/d4-join.log and d4-seed.log")
      |        assert(join.exitValue() == 0, s"failover node failed (exit $${join.exitValue()}) — see target/deployment-face/d4-join.log and d4-seed.log")
      |        val out = tailOf(joinLog)
      |        assert(out.contains(s"D4-RESULT status=Succeeded op=$$opId"), s"failover node did not report a succeeded transfer — output: $$out")
      |        assert(out.contains("alice=99900") && out.contains("bob=100100"), s"balances wrong — output: $$out")
      |        assert(out.contains("ledger=succeeded"), s"the source did not publish the ledger after the node loss — output: $$out")
      |      } finally if (join.isAlive) join.destroy()
      |    } finally {
      |      if (seed.isAlive) { seed.destroy(); seed.waitFor(10, java.util.concurrent.TimeUnit.SECONDS) }
      |    }
      |  }
      |
      |  test("production conf chain assembles the shared durable journal (saga-gated conf face)") {
      |    // The scaffold conf/persistence.conf rides the application.conf include chain as
      |    // the PRODUCTION default; every other test config overrides the journal
      |    // explicitly, so this asserts the assembly (parse only — no journal instantiation).
      |    val config = ConfigFactory.load()
      |    assert(config.getString("akka.persistence.journal.plugin") == "akka-contrib-mongodb-persistence-journal")
      |    assert(config.getString("akka.persistence.snapshot-store.plugin") == "akka-contrib-mongodb-persistence-snapshot")
      |    assert(config.getString("akka.contrib.persistence.mongodb.mongo.driver") == "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension")
      |    assert(config.hasPath("akka.contrib.persistence.mongodb.mongo.mongouri"))
      |  }
      |}
      |""".stripMargin
  }

  private def renderMoneyPrepareEvidenceSpec(m: FixtureHostModel): String = {
    val stream = getClass.getResourceAsStream("/codegen/templates/money-prepare-evidence.scala.tpl")
    require(stream != null, "money Prepare evidence spec template missing")
    val source = try new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8) finally stream.close()
    val face = m.faces.find(_.base == m.publicationFaceBase).get
    val values = Map("MODULE" -> m.moduleType.name, "ENTITY" -> face.entityFqn,
      "AGGREGATE" -> face.aggregateKeyFqn.stripSuffix(".entityTypeKey"),
      "MONEY" -> m.typeAliases.find(_.money).get.targetFqn)
    val result = values.foldLeft(source) { case (text, (key, value)) => text.replace("@" + key + "@", value) }
    require(!"@[A-Z_]+@".r.findFirstIn(result).isDefined, "unresolved money Prepare evidence spec slot")
    result
  }

  private def renderMoneyTerminalEvidenceSpec(m: FixtureHostModel): String = {
    val stream = getClass.getResourceAsStream("/codegen/templates/money-terminal-evidence.scala.tpl")
    require(stream != null, "money terminal evidence spec template missing")
    val source = try new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8) finally stream.close()
    val face = m.faces.find(_.base == m.publicationFaceBase).get
    val values = Map("MODULE" -> m.moduleType.name, "ENTITY" -> face.entityFqn,
      "AGGREGATE" -> face.aggregateKeyFqn.stripSuffix(".entityTypeKey"),
      "MONEY" -> m.typeAliases.find(_.money).get.targetFqn, "COMMANDS" -> face.commandsFamilyFqn)
    val result = values.foldLeft(source) { case (text, (key, value)) => text.replace("@" + key + "@", value) }
    require(!"@[A-Z_]+@".r.findFirstIn(result).isDefined, "unresolved money terminal evidence spec slot")
    result
  }

  private def renderMoneyPrepareTerminalBarrierSpec(m: FixtureHostModel): String = {
    val stream = getClass.getResourceAsStream("/codegen/templates/money-prepare-terminal-barrier.scala.tpl")
    require(stream != null, "money Prepare terminal barrier spec template missing")
    val source = try new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8) finally stream.close()
    val face = m.faces.find(_.base == m.publicationFaceBase).get
    val domainPrefix = face.entityFqn.substring(0, face.entityFqn.lastIndexOf(".entities."))
    val rules = domainPrefix + ".invariant." + face.base + "Rules"
    val values = Map("MODULE" -> m.moduleType.name, "ENTITY" -> face.entityFqn,
      "AGGREGATE" -> face.aggregateKeyFqn.stripSuffix(".entityTypeKey"),
      "MONEY" -> m.typeAliases.find(_.money).get.targetFqn, "COMMANDS" -> face.commandsFamilyFqn,
      "RULES" -> rules, "RULE_PARAMS" -> rules)
    val result = values.foldLeft(source) { case (text, (key, value)) => text.replace("@" + key + "@", value) }
    require(!"@[A-Z_]+@".r.findFirstIn(result).isDefined, "unresolved money Prepare terminal barrier spec slot")
    result
  }

  private def renderMoneyIncomingPositiveSpec(m: FixtureHostModel): String = {
    val stream = getClass.getResourceAsStream("/codegen/templates/money-incoming-positive.scala.tpl")
    require(stream != null, "money incoming positive spec template missing")
    val source = try new String(stream.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8) finally stream.close()
    val face = m.faces.find(_.base == m.publicationFaceBase).get
    val domainPrefix = face.entityFqn.substring(0, face.entityFqn.lastIndexOf(".entities."))
    val rules = domainPrefix + ".invariant." + face.base + "Rules"
    val values = Map("MODULE" -> m.moduleType.name, "ENTITY" -> face.entityFqn,
      "MONEY" -> m.typeAliases.find(_.money).get.targetFqn, "COMMANDS" -> face.commandsFamilyFqn,
      "RULES" -> rules, "RULE_PARAMS" -> rules)
    val result = values.foldLeft(source) { case (text, (key, value)) => text.replace("@" + key + "@", value) }
    require(!"@[A-Z_]+@".r.findFirstIn(result).isDefined, "unresolved money incoming positive spec slot")
    result
  }

  // ---------- test/fixture/FixtureDeploymentNode.scala (D3 physical two-JVM node) ----------
  private def renderDeploymentNode(m: FixtureHostModel): String = {
    val face = m.faces.find(_.base == m.publicationFaceBase).getOrElse(throw new IllegalStateException(
      s"fixture deployment node: no publication face ${m.publicationFaceBase}"))
    val protocol = simple(face.protocolFqn)
    val aggregateObject = simple(face.aggregateKeyFqn.substring(0, face.aggregateKeyFqn.lastIndexOf('.')))
    val protocolPkg = face.protocolFqn.substring(0, face.protocolFqn.lastIndexOf('.'))
    val moneyT = m.typeAliases.filter(_.money).map(_.targetFqn).distinct.head
    val trigger = m.triggers.find(_.sourceIsCommand).getOrElse(throw new IllegalStateException(
      "fixture deployment node: the contract declares no command trigger"))
    val otherSlot = trigger.argSources.map(_._1)
      .filterNot(s => s == trigger.idempotencyField || s == m.publicationSlot || trigger.moneySlots.contains(s)) match {
      case Vector(one) => one
      case other => throw new IllegalStateException(s"fixture deployment node: trigger maps ${other.size} non-identity/non-source text slots, expected exactly one target slot")
    }
    def startArgExpr(slot: String): String =
      if (slot == trigger.idempotencyField) "opId"
      else if (trigger.moneySlots.contains(slot)) "amount"
      else if (slot == m.publicationSlot) "from"
      else if (slot == otherSlot) "to"
      else throw new IllegalStateException(s"fixture deployment node: unmapped trigger slot \"$slot\"")
    val startArgs = trigger.argSources.map(s => startArgExpr(s._1)).mkString(", ")

    s"""package ${m.packagePath}
      |
      |import akka.actor.typed.{ActorSystem, Behavior}
      |import akka.actor.typed.scaladsl.Behaviors
      |import akka.actor.typed.scaladsl.AskPattern._
      |import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, Entity, EntityRef}
      |import akka.cluster.typed.Cluster
      |import akka.persistence.typed.PersistenceId
      |import akka.util.Timeout
      |import com.typesafe.config.{Config, ConfigFactory}
      |import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictState, StrictStatus}
      |import $protocolPkg.$protocol
      |import $protocolPkg.$aggregateObject
      |import ${face.entityFqn}
      |import ${face.behaviorsFqn}
      |import ${face.eventHandlerFqn}
      |import scala.concurrent.{Await, ExecutionContext}
      |import scala.concurrent.duration._
      |
      |/** One node of the deployment-face two-JVM cluster (emitted, not hand-written):
      |  *   - seed: forms the cluster and hosts the coordinator singleton, then idles until
      |  *     the parent process destroys it;
      |  *   - join: funds through the aggregate's own command face, installs the journal
      |  *     event-stream source, sends the trigger command to the aggregate — the
      |  *     PERSISTED trigger event is what starts the saga — then polls the coordinator
      |  *     to a terminal state and prints a machine-checkable result line (exit 0, or
      |  *     exit 1 with a stack trace on any failure).
      |  * Usage: FixtureDeploymentNode seed|join <port> <seedAddr> <mongoUri> [opId from to amountMinor] */
      |object FixtureDeploymentNode {
      |
      |  private val Money = $moneyT
      |  private val Currency = "XTS"
      |  private val SeedAmount = Money("100000", Currency)
      |  private val ReconcileToken = "safety-spec-reconcile-token"
      |
      |  def main(args: Array[String]): Unit = {
      |    require(args.length >= 4, "usage: FixtureDeploymentNode seed|join <port> <seedAddr> <mongoUri> [opId from to amountMinor]")
      |    val role = args(0)
      |    val port = args(1).toInt
      |    val seedAddr = args(2)
      |    val uri = args(3)
      |    try {
      |      val config = ConfigFactory.parseString(
      |        s\"\"\"
      |          akka.loglevel = "WARNING"
      |          akka.actor.provider = cluster
      |          akka.remote.artery.canonical.hostname = "127.0.0.1"
      |          akka.remote.artery.canonical.port = $$port
      |          akka.remote.artery.bind.hostname = "127.0.0.1"
      |          akka.remote.artery.bind.port = $$port
      |          akka.cluster.seed-nodes = [$$seedAddr]
      |          akka.persistence.journal.plugin = "akka-contrib-mongodb-persistence-journal"
      |          akka.persistence.snapshot-store.plugin = "akka-contrib-mongodb-persistence-snapshot"
      |          akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"
      |          akka.contrib.persistence.mongodb.mongo.mongouri = "$$uri"
      |        \"\"\".stripMargin).withFallback(ConfigFactory.load())
      |      // The cluster name derives from the seed address — both nodes of a deployment
      |      // family (D3/D4) derive the same name from the same argument, no hardcoding.
      |      // (The parent passes the config-shaped address; the alphanumeric run immediately
      |      // before '@' is the system name — quote-safe, no string-escape hazards.)
      |      val systemName = seedAddr.takeWhile(_ != '@').reverse.takeWhile(_.isLetterOrDigit).reverse
      |      implicit val system: ActorSystem[Nothing] = ActorSystem[Nothing](Behaviors.empty, systemName, config)
      |      implicit val ec: ExecutionContext = system.executionContext
      |      val sharding = ClusterSharding(system)
      |      sharding.init(Entity(${face.aggregateKeyFqn})(ctx => aggregateBehavior(ctx.entityId)))
      |      val coordinator = ${m.entryName}.spawnClusterSingleton(system, sharding, ReconcileToken)
      |      role match {
      |        case "seed" =>
      |          // The parent destroys this process once the join node has reported.
      |          Await.result(system.whenTerminated, Duration.Inf)
      |        case "join" =>
      |          require(args.length >= 8, "join node requires: join <port> <seedAddr> <mongoUri> <opId> <from> <to> <amountMinor>")
      |          awaitMembers(system, 2)
      |          fund(system, sharding, args(5), "seed-d3-from")
      |          fund(system, sharding, args(6), "seed-d3-to")
      |          val opId = args(4)
      |          val from = args(5)
      |          val to = args(6)
      |          val amount = Money(args(7), Currency)
      |          implicit val timeout: Timeout = Timeout(15.seconds)
      |          // Event-stream source first, command second: the persisted trigger event must
      |          // find the source already streaming the journal.
      |          ${m.entryName}.installEventSource(system, sharding, coordinator)
      |          val commandReply = Await.result(
      |            entityRef(sharding, from).ask(replyTo => $protocol.${simple(trigger.sourceFqn)}(opId, $startArgs, replyTo)), 15.seconds)
      |          require(commandReply.error.isEmpty, s"trigger command rejected: $${commandReply.error}")
      |          val deadline = System.currentTimeMillis() + 90000L
      |          var state = Await.result(${m.entryName}.status(coordinator), 15.seconds)
      |          while (!state.terminal && System.currentTimeMillis() < deadline) {
      |            Thread.sleep(300)
      |            state = Await.result(${m.entryName}.status(coordinator), 15.seconds)
      |          }
      |          require(state.terminal, s"the saga did not reach a terminal state in 90s: $${state.status}")
      |          require(state.status == StrictStatus.Succeeded, s"expected Succeeded, got $${state.status}")
      |          val sourceBalance = balance(system, sharding, from)
      |          val targetBalance = balance(system, sharding, to)
      |          awaitLedger(system, sharding, from, opId, "succeeded")
      |          println(s"D3-RESULT status=$${state.status} op=$$opId $$from=$$sourceBalance $$to=$$targetBalance")
      |          require(sourceBalance == BigInt("99900"), s"source balance $$sourceBalance != 99900")
      |          require(targetBalance == BigInt("100100"), s"target balance $$targetBalance != 100100")
      |          system.terminate()
      |          Await.ready(system.whenTerminated, 15.seconds)
      |          sys.exit(0)
      |        case "failover" =>
      |          require(args.length >= 8, "failover node requires: failover <port> <seedAddr> <mongoUri> <opId> <from> <to> <amountMinor>")
      |          awaitMembers(system, 2)
      |          fund(system, sharding, args(5), "seed-d4-from")
      |          fund(system, sharding, args(6), "seed-d4-to")
      |          val opId = args(4)
      |          val from = args(5)
      |          val to = args(6)
      |          val amount = Money(args(7), Currency)
      |          implicit val timeout: Timeout = Timeout(15.seconds)
      |          ${m.entryName}.installEventSource(system, sharding, coordinator)
      |          val commandReply = Await.result(
      |            entityRef(sharding, from).ask(replyTo => $protocol.${simple(trigger.sourceFqn)}(opId, $startArgs, replyTo)), 15.seconds)
      |          require(commandReply.error.isEmpty, s"trigger command rejected: $${commandReply.error}")
      |          // Failover gate: report the transaction as observable (identity defined) —
      |          // the parent destroys the seed node the moment it sees this line.
      |          var gate: StrictState = null
      |          val gateDeadline = System.currentTimeMillis() + 60000L
      |          while ((gate == null || gate.identity.isEmpty) && System.currentTimeMillis() < gateDeadline) {
      |            Thread.sleep(25)
      |            try gate = Await.result(${m.entryName}.status(coordinator), 3.seconds)
      |            catch { case _: Throwable => gate = null }
      |          }
      |          require(gate != null && gate.identity.isDefined, "the saga never started within 60s")
      |          println(s"D4-STARTED op=$$opId")
      |          // Convergence loop: whatever instant the node loss landed, the deployment
      |          // converges — the recovered journal state resumes on the migrated singleton
      |          // and an authorized reconcile completes the saga (Denied while the previous
      |          // instance is still active, accepted on the migrated recovery).
      |          val reconcileSink = system.systemActorOf(
      |            Behaviors.receiveMessage[StrictSagaCoordinator.Reply](_ => Behaviors.same), "deployment-reconcile-sink")
      |          val deadline = System.currentTimeMillis() + 150000L
      |          var state: StrictState = null
      |          while ((state == null || !state.terminal) && System.currentTimeMillis() < deadline) {
      |            Thread.sleep(300)
      |            try state = Await.result(${m.entryName}.status(coordinator), 5.seconds)
      |            catch { case _: Throwable => state = null } // handover window: singleton moving
      |            if (state != null && !state.terminal && state.identity.isDefined) {
      |              coordinator ! StrictSagaCoordinator.Reconcile(state.identity.get, ReconcileToken, 32, reconcileSink)
      |            }
      |          }
      |          require(state != null && state.terminal, s"the saga did not converge in 150s: $$state")
      |          require(state.status == StrictStatus.Succeeded, s"expected Succeeded, got $${state.status}")
      |          val sourceBalance = balance(system, sharding, from)
      |          val targetBalance = balance(system, sharding, to)
      |          awaitLedger(system, sharding, from, opId, "succeeded")
      |          println(s"D4-RESULT status=$${state.status} op=$$opId $$from=$$sourceBalance $$to=$$targetBalance ledger=succeeded")
      |          require(sourceBalance == BigInt("99900"), s"source balance $$sourceBalance != 99900")
      |          require(targetBalance == BigInt("100100"), s"target balance $$targetBalance != 100100")
      |          system.terminate()
      |          Await.ready(system.whenTerminated, 15.seconds)
      |          sys.exit(0)
      |        case other =>
      |          throw new IllegalArgumentException(s"unknown role: $$other")
      |      }
      |    } catch { case t: Throwable => t.printStackTrace(); sys.exit(1) }
      |  }
      |
      |  private def awaitMembers(system: ActorSystem[_], n: Int): Unit = {
      |    val deadline = System.currentTimeMillis() + 30000L
      |    while (Cluster(system).state.members.size < n && System.currentTimeMillis() < deadline) Thread.sleep(200)
      |    require(Cluster(system).state.members.size >= n, s"cluster did not reach $$n members")
      |  }
      |
      |  private def entityRef(sharding: ClusterSharding, id: String): EntityRef[$protocol.${simple(face.commandsFamilyFqn)}] =
      |    sharding.entityRefFor(${face.aggregateKeyFqn}, id)
      |
      |  private def aggregateBehavior(entityId: String): Behavior[$protocol.${simple(face.commandsFamilyFqn)}] =
      |    akka.persistence.typed.scaladsl.EventSourcedBehavior(
      |      persistenceId = PersistenceId(${face.aggregateKeyFqn}.name, entityId),
      |      emptyState = ${face.entityFqn}.empty(entityId),
      |      commandHandler = ${face.behaviorsFqn}.apply,
      |      eventHandler = ${face.eventHandlerFqn}.apply)
      |
      |  /** Deployment-face funding: the aggregate's own command face (the same folds the
      |    * persistence test-kit seeds in the A/B/C family — a real journal is not
      |    * out-of-band seedable). */
      |  private def fund(system: ActorSystem[_], sharding: ClusterSharding, entityId: String, txid: String): Unit = {
      |    implicit val s: ActorSystem[_] = system
      |    implicit val timeout: Timeout = Timeout(15.seconds)
      |    val ref = entityRef(sharding, entityId)
      |    val r1 = Await.result(ref.ask(replyTo => $protocol.RecordIncomingCredits(txid, "deployment-seed", SeedAmount, replyTo)), 15.seconds)
      |    require(r1.error.isEmpty, s"funding record failed for $$entityId: $${r1.error}")
      |    val r2 = Await.result(ref.ask(replyTo => $protocol.CommitIncomingCredits(txid, "deployment-seed", replyTo)), 15.seconds)
      |    require(r2.error.isEmpty, s"funding commit failed for $$entityId: $${r2.error}")
      |  }
      |
      |  private def balance(system: ActorSystem[_], sharding: ClusterSharding, entityId: String): BigInt = {
      |    implicit val s: ActorSystem[_] = system
      |    implicit val timeout: Timeout = Timeout(15.seconds)
      |    val state = Await.result(entityRef(sharding, entityId).ask(replyTo => $protocol.${simple(face.queryCommandFqn)}(replyTo)), 15.seconds).state
      |    BigInt(state.accountBalance(Currency).minorUnits)
      |  }
      |
      |  /** The event-stream source owns the result publication: poll the durable sagaResults
      |    * ledger on the initiating entity until the mapped kind appears. */
      |  private def awaitLedger(system: ActorSystem[_], sharding: ClusterSharding, entityId: String, txId: String, expectedKind: String): Unit = {
      |    implicit val s: ActorSystem[_] = system
      |    implicit val timeout: Timeout = Timeout(15.seconds)
      |    val deadline = System.currentTimeMillis() + 30000L
      |    var ledger: Map[String, String] = Map.empty
      |    while (!ledger.get(txId).contains(expectedKind) && System.currentTimeMillis() < deadline) {
      |      Thread.sleep(200)
      |      ledger = Await.result(entityRef(sharding, entityId).ask(replyTo => $protocol.${simple(face.queryCommandFqn)}(replyTo)), 15.seconds).state.sagaResults
      |    }
      |    require(ledger.get(txId).contains(expectedKind), s"the event source did not publish '$$expectedKind' for $$txId within 30s — ledger: $$ledger")
      |  }
      |}
      |""".stripMargin
  }
}
