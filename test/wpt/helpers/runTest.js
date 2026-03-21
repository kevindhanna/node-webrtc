/* eslint-disable no-use-before-define, func-style */
"use strict";

const fs = require("fs");

const { createWindow } = require("./createGlobals.js");
const { extractScriptsFromHtml } = require("./extractScriptsFromHtml.js");

function runTest(htmlPath) {
  return new Promise((resolve) => {
    const scripts = extractScriptsFromHtml(htmlPath);
    const { dom, window, closeAllPeerConnections } = createWindow();

    const results = { pass: 0, fail: 0, timeout: 0, notrun: 0, tests: [] };
    let resolved = false;

    function done() {
      if (resolved) return;
      resolved = true;
      clearTimeout(fileTimeout);
      process.removeListener("unhandledRejection", onUnhandled);
      process.removeListener("uncaughtException", onUncaught);
      // Close all PeerConnections before closing the window to prevent
      // segfaults from WebRTC threads accessing freed memory during exit.
      closeAllPeerConnections();
      try {
        dom.window.close();
      } catch {
        // jsdom close can throw if the window is already closed or in
        // a bad state — don't let it prevent resolve() from being called.
      }
      resolve(results);
    }

    // Catch unhandled rejections and exceptions to prevent process crash
    const onUnhandled = () => {};
    const onUncaught = () => {};
    process.on("unhandledRejection", onUnhandled);
    process.on("uncaughtException", onUncaught);

    // Timeout for the whole test file
    const timeoutMs = 30000;
    const fileTimeout = setTimeout(() => {
      results.tests.push({
        name: "(file timeout)",
        status: "TIMEOUT",
        message: `Test file exceeded ${timeoutMs / 1000}s timeout`,
      });
      results.timeout++;
      done();
    }, timeoutMs);

    try {
      // Execute scripts via jsdom's script element injection, which
      // runs them in the window's global scope (like a browser).
      function execScript(code) {
        const el = window.document.createElement("script");
        el.textContent = code;
        window.document.body.appendChild(el);
      }

      // Load scripts in order
      for (const script of scripts) {
        let code;
        if (script.type === "file") {
          code = fs.readFileSync(script.path, "utf8");
        } else {
          code = script.content;
        }
        execScript(code);

        // After testharness.js loads, set up the completion callback
        // BEFORE any test scripts run. Synchronous test() calls complete
        // during script execution, so the callback must be registered first.
        if (script.type === "file" && script.path.includes("testharness.js")) {
          /* eslint-disable camelcase */
          window._on_complete = function (tests) {
            for (const t of tests) {
              const status =
                t.status === 0
                  ? "PASS"
                  : t.status === 1
                    ? "FAIL"
                    : t.status === 2
                      ? "TIMEOUT"
                      : "NOTRUN";
              results.tests.push({
                name: t.name,
                status,
                message: t.message || "",
              });
              if (status === "PASS") results.pass++;
              else if (status === "FAIL") results.fail++;
              else if (status === "TIMEOUT") results.timeout++;
              else results.notrun++;
            }
            done();
          };
          /* eslint-enable camelcase */

          // Expose cleanup function to jsdom context
          window._closeAllPCs = closeAllPeerConnections;

          execScript(`
            setup({ output: false });
            add_completion_callback(function(tests, harness_status) {
              _on_complete(tests, harness_status);
            });
            add_result_callback(function() {
              _closeAllPCs();
            });
          `);
        }
      }
    } catch (err) {
      results.tests.push({
        name: "(load error)",
        status: "FAIL",
        message: err.message,
      });
      results.fail++;
      done();
    }
  });
}

module.exports = { runTest };
