// Runs React Native's codegen the way Xcode's "[CP-User] Generate Specs" phase
// runs it (generate-codegen-artifacts.js --targetPlatform ios) for this app,
// whose package.json declares one TurboModule spec (specs/NativeSample.ts),
// with TMPDIR/TEMP/TMP pointed at an empty folder, then lists that folder.
// Exit: 1 = codegen left folders in the temp folder, 0 = it left none,
//       2 = a step before the check failed.
'use strict';

const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = __dirname;

function fail(message) {
  console.log(`ERROR: ${message}`);
  process.exit(2);
}

function countFiles(directory) {
  let count = 0;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const entryPath = path.join(directory, entry.name);
    count += entry.isDirectory() ? countFiles(entryPath) : 1;
  }
  return count;
}

let reactNativeVersion;
let script;
try {
  script = require.resolve('react-native/scripts/generate-codegen-artifacts', {
    paths: [projectRoot],
  });
  const packageJson = path.join(path.dirname(script), '..', 'package.json');
  reactNativeVersion = JSON.parse(fs.readFileSync(packageJson, 'utf8')).version;
} catch (error) {
  fail(`react-native is not installed here (run yarn install): ${error.message}`);
}
console.log(
  `react-native ${reactNativeVersion}, node ${process.version}, ${os.platform()} ${os.release()} ${os.arch()}`,
);

const temporaryFolder = fs.mkdtempSync(
  path.join(os.tmpdir(), 'codegen-tmpdir-repro-'),
);
const outputFolder = fs.mkdtempSync(
  path.join(os.tmpdir(), 'codegen-tmpdir-repro-output-'),
);

let exitCode = 2;
try {
  const args = [
    script,
    '--path',
    projectRoot,
    '--outputPath',
    outputFolder,
    '--targetPlatform',
    'ios',
  ];
  console.log('TMPDIR, TEMP and TMP set to an empty folder');
  console.log(
    '$ node react-native/scripts/generate-codegen-artifacts.js --path . --outputPath <output> --targetPlatform ios',
  );
  const run = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TMPDIR: temporaryFolder,
      TEMP: temporaryFolder,
      TMP: temporaryFolder,
    },
  });
  const generatedLines = `${run.stdout}${run.stderr}`
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .filter(line => /Generating Native Code|Generated artifacts:/.test(line));
  for (const line of generatedLines) {
    console.log(`  ${line.trim().split(outputFolder).join('<output>')}`);
  }
  if (run.status !== 0) {
    console.log(run.stdout, run.stderr);
    throw new Error(`codegen exited with status ${run.status}`);
  }

  const generatedFolder = path.join(
    outputFolder,
    'build',
    'generated',
    'ios',
    'ReactCodegen',
    'AppSpecs',
  );
  if (!fs.existsSync(generatedFolder)) {
    throw new Error(`codegen wrote no AppSpecs folder at ${generatedFolder}`);
  }
  console.log(
    `codegen exited 0 and wrote ${countFiles(generatedFolder)} files to <output>/build/generated/ios/ReactCodegen/AppSpecs`,
  );

  const leftBehind = fs.readdirSync(temporaryFolder);
  console.log(`TMPDIR after the run holds ${leftBehind.length} entries`);
  for (const name of leftBehind) {
    const entryPath = path.join(temporaryFolder, name);
    const files = fs.statSync(entryPath).isDirectory() ? countFiles(entryPath) : 1;
    console.log(`  ${name} (${files} files)`);
  }
  if (leftBehind.length > 0) {
    console.log(
      `DEFECT: codegen left ${leftBehind.length} temporary folder(s) in TMPDIR after it exited`,
    );
    exitCode = 1;
  } else {
    console.log('OK: codegen left nothing in TMPDIR');
    exitCode = 0;
  }
} catch (error) {
  console.log(`ERROR: ${error.message}`);
  exitCode = 2;
} finally {
  fs.rmSync(temporaryFolder, {recursive: true, force: true});
  fs.rmSync(outputFolder, {recursive: true, force: true});
}
process.exit(exitCode);
