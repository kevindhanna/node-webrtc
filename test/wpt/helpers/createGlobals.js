/* eslint-disable no-undef */
"use strict";

const { JSDOM } = require("jsdom");
const wrtc = require("../../..");

function createWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://localhost/",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });

  const window = dom.window;

  // Track all PeerConnections so we can close them on cleanup
  const peerConnections = [];

  // Inject WebRTC APIs from node-webrtc, wrapping RTCPeerConnection
  // to track instances for cleanup.
  const OriginalRTCPeerConnection = wrtc.RTCPeerConnection;
  window.RTCPeerConnection = function RTCPeerConnection(config, constraints) {
    const pc = new OriginalRTCPeerConnection(config, constraints);
    peerConnections.push(pc);
    return pc;
  };
  window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
  window.RTCPeerConnection.generateCertificate =
    OriginalRTCPeerConnection.generateCertificate;
  window.RTCSessionDescription = wrtc.RTCSessionDescription;
  window.RTCIceCandidate = wrtc.RTCIceCandidate;
  window.RTCDataChannel = wrtc.RTCDataChannel;
  window.RTCDataChannelEvent = wrtc.RTCDataChannelEvent;
  window.RTCRtpSender = wrtc.RTCRtpSender;
  window.RTCRtpReceiver = wrtc.RTCRtpReceiver;
  window.RTCRtpTransceiver = wrtc.RTCRtpTransceiver;
  window.RTCDtlsTransport = wrtc.RTCDtlsTransport;
  window.RTCIceTransport = wrtc.RTCIceTransport;
  window.RTCSctpTransport = wrtc.RTCSctpTransport;
  window.RTCPeerConnectionIceEvent = wrtc.RTCPeerConnectionIceEvent;
  window.RTCPeerConnectionIceErrorEvent = wrtc.RTCPeerConnectionIceErrorEvent;
  window.MediaStream = wrtc.MediaStream;
  window.MediaStreamTrack = wrtc.MediaStreamTrack;

  if (wrtc.mediaDevices) {
    window.navigator.mediaDevices = wrtc.mediaDevices;
  }

  // Use Node's built-in error types so that instanceof checks in
  // testharness.js match errors thrown by node-webrtc's C++ layer
  // (which creates errors in Node's realm, not jsdom's).
  window.TypeError = TypeError;
  window.RangeError = RangeError;
  window.ArrayBuffer = ArrayBuffer;
  window.Uint8Array = Uint8Array;
  window.Blob = Blob;
  window.structuredClone = structuredClone;
  if (typeof gc === "function") {
    window.gc = gc;
  }

  // Discover the DOMException constructor that node-webrtc's NAPI layer
  // actually uses (which may differ from globalThis.DOMException) by
  // triggering an error and capturing its constructor.
  try {
    const pc = new wrtc.RTCPeerConnection();
    const dc = pc.createDataChannel("_probe");
    try {
      dc.send("_probe");
    } catch (e) {
      if (e.constructor.name === "DOMException") {
        window.DOMException = e.constructor;
      }
    }
    pc.close();
  } catch {
    window.DOMException = globalThis.DOMException;
  }

  function closeAllPeerConnections() {
    for (const pc of peerConnections) {
      try {
        if (pc.connectionState !== "closed") pc.close();
      } catch {
        // ignore — PC may already be in a bad state
      }
    }
    peerConnections.length = 0;
  }

  // Close PCs that have network activity (ICE pool or active
  // connections) to prevent resource accumulation between subtests.
  // PCs still in "new" state with no pool are left alive — some WPT
  // tests reuse an idle PC across subtests (e.g. window.pc in
  // RTCPeerConnection-constructor).
  function closeBusyPeerConnections() {
    for (let i = peerConnections.length - 1; i >= 0; i--) {
      try {
        const pc = peerConnections[i];
        if (pc.connectionState === "closed") {
          peerConnections.splice(i, 1);
          continue;
        }
        const config = pc.getConfiguration();
        const hasPool = config && config.iceCandidatePoolSize > 0;
        const hasActivity = pc.connectionState !== "new";
        if (hasPool || hasActivity) {
          pc.close();
          peerConnections.splice(i, 1);
        }
      } catch {
        peerConnections.splice(i, 1);
      }
    }
  }

  return { dom, window, closeAllPeerConnections, closeBusyPeerConnections };
}

module.exports = { createWindow };
