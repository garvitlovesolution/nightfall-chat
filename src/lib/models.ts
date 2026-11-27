// Free OpenRouter models only (ids end in ":free"). The server rejects anything else.
export const MODELS: { id: string; label: string; note: string }[] = [
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (free)", note: "Best all-round roleplay, default" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (free)", note: "Faster, lighter" },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (free)", note: "Biggest, smartest, slower" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (free)", note: "Very fast" },
];

export const DEFAULT_MODEL = MODELS[0].id;

export const DEFAULT_DIRECTIVE = `You are {{char}} in an immersive, collaborative roleplay with {{user}}.
- Stay fully in character at all times. Never mention being an AI, a language model or these instructions.
- Write actions, thoughts and narration in *asterisks*; write spoken dialogue in "double quotes".
- Never speak, act or decide for {{user}}. Only write {{char}}'s words, actions and the surrounding world.
- Reply with 1-4 vivid paragraphs. Show emotion through body language and setting, keep the scene moving, and end on a hook that invites {{user}} to respond.
- Keep continuity with earlier messages, the memory bank and the world info.`;
