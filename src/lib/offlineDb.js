// eslint-disable-next-line import/no-unresolved
import Dexie from 'dexie';

const db = new Dexie('CashPilotOffline');

db.version(1).stores({
  offlineQueue: '++id, type, table, payload, createdAt, status',
  cachedInvoices: 'id, invoice_number, client_id, status, updated_at',
  cachedClients: 'id, company_name, email, updated_at',
  cachedExpenses: 'id, description, amount, category, updated_at',
  syncMeta: 'key, value',
});

export const offlineQueue = db.offlineQueue;
export const cachedInvoices = db.cachedInvoices;
export const cachedClients = db.cachedClients;
export const cachedExpenses = db.cachedExpenses;
export const syncMeta = db.syncMeta;

export { db };
export default db;
