import { MODES } from "../config";
import { evaluateGuess } from "./evaluate";
import { pickTargets } from "./random";
import type { GameMode, Settings, TileState, WordPool } from "../types";

export type SubmitResult = "ok" | "short" | "invalid";
export type Status = "playing" | "won" | "lost";

const RANK: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };

export class Game {
    readonly settings: Settings;
    readonly mode: GameMode;
    readonly targets: string[];
    readonly guesses: string[] = [];
    // For each board: index of the guess that solved it, or null.
    readonly solvedAt: (number | null)[];
    current = "";
    private valid: Set<string>;

    constructor(settings: Settings, pool: WordPool, seed?: string) {
        this.settings = { ...settings };
        this.mode = MODES[settings.mode];
        this.valid = pool.valid;
        this.targets = pickTargets(pool.answers, this.mode.boards, seed);
        this.solvedAt = this.targets.map(() => null);
    }

    get boardCount(): number {
        return this.mode.boards;
    }

    get maxGuesses(): number {
        return this.mode.maxGuesses;
    }

    get status(): Status {
        if (this.solvedAt.every((s) => s !== null)) return "won";
        if (this.guesses.length >= this.mode.maxGuesses) return "lost";
        return "playing";
    }

    addLetter(letter: string): void {
        if (this.current.length < this.settings.wordLength) this.current += letter;
    }

    removeLetter(): void {
        this.current = this.current.slice(0, -1);
    }

    submit(): SubmitResult {
        if (this.current.length !== this.settings.wordLength) return "short";
        if (!this.valid.has(this.current)) return "invalid";

        const guess = this.current;
        this.guesses.push(guess);
        this.targets.forEach((target, i) => {
            if (this.solvedAt[i] === null && target === guess) {
                this.solvedAt[i] = this.guesses.length - 1;
            }
        });
        this.current = "";
        return "ok";
    }

    // Best known state of each letter, per board (used to colour the keyboard).
    keyStates(): Record<string, (TileState | undefined)[]> {
        const out: Record<string, (TileState | undefined)[]> = {};
        for (let b = 0; b < this.boardCount; b++) {
            const lastRow = this.solvedAt[b] ?? this.guesses.length - 1;
            for (let r = 0; r <= lastRow; r++) {
                const states = evaluateGuess(this.guesses[r], this.targets[b]);
                for (let c = 0; c < states.length; c++) {
                    const letter = this.guesses[r][c];
                    if (!out[letter]) {
                        out[letter] = new Array<TileState | undefined>(this.boardCount).fill(undefined);
                    }
                    const prev = out[letter][b];
                    if (prev === undefined || RANK[states[c]] > RANK[prev]) {
                        out[letter][b] = states[c];
                    }
                }
            }
        }
        return out;
    }
}
