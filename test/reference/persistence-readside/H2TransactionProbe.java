// Independent native-JDBC feasibility probe. Not the business reference or a journal.
import java.sql.*;
import java.nio.file.*;
import java.util.*;

class H2TransactionProbe {
  static final byte[] PAYLOAD = new byte[65536];
  static { for (int i = 0; i < PAYLOAD.length; i++) PAYLOAD[i] = (byte)(i * 31); }
  static void check(boolean value, String name) { if (!value) throw new AssertionError(name); }
  static void passed(String name) { System.out.println("PROVEN " + name); }
  static Connection open(String base, boolean exists) throws SQLException {
    return DriverManager.getConnection("jdbc:h2:file:" + base + ";DB_CLOSE_ON_EXIT=FALSE;LOCK_TIMEOUT=250" + (exists ? ";IFEXISTS=TRUE" : ""), "sa", "");
  }
  static void sql(Connection c, String text, Object... values) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(text)) {
      for (int i=0; i<values.length; i++) { if (values[i] instanceof byte[]) p.setBytes(i+1,(byte[])values[i]); else p.setObject(i+1,values[i]); }
      p.executeUpdate();
    }
  }
  static long scalar(Connection c, String text, Object... values) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(text)) {
      for (int i=0; i<values.length; i++) p.setObject(i+1,values[i]);
      try (ResultSet r=p.executeQuery()) { check(r.next(),"scalar row"); long value=r.getLong(1); check(!r.next(),"one scalar row"); return value; }
    }
  }
  static void lock(Connection c, String ns) throws SQLException {
    try (PreparedStatement p=c.prepareStatement("SELECT namespace_id FROM probe_namespace WHERE namespace_id=? FOR UPDATE")) {
      p.setString(1,ns); try (ResultSet r=p.executeQuery()) { check(r.next(),"namespace present"); }
    }
  }
  static void write(Connection c, String ns, long seq) throws SQLException {
    sql(c,"INSERT INTO probe_event VALUES (?,?,?,?)",ns,"pid/opaque",seq,PAYLOAD);
    sql(c,"MERGE INTO probe_state KEY(namespace_id,persistence_id) VALUES (?,?,?,?)",ns,"pid/opaque",seq,PAYLOAD);
    sql(c,"DELETE FROM probe_receipt WHERE namespace_id=? AND persistence_id=?",ns,"pid/opaque");
    sql(c,"INSERT INTO probe_receipt VALUES (?,?,?,?,?)",ns,"pid/opaque","resource/opaque","tx-"+seq,"SkuReservationCommitted");
    sql(c,"MERGE INTO probe_offset KEY(namespace_id,persistence_id) VALUES (?,?,?)",ns,"pid/opaque",seq);
  }
  static void facts(Connection c, String ns, long seq, long events) throws SQLException {
    check(scalar(c,"SELECT COUNT(*) FROM probe_event WHERE namespace_id=?",ns)==events,"event count "+ns);
    check(scalar(c,"SELECT sequence_nr FROM probe_state WHERE namespace_id=?",ns)==seq,"state checkpoint "+ns);
    check(scalar(c,"SELECT sequence_nr FROM probe_offset WHERE namespace_id=?",ns)==seq,"offset "+ns);
    check(scalar(c,"SELECT COUNT(*) FROM probe_receipt WHERE namespace_id=? AND map_key=? AND map_value=?",ns,"tx-"+seq,"SkuReservationCommitted")==1,"index matches checkpoint "+ns);
    try (PreparedStatement p=c.prepareStatement("SELECT payload FROM probe_state WHERE namespace_id=?")) {
      p.setString(1,ns); try (ResultSet r=p.executeQuery()) { check(r.next(),"blob row"); check(Arrays.equals(PAYLOAD,r.getBytes(1)),"blob exact"); }
    }
  }
  static void run(String base) throws Exception {
    check(!Files.exists(Path.of(base+".mv.db")),"new exclusive DB");
    try (Connection a=open(base,false); Connection b=open(base,true)) {
      check(a.getMetaData().getDatabaseProductVersion().startsWith("2.2.224"),"pinned H2 version");
      try (Statement s=a.createStatement(); ResultSet r=s.executeQuery("SELECT SETTING_VALUE FROM INFORMATION_SCHEMA.SETTINGS WHERE SETTING_NAME='MODE'")) {
        check(r.next() && r.getString(1).equals("REGULAR"),"native H2 REGULAR mode");
      }
      sql(a,"CREATE TABLE probe_namespace(namespace_id VARCHAR(128) PRIMARY KEY)");
      sql(a,"CREATE TABLE probe_event(namespace_id VARCHAR(128),persistence_id VARCHAR(256),sequence_nr BIGINT,payload BLOB NOT NULL,PRIMARY KEY(namespace_id,persistence_id,sequence_nr))");
      sql(a,"CREATE TABLE probe_state(namespace_id VARCHAR(128),persistence_id VARCHAR(256),sequence_nr BIGINT,payload BLOB NOT NULL,PRIMARY KEY(namespace_id,persistence_id))");
      sql(a,"CREATE TABLE probe_receipt(namespace_id VARCHAR(128),persistence_id VARCHAR(256),resource_id VARCHAR(256),map_key VARCHAR(256),map_value VARCHAR(256),PRIMARY KEY(namespace_id,persistence_id,map_key))");
      sql(a,"CREATE TABLE probe_offset(namespace_id VARCHAR(128),persistence_id VARCHAR(256),sequence_nr BIGINT,PRIMARY KEY(namespace_id,persistence_id))");
      sql(a,"INSERT INTO probe_namespace VALUES ('alpha'),('beta')");
      a.setAutoCommit(false); b.setAutoCommit(false);
      a.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED); b.setTransactionIsolation(Connection.TRANSACTION_READ_COMMITTED);
      lock(a,"alpha");
      try { lock(b,"alpha"); throw new AssertionError("same namespace lock must block"); }
      catch (SQLException e) { check(e.getErrorCode()==50200,"exact H2 lock timeout code"); b.rollback(); }
      lock(b,"beta"); write(b,"beta",1); b.commit();
      check(scalar(a,"SELECT COUNT(*) FROM probe_event WHERE namespace_id='beta'")==1,"independent namespace committed");
      passed("namespace-lock-second-connection-and-other-namespace-progress");
      write(a,"alpha",1);
      for(String table:List.of("probe_event","probe_state","probe_receipt","probe_offset"))
        check(scalar(b,"SELECT COUNT(*) FROM "+table+" WHERE namespace_id='alpha'")==0,"uncommitted invisible "+table);
      a.commit(); facts(b,"alpha",1,1); b.commit(); passed("blob-and-event-state-index-offset-atomic-commit");
      lock(a,"alpha"); write(a,"alpha",2);
      class BeforeCommit extends RuntimeException {}
      try { throw new BeforeCommit(); } catch (BeforeCommit exact) { a.rollback(); }
      facts(b,"alpha",1,1); b.commit(); passed("failure-after-index-write-before-commit-rolls-back-all-four");
      lock(a,"alpha"); write(a,"alpha",2);
      boolean observed=false;
      try { a.commit(); throw new SQLException("PROBE_POST_COMMIT_OBSERVATION", "P0001", 99001); }
      catch (SQLException e) { check(e.getErrorCode()==99001 && "P0001".equals(e.getSQLState()),"exact post-commit failure"); observed=true; }
      check(observed,"post commit failure observable"); facts(b,"alpha",2,2); b.commit();
      lock(a,"alpha");
      // Retry determines already-committed fact from the complete persisted bytes, not the exception exit code.
      try (PreparedStatement p=a.prepareStatement("SELECT payload FROM probe_event WHERE namespace_id='alpha' AND persistence_id='pid/opaque' AND sequence_nr=2"); ResultSet r=p.executeQuery()) {
        check(r.next() && Arrays.equals(r.getBytes(1),PAYLOAD) && !r.next(),"committed retry identity and bytes");
      }
      a.commit(); facts(b,"alpha",2,2); facts(b,"beta",1,1); b.commit();
      passed("post-commit-exception-is-not-rollback-and-identical-retry-finds-commit");
    }
    check(Files.size(Path.of(base+".mv.db"))>0,"file DB retained");
    passed("normal-close-file-retained");
  }
  static void reopen(String base) throws Exception {
    try (Connection c=open(base,true)) { facts(c,"alpha",2,2); facts(c,"beta",1,1); }
    passed("new-jvm-ifexists-reopen-exact-committed-facts");
    String missing=base+"-missing";
    check(!Files.exists(Path.of(missing+".mv.db")),"missing DB starts absent");
    try (Connection c=open(missing,true)) { throw new AssertionError("IFEXISTS must reject missing DB"); }
    catch (SQLException e) { check(e.getErrorCode()==90146,"exact IFEXISTS missing code, got "+e.getErrorCode()); }
    check(!Files.exists(Path.of(missing+".mv.db")),"missing DB not manufactured");
    passed("ifexists-missing-rejected-without-creation");
  }
  public static void main(String[] args) throws Exception {
    check(args.length==2,"mode and exclusive path required");
    Class.forName("org.h2.Driver");
    if(args[0].equals("write")) run(args[1]); else if(args[0].equals("reopen")) reopen(args[1]); else throw new AssertionError("unknown mode");
    System.out.println("H2_PROBE_"+args[0].toUpperCase(Locale.ROOT)+"_PASS");
  }
}
