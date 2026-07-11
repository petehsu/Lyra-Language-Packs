import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { contentHash, interpolationTokens, keysetHash, readJson, root } from "./common.mjs";

const sourceManifest = readJson(path.join(root, "source", "source-manifest.v1.json"));
const expected = Object.fromEntries(sourceManifest.entries.map(({ key, source }) => [key, source]));
const expectedKeys = Object.keys(expected).sort();
const packDirectory = path.join(root, "packs");
const baselinePath = path.join(root, "pack-baselines.json");
const baselines = existsSync(baselinePath) ? readJson(baselinePath) : { packs: {} };
const MIN_TRANSLATION_COVERAGE = 0.8;

if (sourceManifest.keysetHash !== keysetHash(expected) || sourceManifest.contentHash !== contentHash(expected)) {
  throw new Error("source manifest fingerprint is invalid");
}

if (existsSync(packDirectory)) {
  for (const file of readdirSync(packDirectory).filter((name) => name.endsWith(".json")).sort()) {
    const locale = file.slice(0, -".json".length);
    const pack = readJson(path.join(packDirectory, file));
    const actualKeys = Object.keys(pack).sort();
    if (
      actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      throw new Error(`${locale}: package keyset does not match source`);
    }
    for (const key of actualKeys) {
      if (typeof pack[key] !== "string") {
        throw new Error(`${locale}: ${key} is not a string`);
      }
      if (interpolationTokens(pack[key]).join(",") !== interpolationTokens(expected[key]).join(",")) {
        throw new Error(`${locale}: interpolation mismatch for ${key}`);
      }
      const pluralBaseKey = key.endsWith("_one") ? key.slice(0, -"_one".length) : null;
      if (
        pluralBaseKey !== null
        && expected[pluralBaseKey] !== undefined
        && pack[`${pluralBaseKey}_other`] === undefined
      ) {
        throw new Error(`${locale}: missing plural pair for ${key}`);
      }
    }
    for (const nativeKey of [
      "nativeMenu.back",
      "nativeMenu.forward",
      "nativeMenu.reload",
      "nativeMenu.copy",
      "nativeMenu.cut",
      "nativeMenu.paste",
      "nativeMenu.copyLink",
      "nativeMenu.openLinkInNewTab",
      "nativeMenu.citeSelection",
      "nativeMenu.citeLink",
      "nativeMenu.citePage"
    ]) {
      if (typeof pack[nativeKey] !== "string") {
        throw new Error(`${locale}: missing ${nativeKey}`);
      }
    }
    const unchanged = actualKeys.filter((key) => pack[key] === expected[key]);
    const coverage = 1 - unchanged.length / actualKeys.length;
    if (coverage < MIN_TRANSLATION_COVERAGE) {
      throw new Error(
        `${locale}: translation coverage ${(coverage * 100).toFixed(1)}% is below `
        + `${(MIN_TRANSLATION_COVERAGE * 100).toFixed(0)}%`
      );
    }
    const baseline = baselines.packs?.[locale];
    if (
      baseline === undefined
      || baseline.sourceContentHash !== sourceManifest.contentHash
      || baseline.keysetHash !== sourceManifest.keysetHash
    ) {
      throw new Error(`${locale}: source baseline is stale`);
    }
  }
}

console.log(`[language-packs] valid (${expectedKeys.length} keys)`);
