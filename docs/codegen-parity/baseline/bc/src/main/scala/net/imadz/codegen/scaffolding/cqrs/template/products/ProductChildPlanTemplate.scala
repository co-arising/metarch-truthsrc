package net.imadz.codegen.scaffolding.cqrs.template.products

import net.imadz.codegen.scaffolding.cqrs.model.products._
import net.imadz.codegen.structure.NamingConventions

object ProductChildPlanTemplate {
  def generate(model: ProductApplicationModel): Vector[ProductSourceModel] = {
    if (model.childPlans.isEmpty) Vector.empty
    else ProductExecutionTemplate.generate(model.copy(pipelines = model.childPlans.map(_.pipeline))) ++ model.childPlans.map(_.ref.context).distinct.flatMap { context =>
      val pkg = model.domain.packages(context)
      val sources = model.childPlans.filter(_.ref.context == context).map(_.source)
      val protoPath = "app/protobuf/" + pkg.replace(".", "_") + "_child_host.proto"
      val proto = "syntax = \"proto3\";\nimport \"scalapb/scalapb.proto\";\npackage " + pkg + ".infrastructure.childproto;\noption (scalapb.options) = { flat_package: true };\nmessage ChildHostEventPB { string kind = 1; bytes parent = 2; bytes initial = 3; string operation = 4; string childpid = 5; string version = 6; }\n"
      val text = s"""package $pkg.application

import akka.actor.typed.ActorSystem
import akka.actor.typed.scaladsl.adapter._
import akka.persistence.query.PersistenceQuery
import akka.persistence.query.scaladsl.CurrentEventsByPersistenceIdQuery
import akka.stream.SystemMaterializer
import akka.stream.scaladsl.Sink
import com.google.protobuf.ByteString
import net.imadz.monarch.persistence.{PersistentMonarch, StateCodec}
import scala.concurrent.{ExecutionContext, Future}

object ChildJournal {
  sealed trait Observation[+S]
  case object Missing extends Observation[Nothing]
  final case class Running[S](state: S) extends Observation[S]
  final case class Completed[S](state: S) extends Observation[S]
  final case class Failed(reason: String) extends Observation[Nothing]
  final case class Conflict(reason: String) extends Observation[Nothing]
  trait Reader { def events(persistenceId: String): Future[Vector[Any]] }
  final class CurrentJournal(system: ActorSystem[_], pluginId: String) extends Reader {
    require(system != null && pluginId != null && pluginId.nonEmpty, "explicit journal query implementation required")
    private implicit val materializer: akka.stream.Materializer = SystemMaterializer(system).materializer
    private implicit val ec: ExecutionContext = system.executionContext
    private val query = PersistenceQuery(system.toClassic).readJournalFor[CurrentEventsByPersistenceIdQuery](pluginId)
    def events(persistenceId: String): Future[Vector[Any]] = query.currentEventsByPersistenceId(persistenceId, 0L, Long.MaxValue).runWith(Sink.seq).map(_.iterator.map(_.event).toVector)
  }
  def observe[S](events: Vector[Any], operation: String, initial: ByteString, plan: Vector[String], codec: StateCodec[S]): Observation[S] = {
    var started = false
    var completed = false
    var failure: Option[String] = None
    var error: Option[String] = None
    var prefix = 0
    var state: Option[S] = None
    events.foreach {
      case PersistentMonarch.RunStarted(id, cursors, bytes) =>
        if (started || id != operation || cursors != plan || ByteString.copyFrom(bytes) != initial) error = Some("child run identity, exact plan or payload conflict")
        else { started = true; state = Some(codec.decode(bytes)) }
      case PersistentMonarch.StageDone(cursor, _, _, bytes) =>
        if (!started || completed || failure.nonEmpty || prefix >= plan.size || plan(prefix) != cursor) error = Some("child checkpoint is not a contiguous confirmed prefix")
        else { state = Some(codec.decode(bytes)); prefix += 1 }
      case PersistentMonarch.RunCompleted(id) =>
        if (!started || completed || id != operation || prefix != plan.size) error = Some("child terminal is not backed by the full exact checkpoint prefix")
        else completed = true
      case PersistentMonarch.RunFailedEvt(_, reason) => if (!started || completed) error = Some("invalid child failure order") else failure = Some(reason)
      case _ => error = Some("unsupported child journal event")
    }
    error.map(Conflict).orElse(failure.map(Failed)).getOrElse(if (!started) Missing else if (completed) Completed(state.get) else Running(state.get))
  }
}
"""
      Vector(ProductSourceModel(protoPath, proto, "proto", sources, model.footprint), ProductSourceModel(NamingConventions.productPackagePath(pkg, "application/ChildJournal.scala"), text, "execution-plan", sources, model.footprint))
    }
  }
}
