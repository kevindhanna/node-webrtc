#!/usr/bin/env node
/* eslint-disable no-console, no-process-exit, func-style, new-cap */
"use strict";

const fs = require("fs");
const path = require("path");
const { runTest } = require("./helpers/runTest");

const SNAPSHOT_PATH = path.join(__dirname, "expected.json");

// Prevent stray errors from WPT tests crashing the runner process.
// Individual test errors are caught by runTest's handlers, but some
// can escape (e.g. ICE candidates arriving on closed PeerConnections
// from a previous test).
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

// --- Snapshot ---

function loadSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveSnapshot(allResults) {
  const snapshot = {};
  for (const [file, tests] of Object.entries(allResults)) {
    snapshot[file] = {};
    for (const t of tests) {
      snapshot[file][t.name] = t.status;
    }
  }
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
}

// --- Formatting ---

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

function formatFileResult(index, total, name, r) {
  const tag = r.fail === 0 && r.timeout === 0 ? GREEN("PASS") : RED("FAIL");
  return `[${index}/${total}] ${tag} ${name} (${r.pass} pass, ${r.fail} fail, ${r.timeout} timeout, ${r.notrun} notrun)`;
}

// --- Comparison ---

function compareWithSnapshot(snapshot, name, tests) {
  const expected = snapshot[name];
  if (!expected) return { regressions: [], improvements: [] };

  const regressions = [];
  const improvements = [];

  for (const t of tests) {
    const prev = expected[t.name];
    if (!prev) continue;
    if (prev === "PASS" && t.status !== "PASS") {
      regressions.push({ test: t.name, was: prev, now: t.status });
    } else if (prev !== "PASS" && t.status === "PASS") {
      improvements.push({ test: t.name, was: prev, now: t.status });
    }
  }

  return { regressions, improvements };
}

// --- Resolve test files ---

function resolveTestFiles(fileArgs) {
  const wptDir = path.join(__dirname, "webrtc");
  if (fileArgs.length > 0) {
    return fileArgs.map((a) => {
      if (path.isAbsolute(a)) return a;
      if (fs.existsSync(a)) return a;
      return path.join(wptDir, a);
    });
  }
  return fs
    .readdirSync(wptDir)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .map((f) => path.join(wptDir, f));
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const update = args.includes("--update");
  const testFiles = resolveTestFiles(args.filter((a) => a !== "--update"));

  const snapshot = update ? null : loadSnapshot();
  if (snapshot) {
    console.log("Comparing against expected.json snapshot\n");
  } else if (!update) {
    console.log("No snapshot found — run with --update to create one\n");
  }

  console.log(`Running ${testFiles.length} WPT test files...\n`);

  let totalPass = 0;
  let totalFail = 0;
  let totalTimeout = 0;
  let totalNotrun = 0;
  let totalRegressions = 0;
  let totalImprovements = 0;
  const allResults = {};

  for (let i = 0; i < testFiles.length; i++) {
    const name = path.basename(testFiles[i], ".html");
    let r;
    try {
      r = await runTest(testFiles[i]);
    } catch (err) {
      r = {
        pass: 0,
        fail: 1,
        timeout: 0,
        notrun: 0,
        tests: [
          { name: "(runner error)", status: "FAIL", message: err.message },
        ],
      };
    }
    allResults[name] = r.tests;

    console.log(formatFileResult(i + 1, testFiles.length, name, r));

    if (snapshot) {
      const { regressions, improvements } = compareWithSnapshot(
        snapshot,
        name,
        r.tests,
      );
      for (const reg of regressions) {
        console.log(
          `  ${RED("REGRESSION")}: ${reg.test} (was ${reg.was}, now ${reg.now})`,
        );
      }
      for (const imp of improvements) {
        console.log(
          `  ${GREEN("IMPROVED")}: ${imp.test} (was ${imp.was}, now ${imp.now})`,
        );
      }
      totalRegressions += regressions.length;
      totalImprovements += improvements.length;
    } else if (!update && (r.fail > 0 || r.timeout > 0)) {
      for (const t of r.tests) {
        if (t.status !== "PASS" && t.status !== "NOTRUN") {
          console.log(`  ${t.status}: ${t.name}`);
          if (t.message) console.log(`    ${t.message.slice(0, 200)}`);
        }
      }
    }

    totalPass += r.pass;
    totalFail += r.fail;
    totalTimeout += r.timeout;
    totalNotrun += r.notrun;
  }

  // --- Summary ---
  console.log(
    `\n--- Summary ---\n${totalPass} pass, ${totalFail} fail, ${totalTimeout} timeout, ${totalNotrun} notrun`,
  );
  console.log(`${testFiles.length} test files`);

  if (snapshot) {
    const regMsg =
      totalRegressions > 0 ? RED(totalRegressions) : totalRegressions;
    const impMsg =
      totalImprovements > 0 ? GREEN(totalImprovements) : totalImprovements;
    console.log(`${regMsg} regressions, ${impMsg} improvements`);
  }

  if (update) {
    saveSnapshot(allResults);
    console.log(YELLOW(`\nSnapshot saved to ${SNAPSHOT_PATH}`));
    process.exit(0);
  }

  if (totalRegressions > 0) {
    console.log(RED("\nRegressions detected!"));
    process.exit(1);
  }

  if (!snapshot && (totalFail > 0 || totalTimeout > 0)) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
