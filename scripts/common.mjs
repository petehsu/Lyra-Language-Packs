import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

export const stableEntries = (value) =>
  Object.entries(value).sort(([left], [right]) => left.localeCompare(right));

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const keysetHash = (value) => sha256(stableEntries(value).map(([key]) => key).join("\n"));

export const contentHash = (value) => sha256(JSON.stringify(stableEntries(value)));

export const interpolationTokens = (value) =>
  Array.from(value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g), (match) => match[1]).sort();
