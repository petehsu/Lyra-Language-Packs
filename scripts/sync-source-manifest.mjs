import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { root } from "./common.mjs";

const commit = process.argv[2];
if (typeof commit !== "string" || /^[a-f0-9]{7,64}$/iu.test(commit) === false) {
  throw new Error("usage: node scripts/sync-source-manifest.mjs <Lyra commit SHA>");
}

const url =
  `https://raw.githubusercontent.com/petehsu/Lyra/${commit}/language-packs/source-manifest.v1.json`;
const response = await fetch(url);
if (response.ok === false) {
  throw new Error(`failed to fetch source manifest (${response.status})`);
}
const manifest = await response.text();
JSON.parse(manifest);
const target = path.join(root, "source", "source-manifest.v1.json");
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, manifest.endsWith("\n") ? manifest : `${manifest}\n`, "utf8");
console.log(`[language-packs] synced source manifest from ${commit}`);
