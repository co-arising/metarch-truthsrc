package reference.inventory.ext

import java.io.{ByteArrayInputStream, ByteArrayOutputStream, DataInputStream, DataOutputStream}
import java.nio.ByteBuffer
import java.nio.channels.FileChannel
import java.nio.file.{Files, Path, StandardOpenOption}
import reference.inventory.kernel._
import reference.inventory.kernel.ManagedCheckRunProtocol.Check
import scala.concurrent.{ExecutionContext, Future}
import scala.jdk.CollectionConverters._

/** Independent finite external leaf fixture. It supplies no Run or workflow interpreter. */
final class ManagedCheck(directory: Path)(implicit ec: ExecutionContext) extends Check.Leaf {
  private val home = directory.resolve("managed-check")
  private val lock = new Object
  Files.createDirectories(home)
  private val codecs = BinaryCodecs.ManagedCheckRun
  private def record(request: Check.Request): Path = home.resolve(request.operationId + ".receipt")
  private def proof(request: Check.Request, bytes: Vector[Byte]): Vector[Byte] =
    BinaryCodecs.digest(request.requestBytes ++ bytes ++ request.effectKey.getBytes("UTF-8").toVector).getBytes("UTF-8").toVector
  private def evidence(request: Check.Request, outcome: Check.TerminalOutcome): Check.Evidence = {
    val bytes = codecs.outcome.encode(outcome)
    Check.Evidence(request, outcome, bytes, proof(request, bytes))
  }
  private def write(request: Check.Request, value: Check.Evidence): Unit = {
    val buffer = new ByteArrayOutputStream; val output = new DataOutputStream(buffer)
    for (bytes <- Vector(request.requestBytes, value.bytes)) { output.writeInt(bytes.size); output.write(bytes.toArray) }
    output.flush()
    val channel = FileChannel.open(record(request), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
    try { val bytes = ByteBuffer.wrap(buffer.toByteArray); while (bytes.hasRemaining) channel.write(bytes); channel.force(true) }
    finally channel.close()
  }
  private def read(request: Check.Request): Option[Check.Evidence] = {
    val file = record(request)
    if (!Files.exists(file)) None
    else {
      val input = new DataInputStream(new ByteArrayInputStream(Files.readAllBytes(file)))
      def bytes(): Vector[Byte] = {
        val size = input.readInt(); require(size >= 0 && size <= 65536 && size <= input.available())
        val result = new Array[Byte](size); input.readFully(result); result.toVector
      }
      val original = bytes(); val result = bytes(); require(input.available() == 0)
      require(original == request.requestBytes, "external operation request conflict")
      Some(evidence(request, codecs.outcome.decode(result).get))
    }
  }
  private def earlier(request: Check.Request): Boolean = {
    val stream = Files.list(home)
    try stream.iterator.asScala.filter(_.toString.endsWith(".receipt")).exists { file =>
      val input = new DataInputStream(new ByteArrayInputStream(Files.readAllBytes(file)))
      val size = input.readInt(); require(size >= 0 && size <= 65536 && size <= input.available())
      val bytes = new Array[Byte](size); input.readFully(bytes)
      val state = codecs.request.decode(bytes.toVector).get
      state.input.transactionId == request.args.transactionId
    } finally stream.close()
  }
  def submit(request: Check.Request): Future[Check.Observation] = Future { lock.synchronized {
    read(request) match {
      case Some(value) => Check.Observation.Confirmed(value)
      case None =>
        val id = request.args.request.requestId.value
        val rejected = id == "always-reject" || id == "retry" && !earlier(request)
        val outcome: Check.TerminalOutcome = if (rejected) Check.Outcome.Rejected("confirmed no effects")
          else Check.Outcome.Done(Check.Values(ReservationResult(request.args.transactionId, request.args.request)))
        val value = evidence(request, outcome); write(request, value)
        Check.Observation.Confirmed(value)
    }
  } }
  def query(request: Check.Request): Future[Check.Observation] = Future {
    read(request).map(Check.Observation.Confirmed).getOrElse(Check.Observation.NotFound)
  }
  def validateEvidence(expected: Check.Request, value: Check.Evidence): Either[String, Unit] =
    if (value.request == expected && value.bytes == codecs.outcome.encode(value.outcome) && value.proof == proof(expected, value.bytes)) Right(())
    else Left("external leaf evidence mismatch")
}
