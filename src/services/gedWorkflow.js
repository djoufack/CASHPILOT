const WORKFLOW_STATUSES = new Set(['pending_review', 'approved', 'rejected', 'signed']);

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const GED_WORKFLOW_STATUSES = WORKFLOW_STATUSES;

export const makeGedWorkflowKey = (companyId, sourceTable, sourceId) =>
  `${normalizeKey(companyId)}:${normalizeKey(sourceTable)}:${normalizeKey(sourceId)}`;

export const normalizeGedWorkflowStatus = (value) => {
  const normalized = normalizeKey(value);
  return WORKFLOW_STATUSES.has(normalized) ? normalized : null;
};

export const normalizeGedWorkflowComment = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

export const resolveGedWorkflowRecord = (workflows = [], { sourceTable, sourceId } = {}) => {
  const normalizedSourceTable = normalizeKey(sourceTable);
  const normalizedSourceId = normalizeKey(sourceId);

  if (!normalizedSourceTable || !normalizedSourceId || !Array.isArray(workflows)) {
    return null;
  }

  return (
    workflows.find(
      (workflow) =>
        normalizeKey(workflow?.source_table) === normalizedSourceTable &&
        normalizeKey(workflow?.source_id) === normalizedSourceId
    ) || null
  );
};

export const enrichGedDocumentsWithWorkflowInfo = (documents = [], workflows = []) =>
  (documents || []).map((document) => {
    const workflow = resolveGedWorkflowRecord(workflows, {
      sourceTable: document.sourceTable,
      sourceId: document.sourceId,
    });

    return {
      ...document,
      workflow: workflow || null,
      workflowStatus: normalizeGedWorkflowStatus(workflow?.workflow_status) || null,
      workflowRequestedBy: workflow?.requested_by || null,
      workflowRequestedAt: workflow?.requested_at || null,
      workflowApprovedBy: workflow?.approved_by || null,
      workflowApprovedAt: workflow?.approved_at || null,
      workflowRejectedBy: workflow?.rejected_by || null,
      workflowRejectedAt: workflow?.rejected_at || null,
      workflowSignedBy: workflow?.signed_by || null,
      workflowSignedAt: workflow?.signed_at || null,
      workflowComment: workflow?.comment || '',
      hasWorkflow: !!workflow,
    };
  });

export const normalizeGedWorkflowPayload = (payload = {}) => {
  const sourceTable = normalizeKey(payload.sourceTable || payload.source_table);
  const sourceId = normalizeKey(payload.sourceId || payload.source_id);
  const workflowStatus = normalizeGedWorkflowStatus(payload.workflowStatus || payload.workflow_status);
  const comment = normalizeGedWorkflowComment(payload.comment);

  if (!sourceTable) {
    throw new Error('Le type de document est obligatoire.');
  }

  if (!sourceId) {
    throw new Error('Le document GED est obligatoire.');
  }

  if (!workflowStatus) {
    throw new Error('Le statut de workflow est invalide.');
  }

  return {
    source_table: sourceTable,
    source_id: sourceId,
    workflow_status: workflowStatus,
    comment,
  };
};
