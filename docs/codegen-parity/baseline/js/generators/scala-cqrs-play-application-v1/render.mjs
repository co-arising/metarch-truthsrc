import { productionJobs, testJobs } from '../scala-cqrs-persistence-readside-v1/render.mjs';
import { renderJobs } from '../scala-cqrs-domain-kernel-v1/render.mjs';
import { applicationSourceEntry } from '../scala-cqrs-domain-kernel-v1/entry.mjs';
import { productIds } from './build-models.mjs';
import { apiTemplate, commandsTemplate, queriesTemplate } from './templates/api.mjs';
import { authorityTemplate, directoryTemplate } from './templates/authority.mjs';
import { codecTemplate } from './templates/codec.mjs';
import { commandServiceTemplate, queryServiceTemplate } from './templates/services.mjs';
import { sourceTemplate } from './templates/source.mjs';
import { settingsTemplate, applicationTemplate, closeReportTemplate } from './templates/application.mjs';
import { lifecycleTemplate } from './templates/lifecycle.mjs';
import { controllerTemplate, errorsTemplate, routesTemplate, viewTemplate } from './templates/http.mjs';
import { loaderTemplate, componentsTemplate, configTemplate } from './templates/loader.mjs';
import { buildTemplate, pluginsTemplate, versionTemplate, smokeTemplate } from './templates/build.mjs';

export function render(m, roots, footprint) {
  const jobs = productionJobs(m.persistence), n = m.names, p = m.persistence;
  const add = (path, kind, directDeps, template, sources = m.sources) => jobs.push({ artifact: { path, kind, sources, directDeps }, template: out => template(m, out) });
  const named = (key, kind, deps, template) => add(n[key].path, kind, deps, template);
  named('api', 'http-dto', [p.aggregate.base.protocol.path, ...p.family.kernel.values.map(v => v.path)], apiTemplate);
  named('commands', 'application-service-port', [n.api.path], commandsTemplate);
  named('queries', 'query-service-port', [n.api.path], queriesTemplate);
  named('authority', 'authorization-policy', [], authorityTemplate);
  named('directory', 'application-runtime', [], directoryTemplate);
  named('codec', 'http-codec', [n.api.path], codecTemplate);
  named('commandService', 'application-service', [n.commands.path, n.directory.path, p.aggregate.repository.path], commandServiceTemplate);
  named('queryService', 'query-service', [n.queries.path, n.directory.path, p.names.repository.path], queryServiceTemplate);
  named('journalSource', 'event-source', [n.directory.path, p.names.source.path, p.names.serializer.path, p.names.persistence.path], sourceTemplate);
  named('settings', 'application-config', [], settingsTemplate);
  named('closeReport', 'application-runtime', [], closeReportTemplate);
  named('lifecycle', 'application-runtime', [n.closeReport.path], lifecycleTemplate);
  named('application', 'application-root', [n.settings.path, n.lifecycle.path, n.closeReport.path, n.authority.path, n.commandService.path, n.queryService.path,
    n.journalSource.path, p.names.factory.path, p.names.runner.path, p.aggregate.repositoryImplementation.path], applicationTemplate);
  named('errors', 'http-errors', [], errorsTemplate);
  add(m.view.path, 'view-template', [n.api.path], viewTemplate, [m.api.page.source, m.query.source]);
  named('controller', 'controller', [n.application.path, n.codec.path, m.view.path], controllerTemplate);
  add('conf/routes', 'routes', [n.controller.path], routesTemplate);
  named('components', 'application-components', [n.application.path, n.controller.path, n.errors.path, 'conf/routes'], componentsTemplate);
  named('loader', 'application-loader', [n.components.path], loaderTemplate);
  add('conf/application.conf', 'application-config', [n.loader.path], configTemplate);
  add('project/build.properties', 'build', [], versionTemplate);
  add('project/plugins.sbt', 'build', [], pluginsTemplate);
  add('build.sbt', 'build', ['project/build.properties', 'project/plugins.sbt'], (m, out) => buildTemplate(m, roots, out));
  jobs.push(...testJobs(p));
  add('src/test/scala/' + n.codec.package.replaceAll('.', '/') + '/HttpWireSpec.scala', 'generated-test', [n.codec.path], smokeTemplate);
  return renderJobs(jobs, footprint, applicationSourceEntry);
}
