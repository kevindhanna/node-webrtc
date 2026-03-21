#!/usr/bin/env node
/* eslint no-console:0, no-process-exit:0 */
"use strict";

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const pkg = require("../package.json");
const version = pkg.version;
const triple = `${os.platform()}-${os.arch()}`;
const filename = `wrtc-${triple}.node`;

const repo = "kevindhanna/node-webrtc";
const url = `https://github.com/${repo}/releases/download/v${version}/${filename}`;

const outputDir = path.join(__dirname, "..", "prebuilds", triple);
const outputPath = path.join(outputDir, "wrtc.node");

// Skip if the binary already exists (e.g. local build)
if (fs.existsSync(outputPath)) {
  console.log(`wrtc: prebuilt binary already exists at ${outputPath}`);
  process.exit(0);
}

function download(targetUrl, dest, redirects) {
  if (typeof redirects !== "number") redirects = 5;
  if (redirects <= 0) {
    console.error("wrtc: too many redirects");
    process.exit(1);
  }

  var proto = targetUrl.startsWith("https") ? https : http;
  proto
    .get(
      targetUrl,
      { headers: { "User-Agent": "node-webrtc" } },
      function (res) {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          download(res.headers.location, dest, redirects - 1);
          return;
        }

        if (res.statusCode !== 200) {
          console.error(
            "wrtc: failed to download prebuilt binary for " +
              triple +
              " (HTTP " +
              res.statusCode +
              ")",
          );
          console.error("wrtc: tried " + targetUrl);
          console.error(
            "wrtc: falling back to build from source (npm run build)",
          );
          process.exit(0);
        }

        fs.mkdirSync(path.dirname(dest), { recursive: true });
        var file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", function () {
          file.close();
          console.log("wrtc: downloaded prebuilt binary for " + triple);
        });
      },
    )
    .on("error", function (err) {
      console.error("wrtc: download error: " + err.message);
      console.error("wrtc: falling back to build from source (npm run build)");
      process.exit(0);
    });
}

download(url, outputPath);
