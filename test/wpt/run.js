#!/usr/bin/env node
/* eslint-disable no-console, no-process-exit, func-style, new-cap */
"use strict";

// Re-exec with --unhandled-rejections=none if not already set.
// WPT tests produce unhandled rejections from leaked PeerConnections
// that would crash Node 24+ without this flag.
if (!process.execArgv.includes("--unhandled-rejections=none")) {
  const { execFileSync } = require("child_process");
  try {
    execFileSync(
      process.execPath,
      [
        "--unhandled-rejections=none",
        ...process.execArgv,
        __filename,
        ...process.argv.slice(2),
      ],
      { stdio: "inherit" },
    );
  } catch (e) {
    process.exit(e.status || 1);
  }
  process.exit(0);
}

const fs = require("fs");
const path = require("path");
const { runTest } = require("./helpers/runTest");

const SNAPSHOT_PATH = path.join(__dirname, "expected.json");

// Belt-and-suspenders: catch anything that escapes.
process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

// --- Colours ---

const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const DIM = (s) => `\x1b[2m${s}\x1b[0m`;

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
      regressions.push({
        test: t.name,
        was: prev,
        now: t.status,
        message: t.message,
      });
    } else if (prev !== "PASS" && t.status === "PASS") {
      improvements.push({ test: t.name, was: prev, now: t.status });
    }
  }

  return { regressions, improvements };
}

// --- Printing ---

function printFileResult(index, total, name, r) {
  const tag = r.fail === 0 && r.timeout === 0 ? GREEN("PASS") : RED("FAIL");
  console.log(
    `[${index}/${total}] ${tag} ${name} (${r.pass} pass, ${r.fail} fail, ${r.timeout} timeout, ${r.notrun} notrun)`,
  );
}

function printFailures(r) {
  for (const t of r.tests) {
    if (t.status === "PASS" || t.status === "NOTRUN") continue;
    console.log(`    ${t.status}: ${t.name}`);
    if (t.message) console.log(`      ${DIM(t.message.slice(0, 200))}`);
  }
}

function printDiff(regressions, improvements) {
  for (const reg of regressions) {
    console.log(
      `    ${RED("REGRESSION")}: ${reg.test} (was ${reg.was}, now ${reg.now})`,
    );
    if (reg.message) console.log(`      ${DIM(reg.message.slice(0, 200))}`);
  }
  for (const imp of improvements) {
    console.log(
      `    ${GREEN("IMPROVED")}: ${imp.test} (was ${imp.was}, now ${imp.now})`,
    );
  }
}

function printSummary(totals, snapshot) {
  console.log(
    `\n--- Summary ---\n${totals.pass} pass, ${totals.fail} fail, ${totals.timeout} timeout, ${totals.notrun} notrun`,
  );
  console.log(`${totals.files} test files`);

  if (snapshot) {
    const regMsg =
      totals.regressions > 0 ? RED(totals.regressions) : totals.regressions;
    const impMsg =
      totals.improvements > 0
        ? GREEN(totals.improvements)
        : totals.improvements;
    console.log(`${regMsg} regressions, ${impMsg} improvements`);
  }
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

  const totals = {
    pass: 0,
    fail: 0,
    timeout: 0,
    notrun: 0,
    files: testFiles.length,
    regressions: 0,
    improvements: 0,
  };
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

    printFileResult(i + 1, testFiles.length, name, r);

    if (r.fail > 0 || r.timeout > 0) {
      printFailures(r);
    }

    if (snapshot) {
      const diff = compareWithSnapshot(snapshot, name, r.tests);
      if (diff.regressions.length > 0 || diff.improvements.length > 0) {
        printDiff(diff.regressions, diff.improvements);
      }
      totals.regressions += diff.regressions.length;
      totals.improvements += diff.improvements.length;
    }

    totals.pass += r.pass;
    totals.fail += r.fail;
    totals.timeout += r.timeout;
    totals.notrun += r.notrun;
  }

  printSummary(totals, snapshot);

  if (update) {
    saveSnapshot(allResults);
    console.log(YELLOW(`\nSnapshot saved to ${SNAPSHOT_PATH}`));
    process.exit(0);
  }

  if (totals.regressions > 0) {
    console.log(RED("\nRegressions detected!"));
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
