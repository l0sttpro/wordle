import { MIN_WORD_LENGTH, MAX_WORD_LENGTH, MODES } from "../config";
import type { Language, WordList, WordPool } from "../types";
import { en } from "./en";
import { af } from "./af";

const lists: Record<Language, WordList> = { en, af };

// Lowercase, and strip diacritics: "môre" becomes "more", "reën" becomes "reen".
export function normalize(word: string): string {
    return word
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

const cache = new Map<string, WordPool>();

export function getWords(lang: Language, length: number): WordPool {
    const key = `${lang}:${length}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const ok = (w: string) => w.length === length && /^[a-z]+$/.test(w);
    const list = lists[lang];
    const answers = [...new Set(list.answers.map(normalize).filter(ok))];
    const valid = new Set([...answers, ...list.allowed.map(normalize).filter(ok)]);

    const pool = { answers, valid };
    cache.set(key, pool);
    return pool;
}

// Lengths that have enough answers to fill the biggest mode (quordle needs 4).
export function availableLengths(lang: Language): number[] {
    const needed = Math.max(...Object.values(MODES).map((m) => m.boards));
    const out: number[] = [];
    for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) {
        if (getWords(lang, n).answers.length >= needed) out.push(n);
    }
    return out;
}
