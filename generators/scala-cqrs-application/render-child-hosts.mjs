import { entry, packageFor, pathFor, symbol, typeName } from '../scala-cqrs-domain/naming.mjs';
import { fail } from '../../lib/products/request.mjs';
const q=JSON.stringify;

export function renderChildHosts({products,options},footprint) {
 const result=[],layout=products['reference-layout'];
 for(const p of products['execution-contract'].pipelines)for(const s of p.steps.filter(s=>s.awaitChildRun)) {
  const op=s.awaitChildRun,child=products['child-plan-contract'].plans.find(c=>c.ref.id===op.childRun.planRef.pipelineId);if(!child)fail('APPLICATION_CHILD','complete admitted child plan required');
  const pkg=packageFor(child.ref.context,options),parent=p.id.replaceAll('-','_')+'Execution',plan=child.ref.id.replaceAll('-','_')+'Execution',stem=p.id.replaceAll('-','_')+'_'+s.id.replaceAll('-','_'),name=stem+'ChildHost',n=s.id.replaceAll('-','_');
  const field=id=>layout.declarations.find(d=>d.ref.context===child.ref.context&&d.ref.kind==='type'&&d.ref.id===id);
  const value=ref=>ref.startsWith('input:')?'input.inputs.'+symbol(ref.slice(6)):fail('APPLICATION_CHILD','child payload must remain complete durable initial input');
  const raw=(v,t)=>t.form==='nominal'?raw(v+'.value',field(t.ref.id).valueType):t.form==='primitive'&&t.name==='string'?v:t.form==='primitive'&&t.name==='integer'?'java.lang.Long.toString('+v+')':fail('APPLICATION_CHILD','exact textual or integer child identity carrier required');
  const token=m=>{const d=field(m.type);if(!d)fail('APPLICATION_CHILD','exact nominal child identity descriptor required');return raw(value(m.ref),{form:'nominal',ref:d.ref});};
  const identity=op.childRun.identity,parts=[q('truthsrc-child-run-v1'),q(child.ref.context),q(p.id),q(p.recovery.planVersion),q(child.ref.id),q(child.version),token(identity.source),q(s.id),token(identity.stageOccurrence),q('chunk'),q(identity.chunk?'present':'absent'),...(identity.chunk?[token(identity.chunk)]:[])];
  const binding=p.binding.childRuns.find(c=>c.stepId===s.id),initial=plan+'.State('+plan+'.Inputs('+op.childRun.payload.map(m=>value(m.ref)).join(', ')+'))';
  const success=op.results.find(r=>r.resultKind==='succeeded'),recovery=op.results.find(r=>r.resultKind==='recovery-required');
  const values=s.writes.map(w=>{const map=success.outputs.find(o=>o.slot===w.slot);if(!map)fail('APPLICATION_CHILD','entire typed child result mapping required');return 'output.'+symbol(map.ref.slice(7));});
  let text=`package ${pkg}.application

import akka.actor.typed.{ActorRef, Behavior}
import akka.actor.typed.scaladsl.Behaviors
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}
import akka.serialization.SerializerWithStringManifest
import com.google.protobuf.ByteString
import net.imadz.monarch.persistence.PersistentMonarch
import scala.concurrent.{ExecutionContext, Future}

object ${name} {
  sealed trait Request
  final case class Invoke(input: ${parent}.State, replyTo: ActorRef[Reply]) extends Request
  private final case class Observed(value: ChildJournal.Observation[${plan}.State], replyTo: ActorRef[Reply]) extends Request
  private final case class Started(value: PersistentMonarch.RunReply, replyTo: ActorRef[Reply]) extends Request
  sealed trait Reply
  final case class Pending(reason: String) extends Reply
  final case class Conflict(reason: String) extends Reply
  final case class Completed(result: ${parent}.${n}Result) extends Reply
  sealed trait Event
  final case class Intent(parent: ByteString, initial: ByteString, operation: String, childPid: String, version: String) extends Event
  final case class Confirmed(snapshot: ByteString) extends Event
  final case class State(parent: ByteString = ByteString.EMPTY, initial: ByteString = ByteString.EMPTY, operation: String = "", childPid: String = "", result: Option[ByteString] = None)
  def initial(input: ${parent}.State): ${plan}.State = ${initial}
  def operationIdentity(input: ${parent}.State): String = {
    val buffer = new java.io.ByteArrayOutputStream
    val out = new java.io.DataOutputStream(buffer)
    val parts = Vector(${parts.join(', ')})
    parts.foreach { part => require(part != null && part.nonEmpty, "durable child identity required"); val bytes = part.getBytes(java.nio.charset.StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes) }
    out.flush()
    "sha256:" + java.security.MessageDigest.getInstance("SHA-256").digest(buffer.toByteArray).iterator.map(b => f"\${b & 0xff}%02x").mkString
  }
  def childPersistenceId(input: ${parent}.State): String = ${q(binding.journal.pidPrefix+':')} + operationIdentity(input)
  private val exactPlan = Vector(${child.pipeline.steps.map((s,i)=>q(s.id+'#'+i)).join(', ')})
  private def completed(snapshot: ByteString): Reply = {
    val output = ${plan}.outputs(${plan}.codec.decode(snapshot.toByteArray))
    Completed(${parent}.${n}_${success.code}(${values.join(', ')}))
  }
  def apply(persistenceId: String, child: ActorRef[PersistentMonarch.Command[${plan}.State]], journal: ChildJournal.Reader): Behavior[Request] = Behaviors.setup { context =>
    require(persistenceId != null && persistenceId.nonEmpty && child != null && journal != null, "actual child actor and authoritative journal implementation required")
    implicit val ec: ExecutionContext = context.executionContext
    def observe(state: State, replyTo: ActorRef[Reply]): Unit = context.pipeToSelf(journal.events(state.childPid).map(rows => ChildJournal.observe(rows, state.operation, state.initial, exactPlan, ${plan}.codec))) { result => Observed(result.getOrElse(ChildJournal.Conflict("child journal query failed; no authoritative result")), replyTo) }
    EventSourcedBehavior[Request, Event, State](PersistenceId.ofUniqueId(persistenceId), State(), (state, request) => request match {
      case Invoke(input, replyTo) =>
        val original = ByteString.copyFrom(${parent}.codec.encode(input))
        val bytes = ByteString.copyFrom(${plan}.codec.encode(initial(input)))
        val operation = operationIdentity(input)
        val pid = childPersistenceId(input)
        if (state.operation.nonEmpty && (state.parent != original || state.initial != bytes || state.operation != operation || state.childPid != pid)) Effect.none.thenRun((_: State) => replyTo ! Conflict("different child payload or original input under existing identity"))
        else if (state.result.nonEmpty) Effect.none.thenRun((s: State) => replyTo ! completed(s.result.get))
        else if (state.operation.nonEmpty) Effect.none.thenRun((s: State) => observe(s, replyTo))
        else Effect.persist(Intent(original, bytes, operation, pid, ${q(child.version)})).thenRun((s: State) => observe(s, replyTo))
      case Observed(ChildJournal.Missing, replyTo) => Effect.none.thenRun { s: State =>
        val adapter = context.spawnAnonymous(Behaviors.receiveMessage[PersistentMonarch.RunReply] { reply => context.self ! Started(reply, replyTo); Behaviors.stopped })
        child ! PersistentMonarch.StartRun(s.operation, ${plan}.codec.decode(s.initial.toByteArray), adapter)
      }
      case Started(_, replyTo) => Effect.none.thenRun((s: State) => observe(s, replyTo))
      case Observed(ChildJournal.Running(_), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Pending("awaiting authoritative child terminal"))
      case Observed(ChildJournal.Completed(childState), replyTo) => Effect.persist(Confirmed(ByteString.copyFrom(${plan}.codec.encode(childState)))).thenRun((s: State) => replyTo ! completed(s.result.get))
      case Observed(ChildJournal.Failed(_), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Completed(${parent}.${n}_${recovery.code}))
      case Observed(ChildJournal.Conflict(reason), replyTo) => Effect.none.thenRun((_: State) => replyTo ! Conflict(reason))
    }, (state, event) => event match {
      case Intent(original, initial, operation, pid, version) => require(version == ${q(child.version)}, "exact durable child plan version required"); state.copy(parent = original, initial = initial, operation = operation, childPid = pid)
      case Confirmed(snapshot) => state.copy(result = Some(snapshot))
    })
  }
}
final class ${name}Serializer extends SerializerWithStringManifest {
  override val identifier: Int = ${746000+result.length}
  def manifest(value: AnyRef): String = { require(value.isInstanceOf[${name}.Event], "child host event required"); "child-event-v1" }
  def toBinary(value: AnyRef): Array[Byte] = {
    manifest(value)
    val pb = value match {
      case ${name}.Intent(parent, initial, operation, pid, version) => ${pkg}.infrastructure.childproto.ChildHostEventPB(kind = "intent", parent = parent, initial = initial, operation = operation, childpid = pid, version = version)
      case ${name}.Confirmed(snapshot) => ${pkg}.infrastructure.childproto.ChildHostEventPB(kind = "confirmed", initial = snapshot)
    }
    pb.toByteArray
  }
  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {
    require(manifest == "child-event-v1", "exact child event version required")
    val pb = ${pkg}.infrastructure.childproto.ChildHostEventPB.parseFrom(bytes)
    pb.kind match {
      case "intent" => ${name}.Intent(pb.parent, pb.initial, pb.operation, pb.childpid, pb.version)
      case "confirmed" => ${name}.Confirmed(pb.initial)
      case _ => throw new IllegalArgumentException("unknown child host event")
    }
  }
}
`;
  result.push(entry(pathFor(pkg,'application/'+name+'.scala'),text,'invocation-host',[child.source],footprint,[pathFor(pkg,'application/ChildJournal.scala'),pathFor(pkg,'application/'+plan+'.scala'),pathFor(pkg,'application/'+parent+'.scala'),'app/protobuf/'+pkg.replaceAll('.','_')+'_child_host.proto']));
 }
 return result;
}
