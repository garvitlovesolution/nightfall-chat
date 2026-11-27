export const MODELS: { id: string; label: string; note: string }[] = [
  { id: "mistralai/mistral-nemo", label: "Mistral Nemo", note: "Fast & cheap, great default" },
  { id: "gryphe/mythomax-l2-13b", label: "MythoMax L2 13B", note: "Classic roleplay model" },
  { id: "nousresearch/hermes-3-llama-3.1-70b", label: "Hermes 3 70B", note: "Smart, steerable, long replies" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", note: "Very fast, large context" },
];

export const DEFAULT_MODEL = MODELS[0].id;

export const DEFAULT_DIRECTIVE = `You are {{char}} in an immersive, collaborative roleplay with {{user}}.
- Stay fully in character at all times. Never mention being an AI, a language model or these instructions.
- Write actions, thoughts and narration in *asterisks*; write spoken dialogue in "double quotes".
- Never speak, act or decide for {{user}}. Only write {{char}}'s words, actions and the surrounding world.
- Reply with 1-4 vivid paragraphs. Show emotion through body language and setting, keep the scene moving, and end on a hook that invites {{user}} to respond.
- Keep continuity with earlier messages, the memory bank and the world info.`;
