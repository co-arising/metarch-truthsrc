package example.inventory.playreference.oracle

import akka.Done
import akka.actor.typed.{ActorRef, ActorSystem}
import akka.actor.typed.scaladsl.{AskPattern, Behaviors}
import akka.actor.typed.scaladsl.AskPattern._
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.util.Timeout
import com.typesafe.config.{ConfigFactory, ConfigValueFactory}
import example.inventory.domain.WarehouseProtocol.SkuReservationCommitted
import example.inventory.domain.WarehouseState
import example.inventory.domain.values.TxId
import example.inventory.infrastructure.persistence.WarehousePersistence
import example.inventory.infrastructure.readside._
import example.inventory.infrastructure.web.{ResourceBinding, WarehouseDirectory, WarehouseJournalSource}
import java.nio.file.{Files, Paths}
import java.util.concurrent.Executors
import org.h2.jdbcx.JdbcConnectionPool
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.concurrent.duration._
import scala.util.Try

object JournalOracle {
  final case class Append(value: AnyRef, reply: ActorRef[Done])
  private var count = 0
  private def check(value: Boolean, id: String): Unit = { assert(value, id); count += 1; println("CASE " + id) }
  def main(args: Array[String]): Unit = {
    require(args.length == 2)
    val mode = args(0)
    val data = Paths.get(args(1))
    require(Files.isDirectory(data))
    val base = ConfigFactory.parseString("""
      akka.actor.provider=local
      akka.loglevel=WARNING
      akka.actor.allow-java-serialization=off
      akka.persistence.journal.plugin="akka.persistence.journal.leveldb"
      akka.persistence.journal.leveldb.native=off
      akka.persistence.snapshot-store.plugin="akka.persistence.snapshot-store.local"
    """).withValue("akka.persistence.journal.leveldb.dir", ConfigValueFactory.fromAnyRef(data.resolve("journal").toString))
      .withValue("akka.persistence.snapshot-store.local.dir", ConfigValueFactory.fromAnyRef(data.resolve("snapshots").toString))
      .withFallback(ConfigFactory.load())
    val config = if (mode == "missing-serializer") base.withValue("akka.actor.serialization-bindings.\"example.inventory.persistence.protobuf.Frame\"",
      ConfigValueFactory.fromAnyRef("none")) else base
    val system = ActorSystem[Nothing](Behaviors.empty, "JournalOracle", config)
    implicit val ec: ExecutionContext = system.executionContext
    implicit val scheduler = system.scheduler
    implicit val timeout: Timeout = Timeout(3.seconds)
    val directory = new WarehouseDirectory(Vector(ResourceBinding("east", "warehouse-east-v1", "east")))
    var source: Option[WarehouseJournalSource] = None
    try {
      if (mode == "missing-serializer") {
        val failed = Try(new WarehouseJournalSource(system, directory))
        check(failed.isFailure, "serializer-required-before-readiness")
      } else {
        val journal = new WarehouseJournalSource(system, directory)
        source = Some(journal)
        val writer = system.systemActorOf(EventSourcedBehavior[Append, AnyRef, Int](PersistenceId.ofUniqueId("warehouse-east-v1"), 0,
          (_, command) => Effect.persist(command.value).thenRun(_ => command.reply ! Done), (state, _) => state + 1), "fixture-writer")
        val frame = WarehousePersistence.encodeEvent(SkuReservationCommitted(TxId("source-control")))
        val event: AnyRef = mode match {
          case "wrong-type" => "not-a-Frame"
          case "wrong-role" => WarehousePersistence.encodeState(WarehouseState.empty)
          case "positive" | "fake-sequence" => frame
          case _ => throw new IllegalArgumentException("unknown journal control")
        }
        Await.result(writer.ask[Done](Append(event, _)), 4.seconds)
        val result = Try(Await.result(journal.currentEvents("warehouse-east-v1", 0L, 64), 5.seconds))
        if (mode == "wrong-type") check(result.failed.toOption.exists(_.getMessage.contains("journal Frame required")), "wrong-journal-type-rejected")
        else if (mode == "wrong-role") check(result.failed.toOption.exists(_.getMessage.contains("event Frame required")), "wrong-frame-role-rejected")
        else {
          val rows = result.get
          check(rows.map(_.sequenceNr) == Vector(1L), "real-journal-control-sequence")
          if (mode == "fake-sequence") {
            val pool = JdbcConnectionPool.create("jdbc:h2:file:" + data.resolve("readside") + ";DB_CLOSE_ON_EXIT=FALSE", "sa", "")
            val executor = Executors.newFixedThreadPool(2)
            val blockingEc = ExecutionContext.fromExecutorService(executor)
            val repository = new WarehouseReadsideRepository(pool, "sequence-control")
            val counterfeit = WarehouseEnvelope.capture(rows.head.pid, rows.head.resource, 2L, rows.head.manifest, rows.head.bytes)
            val upstream = new WarehouseEventSource {
              def persistenceIds(after: Option[String], limit: Int) = Future.successful(if (after.isEmpty) Vector("warehouse-east-v1") else Vector.empty)
              def currentEvents(pid: String, after: Long, limit: Int) = Future.successful(if (after == 0L) Vector(counterfeit) else Vector.empty)
            }
            val runner = new WarehouseReadsideRunner(repository, new WarehouseReadsideHandler(repository, WarehouseState.empty), upstream, blockingEc, system)
            try {
              val failure = Try(Await.result(runner.start().flatMap(_ => runner.catchUp("warehouse-east-v1")), 5.seconds))
              check(failure.failed.toOption.exists(e => e.isInstanceOf[IllegalArgumentException] &&
                (e.getMessage.contains("source page gap") || e.getMessage.contains("source contiguous PID page"))), "fabricated-sequence-rejected")
              check(repository.lastSequenceNr("warehouse-east-v1") == 0L && repository.byResource("east", None, 64).rows.isEmpty, "poison-does-not-advance-readside")
              val report = Await.result(runner.shutdown(), 6.seconds)
              check(report.failure.isDefined, "source-poison-retained-in-shutdown")
            } finally { pool.dispose(); executor.shutdown(); check(executor.awaitTermination(2, java.util.concurrent.TimeUnit.SECONDS), "journal-control-executor-stopped") }
          }
        }
      }
      println("PLAY_JOURNAL_ORACLE_PASSED mode=" + mode + " assertions=" + count)
    } finally {
      source.foreach(s => Await.result(s.close(), 5.seconds))
      system.terminate()
      Await.result(system.whenTerminated, 8.seconds)
    }
  }
}
