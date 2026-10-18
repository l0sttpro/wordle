import { evaluateGuess } from "../game/evaluate";
import type { Game } from "../game/state";

export function renderBoards(el: HTMLElement, game: Game, revealRow: number): void {
    el.className = `boards ${game.settings.mode}`;
    el.style.setProperty("--len", String(game.settings.wordLength));
    el.innerHTML = "";
    for (let b = 0; b < game.boardCount; b++) {
        el.append(renderBoard(game, b, revealRow));
    }
}

function renderBoard(game: Game, b: number, revealRow: number): HTMLElement {
    const board = document.createElement("div");
    board.className = "board";
    const solvedAt = game.solvedAt[b];
    if (solvedAt !== null) board.classList.add("solved");

    const len = game.settings.wordLength;
    const isActive = game.status === "playing" && solvedAt === null;

    for (let r = 0; r < game.maxGuesses; r++) {
        const row = document.createElement("div");
        row.className = "row";

        // A board stops showing rows after the guess that solved it.
        const submitted = r < game.guesses.length && r <= (solvedAt ?? Infinity);
        const states = submitted ? evaluateGuess(game.guesses[r], game.targets[b]) : null;
        const isCurrentRow = isActive && r === game.guesses.length;

        for (let c = 0; c < len; c++) {
            const tile = document.createElement("div");
            tile.className = "tile";

            if (states) {
                tile.textContent = game.guesses[r][c];
                tile.classList.add(states[c]);
                if (r === revealRow) {
                    tile.classList.add("reveal");
                    tile.style.animationDelay = `${c * 120}ms`;
                }
            } else if (isCurrentRow) {
                const letter = game.current[c] ?? "";
                tile.textContent = letter;
                if (letter) tile.classList.add("filled");
            }
            row.append(tile);
        }
        board.append(row);
    }
    return board;
}
