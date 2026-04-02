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

export type GameName = "duel" | "bluff" | "tegn" | "sandhed";

export interface PromptManifest {
  game: GameName;
  activeVersions: string[];
  description: string;
}
