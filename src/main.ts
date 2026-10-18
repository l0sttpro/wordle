import "./style.css";
import { DEFAULT_WORD_LENGTH } from "./config";
import { Game } from "./game/state";
import { availableLengths, getWords } from "./words";
import { renderBoards } from "./ui/board";
import { renderKeyboard } from "./ui/keyboard";
import { hideResult, isResultOpen, showResult } from "./ui/result";
import type { GameModeName, Language, Settings } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <h1>word<span>le</span></h1>
    <div id="controls"></div>
  </header>
  <p id="status" aria-live="polite"></p>
  <main id="boards"></main>
  <div id="keyboard"></div>
  <div id="toast" role="status"></div>
  <div id="modal" class="modal"></div>
`;

const controlsEl = document.querySelector<HTMLElement>("#controls")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const boardsEl = document.querySelector<HTMLElement>("#boards")!;
const keysEl = document.querySelector<HTMLElement>("#keyboard")!;
const toastEl = document.querySelector<HTMLElement>("#toast")!;
const modalEl = document.querySelector<HTMLElement>("#modal")!;

const settings: Settings = {
    language: "en",
    mode: "wordle",
    wordLength: DEFAULT_WORD_LENGTH,
    daily: false,
};

let game: Game;
let gameId = 0; // bumped on every new game so old timers can tell they are stale
let busy = false; // true while the tiles are flipping
let toastTimer: number | undefined;

// ---------- game lifecycle ----------

function dailySeed(): string {
    const d = new Date();
    const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return `${day}|${settings.language}|${settings.mode}|${settings.wordLength}`;
}

function newGame(): void {
    const lengths = availableLengths(settings.language);
    if (!lengths.includes(settings.wordLength)) {
        settings.wordLength = lengths.includes(DEFAULT_WORD_LENGTH)
            ? DEFAULT_WORD_LENGTH
            : lengths[0];
    }

    const pool = getWords(settings.language, settings.wordLength);
    game = new Game(settings, pool, settings.daily ? dailySeed() : undefined);
    gameId++;
    busy = false;
    hideResult(modalEl);

    drawControls();
    drawBoards();
    drawKeys();
    drawStatus();
}

function openResult(): void {
    showResult(modalEl, game, newGame);
}

// ---------- input ----------

function handleKey(key: string): void {
    if (busy || game.status !== "playing") return;

    if (key === "Enter") {
        const result = game.submit();
        if (result === "short") {
            toast("Too short");
            shake();
            return;
        }
        if (result === "invalid") {
            toast("Not in word list");
            shake();
            return;
        }
        reveal();
        return;
    }

    if (key === "Backspace") game.removeLetter();
    else game.addLetter(key.toLowerCase());
    drawBoards();
}

function reveal(): void {
    const id = gameId;
    const row = game.guesses.length - 1;
    busy = true;
    drawBoards(row);

    // After the flip finishes: update keyboard and status, bounce solved boards,
    // and open the result modal if the game is over.
    window.setTimeout(() => {
        if (id !== gameId) return; // a new game started in the meantime
        busy = false;
        drawKeys();
        drawStatus();

        const solvedNow = bounce(row);
        if (game.status !== "playing") {
            window.setTimeout(() => {
                if (id === gameId) openResult();
            }, solvedNow ? 900 : 400);
        }
    }, game.settings.wordLength * 120 + 500);
}

// Bounce the tiles of every board that was solved by this guess.
function bounce(row: number): boolean {
    let any = false;
    game.solvedAt.forEach((solvedAt, b) => {
        if (solvedAt !== row) return;
        any = true;
        const tiles = boardsEl.children[b]?.children[row]?.children;
        if (!tiles) return;
        Array.from(tiles).forEach((tile, i) => {
            const el = tile as HTMLElement;
            el.style.animationDelay = `${i * 80}ms`;
            el.classList.add("bounce");
        });
    });
    return any;
}

// Shake the row being typed in (on every active board).
function shake(): void {
    boardsEl.querySelectorAll<HTMLElement>(".row.current").forEach((row) => {
        row.classList.remove("shake");
        void row.offsetWidth; // forces a reflow so the animation can restart
        row.classList.add("shake");
    });
}

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "SELECT") return;

    if (isResultOpen(modalEl)) {
        if (e.key === "Escape") hideResult(modalEl);
        else if (e.key === "Enter" && tag !== "BUTTON") {
            e.preventDefault();
            newGame();
        }
        return;
    }

    if (e.key === "Enter" || e.key === "Backspace" || /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKey(e.key);
    }
});

// ---------- drawing ----------

function option(value: string, label: string, selected: boolean): string {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
}

function drawControls(): void {
    const lengths = availableLengths(settings.language);
    controlsEl.innerHTML = `
    <select id="sel-lang" aria-label="Language">
      ${option("en", "English", settings.language === "en")}
      ${option("af", "Afrikaans", settings.language === "af")}
    </select>
    <select id="sel-mode" aria-label="Mode">
      ${option("wordle", "Wordle", settings.mode === "wordle")}
      ${option("quordle", "Quordle", settings.mode === "quordle")}
    </select>
    <select id="sel-len" aria-label="Word length">
      ${lengths.map((n) => option(String(n), `${n} letters`, n === settings.wordLength)).join("")}
    </select>
    <select id="sel-play" aria-label="Play type">
      ${option("random", "Random", !settings.daily)}
      ${option("daily", "Daily", settings.daily)}
    </select>
    <button id="btn-new">New game</button>
  `;
}

function drawBoards(revealRow = -1): void {
    renderBoards(boardsEl, game, revealRow);
}

function drawKeys(): void {
    renderKeyboard(keysEl, game, handleKey);
}

function drawStatus(): void {
    if (game.status === "won") {
        statusEl.textContent = `Solved in ${game.guesses.length} guesses`;
    } else if (game.status === "lost") {
        statusEl.textContent = `Out of guesses. Answer: ${game.targets.join(", ").toUpperCase()}`;
    } else {
        const daily = settings.daily ? " · daily" : "";
        statusEl.textContent = `${game.guesses.length} / ${game.maxGuesses} guesses${daily}`;
    }
}

function toast(message: string): void {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 1400);
}

// ---------- controls (event delegation, survives re-rendering) ----------

controlsEl.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id === "sel-lang") settings.language = t.value as Language;
    else if (t.id === "sel-mode") settings.mode = t.value as GameModeName;
    else if (t.id === "sel-len") settings.wordLength = Number(t.value);
    else if (t.id === "sel-play") settings.daily = t.value === "daily";
    t.blur();
    newGame();
});

controlsEl.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "btn-new") {
        t.blur();
        newGame();
    }
});

newGame();
