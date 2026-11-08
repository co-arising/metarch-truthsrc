package example.inventory.infrastructure.readside

import java.sql.{Connection, PreparedStatement, ResultSet, Types}
import java.nio.charset.StandardCharsets.UTF_8
import java.security.MessageDigest
import javax.sql.DataSource
import example.inventory.domain.WarehouseState
import example.inventory.domain.values.TxId
import example.inventory.infrastructure.persistence.WarehousePersistence
import scala.util.control.NonFatal

private[readside] object WarehouseSql {
  def text(s: String): Unit = {
    require(s != null && s.nonEmpty && !s.exists(Character.isISOControl),"invalid identifier")
    val encoder=UTF_8.newEncoder().onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
    try require(encoder.encode(java.nio.CharBuffer.wrap(s)).remaining <= 256,"identifier bound")
    catch { case e: java.nio.charset.CharacterCodingException => throw new IllegalArgumentException("invalid Unicode",e) }
  }
  def digest(s: String): String = MessageDigest.getInstance("SHA-256").digest(s.getBytes(UTF_8)).map(b=>f"${b & 255}%02x").mkString
  def bound(n: Int): Unit = require(n>=1 && n<=64,"page bound")
  val prefix="warehouse_rs_"
  val ddl=Vector(
    "namespace" -> "namespace_id VARCHAR(256) NOT NULL, compatibility_key VARCHAR(64) NOT NULL, PRIMARY KEY(namespace_id)",
    "event" -> "namespace_id VARCHAR(256) NOT NULL, pid_key VARCHAR(64) NOT NULL, persistence_id VARCHAR(256) NOT NULL, resource_id VARCHAR(256) NOT NULL, stream_kind VARCHAR(256) NOT NULL, sequence_nr BIGINT NOT NULL, manifest VARCHAR(1024) NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(namespace_id,pid_key,sequence_nr)",
    "state" -> "namespace_id VARCHAR(256) NOT NULL, pid_key VARCHAR(64) NOT NULL, persistence_id VARCHAR(256) NOT NULL, resource_id VARCHAR(256) NOT NULL, sequence_nr BIGINT NOT NULL, manifest VARCHAR(1024) NOT NULL, payload BLOB NOT NULL, PRIMARY KEY(namespace_id,pid_key)",
    "offset" -> "namespace_id VARCHAR(256) NOT NULL, pid_key VARCHAR(64) NOT NULL, persistence_id VARCHAR(256) NOT NULL, resource_id VARCHAR(256) NOT NULL, sequence_nr BIGINT NOT NULL, PRIMARY KEY(namespace_id,pid_key)",
    "receipt" -> "namespace_id VARCHAR(256) NOT NULL, pid_key VARCHAR(64) NOT NULL, persistence_id VARCHAR(256) NOT NULL, resource_id VARCHAR(256) NOT NULL, map_key VARCHAR(256) NOT NULL, map_value VARCHAR(256) NOT NULL, PRIMARY KEY(namespace_id,pid_key,map_key)")
  val compatibility: String = digest(Vector("truthsrc.reference-store/v1","warehouse-persistence/1","WarehouseReadside/1","h2-2","warehouse-events/1","warehouse","envelope/1","serializer/736401","Receipt/receipt/by_resource/state-map/receipts/TxId:string256/string256/map_key,pid_key")
    .mkString("\n")+"\n"+WarehousePersistence.registrations.mkString("\n")+"\n"+ddl.mkString("\n"))
  def statement[A](c: Connection, sql: String, args: Seq[Any] = Nil)(body: PreparedStatement=>A): A = {
    val p=c.prepareStatement(sql)
    try {args.zipWithIndex.foreach { case (v,i) => v match {case b: Array[Byte] => p.setBytes(i+1,b);case x: Long=>p.setLong(i+1,x);case x: Int=>p.setInt(i+1,x);case x: String=>p.setString(i+1,x);case _=>throw new IllegalArgumentException("unsupported SQL parameter")}}; body(p)} finally p.close()
  }
  def rows[A](c: Connection, sql: String, args: Seq[Any]=Nil)(f: ResultSet=>A): Vector[A] = statement(c,sql,args){ p=> val r=p.executeQuery();try {val b=Vector.newBuilder[A];while(r.next())b+=f(r);b.result()}finally r.close() }
  def update(c: Connection,sql: String,args: Seq[Any]=Nil): Int=statement(c,sql,args)(_.executeUpdate())
  def schema(c: Connection): Unit = {
    val ignoreCase=rows(c,"SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME='IGNORECASE'")(_.getString(1))
    require(ignoreCase.isEmpty || ignoreCase==Vector("0"),"case insensitive store is unsupported")
    require(rows(c,"SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME='MODE'")(_.getString(1))==Vector("REGULAR"),"native H2 mode required")
    val md=c.getMetaData
    ddl.foreach {case (name,definition)=>
      val expected=definition.take(definition.indexOf(", PRIMARY KEY")).split(", ").toVector.map { column=>
        val bits=column.split(" ");val typ=bits(1);(bits(0).toUpperCase, if(typ.startsWith("VARCHAR")) Types.VARCHAR else if(typ=="BIGINT")Types.BIGINT else Types.BLOB,if(typ.startsWith("VARCHAR"))typ.drop(8).dropRight(1).toInt else 0)
      }
      val r=md.getColumns(null,"PUBLIC",(prefix+name).toUpperCase,null)
      val actual=try {val b=Vector.newBuilder[(String,Int,Int)];while(r.next()){if(r.getString("TABLE_NAME")== (prefix+name).toUpperCase(java.util.Locale.ROOT) && r.getString("TABLE_SCHEM")=="PUBLIC"){require(r.getString("TYPE_NAME")!="VARCHAR_IGNORECASE","case insensitive column");require(r.getInt("NULLABLE")==0,"schema nullable drift"); val t=r.getInt("DATA_TYPE");b+=((r.getString("COLUMN_NAME"),t,if(t==Types.VARCHAR)r.getInt("COLUMN_SIZE")else 0))}};b.result()}finally r.close()
      require(actual==expected,"schema columns drift: "+name)
      val pk=md.getPrimaryKeys(null,"PUBLIC",(prefix+name).toUpperCase)
      val keys=try{val b=Vector.newBuilder[(Int,String)];while(pk.next())b+=((pk.getInt("KEY_SEQ"),pk.getString("COLUMN_NAME")));b.result().sortBy(_._1).map(_._2)}finally pk.close()
      val wanted=definition.substring(definition.indexOf("PRIMARY KEY(")+12).dropRight(1).split(",").toVector.map(_.toUpperCase)
      require(keys==wanted,"schema primary key drift")
    }
  }
}
object WarehouseReadsideRepository {
  trait Session {
    def event(pid: String, sequenceNr: Long): Option[WarehouseEnvelope]
    def state(pid: String): Option[WarehouseStoredState]
    def lastSequenceNr(pid: String): Long
    def append(envelope: WarehouseEnvelope): Unit
    def replaceState(pid: String, resource: String, sequenceNr: Long, state: WarehouseState): Unit
    def replaceReceipts(pid: String, resource: String, receipts: Map[TxId,String]): Unit
    def checkpoint(pid: String, resource: String, sequenceNr: Long): Unit
  }
}
final class WarehouseReadsideRepository(dataSource: DataSource, val namespace: String) {
  import WarehouseSql._
  import WarehouseReadsideRepository.Session
  require(dataSource!=null,"null data source");text(namespace)
  private val entered=new ThreadLocal[java.lang.Boolean]()
  private def connection[A](body: Connection=>A): A = {val c=dataSource.getConnection();try body(c)finally c.close()}
  def initialize(): Unit = connection { c=>
    c.setAutoCommit(true)
    val tables=rows(c,"SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC'")(_.getString(1)).toSet
    val wanted=ddl.map(x=>(prefix+x._1).toUpperCase).toSet
    require((tables intersect wanted).isEmpty || wanted.subsetOf(tables),"partial existing schema")
    if((tables intersect wanted).isEmpty)ddl.foreach {case(n,d)=>update(c,"CREATE TABLE "+prefix+n+" ("+d+")")}
    schema(c)
    val keys=rows(c,"SELECT compatibility_key FROM warehouse_rs_namespace WHERE namespace_id=?",Seq(namespace))(_.getString(1))
    if(keys.isEmpty) {
      try update(c,"INSERT INTO warehouse_rs_namespace VALUES (?,?)",Seq(namespace,compatibility))
      catch {case e: java.sql.SQLException if e.getSQLState=="23505" => ()}
    }
    require(rows(c,"SELECT compatibility_key FROM warehouse_rs_namespace WHERE namespace_id=?",Seq(namespace))(_.getString(1))==Vector(compatibility),"store compatibility mismatch")
  }
  private def locked[A](body: Connection=>A): A = {
    require(entered.get()!=java.lang.Boolean.TRUE,"nested transaction")
    entered.set(true)
    try connection {c=>
      c.setAutoCommit(false)
      try {
        schema(c)
        val key=rows(c,"SELECT compatibility_key FROM warehouse_rs_namespace WHERE namespace_id=? FOR UPDATE",Seq(namespace))(_.getString(1))
        require(key==Vector(compatibility),"store compatibility mismatch or uninitialized namespace")
        val result=body(c);c.commit();result
      } catch {case NonFatal(e)=>try c.rollback() catch {case NonFatal(r)=>e.addSuppressed(r)};throw e}
    } finally entered.remove()
  }
  private class Live(c: Connection) extends Session {
    private val thread=Thread.currentThread();private var active=true
    def expire(): Unit={active=false}
    private def check(): Unit=require(active && Thread.currentThread()==thread,"session outside callback/thread")
    private def id(pid: String): Seq[Any]={check();text(pid);Seq(namespace,digest(pid))}
    private def association(pid: String,resource: String): Unit = {
      text(resource)
      for(t<-Vector("offset","state","event")) {
        val found=rows(c,s"SELECT persistence_id,resource_id FROM warehouse_rs_$t WHERE namespace_id=? AND pid_key=? LIMIT 1",id(pid))(r=>(r.getString(1),r.getString(2)))
        require(found.forall(_ == (pid,resource)),"PID/resource association conflict")
      }
    }
    def event(pid: String,n: Long): Option[WarehouseEnvelope] = {require(n>0,"sequence bound");rows(c,"SELECT persistence_id,resource_id,sequence_nr,manifest,payload,stream_kind FROM warehouse_rs_event WHERE namespace_id=? AND pid_key=? AND sequence_nr=?",id(pid):+n){r=>require(r.getString(1)==pid && r.getString(6)=="warehouse","event identity conflict");WarehouseEnvelope.capture(pid,r.getString(2),r.getLong(3),r.getString(4),r.getBytes(5))}.headOption}
    def state(pid: String): Option[WarehouseStoredState] = rows(c,"SELECT persistence_id,resource_id,sequence_nr,manifest,payload FROM warehouse_rs_state WHERE namespace_id=? AND pid_key=?",id(pid)){r=>require(r.getString(1)==pid,"PID collision");WarehouseStoredState(r.getString(2),r.getLong(3),WarehousePersistence.decodeState(WarehousePersistence.parse(r.getBytes(5),r.getString(4))))}.headOption
    def lastSequenceNr(pid: String): Long=rows(c,"SELECT persistence_id,sequence_nr FROM warehouse_rs_offset WHERE namespace_id=? AND pid_key=?",id(pid)){r=>require(r.getString(1)==pid,"PID collision");r.getLong(2)}.headOption.getOrElse(0L)
    def append(e: WarehouseEnvelope): Unit = {check();require(e!=null,"null envelope");association(e.pid,e.resource);require(e.sequenceNr==lastSequenceNr(e.pid)+1,"sequence gap");val f=WarehousePersistence.parse(e.bytes,e.manifest);require(f.role=="event","event role");update(c,"INSERT INTO warehouse_rs_event VALUES (?,?,?,?,?,?,?,?)",Seq(namespace,digest(e.pid),e.pid,e.resource,"warehouse",e.sequenceNr,e.manifest,e.bytes));()}
    def replaceState(pid: String,resource: String,n: Long,s: WarehouseState): Unit = {check();require(n>0,"sequence bound");association(pid,resource);val f=WarehousePersistence.encodeState(s);update(c,"MERGE INTO warehouse_rs_state KEY(namespace_id,pid_key) VALUES (?,?,?,?,?,?,?)",Seq(namespace,digest(pid),pid,resource,n,WarehousePersistence.manifest(f),f.toByteArray));()}
    def replaceReceipts(pid: String,resource: String,receipts: Map[TxId,String]): Unit = {
      check();association(pid,resource);require(receipts!=null && receipts.forall{case(k,v)=>k!=null && k.value!=null && v!=null && k.value.length<=256 && v.length<=256},"receipt bound")
      update(c,"DELETE FROM warehouse_rs_receipt WHERE namespace_id=? AND pid_key=?",id(pid))
      receipts.toVector.sortBy(_._1.value).foreach {case(k,v)=>update(c,"INSERT INTO warehouse_rs_receipt VALUES (?,?,?,?,?,?)",Seq(namespace,digest(pid),pid,resource,k.value,v))}
    }
    def checkpoint(pid: String,resource: String,n: Long): Unit = {check();association(pid,resource);require(n>0,"sequence bound");update(c,"MERGE INTO warehouse_rs_offset KEY(namespace_id,pid_key) VALUES (?,?,?,?,?)",Seq(namespace,digest(pid),pid,resource,n));()}
  }
  def transaction[A](body: Session=>A): A={require(body!=null,"null callback");locked{c=>val s=new Live(c);try body(s)finally s.expire()}}
  def state(pid: String): Option[WarehouseStoredState]=transaction(_.state(pid))
  def lastSequenceNr(pid: String): Long=transaction(_.lastSequenceNr(pid))
  def byResource(resource: String,after: Option[ReceiptCursor],limit: Int): ReceiptPage={
    text(resource);bound(limit);require(after!=null && after.forall(_!=null),"null cursor")
    after.foreach(c=>require(c.mapKey.length<=256 && c.pidKey.matches("[a-f0-9]{64}"),"invalid cursor"))
    locked{c=>
      val predicate=if(after.isDefined)" AND (map_key>? OR (map_key=? AND pid_key>?))"else ""
      val args=Seq[Any](namespace,resource)++after.toSeq.flatMap(x=>Seq(x.mapKey,x.mapKey,x.pidKey)):+(limit+1)
      val found=rows(c,"SELECT pid_key,persistence_id,resource_id,map_key,map_value FROM warehouse_rs_receipt WHERE namespace_id=? AND resource_id=?"+predicate+" ORDER BY map_key,pid_key LIMIT ?",args)(r=>ReceiptRow(r.getString(1),r.getString(2),r.getString(3),TxId(r.getString(4)),r.getString(5)))
      val page=found.take(limit);ReceiptPage(page,if(found.size>limit)Some(ReceiptCursor(page.last.txid.value,page.last.pidKey))else None)
    }
  }
  def persistenceIds(after: Option[String],limit: Int): Vector[String]={bound(limit);require(after!=null,"null cursor");after.foreach(text);locked{c=>rows(c,"SELECT persistence_id FROM warehouse_rs_offset WHERE namespace_id=?"+(if(after.isDefined)" AND persistence_id>?"else "")+" ORDER BY persistence_id LIMIT ?",Seq[Any](namespace)++after.toSeq:+limit)(_.getString(1))}}
  def currentEvents(pid: String,after: Long,limit: Int): Vector[WarehouseEnvelope]={text(pid);bound(limit);require(after>=0,"negative cursor");locked{c=>rows(c,"SELECT persistence_id,resource_id,sequence_nr,manifest,payload,stream_kind FROM warehouse_rs_event WHERE namespace_id=? AND pid_key=? AND sequence_nr>? ORDER BY sequence_nr LIMIT ?",Seq(namespace,digest(pid),after,limit)){r=>require(r.getString(1)==pid && r.getString(6)=="warehouse","event identity conflict");WarehouseEnvelope.capture(pid,r.getString(2),r.getLong(3),r.getString(4),r.getBytes(5))}}}
}
