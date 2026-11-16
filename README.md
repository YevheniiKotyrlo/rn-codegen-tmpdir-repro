# rn-codegen-tmpdir-repro

ReproducerApp on React Native `0.88.1`, with one app-level TurboModule spec:

- `ReproducerApp/package.json` declares `codegenConfig` (`AppSpecs`, `jsSrcsDir: specs`).
- `ReproducerApp/specs/NativeSample.ts` is the spec.
- `ReproducerApp/repro.js` runs `react-native/scripts/generate-codegen-artifacts.js --path . --outputPath <output> --targetPlatform ios`, the command Xcode's `[CP-User] Generate Specs` phase runs, with `TMPDIR`, `TEMP` and `TMP` pointed at an empty folder, and lists that folder after the codegen exits.

## Reproduce

```bash
cd ReproducerApp
yarn install
node repro.js
```

It exits 1 while the codegen leaves folders in the temporary folder, 0 once it leaves none, and 2 when a step before the check fails.

Expected: the temporary folder is empty after the codegen exits. Seen: one folder per codegen library (`AppSpecsXXXXXX`, `safeareacontextXXXXXX`), each holding a copy of that library's generated code.

The same folders are left in the Mac's `$TMPDIR` by `cd ios && bundle exec pod install` and by every Xcode build of the app.
