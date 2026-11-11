# Mobile design assets

Files under `generated/` are copied from the local IntelliDeploy design package by
`scripts/extract-mobile-design-evidence.mjs`.

The generator walks only the approved `375x812` frame subtrees, resolves each
Figma image hash through `design-data/raw-assets.json`, and copies the matching
original file from `raw-assets/`. Do not replace these files with crops from the
full-page PNG or PDF exports, and do not edit generated files by hand.

The generated TypeScript manifest records the originating node ID and node name
for every image paint. Re-run the generator after an approved frame or source
asset changes.
