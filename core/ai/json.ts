import type { ZodType } from "zod";
import { AIError } from "./types";

// Reasoning models leak chain-of-thought; free keyless endpoints sometimes append a sponsor line.
export function cleanModelText(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^.*pollinations\.ai.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// LaTeX commands whose first letter collides with a valid JSON escape (\b \f \n \r \t). A model that
// writes a single backslash would otherwise have "\frac" silently parsed as form-feed + "rac".
const LATEX_COLLIDING = new Set([
  "beta", "bar", "begin", "binom", "bigcup", "bigcap", "boldsymbol", "bf", "bmatrix", "bullet", "because", "bot", "backslash", "breve",
  "frac", "forall", "flat", "fbox", "footnotesize",
  "nabla", "neq", "ne", "nu", "notin", "neg", "not", "ni", "newcommand", "nolimits", "norm",
  "rho", "right", "rightarrow", "rangle", "rceil", "rfloor", "rm", "rightleftharpoons", "Rightarrow", "Re",
  "theta", "tau", "times", "text", "textbf", "textit", "tan", "tanh", "to", "top", "triangle", "therefore", "tilde", "tfrac", "thinspace",
]);

// Models also emit lone backslashes before non-escape letters (\sin, \lim, \displaystyle), which is invalid JSON.
export function fixLatexEscapes(text: string): string {
  return text.replace(/\\(?!u[0-9a-fA-F]{4})(?:(?:[a-zA-Z]+)|(?![a-zA-Z"\\/]))/g, (match, offset: number, whole: string) => {
    // An already-doubled backslash (\\frac) is correct: skip both characters.
    if (whole[offset - 1] === "\\") return match;
    const word = match.slice(1);
    if (!word) return "\\" + match; // "\" followed by a symbol such as ( or [ : double it
    if (/^[bfnrt]/.test(word) && !LATEX_COLLIDING.has(word)) return match; // genuine JSON escape (\n, \t ...)
    return "\\" + match;
  });
}

// Finds the first balanced JSON object/array in a model reply, tolerating ``` fences and prose.
export function extractJson(text: string): unknown {
  const cleaned = cleanModelText(text);
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], cleaned].filter((c): c is string => Boolean(c));
  for (const candidate of candidates) {
    const start = candidate.search(/[{[]/);
    if (start === -1) continue;
    const open = candidate[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < candidate.length; i++) {
      const ch = candidate[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close && --depth === 0) {
        const slice = candidate.slice(start, i + 1);
        // Repair LaTeX escapes first: "\\frac" parses fine as JSON but silently becomes form-feed + "rac".
        try {
          return JSON.parse(fixLatexEscapes(slice));
        } catch {
          try {
            return JSON.parse(slice);
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new AIError("invalid-json", "The model did not return valid JSON.");
}

export function parseJsonWith<T>(text: string, schema: ZodType<T>): T {
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) throw new AIError("invalid-json", `The JSON did not match the expected shape: ${parsed.error.message}`);
  return parsed.data;
}
