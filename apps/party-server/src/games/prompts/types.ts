export type DuelPrompt = string;

export interface BluffPrompt {
  text: string;
  answer: string;
}

export interface TegnPrompt {
  text: string;
  category: "1" | "2" | "3";
}

export interface SandhedPrompt {
  text: string;
  answer: "true" | "false";
  category: "1" | "2" | "3";
}

export interface OrdklapPrompt {
  leftLabel: string;
  rightLabel: string;
  category: string;
}

export type GameName = "duel" | "bluff" | "tegn" | "sandhed" | "ordklap";

export interface PromptManifest {
  game: GameName;
  activeVersions: string[];
  description: string;
}
