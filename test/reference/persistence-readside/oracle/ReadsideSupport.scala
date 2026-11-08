package example.inventory.persistencereadside.reference

import java.lang.reflect.{InvocationHandler,InvocationTargetException,Method,Proxy}
import java.sql.{Connection,PreparedStatement,SQLException}
import java.util.concurrent.atomic.AtomicInteger
import javax.sql.DataSource
import org.h2.jdbcx.JdbcDataSource
import example.inventory.domain.WarehouseProtocol._
import example.inventory.domain.WarehouseState
import example.inventory.domain.ports.WarehouseComputations
import example.inventory.domain.values._
import example.inventory.infrastructure.persistence._
import example.inventory.infrastructure.readside._
import scala.concurrent.{Await,Future}
import scala.concurrent.duration._

object ReadsideSupport {
  def await[A](f: Future[A]): A=Await.result(f,10.seconds)
  def data(path: String,exists: Boolean=false): JdbcDataSource={val d=new JdbcDataSource;d.setURL("jdbc:h2:file:"+path+";DB_CLOSE_ON_EXIT=FALSE;LOCK_TIMEOUT=2000"+(if(exists)";IFEXISTS=TRUE"else ""));d}
  def fresh(): JdbcDataSource=data(java.nio.file.Files.createTempDirectory("warehouse-hand-").resolve("database").toString)
  def sql[A](ds: DataSource,query: String)(read: java.sql.ResultSet=>A): Vector[A]={val c=ds.getConnection;try{val s=c.createStatement;try{val r=s.executeQuery(query);try{val b=Vector.newBuilder[A];while(r.next())b+=read(r);b.result()}finally r.close()}finally s.close()}finally c.close()}
  def execute(ds: DataSource,query: String): Unit={val c=ds.getConnection;try{val s=c.createStatement;try{s.execute(query);()}finally s.close()}finally c.close()}
  def count(ds: DataSource,table: String,namespace: String="n"): Long=sql(ds,"SELECT COUNT(*) FROM warehouse_rs_"+table+" WHERE namespace_id='"+namespace+"'")(_.getLong(1)).head
  def assertFacts(ds: DataSource,pid: String,n: Long,keys: Set[String],namespace: String="n"): Unit={
    val offsets=sql(ds,s"SELECT sequence_nr FROM warehouse_rs_offset WHERE namespace_id='$namespace' AND persistence_id='$pid'")(_.getLong(1))
    assert(offsets==Vector(n),"ORACLE_CHECKPOINT")
    val rows=sql(ds,s"SELECT map_key,map_value FROM warehouse_rs_receipt WHERE namespace_id='$namespace' AND persistence_id='$pid'")(r=>r.getString(1)->r.getString(2))
    assert(rows.toMap==keys.map(_ -> "SkuReservationCommitted").toMap,"ORACLE_INDEX_ATOMIC")
    val state=sql(ds,s"SELECT manifest,payload,sequence_nr FROM warehouse_rs_state WHERE namespace_id='$namespace' AND persistence_id='$pid'"){r=>
      val frame=example.inventory.persistence.protobuf.Frame.parseFrom(r.getBytes(2))
      // Independent domain PB decoder: do not ask the candidate repository for expected state.
      assert(frame.typeId=="warehouse.state" && r.getLong(3)==n,"ORACLE_STATE_CHECKPOINT")
      val pb=example.inventory.protobuf.WarehouseSnapshot.parseFrom(frame.payload.toByteArray)
      assert(pb.f0.exists(_.present),"ORACLE_STATE_PRESENT")
      pb.f0.get.f0.map(x=>x.f0.get.f0->x.f1).toMap
    }
    assert(state==Vector(keys.map(_->"SkuReservationCommitted").toMap),"ORACLE_STATE_ROWS")
    assert(sql(ds,s"SELECT sequence_nr FROM warehouse_rs_event WHERE namespace_id='$namespace' AND persistence_id='$pid' ORDER BY sequence_nr")(_.getLong(1))==(1L to n).toVector,"ORACLE_EVENT_PREFIX")
  }
  def env(pid: String,n: Long,e: Event,resource: String="resource"): WarehouseEnvelope={val f=WarehousePersistence.encodeEvent(e);WarehouseEnvelope.capture(pid,resource,n,WarehousePersistence.manifest(f),f.toByteArray)}
  val hosts=new WarehouseComputations {def reservationIdentity(t: TxId,w: WarehouseId,s: SkuId,q: Long): ReservationId=ReservationId("supplied-"+t.value)}
  def realEvents(tx: String): Vector[Event]={
    val initial=WarehouseState();val t=TxId(tx)
    val reserved=example.inventory.domain.invariant.WarehouseRules.decide(initial,ReserveSkuQuantity(t,WarehouseId("w"),SkuId("s"),1L),hosts).toOption.get
    val committed=example.inventory.domain.invariant.WarehouseRules.decide(initial,CommitSkuReservation(t,WarehouseId("w"),SkuId("s"),ReservationId("supplied-"+tx)),hosts).toOption.get
    assert(reserved==Vector(SkuQuantityReserved(ReservationId("supplied-"+tx))) && committed==Vector(SkuReservationCommitted(t)),"original rule fixture")
    reserved++committed
  }
  final class Faults(delegate: DataSource) extends DataSource {
    val opens=new AtomicInteger;val closes=new AtomicInteger;val writes=new AtomicInteger
    @volatile var preCommit=false
    @volatile var lostAck=false
    @volatile var rejectWrites=false
    private def invoke(target: AnyRef,m: Method,args: Array[AnyRef]): AnyRef=try m.invoke(target,Option(args).getOrElse(Array.empty[AnyRef]):_*)catch{case e: InvocationTargetException=>throw e.getCause}
    def getConnection(): Connection={
      val c=delegate.getConnection();opens.incrementAndGet()
      Proxy.newProxyInstance(getClass.getClassLoader,Array(classOf[Connection]),new InvocationHandler {
        def invoke(proxy: Any,m: Method,args: Array[AnyRef]): AnyRef=m.getName match {
          case "close"=>closes.incrementAndGet();Faults.this.invoke(c,m,args)
          case "commit" if preCommit=>throw new SQLException("INJECT_BEFORE_COMMIT")
          case "commit" if lostAck=>c.commit();lostAck=false;throw new SQLException("INJECT_AFTER_COMMIT_LOST_ACK")
          case "prepareStatement"=>
            val p=Faults.this.invoke(c,m,args).asInstanceOf[PreparedStatement]
            Proxy.newProxyInstance(getClass.getClassLoader,Array(classOf[PreparedStatement]),new InvocationHandler{def invoke(proxy: Any,m: Method,a: Array[AnyRef]): AnyRef={
              if(m.getName=="executeUpdate"){writes.incrementAndGet();if(rejectWrites)throw new SQLException("INJECT_UNEXPECTED_WRITE")}
              Faults.this.invoke(p,m,a)
            }}).asInstanceOf[PreparedStatement]
          case _=>Faults.this.invoke(c,m,args)
        }
      }).asInstanceOf[Connection]
    }
    def getConnection(u: String,p: String): Connection=getConnection()
    def getLogWriter(): java.io.PrintWriter=delegate.getLogWriter
    def setLogWriter(p: java.io.PrintWriter): Unit=delegate.setLogWriter(p)
    def getLoginTimeout(): Int=delegate.getLoginTimeout
    def setLoginTimeout(n: Int): Unit=delegate.setLoginTimeout(n)
    def getParentLogger(): java.util.logging.Logger=delegate.getParentLogger
    def unwrap[T](c: Class[T]): T=throw new SQLException("not a wrapper")
    def isWrapperFor(c: Class[_]): Boolean=false
  }
}
