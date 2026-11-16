package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductHostSupportTemplate {
  private def quote(value: String): String = ujson.write(value)
  private def typeText(ref: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = ref.fqn + (if (ref.typeParams.isEmpty) "" else ref.typeParams.map(typeText).mkString("[", ", ", "]"))
  private def tpe(value: NominalType, m: ProductApplicationModel): String = typeText(TypeResolverDSL.productType(value, m.domain.packages))
  private def owner(p: HostTechnicalPort, m: ProductApplicationModel): ArtifactContract = {
    val owners = m.selectedArtifacts.filter(a => a.ports.exists(pin => pin.ref == p.port.ref && pin.version == p.port.version) &&
      a.implementations.exists(i => i.port == p.port.ref && i.id == p.implementation.id && i.version == p.implementation.version))
    require(owners.size == 1, "exact selected technical port owner required")
    owners.head
  }
  private def memberType(r: QualifiedReference, m: ProductApplicationModel): NominalType = m.domain.layout.declarations.find(_.ref == r).get.valueType.get
  private def nonNull(value: String, t: NominalType, m: ProductApplicationModel): String = t match {
    case NominalType.Named(r) => value + " != null && " + nonNull(value + ".value", memberType(r, m), m)
    case _ => value + " != null"
  }
  private def textualValue(value: String, t: NominalType, m: ProductApplicationModel): String = t match {
    case NominalType.Named(r) => textualValue(value + ".value", memberType(r, m), m)
    case _ => value
  }
  private def installedRun(h: SagaHostContract, p: HostTechnicalPort, pin: ArtifactPort, method: String, m: ProductApplicationModel): String = {
    val keys = h.association.inputKeys.map(k => NamingConventions.productSymbol(k.id) -> memberType(k, m))
    if (Set("external-submission", "external-query", "readside")(p.role)) {
      val inputGate = (Vector("input != null") ++ keys.map { case (id, t) => nonNull("input." + id, t, m) }).mkString(" && ")
      val sameKeys = keys.map { case (id, _) => "record." + id + " == input." + id }.mkString(" && ")
      val resultGate = if (p.role == "external-submission") "result != null && { val record = result; " + sameKeys + " }"
        else "result != null && result.forall(record => record != null && " + sameKeys + ")"
      "{\n      require(" + inputGate + ", \"complete original association input required\")\n      val pending = bindings." + method + ".run(input)\n      require(pending != null, \"typed association callback future required\")\n      pending.map { result =>\n        require(" + resultGate + ", \"technical port changed original association\")\n        result\n      }(scala.concurrent.ExecutionContext.parasitic)\n    }"
    } else if (p.role == "deployment") {
      val record = pin.inputType.asInstanceOf[NominalType.Named].ref
      val members = memberType(record, m).asInstanceOf[NominalType.Record].members
      val secret = members.find(_.id == "secretRef").get
      val secretType = memberType(secret, m)
      "{\n      require(input != null && " + nonNull("input.secretRef", secretType, m) + " && secretReferences.exists(_._1 == " + textualValue("input.secretRef", secretType, m) + "), \"declared symbolic secret reference required before deployment callback\")\n      bindings." + method + ".run(input)\n    }"
    } else "bindings." + method + ".run(input)"
  }
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = model.hosts.zipWithIndex.flatMap { case (row, index) =>
    val h = row.contract; val pkg = model.domain.packages(h.saga.ref.context); val stem = NamingConventions.strictSymbol(h.id)
    def entry(path: String, text: String, kind: String): ProductSourceModel = ProductSourceModel(path, text, kind, Vector(h.source), model.footprint)
    val protoName = stem.replace("_", "") + "HostEventPB"
    val protoPath = "app/protobuf/" + stem + "_host.proto"
    val proto = "syntax = \"proto3\";\nimport \"scalapb/scalapb.proto\";\npackage " + pkg + ".infrastructure.hostproto;\noption (scalapb.options) = { flat_package: true };\nmessage " + protoName + " { string kind = 1; bytes original = 2; bytes args = 3; string operation = 4; bytes identity = 5; }\n"
    val host = stem + "Host"; val pb = pkg + ".infrastructure.hostproto." + protoName
    val serializer = "package " + pkg + ".application\n\nimport akka.serialization.SerializerWithStringManifest\nimport net.imadz.infra.saga.strict.StrictSagaProtoConverters\nimport net.imadz.infra.saga.strict.proto.saga_strict.TransactionIdentityPO\n\nfinal class " + stem + "HostSerializer extends SerializerWithStringManifest {\n  override val identifier: Int = " + (742000 + index) + "\n  def manifest(value: AnyRef): String = { require(value.isInstanceOf[" + host + ".Event], \"host event required\"); \"event-v1\" }\n  def toBinary(value: AnyRef): Array[Byte] = {\n    manifest(value)\n    val pb = value match {\n      case " + host + ".AdmissionGranted => " + pb + "(kind = \"admitted\")\n      case " + host + ".Associated(original, args, operation) => " + pb + "(kind = \"associated\", original = original, args = args, operation = operation)\n      case " + host + ".IdentityObserved(identity) => " + pb + "(kind = \"identity\", identity = StrictSagaProtoConverters.identityToProto(identity).toByteString)\n      case " + host + ".ResultIntent(kind) => " + pb + "(kind = \"result\", operation = kind)\n      case " + host + ".DeliveryAcknowledged(kind) => " + pb + "(kind = \"delivered\", operation = kind)\n    }\n    pb.toByteArray\n  }\n  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {\n    require(manifest == \"event-v1\", \"host event version required\")\n    val pb = " + pb + ".parseFrom(bytes)\n    pb.kind match {\n      case \"admitted\" => " + host + ".AdmissionGranted\n      case \"associated\" => " + host + ".Associated(pb.original, pb.args, pb.operation)\n      case \"identity\" => " + host + ".IdentityObserved(StrictSagaProtoConverters.identityFromProto(TransactionIdentityPO.parseFrom(pb.identity.toByteArray)))\n      case \"result\" => " + host + ".ResultIntent(pb.operation)\n      case \"delivered\" => " + host + ".DeliveryAcknowledged(pb.operation)\n      case _ => throw new IllegalArgumentException(\"unknown host event\")\n    }\n  }\n}\n"
    var ports = "package " + pkg + ".application\n\nimport scala.concurrent.Future\nimport net.imadz.infra.saga.strict.{OperationIdentity, TransactionIdentity}\n\ntrait " + stem + "TechnicalPorts {\n"
    h.technicalPorts.foreach { p =>
      val descriptor = model.ports.find(port => port.ref == p.port.ref && port.version == p.port.version).get
      val signature = descriptor.inputType -> descriptor.outputType
      ports += "  // " + p.role + ": implementation is supplied by the handwritten composition root, never by this generated declaration.\n"
      ports += "  def " + NamingConventions.strictSymbol(p.port.ref.id) + "(input: " + tpe(signature._1, model) + "): Future[" + tpe(signature._2, model) + "]\n"
    }
    ports += "}\nobject " + stem + "TechnicalPorts {\n  val required: Vector[(String, String, String)] = Vector(" + h.technicalPorts.map(p => "(" + quote(p.port.ref.id) + ", " + quote(p.implementation.id) + ", " + quote(p.implementation.version) + ")").mkString(", ") + ")\n  def requireInstalled(actual: Map[String, (String, String)]): Unit = require(actual != null && required.forall { case (port, id, version) => actual.get(port).contains(id -> version) }, \"missing or mismatched required implementation\")\n"
    val bindings = h.technicalPorts.map { p =>
      val descriptor = model.ports.find(port => port.ref == p.port.ref && port.version == p.port.version).get
      (p, descriptor, NamingConventions.strictSymbol(p.port.ref.id))
    }
    ports += "  // Install exact callback objects in the handwritten composition root before constructing a host or coordinator.\n  // Ownership below is a static binding obligation, not proof of business authorization, replay or deployment.\n"
    ports += "  final case class BindingOwnership(port: String, role: String, artifact: String, artifactVersion: String, implementation: String, implementationVersion: String, boundary: String)\n  val bindingOwnership: Vector[BindingOwnership] = Vector(\n" + bindings.map { case (p, _, _) =>
      val a = owner(p, model)
      "    BindingOwnership(" + Vector(p.port.ref.id, p.role, a.id, a.version, p.implementation.id, p.implementation.version, "handwritten-composition-root").map(quote).mkString(", ") + ")"
    }.mkString(",\n") + "\n  )\n"
    val secrets = bindings.collect { case (p, _, _) if p.role == "deployment" => owner(p, model).deployment.secretRefs }.flatten
    ports += "  val secretReferences: Vector[(String, String)] = Vector(" + secrets.map(s => "(" + quote(s.id) + ", " + quote(s.provider) + ")").mkString(", ") + ")\n"
    ports += "  final case class OperationNotExecuted(identity: OperationIdentity, evidence: String, safeToRetry: Boolean) extends RuntimeException(evidence)\n"
    ports += "  final case class CompletionContext(original: " + tpe(h.entry.inputType, model) + ", identity: TransactionIdentity)\n  final case class Implementation[I, O](id: String, version: String, run: I => Future[O], operation: (I, OperationIdentity) => Future[O] = null, completion: (I, CompletionContext) => Future[O] = null)\n  final case class Bindings(\n" + bindings.map { case (_, pin, method) =>
      "    " + method + ": Implementation[" + tpe(pin.inputType, model) + ", " + tpe(pin.outputType, model) + "]"
    }.mkString(",\n") + "\n  )\n"
    ports += "  final class Installed private[" + stem + "TechnicalPorts] (private val bindings: Bindings) extends " + stem + "TechnicalPorts {\n"
    bindings.foreach { case (p, pin, method) =>
      ports += "    def " + method + "(input: " + tpe(pin.inputType, model) + "): Future[" + tpe(pin.outputType, model) + "] = " + installedRun(h, p, pin, method, model) + "\n"
      if (Set("authority", "result-delivery").contains(p.role)) ports += "    def " + method + "Completion(input: " + tpe(pin.inputType, model) + ", context: CompletionContext): Future[" + tpe(pin.outputType, model) + "] = bindings." + method + ".completion(input, context)\n"
      if (Set("phase-execute", "phase-query").contains(p.role)) ports += "    def " + method + "Operation(input: " + tpe(pin.inputType, model) + ", identity: OperationIdentity): Future[" + tpe(pin.outputType, model) + "] = bindings." + method + ".operation(input, identity)\n"
    }
    ports += "    val declarations: Map[String, (String, String)] = Map(" + bindings.map { case (p, _, method) => quote(p.port.ref.id) + " -> (bindings." + method + ".id -> bindings." + method + ".version)" }.mkString(", ") + ")\n  }\n"
    ports += "  def install(bindings: Bindings): Installed = {\n    require(bindings != null, \"complete technical object bindings required\")\n"
    bindings.foreach { case (p, _, method) => ports += "    require(bindings." + method + " != null && bindings." + method + ".id == " + quote(p.implementation.id) + " && bindings." + method + ".version == " + quote(p.implementation.version) + " && bindings." + method + ".run != null" + (if (Set("authority", "result-delivery").contains(p.role)) " && bindings." + method + ".completion != null" else "") + (if (Set("phase-execute", "phase-query").contains(p.role)) " && bindings." + method + ".operation != null" else "") + ", " + quote("missing or mismatched technical object " + p.port.ref.id) + ")\n" }
    ports += "    new Installed(bindings)\n  }\n}\n"
    Vector(entry(protoPath, proto, "host-proto"), entry(NamingConventions.productPackagePath(pkg, "application/" + stem + "HostSerializer.scala"), serializer, "host-serialization"), entry(NamingConventions.productPackagePath(pkg, "application/" + stem + "TechnicalPorts.scala"), ports, "technical-port"))
  }
  def build(model: ProductApplicationModel): Vector[ProductSourceModel] = ProductBuildTemplate.generate(model.domain, externalIngress = true).map { e =>
    if (e.path == "build.sbt") e.copy(content = e.content + "\nresolvers += \"explicit-frozen-runtime\" at " + quote(model.artifact.repository) + "\nlibraryDependencies += \"net.imadz\" %% \"saga-core\" % \"0.2.1-p23.20261027.1\"\n" + (if (model.pipelines.nonEmpty) "libraryDependencies += \"net.imadz\" %% \"monarch-persistence\" % \"0.2.1-p23.20261027.1\"\n" else ""), footprint = model.footprint)
    else if (e.path == "src/main/resources/application.conf") e.copy(content = e.content + "\nakka.actor.serializers.strict-saga = \"net.imadz.infra.saga.strict.StrictSagaSerializer\"\nakka.actor.serialization-bindings.\"net.imadz.infra.saga.strict.StrictDurable\" = strict-saga\n" + model.hosts.zipWithIndex.map { case (h, i) =>
      val pkg = model.domain.packages(h.contract.saga.ref.context); val stem = NamingConventions.strictSymbol(h.contract.id)
      "akka.actor.serializers.host" + i + " = " + quote(pkg + ".application." + stem + "HostSerializer") + "\nakka.actor.serialization-bindings." + quote(pkg + ".application." + stem + "Host$Event") + " = host" + i + "\n"
    }.mkString + model.pipelines.flatMap(p => p.steps.collect { case s if s.operation.isInstanceOf[ExecutionChildOperation] =>
      val child = model.childPlans.find(_.ref.id == s.operation.asInstanceOf[ExecutionChildOperation].plan).get
      val pkg = model.domain.packages(child.ref.context)
      val name = NamingConventions.strictSymbol(p.id + "_" + s.id) + "ChildHost"
      pkg -> name
    }).zipWithIndex.map { case ((pkg, name), i) =>
      "akka.actor.serializers.child" + i + " = " + quote(pkg + ".application." + name + "Serializer") + "\nakka.actor.serialization-bindings." + quote(pkg + ".application." + name + "$Event") + " = child" + i + "\n"
    }.mkString + ProductEffectSupportTemplate.config(model), footprint = model.footprint)
    else e
  }
}
