const normalizeMessage = (error) =>
  [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const normalizeCode = (error) => String(error?.code || '').toUpperCase();

export const isSupabaseErrorCode = (error, expectedCode) =>
  normalizeCode(error) === String(expectedCode || '').toUpperCase();

export const isMissingColumnError = (error, columnRef = '') => {
  const message = normalizeMessage(error);
  const isSqlMissingColumn = isSupabaseErrorCode(error, '42703');
  const isPostgrestMissingColumn =
    isSupabaseErrorCode(error, 'PGRST204') &&
    (message.includes('could not find') || message.includes('schema cache') || message.includes('column'));

  if (!isSqlMissingColumn && !isPostgrestMissingColumn) return false;
  if (!columnRef) return true;
  return message.includes(String(columnRef).toLowerCase());
};

export const isMissingRelationError = (error, relationRef = '') => {
  if (!isSupabaseErrorCode(error, '42P01')) return false;
  if (!relationRef) return true;
  return normalizeMessage(error).includes(String(relationRef).toLowerCase());
};

export const isFunctionNotFoundError = (error) => isSupabaseErrorCode(error, '42883');

export const isPostgrestRelationAmbiguityError = (error) => isSupabaseErrorCode(error, 'PGRST201');
