package example.inventory.persistencereadside.reference

import example.inventory.domain.WarehouseState
import example.inventory.infrastructure.readside._
import akka.actor.testkit.typed.scaladsl.ActorTestKit
import scala.concurrent.ExecutionContext
import java.nio.file.{Files,Paths,StandardOpenOption}
import java.util.concurrent.Executors

object FileReplay {
  import ReadsideSupport._
  def main(args: Array[String]): Unit={
    require(args.length==2);val phase=args(0);val root=args(1)
    val sourceDs=data(root+"/source",phase=="b");val oldDs=data(root+"/old",phase=="b")
    val source=new WarehouseReadsideRepository(sourceDs,"sealed-source");val old=new WarehouseReadsideRepository(oldDs,"target")
    if(phase=="a") {
      source.initialize();old.initialize()
      val cache=new WarehouseReadsideHandler(source,WarehouseState());val prefix=new WarehouseReadsideHandler(old,WarehouseState())
      val history=(realEvents("a")++realEvents("b")).zipWithIndex.map{case(e,i)=>env("replay-pid",i+1,e)}
      history.foreach(cache.project);history.take(2).foreach(prefix.project)
      assertFacts(sourceDs,"replay-pid",4,Set("a","b"),"sealed-source");assertFacts(oldDs,"replay-pid",2,Set("a"),"target")
      Files.write(Paths.get(root,"jvm-a.txt"),"A persisted four real original-rule frames and old target prefix=2; all JDBC connections closed\n".getBytes("UTF-8"),StandardOpenOption.CREATE_NEW)
      println("JVM_A_PERSISTED_SOURCE_AND_PREFIX")
    } else {
      require(phase=="b" && Files.exists(Paths.get(root,"jvm-a.txt")))
      assert(scala.util.Try(data(root+"/absent",true).getConnection()).isFailure,"ORACLE_IFEXISTS_MISSING")
      // B never calls realEvents or manufactures source Frames. Only IFEXISTS persisted rows.
      val before=source.currentEvents("replay-pid",0,64).map(e=>(e.sequenceNr,e.manifest,e.bytes.toVector))
      assert(before.size==4 && old.lastSequenceNr("replay-pid")==2)
      val freshDs=data(root+"/new");val fresh=new WarehouseReadsideRepository(freshDs,"target")
      val kit=ActorTestKit();val executor=Executors.newFixedThreadPool(2);val ec=ExecutionContext.fromExecutorService(executor)
      try {
        val input=new WarehouseJdbcEventSource(source,ec)
        for(target<-Vector(old,fresh)){
          val runner=new WarehouseReadsideRunner(target,new WarehouseReadsideHandler(target,WarehouseState()),input,ec,kit.system)
          assert(await(runner.catchUp("replay-pid"))==CatchUpResult("replay-pid",4,4));val stopped=await(runner.shutdown());assert(stopped.drained && stopped.failure.isEmpty)
        }
        assertFacts(oldDs,"replay-pid",4,Set("a","b"),"target");assertFacts(freshDs,"replay-pid",4,Set("a","b"),"target")
        assert(source.currentEvents("replay-pid",0,64).map(e=>(e.sequenceNr,e.manifest,e.bytes.toVector))==before,"ORACLE_SOURCE_UNCHANGED")
        execute(sourceDs,"UPDATE warehouse_rs_namespace SET compatibility_key='wrong-source' WHERE namespace_id='sealed-source'")
        assert(scala.util.Try(await(input.currentEvents("replay-pid",0,64))).isFailure,"ORACLE_REOPEN_SOURCE_IDENTITY")
      } finally {ec.shutdown();assert(ec.awaitTermination(10,java.util.concurrent.TimeUnit.SECONDS));kit.shutdownTestKit()}
      Files.write(Paths.get(root,"jvm-b.txt"),"B reopened source+old IFEXISTS, resumed 2->4, rebuilt absent new target to4, direct SQL state/index/events/checkpoint verified, missing and wrong source rejected\n".getBytes("UTF-8"),StandardOpenOption.CREATE_NEW)
      println("JVM_B_REOPEN_RESUME_AND_NEW_TARGET_VERIFIED")
    }
  }
}
