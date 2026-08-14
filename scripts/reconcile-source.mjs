import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { contentHash, interpolationTokens, keysetHash, readJson, root } from "./common.mjs";

const manifestPath = process.argv[2];
if (typeof manifestPath !== "string" || manifestPath.trim().length === 0) {
  throw new Error("usage: node scripts/reconcile-source.mjs <source-manifest.v1.json>");
}

const nextManifest = JSON.parse(readFileSync(path.resolve(manifestPath), "utf8"));
const nextSource = Object.fromEntries(
  nextManifest.entries.map(({ key, source }) => [key, source])
);
if (
  nextManifest.keysetHash !== keysetHash(nextSource)
  || nextManifest.contentHash !== contentHash(nextSource)
) {
  throw new Error("incoming source manifest fingerprint is invalid");
}

const metadataPath = path.join(root, "pack-metadata.json");
const baselinesPath = path.join(root, "pack-baselines.json");
const metadata = readJson(metadataPath);
const baselines = readJson(baselinesPath);

const bumpPatch = (version) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) {
    throw new Error(`cannot bump non-semver language-pack version: ${version}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
};

for (const locale of Object.keys(metadata).sort()) {
  const packPath = path.join(root, "packs", `${locale}.json`);
  const baselinePath = path.join(
    root,
    "source",
    "baselines",
    `${locale}.source-manifest.v1.json`
  );
  const pack = readJson(packPath);
  const baseline = readJson(baselinePath);
  const previousSource = new Map(
    baseline.entries.map(({ key, source }) => [key, source])
  );
  const nextPack = {};
  let changed = false;

  for (const { key, source } of nextManifest.entries) {
    const existing = pack[key];
    const sourceUnchanged = previousSource.get(key) === source;
    const tokensCompatible = typeof existing === "string"
      && interpolationTokens(existing).join(",") === interpolationTokens(source).join(",");
    const value = sourceUnchanged && tokensCompatible ? existing : source;
    nextPack[key] = value;
    changed = changed || value !== existing;
  }
  changed = changed || Object.keys(pack).length !== Object.keys(nextPack).length;
  if (changed) {
    metadata[locale] = {
      ...metadata[locale],
      version: bumpPatch(metadata[locale].version)
    };
  }
  writeFileSync(packPath, `${JSON.stringify(nextPack, null, 2)}\n`, "utf8");
  writeFileSync(baselinePath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");
  baselines.packs[locale] = {
    sourceContentHash: nextManifest.contentHash,
    keysetHash: nextManifest.keysetHash
  };
}

writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
writeFileSync(baselinesPath, `${JSON.stringify(baselines, null, 2)}\n`, "utf8");
writeFileSync(
  path.join(root, "source", "source-manifest.v1.json"),
  `${JSON.stringify(nextManifest, null, 2)}\n`,
  "utf8"
);

console.log(
  `[language-packs] reconciled ${Object.keys(metadata).length} packs to ${nextManifest.contentHash}`
);
