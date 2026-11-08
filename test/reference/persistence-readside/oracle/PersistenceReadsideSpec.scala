package example.inventory.persistencereadside.reference

import org.scalatest.funsuite.AnyFunSuite
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.values._
import example.inventory.infrastructure.persistence._
import example.inventory.infrastructure.readside._
import example.inventory.persistence.protobuf.Frame
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import akka.persistence.testkit.scaladsl.{EventSourcedBehaviorTestKit,PersistenceTestKit,SnapshotTestKit}
import akka.persistence.testkit.SnapshotMeta
import akka.persistence.typed.PersistenceId
import akka.serialization.{SerializationExtension,Serializers}
import com.typesafe.config.ConfigFactory
import scala.concurrent.{ExecutionContext,Future,Promise}
import java.util.concurrent.Executors
import scala.util.Try
import scala.concurrent.duration._

final class PersistenceReadsideSpec extends AnyFunSuite {
  import ReadsideSupport._
  private def kitBody(body: ActorTestKit=>Unit): Unit={
    val config=ConfigFactory.parseString("akka.loglevel=WARNING\nakka.actor.provider=local\nakka.persistence.testkit.events.serialize=true\nakka.persistence.testkit.snapshots.serialize=true")
      .withFallback(EventSourcedBehaviorTestKit.config).withFallback(ConfigFactory.load())
    val kit=ActorTestKit(config);try body(kit)finally kit.shutdownTestKit()
  }
  private def runnerBody(body: (ActorTestKit,ExecutionContext)=>Unit): Unit=kitBody{kit=>
    val executor=Executors.newFixedThreadPool(2);val ec=ExecutionContext.fromExecutorService(executor)
    try body(kit,ec)finally {ec.shutdown();assert(ec.awaitTermination(10,java.util.concurrent.TimeUnit.SECONDS))}
  }
  test("real SerializationExtension selects the finite registry and rejects versions roles manifests and malformed frames") {
    kitBody{kit=>
      val serialization=SerializationExtension(kit.system.classicSystem)
      val frames=realEvents("bytes").map(WarehousePersistence.encodeEvent):+WarehousePersistence.encodeState(WarehouseState(Map(TxId("present")->"value")))
      frames.foreach{f=>
        val selected=Try(serialization.findSerializerFor(f))
        assert(selected.toOption.exists(_.identifier==736401),"ORACLE_SERIALIZER_REGISTRATION")
        val s=selected.get;val m=Serializers.manifestFor(s,f);val bytes=serialization.serialize(f).get
        assert(serialization.deserialize(bytes,s.identifier,m).get==f)
      }
      assert(WarehousePersistence.decodeState(frames.last)==WarehouseState(Map(TxId("present")->"value")))
      val f=frames.head
      val bad=Vector(f.copy(envelopeVersion=2),f.copy(role="state"),f.copy(typeId="unknown"),f.copy(wireVersion=2),f.copy(layoutSha256="0"*64))
      bad.foreach{x=>assert(Try(WarehousePersistence.decodeEvent(x)).isFailure,"ORACLE_VERSION_DISPATCH");assert(Try(new WarehouseSnapshotAdapter().fromJournal(x)).isFailure,"ORACLE_SNAPSHOT_VERSION")}
      val s=serialization.findSerializerFor(f).asInstanceOf[akka.serialization.SerializerWithStringManifest]
      assert(Try(s.fromBinary(f.toByteArray,"wrong")).isFailure,"ORACLE_MANIFEST")
      assert(Try(s.fromBinary(Array[Byte](0),WarehousePersistence.manifest(f))).isFailure,"ORACLE_BAD_FRAME")
      assert(Try(s.fromBinary(f.toByteArray++Array[Byte](56,1),WarehousePersistence.manifest(f))).isFailure,"ORACLE_UNKNOWN_FRAME_FIELD")
      assert(Try(WarehousePersistence.decodeEvent(f.copy(payload=com.google.protobuf.ByteString.copyFrom(Array[Byte](0))))).isFailure)
      assert(Try(WarehousePersistence.decodeEvent(f.copy(payload=com.google.protobuf.ByteString.copyFrom(Array[Byte](10,0))))).isSuccess)
      assert(Try(WarehousePersistence.decodeState(f)).isFailure)
      assert(!kit.system.settings.config.getConfig("akka.actor.serialization-bindings").hasPath("java.lang.Object"),"ORACLE_NO_BLANKET_BINDING")
    }
  }
  test("real Factory persists Frames and recovers snapshot and ordered events without rerunning hosts") {
    kitBody{kit=>
      import example.inventory.application.aggregates.WarehouseActorProtocol._
      val pid="verbatim:/ warehouse PID"
      val snapshot=WarehouseState(Map(TxId("seed")->"keep"))
      SnapshotTestKit(kit.system).persistForRecovery(pid,SnapshotMeta(0L)->WarehousePersistence.encodeState(snapshot))
      val calls=new java.util.concurrent.atomic.AtomicInteger
      val h=new example.inventory.domain.ports.WarehouseComputations {def reservationIdentity(t: TxId,w: WarehouseId,s: SkuId,q: Long): ReservationId={calls.incrementAndGet();ReservationId("from-port")}}
      def behavior=WarehousePersistenceFactory.create(PersistenceId.ofUniqueId(pid),WarehouseState(),h)
      val ref=kit.spawn(behavior);val replies=kit.createTestProbe[Reply]();val states=kit.createTestProbe[WarehouseState]()
      ref ! Execute(ReserveSkuQuantity(TxId("actor"),WarehouseId("w"),SkuId("s"),1),replies.ref)
      replies.expectMessage(Accepted(Vector(SkuQuantityReserved(ReservationId("from-port")))))
      assert(PersistenceTestKit(kit.system).persistedInStorage(pid).size==1,"ORACLE_ACK_AFTER_PERSIST")
      ref ! Execute(CommitSkuReservation(TxId("actor"),WarehouseId("w"),SkuId("s"),ReservationId("from-port")),replies.ref)
      replies.expectMessage(Accepted(Vector(SkuReservationCommitted(TxId("actor")))))
      assert(PersistenceTestKit(kit.system).persistedInStorage(pid).forall(_.isInstanceOf[Frame]),"ORACLE_ADAPTER_FRAME")
      kit.stop(ref);val recovered=kit.spawn(behavior);recovered ! GetState(states.ref)
      states.expectMessage(WarehouseState(Map(TxId("seed")->"keep",TxId("actor")->"SkuReservationCommitted")))
      recovered ! Execute(ReserveSkuQuantity(TxId("actor"),WarehouseId("w"),SkuId("s"),1),replies.ref)
      replies.expectMessage(Accepted(Vector.empty));assert(calls.get==1 && PersistenceTestKit(kit.system).persistedInStorage(pid).size==2)
    }
  }
  test("direct SQL proves event state receipt checkpoint atomicity and reserve progress") {
    val ds=fresh();val repo=new WarehouseReadsideRepository(ds,"n");repo.initialize();val handler=new WarehouseReadsideHandler(repo,WarehouseState())
    val es=realEvents("tx");handler.project(env("p",1,es.head));assertFacts(ds,"p",1,Set.empty)
    handler.project(env("p",2,es.last));assertFacts(ds,"p",2,Set("tx"))
  }
  test("precommit failure rolls back all four tables and postcommit lost acknowledgement retries without writes") {
    val ds=fresh();val fault=new Faults(ds);val repo=new WarehouseReadsideRepository(fault,"n");repo.initialize();val handler=new WarehouseReadsideHandler(repo,WarehouseState())
    val e=env("p",1,SkuReservationCommitted(TxId("tx")))
    fault.preCommit=true;intercept[java.sql.SQLException](handler.project(e));fault.preCommit=false
    assert(Vector("event","state","receipt","offset").forall(t=>count(ds,t)==0),"ORACLE_PRECOMMIT_ATOMIC")
    fault.lostAck=true;intercept[java.sql.SQLException](handler.project(e));assertFacts(ds,"p",1,Set("tx"))
    fault.rejectWrites=true
    assert(Try(handler.project(e)).toOption.contains(ProjectResult(1,true)),"ORACLE_DUPLICATE_NO_WRITE")
    assertFacts(ds,"p",1,Set("tx"));assert(fault.opens.get==fault.closes.get,"ORACLE_CONNECTION_CLOSE")
  }
  test("exact duplicate conflict gap and resource reassociation reject without advancing") {
    val ds=fresh();val repo=new WarehouseReadsideRepository(ds,"n");repo.initialize();val h=new WarehouseReadsideHandler(repo,WarehouseState())
    val e=env("opaque://PID",1,SkuReservationCommitted(TxId("tx")))
    h.project(e);assert(h.project(e).duplicate)
    assert(Try(h.project(env(e.pid,3,SkuQuantityReserved(ReservationId("r"))))).isFailure,"ORACLE_SEQUENCE_GAP")
    assert(Try(h.project(env(e.pid,1,SkuReservationCommitted(TxId("other"))))).isFailure,"ORACLE_DUPLICATE_CONFLICT")
    assert(Try(h.project(env(e.pid,2,SkuQuantityReserved(ReservationId("r")),"other"))).isFailure,"ORACLE_RESOURCE_IDENTITY")
    assertFacts(ds,e.pid,1,Set("tx"))
  }
  test("two PID two namespace isolation and full keyset pagination preserve equal map keys") {
    val ds=fresh();val repo=new WarehouseReadsideRepository(ds,"n");repo.initialize();val h=new WarehouseReadsideHandler(repo,WarehouseState())
    for(p<-Vector("p1","p2");(tx,i)<-Vector("a","b").zipWithIndex)h.project(env(p,i+1,SkuReservationCommitted(TxId(tx))))
    val other=new WarehouseReadsideRepository(ds,"other");other.initialize();new WarehouseReadsideHandler(other,WarehouseState()).project(env("p1",1,SkuReservationCommitted(TxId("secret"))))
    var after: Option[ReceiptCursor]=None;var all=Vector.empty[ReceiptRow];var more=true
    while(more){val p=repo.byResource("resource",after,1);all++=p.rows;after=p.next;more=after.nonEmpty}
    assert(all.size==4 && all.map(r=>(r.txid.value,r.pidKey)).distinct.size==4 && all.map(_.txid.value)==Vector("a","a","b","b"),"ORACLE_KEYSET")
    assert(repo.persistenceIds(None,1)==Vector("p1") && repo.persistenceIds(Some("p1"),1)==Vector("p2"))
    assert(repo.currentEvents("p1",1,1).map(_.sequenceNr)==Vector(2))
    assert(repo.byResource("absent",None,64).rows.isEmpty && other.byResource("resource",None,64).rows.map(_.txid.value)==Vector("secret"))
    intercept[IllegalArgumentException](repo.byResource("resource",None,65));intercept[IllegalArgumentException](repo.currentEvents("p1",-1,1))
  }
  test("sessions are callback and thread confined and every connection closes on failure") {
    val f=new Faults(fresh());val r=new WarehouseReadsideRepository(f,"n");r.initialize();var escaped: WarehouseReadsideRepository.Session=null
    val executor=Executors.newSingleThreadExecutor();val ec=ExecutionContext.fromExecutorService(executor)
    try r.transaction{s=>escaped=s;assert(Try(r.transaction(_=>())).isFailure,"ORACLE_NESTED_SESSION");assert(await(Future(Try(s.lastSequenceNr("p")).isFailure)(ec)),"ORACLE_THREAD_CONFINEMENT")}
    finally {ec.shutdown();ec.awaitTermination(5,java.util.concurrent.TimeUnit.SECONDS)}
    assert(Try(escaped.lastSequenceNr("p")).isFailure,"ORACLE_ESCAPED_SESSION")
    intercept[IllegalStateException](r.transaction(_=>throw new IllegalStateException("callback")))
    assert(f.opens.get==f.closes.get,"ORACLE_CONNECTION_CLOSE")
  }
  test("existing schema and compatibility identity drift refuse instead of migrating") {
    val ds=fresh();val r=new WarehouseReadsideRepository(ds,"n");r.initialize()
    ReadsideSupport.execute(ds,"UPDATE warehouse_rs_namespace SET compatibility_key='wrong' WHERE namespace_id='n'")
    assert(Try(r.lastSequenceNr("p")).isFailure && Try(r.initialize()).isFailure,"ORACLE_STORE_IDENTITY")
    val broken=fresh();val b=new WarehouseReadsideRepository(broken,"n");b.initialize();ReadsideSupport.execute(broken,"ALTER TABLE warehouse_rs_receipt ALTER COLUMN map_value VARCHAR(200)")
    assert(Try(b.initialize()).isFailure && Try(b.lastSequenceNr("p")).isFailure,"ORACLE_SCHEMA_DRIFT")
  }
  test("coalesced catchup drains already accepted later pages and preserves caller resources") {
    runnerBody{(kit,ec)=>
      val ds=fresh();val repo=new WarehouseReadsideRepository(ds,"n");val h=new WarehouseReadsideHandler(repo,WarehouseState())
      val page=Promise[Vector[WarehouseEnvelope]]();val called=Promise[Unit]();val calls=new java.util.concurrent.atomic.AtomicInteger
      val source=new WarehouseEventSource {
        def persistenceIds(a: Option[String],n: Int)=Future.successful(Vector.empty)
        def currentEvents(p: String,a: Long,n: Int)={calls.incrementAndGet();called.trySuccess(());if(a==0)page.future else Future.successful(Vector.empty)}
      }
      val runner=new WarehouseReadsideRunner(repo,h,source,ec,kit.system);await(runner.initialize());val one=runner.catchUp("p");await(called.future)
      assert(one eq runner.catchUp("p"),"ORACLE_COALESCING")
      val shutdown=runner.shutdown();assert(shutdown eq runner.shutdown());assert(!shutdown.isCompleted,"ORACLE_DRAIN_WAIT")
      assert(Try(await(runner.catchUp("new"))).isFailure)
      page.success(Vector(env("p",1,SkuReservationCommitted(TxId("tx")))))
      assert(await(one)==CatchUpResult("p",1,1));val done=await(shutdown)
      assert(done.drained && !done.timedOut && done.accepted==done.completed && done.failure.isEmpty,"ORACLE_DRAIN_RESULT")
      assert(calls.get==2 && !kit.system.whenTerminated.isCompleted);assertFacts(ds,"p",1,Set("tx"))
    }
  }
  test("source poison failure is observable and never skips checkpoint") {
    runnerBody{(kit,ec)=>
      for(kind<-Vector("foreign","gap","oversize","badbytes","failure")){
        val ds=fresh();val r=new WarehouseReadsideRepository(ds,"n");val h=new WarehouseReadsideHandler(r,WarehouseState())
        val good=env("p",1,SkuReservationCommitted(TxId("tx")))
        val source=new WarehouseEventSource {
          def persistenceIds(a: Option[String],n: Int)=Future.successful(Vector.empty)
          def currentEvents(p: String,a: Long,n: Int)=kind match {
            case "failure"=>Future.failed(new IllegalStateException("SOURCE_FAIL"))
            case "foreign"=>Future.successful(Vector(env("other",1,SkuQuantityReserved(ReservationId("r")))))
            case "gap"=>Future.successful(Vector(env("p",2,SkuQuantityReserved(ReservationId("r")))))
            case "oversize"=>Future.successful(Vector.fill(65)(good))
            case _=>Future.successful(Vector(WarehouseEnvelope.capture("p","resource",1,good.manifest,Array[Byte](0))))
          }
        }
        val runner=new WarehouseReadsideRunner(r,h,source,ec,kit.system)
        assert(Try(await(runner.catchUp("p"))).isFailure,"ORACLE_POISON_FAILURE");assert(await(runner.failure)!=null)
        assert(r.lastSequenceNr("p")==0,"ORACLE_POISON_CHECKPOINT");val stopped=await(runner.shutdown());assert(stopped.drained && stopped.failure.nonEmpty)
      }
    }
  }
  test("runner admission is bounded and shutdown timeout cannot report drained") {
    runnerBody{(kit,ec)=>
      val ds=fresh();val r=new WarehouseReadsideRepository(ds,"n");val p=Promise[Vector[WarehouseEnvelope]]()
      val source=new WarehouseEventSource {def persistenceIds(a: Option[String],n: Int)=Future.successful(Vector.empty);def currentEvents(id: String,a: Long,n: Int)=p.future}
      val runner=new WarehouseReadsideRunner(r,new WarehouseReadsideHandler(r,WarehouseState()),source,ec,kit.system);await(runner.initialize())
      val accepted=(1 to 64).map(i=>runner.catchUp("pid"+i));assert(Try(await(runner.catchUp("overflow"))).isFailure,"ORACLE_CAPACITY")
      val result=await(runner.shutdown());assert(result.timedOut && !result.drained,"ORACLE_TIMEOUT")
      p.success(Vector.empty);accepted.foreach(await(_));assert(await(runner.shutdown())==result,"ORACLE_TIMEOUT_IMMUTABLE")
    }
  }
}
