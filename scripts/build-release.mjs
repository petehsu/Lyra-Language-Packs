import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { sign } from "node:crypto";
import path from "node:path";

import { contentHash, keysetHash, readJson, root, sha256 } from "./common.mjs";

const outIndex = process.argv.indexOf("--out");
const outDir = path.resolve(root, outIndex === -1 ? "dist" : process.argv[outIndex + 1] ?? "dist");
const privateKey = process.env.LYRA_LANGUAGE_PACKS_ED25519_PRIVATE_KEY;
if (typeof privateKey !== "string" || privateKey.trim().length === 0) {
  throw new Error("LYRA_LANGUAGE_PACKS_ED25519_PRIVATE_KEY is required");
}

const sourceManifest = readJson(path.join(root, "source", "source-manifest.v1.json"));
const metadata = readJson(path.join(root, "pack-metadata.json"));
const packBaselines = readJson(path.join(root, "pack-baselines.json"));
const source = Object.fromEntries(sourceManifest.entries.map(({ key, source: value }) => [key, value]));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const signFile = (filePath) => {
  const signature = sign(null, readFileSync(filePath), privateKey).toString("base64");
  writeFileSync(`${filePath}.sig`, `${signature}\n`, "utf8");
};

const packs = [];
for (const locale of Object.keys(metadata).sort()) {
  const file = `${locale}.json`;
  const sourcePath = path.join(root, "packs", file);
  const targetPath = path.join(outDir, file);
  const pack = readJson(sourcePath);
  if (keysetHash(pack) !== sourceManifest.keysetHash || Object.keys(pack).length !== Object.keys(source).length) {
    throw new Error(`${locale}: pack keyset does not match source`);
  }
  const baseline = packBaselines.packs?.[locale];
  if (
    baseline?.sourceContentHash !== sourceManifest.contentHash
    || baseline?.keysetHash !== sourceManifest.keysetHash
  ) {
    throw new Error(`${locale}: pack baseline is stale`);
  }
  copyFileSync(sourcePath, targetPath);
  packs.push({
    locale,
    ...metadata[locale],
    sourceContentHash: sourceManifest.contentHash,
    keysetHash: sourceManifest.keysetHash,
    sha256: sha256(readFileSync(targetPath)),
    asset: file,
    signature: `${file}.sig`
  });
  signFile(targetPath);
}

const catalog = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  packs
};
const catalogPath = path.join(outDir, "catalog.json");
writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
signFile(catalogPath);

console.log(`[language-packs] release assets built in ${outDir}`);
