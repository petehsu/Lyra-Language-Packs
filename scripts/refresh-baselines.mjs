import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";

import { readJson, root } from "./common.mjs";

const sourcePath = path.join(root, "source", "source-manifest.v1.json");
const source = readJson(sourcePath);
const locales = process.argv.slice(2);
const selectedLocales = locales.length === 0 ? ["ja-JP", "ko-KR"] : locales;
const current = readJson(path.join(root, "pack-baselines.json"));
const baselines = {
  schemaVersion: 1,
  packs: {
    ...(current.packs ?? {}),
    ...Object.fromEntries(selectedLocales.map((locale) => [
      locale,
      {
        sourceContentHash: source.contentHash,
        keysetHash: source.keysetHash
      }
    ]))
  }
};

mkdirSync(path.join(root, "source", "baselines"), { recursive: true });
for (const locale of selectedLocales) {
  copyFileSync(sourcePath, path.join(root, "source", "baselines", `${locale}.source-manifest.v1.json`));
}
writeFileSync(path.join(root, "pack-baselines.json"), `${JSON.stringify(baselines, null, 2)}\n`, "utf8");
