import type { GameMode, GameModeName } from "./types";

export const MODES: Record<GameModeName, GameMode> = {
    wordle: { name: "wordle", boards: 1, maxGuesses: 6 },
    quordle: { name: "quordle", boards: 4, maxGuesses: 9 }
}

export const DEFAULT_WORD_LENGTH = 5;

export const MIN_WORD_LENGTH = 4;
export const MAX_WORD_LENGTH = 7;
