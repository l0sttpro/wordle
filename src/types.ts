export type Language = "en" | "af";
export type TileState = "correct" | "present" | "absent";
export type GameModeName = "wordle" | "quordle";

export interface GameMode {
    name: GameModeName;
    boards: number;
    maxGuesses: number;
}

export interface Settings {
    language: Language;
    mode: GameModeName;
    wordLength: number;
    daily: boolean;
}

export interface WordList {
    answers: string[]; // words that can be picked as the secret word
    allowed: string[]; // extra word accepted as guesses
}

export interface WordPool {
    answers: string[];
    valid: Set<string>;
}
