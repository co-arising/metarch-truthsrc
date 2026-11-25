import { entry, packageFor, pathFor, symbol } from '../scala-cqrs-domain/naming.mjs';
import { isFlipped } from '../../lib/derivation/pipeline-invocation-face.mjs';
export function renderHostAdapters({products,options},footprint){
 const result=[];
 // Retirement registry (2026-11-23): flipped hosts keep their staying host
 // proto (the golden serializer pins its PB); only the serializer artifact retires.
 let protoIndex=0;
 for(const h of products['saga-host-contract'].hosts){
  if(h.entry.startOwner.kind==='pipeline'&&isFlipped(h.id,options,h.saga.ref.context)){ // staying host proto only
   const pkg0=packageFor(h.saga.ref.context,options),stem0=h.id.replaceAll('-','_'),proto0=stem0.replaceAll('_','')+'HostEventPB';
   const text0='syntax = "proto3";\nimport "scalapb/scalapb.proto";\npackage '+pkg0+'.infrastructure.hostproto;\noption (scalapb.options) = { flat_package: true };\nmessage '+proto0+' { string kind = 1; bytes original = 2; bytes args = 3; string operation = 4; bytes identity = 5; }\n';
   const path0='app/protobuf/'+stem0+'_host.proto';
   result.push({...entry(path0,text0,'host-proto',[h.source],footprint),content:text0});
   continue;
  }
  const index=protoIndex;protoIndex++;
  const pkg=packageFor(h.saga.ref.context,options),stem=h.id.replaceAll('-','_'),host=symbol(stem)+'Host',proto=stem.replaceAll('_','')+'HostEventPB';
  const text='syntax = "proto3";\nimport "scalapb/scalapb.proto";\npackage '+pkg+'.infrastructure.hostproto;\noption (scalapb.options) = { flat_package: true };\nmessage '+proto+' { string kind = 1; bytes original = 2; bytes args = 3; string operation = 4; bytes identity = 5; }\n';
  const path='app/protobuf/'+stem+'_host.proto';
  result.push({...entry(path,text,'host-proto',[h.source],footprint),content:text});
  let scala='package '+pkg+'.application\n\nimport akka.serialization.SerializerWithStringManifest\nimport com.google.protobuf.ByteString\nimport net.imadz.infra.saga.strict.StrictSagaProtoConverters\nimport net.imadz.infra.saga.strict.proto.saga_strict.TransactionIdentityPO\n\nfinal class '+symbol(stem)+'HostSerializer extends SerializerWithStringManifest {\n  override val identifier: Int = '+(742000+index)+'\n  def manifest(value: AnyRef): String = { require(value.isInstanceOf['+host+'.Event], "host event required"); "event-v1" }\n  def toBinary(value: AnyRef): Array[Byte] = {\n    manifest(value)\n    val pb = value match {\n      case '+host+'.AdmissionGranted => '+pkg+'.infrastructure.hostproto.'+proto+'(kind = "admitted")\n      case '+host+'.Associated(original, args, operation) => '+pkg+'.infrastructure.hostproto.'+proto+'(kind = "associated", original = original, args = args, operation = operation)\n      case '+host+'.IdentityObserved(identity) => '+pkg+'.infrastructure.hostproto.'+proto+'(kind = "identity", identity = StrictSagaProtoConverters.identityToProto(identity).toByteString)\n      case '+host+'.ResultIntent(kind) => '+pkg+'.infrastructure.hostproto.'+proto+'(kind = "result", operation = kind)\n      case '+host+'.DeliveryAcknowledged(kind) => '+pkg+'.infrastructure.hostproto.'+proto+'(kind = "delivered", operation = kind)\n    }\n    pb.toByteArray\n  }\n  def fromBinary(bytes: Array[Byte], manifest: String): AnyRef = {\n    require(manifest == "event-v1", "host event version required")\n    val pb = '+pkg+'.infrastructure.hostproto.'+proto+'.parseFrom(bytes)\n    pb.kind match {\n      case "admitted" => '+host+'.AdmissionGranted\n      case "associated" => '+host+'.Associated(pb.original, pb.args, pb.operation)\n      case "identity" => '+host+'.IdentityObserved(StrictSagaProtoConverters.identityFromProto(TransactionIdentityPO.parseFrom(pb.identity.toByteArray)))\n      case "result" => '+host+'.ResultIntent(pb.operation)\n      case "delivered" => '+host+'.DeliveryAcknowledged(pb.operation)\n      case _ => throw new IllegalArgumentException("unknown host event")\n    }\n  }\n}\n';
  result.push(entry(pathFor(pkg,'application/'+stem+'HostSerializer.scala'),scala,'host-serialization',[h.source],footprint,[path,pathFor(pkg,'application/'+stem+'Host.scala')]));
 }
 return result;
}
