import type { WordList } from "../types";
import answers from "./data/en-answers.txt?raw";
import allowed from "./data/en-allowed.txt?raw";

const lines = (raw: string) => raw.split(/\r?\n/).filter(Boolean);

export const en: WordList = { answers: lines(answers), allowed: lines(allowed) };
