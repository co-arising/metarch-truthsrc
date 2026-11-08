package example.inventory.infrastructure.readside

import akka.Done
import akka.actor.Cancellable
import akka.actor.typed.ActorSystem
import scala.concurrent.{ExecutionContext,Future,Promise}
import scala.concurrent.duration._
import scala.util.{Try,Success,Failure}
import scala.util.control.NonFatal

final class WarehouseJdbcEventSource(repository: WarehouseReadsideRepository, blockingEc: ExecutionContext) extends WarehouseEventSource {
  require(repository!=null && blockingEc!=null,"null source dependency")
  def persistenceIds(after: Option[String],limit: Int): Future[Vector[String]]=Future(repository.persistenceIds(after,limit))(blockingEc)
  def currentEvents(pid: String,after: Long,limit: Int): Future[Vector[WarehouseEnvelope]]=Future(repository.currentEvents(pid,after,limit))(blockingEc)
}
final class WarehouseReadsideRunner(repository: WarehouseReadsideRepository,handler: WarehouseReadsideHandler,source: WarehouseEventSource,blockingEc: ExecutionContext,system: ActorSystem[_]) {
  require(repository!=null && handler!=null && source!=null && blockingEc!=null && system!=null,"null runner dependency")
  private implicit val ec: ExecutionContext=blockingEc
  private var closing=false
  private var accepted=0L
  private var completed=0L
  private var pending=0
  private var first: Option[Throwable]=None
  private val failed=Promise[Throwable]()
  private var init: Future[Done]=null
  private var started: Future[Done]=null
  private var stopped: Promise[ShutdownResult]=null
  private var timer: Option[Cancellable]=None
  private var closeTimer: Option[Cancellable]=None
  private val active=scala.collection.mutable.Map.empty[String,Future[CatchUpResult]]
  def failure: Future[Throwable]=failed.future
  private def report(e: Throwable): Unit=synchronized {if(first.isEmpty){first=Some(e);failed.trySuccess(e)}}
  private def finishClose(): Unit=synchronized {
    if(stopped!=null && pending==0){stopped.trySuccess(ShutdownResult(true,accepted,completed,first,false));closeTimer.foreach(_.cancel())}
  }
  private def admitted[A](internal: Boolean=false)(body: => Future[A]): Future[A]=synchronized {
    if((closing && !internal)||pending>=64)return Future.failed(new IllegalStateException(if(closing)"runner closing"else "runner capacity"))
    val result=Promise[A]();accepted+=1;pending+=1
    // Defer user source callbacks and JDBC work to the explicitly supplied EC.
    Future.unit.flatMap(_=>body).onComplete {r=>
      synchronized {r.failed.foreach(report);completed+=1;pending-=1;result.tryComplete(r);finishClose()}
    }
    result.future
  }
  private def ensureInitialized(): Future[Done]=synchronized {
    if(init==null)init=Future{repository.initialize();Done}
    init
  }
  def initialize(): Future[Done]=synchronized {
    if(init!=null)init else {val f=admitted(){Future{repository.initialize();Done}};init=f;f}
  }
  def project(e: WarehouseEnvelope): Future[ProjectResult]={
    require(e!=null,"null envelope")
    val captured=WarehouseEnvelope.capture(e.pid,e.resource,e.sequenceNr,e.manifest,e.bytes)
    admitted(){ensureInitialized().flatMap(_=>Future(handler.project(captured)))}
  }
  private def catchUp0(pid: String,internal: Boolean): Future[CatchUpResult]=synchronized {
    WarehouseSql.text(pid)
    if(closing && !internal)return Future.failed(new IllegalStateException("runner closing"))
    active.getOrElse(pid,{
      val result=admitted(internal){ensureInitialized().flatMap(_=>Future(repository.lastSequenceNr(pid))).flatMap(last=>pages(pid,last))}
      active.put(pid,result)
      result.onComplete(_=>synchronized{if(active.get(pid).contains(result))active.remove(pid)})
      result
    })
  }
  def catchUp(pid: String): Future[CatchUpResult]=catchUp0(pid,false)
  private def pages(pid: String,after: Long): Future[CatchUpResult]=source.currentEvents(pid,after,64).flatMap { page=>
    require(page!=null && page.size<=64 && page.forall(_!=null),"source page bound")
    if(page.isEmpty)Future.successful(CatchUpResult(pid,after,after))
    else {
      var expected=after
      page.foreach {e=>require(expected<Long.MaxValue && e.pid==pid && e.sequenceNr==expected+1,"source contiguous PID page");expected=e.sequenceNr}
      Future{page.foreach(handler.project);expected}.flatMap(next=>pages(pid,next))
    }
  }
  private def discover(after: Option[String]): Future[Done]=source.persistenceIds(after,64).flatMap {page=>
    require(page!=null && page.size<=64,"discovery bound")
    page.foreach(WarehouseSql.text)
    require(page.distinct==page && page==page.sorted && after.forall(a=>page.forall(_>a)),"discovery non-progress")
    page.foldLeft(Future.successful(()))((f,pid)=>f.flatMap(_=>catchUp0(pid,true).map(_=>()))).flatMap{_=>if(page.isEmpty)Future.successful(Done)else discover(page.lastOption)}
  }
  private def schedule(): Unit=synchronized {
    if(!closing)timer=Some(system.scheduler.scheduleOnce(100.millis,new Runnable{def run(): Unit={
      val work=admitted(){discover(None)}
      work.onComplete {case Success(_)=>schedule();case Failure(e)=>report(e)}
    }}))
  }
  def start(): Future[Done]=synchronized {
    if(started==null)started=admitted(){ensureInitialized().map{_=>schedule();Done}}
    started
  }
  def shutdown(): Future[ShutdownResult]=synchronized {
    if(stopped==null){
      stopped=Promise[ShutdownResult]();closing=true;timer.foreach(_.cancel())
      closeTimer=Some(system.scheduler.scheduleOnce(5000.millis,new Runnable{def run(): Unit=synchronized {
        WarehouseReadsideRunner.this.synchronized {stopped.trySuccess(ShutdownResult(false,accepted,completed,first,true))}
      }}))
      finishClose()
    }
    stopped.future
  }
}
