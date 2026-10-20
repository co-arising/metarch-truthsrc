package net.imadz.metarch.infrastructure.persistence.converters

import net.imadz.common.serialization.PrimitiveConverter
import net.imadz.metarch.domain.entities.DoREntity.DoRState
import net.imadz.metarch.domain.entities.DoREntity._
import net.imadz.metarch.infrastructure.proto._

trait DoRProtoConverters extends PrimitiveConverter {

  object DoRStateConv extends ProtoConverter[DoRState, DoRStatePO] {
    override def toProto(d: DoRState): DoRStatePO = DoRStatePO(
      tenantId = d.tenantId,
      status = d.status,
      projectId = d.projectId,
      targetSessionIds = d.targetSessionIds,
      scopeSnapshot = d.scopeSnapshot,
      knowledgeSnapshot = d.knowledgeSnapshot,
      verdicts = d.verdicts,
      evaluatedAt = d.evaluatedAt,
      evaluatedBy = d.evaluatedBy,
      findings = d.findings,
      workshopId = d.workshopId,
      patchId = d.patchId,
      criterion = d.criterion,
      evaluatorType = d.evaluatorType,
      evaluatorId = d.evaluatorId,
      evaluatorRole = d.evaluatorRole,
      aiModelVersion = d.aiModelVersion,
      harnessBrand = d.harnessBrand,
      harnessVersion = d.harnessVersion,
      effort = d.effort,
      result = d.result,
      reason = d.reason,
      evidenceLinks = d.evidenceLinks,
      recordedAt = d.recordedAt,
      recordedBy = d.recordedBy,
      evaluatedScope = d.evaluatedScope,
      summary = d.summary,
      description = d.description,
      severity = d.severity
    )

    override def fromProto(p: DoRStatePO): DoRState = DoRState(
      tenantId = p.tenantId,
      status = p.status,
      projectId = p.projectId,
      targetSessionIds = p.targetSessionIds,
      scopeSnapshot = p.scopeSnapshot,
      knowledgeSnapshot = p.knowledgeSnapshot,
      verdicts = p.verdicts,
      evaluatedAt = p.evaluatedAt,
      evaluatedBy = p.evaluatedBy,
      findings = p.findings,
      workshopId = p.workshopId,
      patchId = p.patchId,
      criterion = p.criterion,
      evaluatorType = p.evaluatorType,
      evaluatorId = p.evaluatorId,
      evaluatorRole = p.evaluatorRole,
      aiModelVersion = p.aiModelVersion,
      harnessBrand = p.harnessBrand,
      harnessVersion = p.harnessVersion,
      effort = p.effort,
      result = p.result,
      reason = p.reason,
      evidenceLinks = p.evidenceLinks,
      recordedAt = p.recordedAt,
      recordedBy = p.recordedBy,
      evaluatedScope = p.evaluatedScope,
      summary = p.summary,
      description = p.description,
      severity = p.severity
    )
  }


  object DoRRequestedConv extends ProtoConverter[DoRRequested, DoRRequestedPO] {
    override def toProto(d: DoRRequested): DoRRequestedPO = DoRRequestedPO(
      dorId = d.dorId,
      tenantId = d.tenantId,
      projectId = d.projectId,
      targetSessionIds = d.targetSessionIds,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      workshopId = d.workshopId,
      patchId = d.patchId,
      knowledgeSnapshot = d.knowledgeSnapshot,
      scopeSnapshot = d.scopeSnapshot
    )

    override def fromProto(p: DoRRequestedPO): DoRRequested = DoRRequested(
      dorId = p.dorId,
      tenantId = p.tenantId,
      projectId = p.projectId,
      targetSessionIds = p.targetSessionIds,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      workshopId = p.workshopId,
      patchId = p.patchId,
      knowledgeSnapshot = p.knowledgeSnapshot,
      scopeSnapshot = p.scopeSnapshot
    )
  }


  object DoRVerdictSubmittedConv extends ProtoConverter[DoRVerdictSubmitted, DoRVerdictSubmittedPO] {
    override def toProto(d: DoRVerdictSubmitted): DoRVerdictSubmittedPO = DoRVerdictSubmittedPO(
      dorId = d.dorId,
      verdict = d.verdict,
      recordedAt = d.recordedAt,
      recordedBy = d.recordedBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: DoRVerdictSubmittedPO): DoRVerdictSubmitted = DoRVerdictSubmitted(
      dorId = p.dorId,
      verdict = p.verdict,
      recordedAt = p.recordedAt,
      recordedBy = p.recordedBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object DoRPassedConv extends ProtoConverter[DoRPassed, DoRPassedPO] {
    override def toProto(d: DoRPassed): DoRPassedPO = DoRPassedPO(
      dorId = d.dorId,
      assessmentResult = d.assessmentResult,
      approvedBy = d.approvedBy,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId,
      patchId = d.patchId
    )

    override def fromProto(p: DoRPassedPO): DoRPassed = DoRPassed(
      dorId = p.dorId,
      assessmentResult = p.assessmentResult,
      approvedBy = p.approvedBy,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId,
      patchId = p.patchId
    )
  }


  object DoRFindingsSubmittedConv extends ProtoConverter[DoRFindingsSubmitted, DoRFindingsSubmittedPO] {
    override def toProto(d: DoRFindingsSubmitted): DoRFindingsSubmittedPO = DoRFindingsSubmittedPO(
      dorId = d.dorId,
      findings = d.findings,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: DoRFindingsSubmittedPO): DoRFindingsSubmitted = DoRFindingsSubmitted(
      dorId = p.dorId,
      findings = p.findings,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object DoRReopenedConv extends ProtoConverter[DoRReopened, DoRReopenedPO] {
    override def toProto(d: DoRReopened): DoRReopenedPO = DoRReopenedPO(
      dorId = d.dorId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: DoRReopenedPO): DoRReopened = DoRReopened(
      dorId = p.dorId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object DoRVerdictFixedConv extends ProtoConverter[DoRVerdictFixed, DoRVerdictFixedPO] {
    override def toProto(d: DoRVerdictFixed): DoRVerdictFixedPO = DoRVerdictFixedPO(
      dorId = d.dorId,
      verdictId = d.verdictId,
      resolution = d.resolution,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: DoRVerdictFixedPO): DoRVerdictFixed = DoRVerdictFixed(
      dorId = p.dorId,
      verdictId = p.verdictId,
      resolution = p.resolution,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }


  object DoRBlockedConv extends ProtoConverter[DoRBlocked, DoRBlockedPO] {
    override def toProto(d: DoRBlocked): DoRBlockedPO = DoRBlockedPO(
      dorId = d.dorId,
      reason = d.reason,
      triggeredBy = d.triggeredBy,
      timestamp = d.timestamp,
      tenantId = d.tenantId
    )

    override def fromProto(p: DoRBlockedPO): DoRBlocked = DoRBlocked(
      dorId = p.dorId,
      reason = p.reason,
      triggeredBy = p.triggeredBy,
      timestamp = p.timestamp,
      tenantId = p.tenantId
    )
  }

}
