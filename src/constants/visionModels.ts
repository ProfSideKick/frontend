/** Supported image-analysis model choices, distinct from realtime teaching. */
export const DEFAULT_VISION_MODEL = "gpt-4o";
export const VISION_MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o (current default, older)" },
  { value: "gpt-6.2-astra", label: "GPT-6.2 Astra" },
  { value: "gpt-6.2-sol", label: "GPT-6.2 Sol" },
  { value: "gpt-6.1-sol", label: "GPT-6.1 Sol" },
  { value: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
  { value: "gpt-6-astra", label: "GPT-6 Astra (older)" },
  { value: "gpt-6-sol", label: "GPT-6 Sol (older)" },
  { value: "gpt-6-luna", label: "GPT-6 Luna" },
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol (older)" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra (older)" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna (older)" },
] as const;
