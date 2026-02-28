/**
 * Scrada Access Point adapter.
 * API docs: https://www.scrada.be/api-documentation/
 *
 * This adapter is called from Edge Functions (server-side).
 * Credentials must never be exposed to the client.
 */
const PROD_BASE_URL = 'https://api.scrada.be/v1';
const TEST_BASE_URL = 'https://apitest.scrada.be/v1';

export const createScradaAdapter = ({ apiKey, password, companyId, baseUrl, useTestEnv = false } = {}) => {
  const base = baseUrl || (useTestEnv ? TEST_BASE_URL : PROD_BASE_URL);

  const authHeaders = () => ({
    'X-API-KEY': apiKey,
    'X-PASSWORD': password,
    'Language': 'FR',
  });

  const companyUrl = `${base}/company/${companyId}`;

  return {
    /**
     * Send UBL XML via Peppol.
     * POST /v1/company/{companyID}/peppolOutbound/sendSalesInvoice
     */
    async sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType = 'invoice') {
      const response = await fetch(`${companyUrl}/peppolOutbound/sendSalesInvoice`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/xml' },
        body: ublXml,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Scrada API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      return { documentId: data.id || data, status: 'pending' };
    },

    /**
     * Get outbound document status.
     * GET /v1/company/{companyID}/peppolOutbound/{documentID}/status
     */
    async getDocumentStatus(documentId) {
      const response = await fetch(`${companyUrl}/peppolOutbound/${documentId}/status`, {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      const statusMap = { 'Created': 'pending', 'Processed': 'delivered', 'Error': 'error' };
      return {
        status: statusMap[data.status] || data.status?.toLowerCase() || 'pending',
        errorMessage: data.errorMessage || null,
        details: data,
      };
    },

    /**
     * Check if a company is registered on Peppol.
     * GET /v1/company/{companyID}/peppolRegistration/check/{peppolID}
     */
    async checkPeppolRegistration(peppolId) {
      const response = await fetch(
        `${companyUrl}/peppolRegistration/check/${encodeURIComponent(peppolId)}`,
        { method: 'GET', headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
      );

      if (!response.ok) {
        if (response.status === 404) return { registered: false };
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      return { registered: true, details: data };
    },

    /**
     * List inbound Peppol documents.
     * GET /v1/company/{companyID}/peppolInbound
     */
    async listInboundDocuments() {
      const response = await fetch(`${companyUrl}/peppolInbound`, {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      return await response.json();
    },

    /**
     * Get a specific inbound document (UBL XML).
     * GET /v1/company/{companyID}/peppolInbound/{documentID}
     */
    async getInboundDocument(documentId) {
      const response = await fetch(`${companyUrl}/peppolInbound/${documentId}`, {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/xml' },
      });

      if (!response.ok) {
        throw new Error(`Scrada API error ${response.status}`);
      }

      return await response.text();
    },

    /**
     * Validate credentials by calling GET /v1/company/{companyID}
     */
    async validateCredentials() {
      const response = await fetch(companyUrl, {
        method: 'GET',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) return { valid: false, error: 'Invalid API key or password' };
        throw new Error(`Scrada API error ${response.status}`);
      }

      const data = await response.json();
      return { valid: true, company: data };
    },
  };
};
