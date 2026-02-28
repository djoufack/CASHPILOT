/**
 * Storecove Access Point adapter.
 * API docs: https://www.storecove.com/docs/
 *
 * This adapter is called from the Edge Function (server-side),
 * not from the browser. The API key must never be exposed to the client.
 */
const DEFAULT_BASE_URL = 'https://api.storecove.com/api/v2';

export const createStorecoveAdapter = ({ apiKey, baseUrl = DEFAULT_BASE_URL } = {}) => {
  const headers = () => ({
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  });

  return {
    async sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType = 'invoice') {
      const response = await fetch(`${baseUrl}/document_submissions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          document: {
            document_type: documentType === 'credit_note' ? 'creditnote' : 'invoice',
            rawDocument: btoa(ublXml),
            rawDocumentMimeType: 'application/xml',
          },
          routing: {
            eIdentifiers: [
              { scheme: senderEndpoint.split(':')[0], id: senderEndpoint.split(':').slice(1).join(':') },
            ],
            receiverIdentifiers: [
              { scheme: receiverEndpoint.split(':')[0], id: receiverEndpoint.split(':').slice(1).join(':') },
            ],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Storecove API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      return { documentId: data.guid, status: 'sent' };
    },

    async getDocumentStatus(documentId) {
      const response = await fetch(`${baseUrl}/document_submissions/${documentId}`, {
        method: 'GET',
        headers: headers(),
      });

      if (!response.ok) {
        throw new Error(`Storecove API error ${response.status}`);
      }

      const data = await response.json();
      return { status: data.status, details: data };
    },
  };
};
