import { evaluateGuess } from "../game/evaluate";
import type { Game } from "../game/state";
import type { Language, TileState } from "../types";

const EMOJI: Record<TileState, string> = {
    correct: "🟩",
    present: "🟨",
    absent: "⬛",
};

const LANGUAGE_NAMES: Record<Language, string> = { en: "English", af: "Afrikaans" };

// The classic copy-paste result grid.
function shareText(game: Game): string {
    const won = game.status === "won";
    const score = `${won ? game.guesses.length : "X"}/${game.maxGuesses}`;
    const { mode, language, wordLength } = game.settings;
    const title = mode === "wordle" ? "Wordle" : "Quordle";
    const header = `${title} · ${LANGUAGE_NAMES[language]} · ${wordLength} letters · ${score}`;

    const grids = game.targets.map((target, b) => {
        // A solved board stops at the guess that solved it.
        const lastRow = game.solvedAt[b] ?? game.guesses.length - 1;
        return game.guesses
            .slice(0, lastRow + 1)
            .map((guess) =>
                evaluateGuess(guess, target)
                    .map((s) => EMOJI[s])
                    .join(""),
            )
            .join("\n");
    });

    return `${header}\n\n${grids.join("\n\n")}\n\n${location.origin}${location.pathname}`;
}

export function showResult(el: HTMLElement, game: Game, onPlayAgain: () => void): void {
    const won = game.status === "won";
    const n = game.guesses.length;
    const boards = game.boardCount;
    const solved = game.solvedAt.filter((s) => s !== null).length;

    let sub: string;
    if (won) sub = `Solved in ${n} ${n === 1 ? "guess" : "guesses"}`;
    else if (boards > 1) sub = `${solved} of ${boards} words solved`;
    else sub = "The word was";

    const answers = game.targets
        .map((t, i) => `<span class="answer ${game.solvedAt[i] !== null ? "hit" : "miss"}">${t}</span>`)
        .join("");

    el.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button id="m-close" class="modal-close" aria-label="Close">×</button>
      <h2 id="modal-title" class="${won ? "win" : "lose"}">${won ? "Solved" : "Out of guesses"}</h2>
      <p class="modal-sub">${sub}</p>
      <div class="answers">${answers}</div>
      <pre class="share"></pre>
      <div class="modal-actions">
        <button id="m-copy">Copy result</button>
        <button id="m-again" class="primary">Play again</button>
      </div>
    </div>
  `;

    const text = shareText(game);
    el.querySelector<HTMLElement>(".share")!.textContent = text;

    const copyBtn = el.querySelector<HTMLButtonElement>("#m-copy")!;
    copyBtn.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(text);
            copyBtn.textContent = "Copied";
        } catch {
            copyBtn.textContent = "Copy failed";
        }
    });

    el.querySelector("#m-close")!.addEventListener("click", () => hideResult(el));
    el.querySelector("#m-again")!.addEventListener("click", onPlayAgain);
    el.onclick = (e) => {
        if (e.target === el) hideResult(el); // click on the dark backdrop
    };

    el.classList.add("open");
    el.querySelector<HTMLButtonElement>("#m-again")!.focus();
}

export function hideResult(el: HTMLElement): void {
    el.classList.remove("open");
    el.innerHTML = "";
}

export function isResultOpen(el: HTMLElement): boolean {
    return el.classList.contains("open");
}
