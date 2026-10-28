import { renderAggregate, renderCommand, renderInvariant } from '../scala-cqrs-domain/render-domain.mjs';
import { renderActors } from '../scala-cqrs-domain/render-actor.mjs';
import { renderValues } from '../scala-cqrs-domain/render-values.mjs';
import { renderProto, renderConverters } from '../scala-cqrs-domain/render-serialization.mjs';
import { renderAdapters } from '../scala-cqrs-domain/render-adapters.mjs';
import { renderScaffold } from '../scala-cqrs-domain/scaffold.mjs';
import { renderDefinitions } from './render-host.mjs';
import { renderInvocationHosts } from './render-invocation-host.mjs';
import { renderHostAdapters } from './render-host-adapters.mjs';
import { renderTechnicalPorts } from './render-technical-ports.mjs';
import { applicationBuild } from './render-build.mjs';
import { renderHostVerification } from './render-host-verification.mjs';

const footprint = ids => ids.map(id=>({id,version:id==='domain-dependencies'||id==='domain-folds'?'5':id==='domain-external-events'||id==='artifact-contract'?'2':id==='domain-decision'?'3':'1'}));
const producer=(ids,render)=>Object.freeze({version:'1',produce:context=>render(context,footprint(ids))});
export const registry=Object.freeze({
 'aggregate-dsl':producer(['reference-layout','domain-folds','exact-value-types','domain-dependencies'],(c,f)=>[...renderAggregate(c,f),...renderActors(c,f,true)]),
 'command-dsl':producer(['reference-layout','domain-dependencies','exact-value-types'],renderCommand),
 'invariant-dsl':producer(['reference-layout','domain-decision','domain-folds','exact-value-types'],renderInvariant),
 'valueobject-dsl':producer(['reference-layout','exact-value-types'],renderValues),
 'proto-dsl':producer(['reference-layout','domain-dependencies','domain-folds','exact-value-types','exact-value-codecs','saga-host-contract'],(c,f)=>[...renderProto(c,f),...applicationBuild(c,f,renderScaffold(c,f,true))]),
 'converter-dsl':producer(['reference-layout','domain-dependencies','domain-folds','exact-value-types','exact-value-codecs'],(c,f)=>[...renderConverters(c,f),...renderAdapters(c,f)]),
 'finite-host-dsl':producer(['reference-layout','saga-host-contract','saga-runtime-contract','artifact-contract','domain-external-events'],(c,f)=>[...renderDefinitions(c,f),...renderInvocationHosts(c,f),...renderHostAdapters(c,f),...renderTechnicalPorts(c,f),...renderHostVerification(c,f)]),
});
