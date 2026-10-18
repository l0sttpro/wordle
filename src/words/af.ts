import type { WordList } from "../types";
import answers from "./data/af-answers.txt?raw";
import allowed from "./data/af-allowed.txt?raw";

const lines = (raw: string) => raw.split(/\r?\n/).filter(Boolean);

export const af: WordList = { answers: lines(answers), allowed: lines(allowed) };
