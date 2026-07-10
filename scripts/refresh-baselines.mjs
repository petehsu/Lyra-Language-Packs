import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

import { readJson, root } from "./common.mjs";

const sourcePath = path.join(root, "source", "source-manifest.v1.json");
const source = readJson(sourcePath);
const locales = ["ja-JP", "ko-KR"];
const baselines = {
  schemaVersion: 1,
  packs: Object.fromEntries(locales.map((locale) => [
    locale,
    {
      sourceContentHash: source.contentHash,
      keysetHash: source.keysetHash
    }
  ]))
};

mkdirSync(path.join(root, "source", "baselines"), { recursive: true });
for (const locale of locales) {
  copyFileSync(sourcePath, path.join(root, "source", "baselines", `${locale}.source-manifest.v1.json`));
}
writeFileSync(path.join(root, "pack-baselines.json"), `${JSON.stringify(baselines, null, 2)}\n`, "utf8");
