package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.TypeResolverDSL
import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta.products._

object ProductServiceTemplate {
  private def q(value: String): String = ujson.write(value)
  private def typeText(ref: net.imadz.codegen.scaffolding.cqrs.TypeRef): String = ref.fqn + (if (ref.typeParams.isEmpty) "" else ref.typeParams.map(typeText).mkString("[", ", ", "]"))
  def generate(m: ProductServiceModel): Vector[ProductSourceModel] = {
    val pkg = m.application.domain.packages(m.artifact.artifact.context)
    val name = NamingConventions.productSymbol(m.artifact.artifact.id)
    val s = m.deployment
    def tpe(t: NominalType): String = typeText(TypeResolverDSL.productType(t, m.application.domain.packages))
    def member(e: ProductServiceEndpoint): String = NamingConventions.productSymbol(e.endpoint.port.ref.id)
    def entry(path: String, content: String, kind: String): ProductSourceModel = ProductSourceModel(path, content, kind, Vector(m.artifact.source), m.application.footprint)
    val bindings = m.endpoints.map(e => "    " + member(e) + ": Endpoint[" + tpe(e.endpoint.inputType) + ", " + tpe(e.endpoint.outputType) + "]").mkString(",\n")
    val checks = m.endpoints.map { e =>
      val b = "value.bindings." + member(e)
      "    require(" + b + " != null && " + b + ".implementation == " + q(e.implementation.id) + " && " + b + ".version == " + q(e.implementation.version) + " && " + b + ".reads != null && " + b + ".writes != null && " + b + ".run != null, " + q("missing service endpoint " + e.endpoint.id) + ")"
    }.mkString("\n")
    val contract = s"""package $pkg.service

import play.api.ApplicationLoader
import play.api.libs.json.{JsValue, Reads, Writes}
import play.api.mvc.{RequestHeader, Result}
import scala.concurrent.Future

object ${name}Service {
  final case class Principal private[service] (id: String, roles: Set[String])
  trait Authority {
    def authenticate(request: RequestHeader): Future[Option[(String, Set[String])]]
    def csrf(request: RequestHeader): Future[Boolean]
  }
  sealed trait Failure { def status: Int; def code: String }
  case object InvalidRequest extends Failure { val status = 400; val code = "invalid-request" }
  case object NotAuthenticated extends Failure { val status = 401; val code = "not-authenticated" }
  case object NotAuthorized extends Failure { val status = 403; val code = "not-authorized" }
  case object MissingResource extends Failure { val status = 404; val code = "not-found" }
  case object RequestConflict extends Failure { val status = 409; val code = "request-conflict" }
  case object Unavailable extends Failure { val status = 503; val code = "service-unavailable" }
  type Outcome[A] = Either[Failure, A]
  def decodeBody(text: String): Outcome[JsValue] = {
    val factory = new com.fasterxml.jackson.core.JsonFactory()
    factory.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
    try {
      val parser = factory.createParser(text)
      try {
        var depth = 0
        var roots = 0
        var token = parser.nextToken()
        while (token != null) {
          if (depth == 0) roots += 1
          if (token.isStructStart) depth += 1
          if (token.isStructEnd) depth -= 1
          require(depth >= 0 && depth <= 64 && roots == 1, "bounded single JSON value required")
          token = parser.nextToken()
        }
        require(depth == 0 && roots == 1, "complete JSON required")
        Right(play.api.libs.json.Json.parse(text))
      } finally parser.close()
    } catch { case scala.util.control.NonFatal(_) => Left(InvalidRequest) }
  }
  final case class Endpoint[I, O](implementation: String, version: String, reads: Reads[I], writes: Writes[O],
    run: (Principal, I) => Future[Outcome[O]])
  final case class Bindings(
$bindings
  )
${if (s.pages.isDefined) ProductServicePagesTemplate.contract else ""}  trait Composition extends AutoCloseable {
    def authority: Authority
    def bindings: Bindings
    def ready: Future[Unit]
${if (s.pages.isDefined) "    def pages: Option[PageRenderer] = None\n" else ""}  }
  trait Factory {
    def implementation: String
    def version: String
    def create(context: ApplicationLoader.Context): Composition
  }
  def requireInstalled(value: Composition): Unit = {
    require(value != null && value.authority != null && value.bindings != null, "complete service composition required")
$checks
${s.pages.map(ProductServicePagesTemplate.requirement).getOrElse("")}  }
}
"""
    val routes = m.endpoints.map { e =>
      val parts = e.endpoint.path.split("/").drop(1).toVector
      val regex = "^/" + parts.map(p => if (p.startsWith(":")) "([^/]+)" else p).mkString("/") + "$"
      val parameters = parts.filter(_.startsWith(":")).map(p => q(p.drop(1))).mkString(", ")
      "    (" + q(e.endpoint.method) + ", " + q(regex) + ".r, Vector(" + parameters + "), " + q(e.endpoint.audience) + ", " + e.endpoint.csrf + ", (principal: Principal, input: JsValue) => invoke(composition.bindings." + member(e) + ", principal, input))"
    }.mkString(",\n")
    val loader = if (s.pages.isDefined) ProductServicePagesTemplate.loader(m) else s"""package $pkg.service

import play.api.{Application, ApplicationLoader, BuiltInComponentsFromContext}
import play.api.libs.json._
import play.api.mvc._
import play.api.routing.Router
import scala.concurrent.{ExecutionContext, Future}
import scala.util.control.NonFatal
import ${name}Service._

final class ${name}Loader extends ApplicationLoader {
  def load(context: ApplicationLoader.Context): Application = {
    ${name}Configuration.validate(context.initialConfiguration)
    val factory = context.environment.classLoader.loadClass(${q(m.bootstrap.id)}).getDeclaredConstructor().newInstance().asInstanceOf[Factory]
    require(factory.implementation == ${q(m.bootstrap.id)} && factory.version == ${q(m.bootstrap.version)}, "composition factory pin mismatch")
    val composition = factory.create(context)
    try {
      requireInstalled(composition)
      new ${name}Components(context, composition).application
    } catch { case NonFatal(error) =>
      context.lifecycle.stop()
      composition.close()
      throw error
    }
  }
}
final class ${name}Components(context: ApplicationLoader.Context, composition: Composition)
  extends BuiltInComponentsFromContext(context) {
  implicit private val ec: ExecutionContext = executionContext
  override lazy val httpFilters = Seq.empty[EssentialFilter]
  applicationLifecycle.addStopHook(() => Future(composition.close()))
  private def invoke[I, O](endpoint: Endpoint[I, O], principal: Principal, input: JsValue): Future[Result] = {
    endpoint.reads.reads(input) match {
      case JsSuccess(value, _) => endpoint.run(principal, value).map {
        case Right(result) => Results.Ok(endpoint.writes.writes(result))
        case Left(error) => Results.Status(error.status)(Json.obj("code" -> error.code))
      }
      case _: JsError => Future.successful(Results.BadRequest(Json.obj("code" -> "invalid-request")))
    }
  }
  private val actions = Vector(
$routes
  )
  private def action(row: (String, scala.util.matching.Regex, Vector[String], String, Boolean, (Principal, JsValue) => Future[Result]), matched: scala.util.matching.Regex.Match): Handler = {
    controllerComponents.actionBuilder.async(controllerComponents.parsers.tolerantText(65536)) { request =>
      composition.ready.flatMap { _ =>
        composition.authority.authenticate(request).flatMap {
          case Some((id, roles)) if id != null && id.nonEmpty && roles != null && roles.contains(row._4) =>
            val allowed = if (row._5) composition.authority.csrf(request) else Future.successful(true)
            allowed.flatMap { ok =>
              if (!ok) Future.successful(Results.Forbidden(Json.obj("code" -> "csrf-denied")))
              else {
                val params = JsObject(row._3.zipWithIndex.map { case (name, i) => name -> JsString(matched.group(i + 1)) })
                val body = if (row._1 == "GET") Right(JsNull) else decodeBody(request.body)
                body match {
                  case Left(error) => Future.successful(Results.Status(error.status)(Json.obj("code" -> error.code)))
                  case Right(value) =>
                    val input = Json.obj("path" -> params, "query" -> JsObject(request.queryString.toVector.map { case (k, v) => k -> JsArray(v.map(JsString)) }), "body" -> value)
                    row._6(Principal(id, roles), input)
                }
              }
            }
          case None => Future.successful(Results.Unauthorized(Json.obj("code" -> "not-authenticated")))
          case _ => Future.successful(Results.Forbidden(Json.obj("code" -> "not-authorized")))
        }
      }.recover { case NonFatal(_) => Results.ServiceUnavailable(Json.obj("code" -> "service-unavailable")) }
    }
  }
  override lazy val router: Router = Router.from {
    case request if actions.exists(row => row._1 == request.method && row._2.findFirstMatchIn(request.path).nonEmpty) =>
      val row = actions.find(row => row._1 == request.method && row._2.findFirstMatchIn(request.path).nonEmpty).get
      action(row, row._2.findFirstMatchIn(request.path).get)
  }
}
"""
    val config = "play.application.loader = " + q(pkg + ".service." + m.artifact.artifact.id + "Loader") + "\n" +
      "play.http.secret.key = ${PLAY_SECRET}\n" +
      "service.connections." + q(s.journal.connectionRef) + " = ${MONGO_URI}\n" +
      "service.connections." + q(s.readSide.connectionRef) + " = ${MYSQL_JDBC_URL}\n" +
      "akka.persistence.journal.plugin = \"akka-contrib-mongodb-persistence-journal\"\n" +
      "akka.persistence.snapshot-store.plugin = \"akka-contrib-mongodb-persistence-snapshot\"\n" +
      "akka.contrib.persistence.mongodb.mongo.mongouri = ${service.connections." + q(s.journal.connectionRef) + "}\n" +
      "db.default.driver = \"com.mysql.cj.jdbc.Driver\"\n" +
      "db.default.url = ${service.connections." + q(s.readSide.connectionRef) + "}\n" +
      "db.default.username = ${MYSQL_USER}\ndb.default.password = ${MYSQL_PASSWORD}\n"
    Vector(entry(NamingConventions.productPackagePath(pkg, "service/" + m.artifact.artifact.id + "Service.scala"), contract, "service-port"),
      entry(NamingConventions.productPackagePath(pkg, "service/" + m.artifact.artifact.id + "Loader.scala"), loader, "service-runtime"),
      entry("conf/service.conf", config, "service-config"),
      entry("conf/application.conf", "include \"serialization.conf\"\ninclude \"service.conf\"\n", "service-config"))
  }
  def isolateTests(m: ProductServiceModel, entries: Vector[ProductSourceModel]): Vector[ProductSourceModel] = {
    val check = m.application.domain.packages(m.artifact.artifact.context) + ".service.UnitConfigurationCheck.main(Array.empty)"
    entries.map { e =>
      if (e.path.startsWith("src/test/scala/") && e.content.contains("extends AnyFunSuite {") && !e.content.contains("UnitConfigurationCheck.main(Array.empty)"))
        e.copy(content = e.content.replace("extends AnyFunSuite {", "extends AnyFunSuite {\n  " + check))
      else e
    }
  }
  def build(m: ProductServiceModel): Vector[ProductSourceModel] = ProductHostSupportTemplate.build(m.application).map { e =>
    if (e.path == "build.sbt") e.copy(footprint = m.application.footprint, content = e.content +
      "\nlazy val root = (project in file(\".\")).enablePlugins(PlayScala)\n" +
      "Compile / unmanagedSourceDirectories := Seq(baseDirectory.value / \"app\") ++ Seq(" + m.externalSourceRoots.map(p => "file(" + q(p) + ")").mkString(", ") + ")\n" +
      "Test / unmanagedSourceDirectories += baseDirectory.value / \"src\" / \"test\" / \"scala\"\n" +
      "Test / unmanagedResourceDirectories += baseDirectory.value / \"src\" / \"test\" / \"resources\"\n" +
      "Test / fork := true\nTest / javaOptions += \"-Dconfig.resource=service-unit.conf\"\n" +
      "Test / javaOptions += \"-Dservice.test.suites=\" + (Test / definedTests).value.map(_.name).sorted.mkString(\",\")\n" +
      "Test / test := (Test / runMain).toTask(" + q(" " + m.application.domain.packages(m.artifact.artifact.context) + ".service.UnitTestMain") + ").value\n" +
      "Test / testOnly := { val ignored = complete.DefaultParsers.spaceDelimited(\"suite\").parsed; sys.error(\"Use test for isolated unit suites; integration tests require their explicit runner\") }\n" +
      "libraryDependencies ++= Seq(guice, jdbc, \"com.github.scullxbones\" %% \"akka-persistence-mongo-rxmongo\" % \"3.0.8\", \"com.lightbend.akka\" %% \"akka-projection-jdbc\" % \"1.2.5\", \"com.mysql\" % \"mysql-connector-j\" % \"8.0.33\")\n" +
      "libraryDependencies ~= (_.map { case d if d.organization == \"net.imadz\" && d.name == \"saga-core\" => d.exclude(\"com.github.scullxbones\", \"akka-persistence-mongo-scala_2.13\").exclude(\"org.reactivemongo\", \"reactivemongo_2.13\"); case d => d })\n" +
      "dependencyOverrides ++= Seq(\"akka-actor\", \"akka-actor-typed\", \"akka-stream\", \"akka-stream-typed\", \"akka-persistence\", \"akka-persistence-typed\", \"akka-persistence-query\", \"akka-protobuf-v3\", \"akka-slf4j\", \"akka-testkit\", \"akka-serialization-jackson\", \"akka-remote\", \"akka-cluster\", \"akka-cluster-typed\", \"akka-cluster-tools\", \"akka-coordination\", \"akka-distributed-data\", \"akka-cluster-sharding\", \"akka-cluster-sharding-typed\").map(\"com.typesafe.akka\" %% _ % \"2.6.20\")\n")
    else if (e.path == "project/build.properties") e.copy(content = "sbt.version=1.4.9\n")
    else if (e.path == "project/plugins.sbt") e.copy(content = e.content + "\naddSbtPlugin(\"com.typesafe.play\" % \"sbt-plugin\" % \"2.8.18\")\n")
    else if (e.path == "src/main/resources/application.conf") e.copy(path = "conf/serialization.conf")
    else e
  }
}
