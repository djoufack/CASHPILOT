export const readFunctionErrorData = async (error) => {
  if (!error?.context || typeof error.context.json !== 'function') {
    return null;
  }

  try {
    return await error.context.json();
  } catch {
    return null;
  }
};
