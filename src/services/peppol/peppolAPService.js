/**
 * Abstract Peppol Access Point service.
 * Delegates to a provider-specific adapter (Scrada, Storecove, etc.).
 */
export const createAPService = (adapter) => ({
  sendDocument: (ublXml, senderEndpoint, receiverEndpoint, documentType) =>
    adapter.sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType),

  getDocumentStatus: (documentId) =>
    adapter.getDocumentStatus(documentId),

  // Optional methods — only available with adapters that support them
  checkPeppolRegistration: adapter.checkPeppolRegistration
    ? (peppolId) => adapter.checkPeppolRegistration(peppolId)
    : undefined,

  listInboundDocuments: adapter.listInboundDocuments
    ? () => adapter.listInboundDocuments()
    : undefined,

  getInboundDocument: adapter.getInboundDocument
    ? (documentId) => adapter.getInboundDocument(documentId)
    : undefined,

  validateCredentials: adapter.validateCredentials
    ? () => adapter.validateCredentials()
    : undefined,
});
