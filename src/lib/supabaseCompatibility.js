const normalizeMessage = (error) => String(error?.message || '').toLowerCase();

const normalizeCode = (error) => String(error?.code || '').toUpperCase();

export const isSupabaseErrorCode = (error, expectedCode) =>
  normalizeCode(error) === String(expectedCode || '').toUpperCase();

export const isMissingColumnError = (error, columnRef = '') => {
  if (!isSupabaseErrorCode(error, '42703')) return false;
  if (!columnRef) return true;
  return normalizeMessage(error).includes(String(columnRef).toLowerCase());
};

export const isMissingRelationError = (error, relationRef = '') => {
  if (!isSupabaseErrorCode(error, '42P01')) return false;
  if (!relationRef) return true;
  return normalizeMessage(error).includes(String(relationRef).toLowerCase());
};

export const isFunctionNotFoundError = (error) => isSupabaseErrorCode(error, '42883');

export const isPostgrestRelationAmbiguityError = (error) => isSupabaseErrorCode(error, 'PGRST201');
