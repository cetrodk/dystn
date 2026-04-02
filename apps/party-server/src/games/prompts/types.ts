export type BlitzPrompt = string;

export interface FuskPrompt {
  text: string;
  answer: string;
}

export interface ScrawlPrompt {
  text: string;
  category: "1" | "2" | "3";
}

export interface SurgePrompt {
  text: string;
  answer: "true" | "false";
  category: "1" | "2" | "3";
}

export interface HunchPrompt {
  leftLabel: string;
  rightLabel: string;
  category: string;
}

export type GameName = "blitz" | "fusk" | "scrawl" | "surge" | "hunch";

export interface PromptManifest {
  game: GameName;
  activeVersions: string[];
  description: string;
}
