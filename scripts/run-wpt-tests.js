#!/usr/bin/env node
/* eslint-disable no-console, no-process-exit */
"use strict";

const { execSync } = require("child_process");
const path = require("path");

// Ensure WPT tests are downloaded
execSync("bash test/wpt/setup.sh", { stdio: "inherit" });

// Tests categorised by current pass rate.
// Updated: 2026-03-20 against M114 (branch-heads/5735)

// All subtests pass
const ALL_PASS = [
  "RTCIceConnectionState-candidate-pair.https.html",
  "RTCPeerConnection-add-track-no-deadlock.https.html",
  "RTCPeerConnection-addIceCandidate-connectionSetup.html",
  "RTCPeerConnection-candidate-in-sdp.https.html",
  "RTCPeerConnection-createAnswer.html",
  "RTCPeerConnection-getTransceivers.html",
  "RTCPeerConnection-helper-test.html",
  "RTCPeerConnection-removeTrack.https.html",
  "RTCPeerConnection-setDescription-transceiver.html",
  "RTCPeerConnection-setLocalDescription-pranswer.html",
  "RTCPeerConnection-setLocalDescription.html",
  "RTCPeerConnection-setRemoteDescription-answer.html",
  "RTCPeerConnection-setRemoteDescription-nomsid.html",
  "RTCPeerConnection-setRemoteDescription-pranswer.html",
  "RTCPeerConnectionIceErrorEvent.html",
  "RTCRtpReceiver-getCapabilities.html",
  "RTCRtpReceiver-getContributingSources.https.html",
  "RTCRtpSender-getCapabilities.html",
  "RTCRtpSender-getParameters.html",
  "RTCRtpSender-transport.https.html",
  "RTCRtpTransceiver-direction.html",
  "RTCRtpTransceiver-stop.html",
  "RTCSctpTransport-constructor.html",
  "RTCSctpTransport-maxChannels.html",
  "RTCConfiguration-iceCandidatePoolSize.html",
  "RTCConfiguration-rtcpMuxPolicy.html",
  "RTCPeerConnection-constructor.html",
  "getstats.html",
  "no-media-call.html",
  "toJSON.html",
];

// Some subtests pass, some fail
const RUNNABLE = [
  "RTCConfiguration-bundlePolicy.html",
  "RTCConfiguration-iceServers.html",
  "RTCConfiguration-iceTransportPolicy.html",
  "RTCConfiguration-validation.html",
  "RTCDataChannel-close.html",
  "RTCDataChannel-GC.html",
  "RTCDataChannel-id.html",
  "RTCDataChannel-iceRestart.html",
  "RTCDataChannel-send.html",
  "RTCDataChannelEvent-constructor.html",
  "RTCDataChannelInit-maxPacketLifeTime-enforce-range.html",
  "RTCDataChannelInit-maxRetransmits-enforce-range.html",
  "RTCIceCandidate-constructor.html",
  "RTCPeerConnection-addIceCandidate-timing.https.html",
  "RTCPeerConnection-addTrack.https.html",
  "RTCPeerConnection-addTransceiver.https.html",
  "RTCPeerConnection-connectionState.https.html",
  "RTCPeerConnection-createDataChannel.html",
  "RTCPeerConnection-createOffer.html",
  "RTCPeerConnection-explicit-rollback-iceGatheringState.html",
  "RTCPeerConnection-generateCertificate.html",
  "RTCPeerConnection-getStats-timestamp.https.html",
  "RTCPeerConnection-iceConnectionState.https.html",
  "RTCPeerConnection-iceGatheringState.html",
  "RTCPeerConnection-ondatachannel.html",
  "RTCPeerConnection-onicecandidateerror.https.html",
  "RTCPeerConnection-onnegotiationneeded.html",
  "RTCPeerConnection-onsignalingstatechanged.https.html",
  "RTCPeerConnection-ontrack.https.html",
  "RTCPeerConnection-remote-track-properties.https.html",
  "RTCPeerConnection-operations.https.html",
  "RTCPeerConnection-restartIce.https.html",
  "RTCPeerConnection-setLocalDescription-answer.html",
  "RTCPeerConnection-setLocalDescription-offer.html",
  "RTCPeerConnection-setLocalDescription-parameterless.https.html",
  "RTCPeerConnection-setLocalDescription-rollback.html",
  "RTCPeerConnection-setRemoteDescription-offer.html",
  "RTCPeerConnection-setRemoteDescription-replaceTrack.https.html",
  "RTCPeerConnection-setRemoteDescription-rollback.html",
  "RTCPeerConnection-setRemoteDescription.html",
  "RTCPeerConnection-transceivers.https.html",
  "RTCPeerConnectionIceEvent-constructor.html",
  "RTCRtpParameters-codecs.html",
  "RTCRtpParameters-encodings.html",
  "RTCRtpParameters-maxFramerate.html",
  "RTCRtpParameters-transactionId.html",
  "RTCRtpReceiver-getParameters.html",
  "RTCRtpReceiver.https.html",
  "RTCRtpSender-setParameters.html",
  "RTCRtpSender.https.html",
  "RTCRtpTransceiver-setCodecPreferences.html",
  "historical.html",
];

// eslint-disable-next-line no-unused-vars
const EXCLUDED = [
  // (empty — previously excluded tests now pass after fixing ICE pool
  // cleanup in Close(); see RTCPeerConnection::Close() in C++)
];

const sets = {
  "all-pass": ALL_PASS,
  runnable: RUNNABLE,
  all: [...ALL_PASS, ...RUNNABLE],
};
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node scripts/wpt.js [all-pass|runnable|all|FILE...]");
  console.log(
    "  all-pass   - only tests where every subtest passes (" +
      ALL_PASS.length +
      " files)",
  );
  console.log(
    "  runnable  - tests that complete without hanging (" +
      RUNNABLE.length +
      " files)",
  );
  console.log(
    "  all        - both sets (default, " +
      (ALL_PASS.length + RUNNABLE.length) +
      " files)",
  );
  console.log(
    "  FILE...    - specific test filenames (e.g. RTCDataChannel-send.html)",
  );
  console.log("\nFlags:");
  console.log(
    "  --update   - update expected.json snapshot with current results",
  );
  process.exit(0);
}

const update = args.includes("--update");
const filteredArgs = args.filter((a) => a !== "--update");

let files;
if (filteredArgs.length === 0) {
  files = sets.all;
} else if (sets[filteredArgs[0]]) {
  files = sets[filteredArgs[0]];
} else {
  files = filteredArgs;
}

const runner = path.join(__dirname, "..", "test", "wpt", "run.js");
const flags = update ? "--update" : "";
try {
  execSync(
    `node --expose-gc --unhandled-rejections=none ${runner} ${flags} ${files.join(" ")}`,
    { stdio: "inherit" },
  );
} catch (e) {
  if (e.signal) {
    console.error(`\nWPT runner killed by signal: ${e.signal}`);
  } else if (e.status) {
    // Normal exit with non-zero status (regressions detected)
  } else {
    console.error(`\nWPT runner error: ${e.message}`);
  }
  process.exit(e.status || 1);
}
