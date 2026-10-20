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

const STORAGE_KEY = "wordle-state-v1";

const settings: Settings = {
    language: "en",
    mode: "wordle",
    wordLength: DEFAULT_WORD_LENGTH,
    daily: false,
};

interface SavedGameState {
    seed?: string;
    targets: string[];
    guesses: string[];
    current: string;
}

interface SavedState {
    settings?: Partial<Settings>;
    game?: SavedGameState;
}

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

function isWord(value: string, len: number): boolean {
    return /^[a-z]+$/.test(value) && value.length === len;
}

function computeSolvedAt(targets: string[], guesses: string[]): (number | null)[] {
    return targets.map((target) => {
        const guessAt = guesses.findIndex((guess) => guess === target);
        return guessAt === -1 ? null : guessAt;
    });
}

function loadSavedState(): SavedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!parsed || typeof parsed !== "object") return null;

        const out: SavedState = {};

        const savedSettings = parsed.settings as Record<string, unknown> | undefined;
        if (savedSettings && typeof savedSettings === "object") {
            out.settings = {};
            if (savedSettings.language === "en" || savedSettings.language === "af") {
                out.settings.language = savedSettings.language;
            }
            if (savedSettings.mode === "wordle" || savedSettings.mode === "quordle") {
                out.settings.mode = savedSettings.mode;
            }
            if (typeof savedSettings.wordLength === "number") {
                out.settings.wordLength = savedSettings.wordLength;
            }
            if (typeof savedSettings.daily === "boolean") {
                out.settings.daily = savedSettings.daily;
            }
        }

        const savedGame = parsed.game as Record<string, unknown> | undefined;
        if (
            savedGame &&
            typeof savedGame === "object" &&
            Array.isArray(savedGame.targets) &&
            Array.isArray(savedGame.guesses) &&
            typeof savedGame.current === "string" &&
            savedGame.targets.every((word) => typeof word === "string") &&
            savedGame.guesses.every((word) => typeof word === "string") &&
            (savedGame.seed === undefined || typeof savedGame.seed === "string")
        ) {
            out.game = {
                seed: savedGame.seed as string | undefined,
                targets: savedGame.targets as string[],
                guesses: savedGame.guesses as string[],
                current: savedGame.current
            };
        }

        return out;
    } catch {
        return null;
    }
}

function saveState(): void {
    if (!game) return;
    const state: SavedState = {
        settings: { ...settings },
        game: {
            seed: settings.daily ? dailySeed() : undefined,
            targets: [...game.targets],
            guesses: [...game.guesses],
            current: game.current
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function restoreGame(
    savedGame: SavedGameState,
    seed: string | undefined,
    answers: string[],
    valid: Set<string>
): boolean {
    const len = settings.wordLength;
    const answerSet = new Set(answers);

    if (settings.daily && savedGame.seed !== seed) return false;
    if (savedGame.targets.length !== game.boardCount) return false;
    if (savedGame.guesses.length > game.maxGuesses) return false;
    if (!savedGame.targets.every((word) => isWord(word, len) && answerSet.has(word))) return false;
    if (!savedGame.guesses.every((word) => isWord(word, len))) return false;
    if (!savedGame.guesses.every((word) => valid.has(word))) return false;
    if (!/^[a-z]*$/.test(savedGame.current) || savedGame.current.length > len) return false;

    game.targets.splice(0, game.targets.length, ...savedGame.targets);
    game.guesses.push(...savedGame.guesses);
    game.solvedAt.splice(0, game.solvedAt.length, ...computeSolvedAt(savedGame.targets, savedGame.guesses));
    game.current = game.status === "playing" ? savedGame.current : "";
    return true;
}

function newGame(savedGame?: SavedGameState): void {
    const lengths = availableLengths(settings.language);
    if (!lengths.includes(settings.wordLength)) {
        settings.wordLength = lengths.includes(DEFAULT_WORD_LENGTH)
            ? DEFAULT_WORD_LENGTH
            : lengths[0];
    }

    const pool = getWords(settings.language, settings.wordLength);
    const seed = settings.daily ? dailySeed() : undefined;
    game = new Game(settings, pool, seed);
    if (savedGame) restoreGame(savedGame, seed, pool.answers, pool.valid);
    gameId++;
    busy = false;
    hideResult(modalEl);

    drawControls();
    drawBoards();
    drawKeys();
    drawStatus();
    saveState();
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
        saveState();
        reveal();
        return;
    }

    if (key === "Backspace") game.removeLetter();
    else game.addLetter(key.toLowerCase());
    drawBoards();
    saveState();
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

const saved = loadSavedState();
if (saved?.settings) Object.assign(settings, saved.settings);
newGame(saved?.game);
