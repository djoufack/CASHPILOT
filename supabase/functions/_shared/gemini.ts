declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const getGeminiModel = () => {
  const configuredModel = Deno.env.get('GEMINI_MODEL')?.trim();
  return configuredModel || DEFAULT_GEMINI_MODEL;
};

export const buildGeminiGenerateContentUrl = (apiKey: string, model = getGeminiModel()) => {
  const normalizedModel = model.trim().replace(/^models\//, '') || DEFAULT_GEMINI_MODEL;
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    normalizedModel
  )}:generateContent?key=${apiKey}`;
};
