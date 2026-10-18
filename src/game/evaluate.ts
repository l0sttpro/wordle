import type { TileState } from "../types";

export function evaluateGuess(guess: string, target: string): TileState[] {
    const result: TileState[] = new Array<TileState>(guess.length).fill("absent");
    const remaining: Record<string, number> = {};

    // Pass 1: exact matches. Count the target letters that are still unclaimed.
    for (let i = 0; i < target.length; i++) {
        if (guess[i] === target[i]) {
            result[i] = "correct";
        } else {
            remaining[target[i]] = (remaining[target[i]] ?? 0) + 1;
        }
    }

    // Pass 2: right letter, wrong place, only while unclaimed copies remain.
    for (let i = 0; i < guess.length; i++) {
        if (result[i] === "correct") continue;
        const letter = guess[i];
        if ((remaining[letter] ?? 0) > 0) {
            result[i] = "present";
            remaining[letter]--;
        }
    }

    return result;
}
