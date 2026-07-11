# Lyra Language Packs

This public repository publishes the only remote language packs trusted by Lyra Desktop.

Clients download assets exclusively from GitHub Releases and verify every catalog and
pack asset with the Ed25519 public key embedded in Lyra. A package is a flat JSON map
of all UI and native-menu keys. It never contains executable code.

## Translation flow

1. A Lyra `main` change dispatches its source commit and manifest hash here.
2. The dispatch workflow checks out that exact source commit and opens or updates one
   `needs-update` issue for each affected language.
3. Translation work happens in a pull request. CI checks the full keyset, interpolation
   variables, plural pairs, native-menu keys, and source baseline.
4. `petehsu` reviews and merges the PR. Only then may `petehsu` run the signed release
   workflow on `main`.

`ja-JP` and `ko-KR` drafts are intentionally kept in pull requests until reviewed. A
draft is not an Official Release and is never shown by the desktop client's catalog.

To start a translation update branch, sync the source snapshot from the commit in its
`needs-update` issue, then refresh only the translated locale's baseline after updating
the package:

```sh
node scripts/sync-source-manifest.mjs <lyra-commit-sha>
node scripts/refresh-baselines.mjs ja-JP
```

## Release assets

Each release contains:

- `catalog.json` and `catalog.json.sig`
- `{locale}.json` and `{locale}.json.sig` for every published pack

The signing private key is stored only in the `LYRA_LANGUAGE_PACKS_ED25519_PRIVATE_KEY`
GitHub Actions secret. The public key is in Lyra Desktop.
