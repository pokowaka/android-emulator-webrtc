/*
 * Copyright 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * Copyright 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { EventEmitter } from "events";
import logger from "./logger";

/**
 * A JSEP protocol driver that uses WebSockets for signaling.
 *
 * @export
 * @class WsJsepProtocol
 */
export default class WsJsepProtocol {
  constructor(wsUrl, emulator = null, config = {}) {
    this.wsUrl = wsUrl;
    this.emulator = emulator;
    this.config = {
      enableLogging: false,
      ...config
    };
    this.events = new EventEmitter();
    this.connected = false;
    this.event_forwarders = {};
    this.peerConnection = null;
    this.ws = null;

    // WebRTC signaling state
    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;

    // Signaling message queue to prevent concurrent mutations
    this.signalQueue = [];
    this.isProcessingSignal = false;
  }

  on = (name, fn) => {
    this.events.on(name, fn);
  };

  startStream = () => {
    // FIX 3: Prevent Zombie connections by cleaning up first
    this.cleanup();

    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = this._handleWsMessage;
    this.ws.onclose = this._handleWsClose;
    this.ws.onerror = this._handleWsError;
  };

  _handleWsMessage = (event) => {
    try {
      const signal = JSON.parse(event.data);
      // Push to queue instead of handling immediately
      this.signalQueue.push(signal);
      this._processSignalQueue();
    } catch (e) {
      logger.error("Failed to handle WS message:", e, "Raw payload:", event.data);
    }
  };

  // NEW: Process signals strictly sequentially
  _processSignalQueue = async () => {
    if (this.isProcessingSignal) return;
    this.isProcessingSignal = true;

    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift();
      await this._handleSignal(signal);
    }

    this.isProcessingSignal = false;
  };

  _handleWsClose = (event) => {
    logger.debug("WebSocket closed:", event);
    this.disconnect();
  };

  _handleWsError = (error) => {
    logger.error("WebSocket error:", error);
    this.events.emit("error", error);
    this.disconnect();
  };

  // FIX 2: Await asynchronous handlers to prevent concurrent WebRTC state mutations
  _handleSignal = async (signal) => {
    logger.debug("JSEP << [Received from Server]:", JSON.stringify(signal, null, 2));
    
    try {
      if (signal.start) {
        await this._handleStart(signal.start);
      }
      
      if (signal.type === "offer" || signal.type === "answer") {
        await this._handleSDP(signal); // Pass the whole signal object
      } else if (signal.sdp && signal.sdp.type) {
        await this._handleSDP(signal.sdp); // Pass the nested object
      }
      
      if (signal.candidate) {
        this._handleCandidate(signal.candidate);
      }
      if (signal.bye) {
        this._handleBye();
      }
    } catch (e) {
      logger.error("Error processing signal:", e);
    }
  };

  _handleStart = async (config) => {
    const localOnlyConfig = {
      ...config,
      iceServers: []
    };

    this.peerConnection = new RTCPeerConnection(localOnlyConfig);
    this.peerConnection.ontrack = this._handlePeerConnectionTrack;
    this.peerConnection.onicecandidate = this._handlePeerIceCandidate;
    this.peerConnection.onconnectionstatechange = this._handlePeerConnectionStateChange;
    this.peerConnection.ondatachannel = this._handleDataChannel;

    this.peerConnection.addTransceiver("video", { direction: "recvonly" });
    this.peerConnection.addTransceiver("audio", { direction: "recvonly" });

    const mouse = this.peerConnection.createDataChannel("mouse");
    const keyboard = this.peerConnection.createDataChannel("keyboard");
    const touch = this.peerConnection.createDataChannel("touch");

    this._setupDataChannel(mouse);
    this._setupDataChannel(keyboard);
    this._setupDataChannel(touch);

    this.connected = true;

    try {
      const offer = await this.peerConnection.createOffer();
      // FIX 1: Check if we disconnected while yielding to createOffer
      if (!this.peerConnection) return;

      await this.peerConnection.setLocalDescription(offer);
      // FIX 1: Check again after yielding to setLocalDescription
      if (!this.peerConnection) return;

      this._sendJsep({ sdp: offer });
    } catch (e) {
      logger.error("Failed to create or set local offer:", e);
    }
  };

  _handlePeerConnectionTrack = (e) => {
    this.events.emit("connected", e.track);
  };

  _handlePeerIceCandidate = (e) => {
    if (e.candidate === null) return;
    this._sendJsep({ candidate: e.candidate });
  };

  _handlePeerConnectionStateChange = (e) => {
    if (!this.peerConnection) return;
    switch (this.peerConnection.connectionState) {
      case "disconnected":
      case "failed":
      case "closed":
        this.disconnect();
    }
  };

  _setupDataChannel = (channel) => {
    this.event_forwarders[channel.label] = channel;
  };

  _handleDataChannel = (e) => {
    this._setupDataChannel(e.channel);
  };

  _handleSDP = async (sdp) => {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      // FIX 1: Check for disconnect during setRemoteDescription
      if (!this.peerConnection) return;

      this.remoteDescriptionSet = true;

      logger.debug(`Processing ${this.pendingCandidates.length} queued ICE candidates.`);
      while (this.pendingCandidates.length > 0) {
        const candidate = this.pendingCandidates.shift();
        this._addIceCandidate(candidate);
      }

      if (sdp.type === "offer") {
        const answer = await this.peerConnection.createAnswer();
        if (!this.peerConnection) return;

        await this.peerConnection.setLocalDescription(answer);
        if (!this.peerConnection) return; 

        this._sendJsep({ sdp: answer });
      }
    } catch (e) {
      logger.error("Failed to process remote SDP:", e);
    }
  };

  _addIceCandidate = (candidate) => {
    try {
      const candidateInit = typeof candidate === 'string'
        ? { candidate: candidate, sdpMid: "0", sdpMLineIndex: 0 }
        : candidate;
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (e) {
      logger.warn("Failed to add ICE candidate:", e, candidate);
    }
  };

  _handleCandidate = (candidate) => {
    if (!this.peerConnection) return;
    if (!this.remoteDescriptionSet) {
      logger.debug("Queueing ICE candidate until remote description is set:", candidate);
      this.pendingCandidates.push(candidate);
    } else {
      this._addIceCandidate(candidate);
    }
  };

  _handleBye = () => {
    this.disconnect();
  };

  _sendJsep = (jsonObject) => {
    logger.debug("JSEP >> [Sending to Server]:", JSON.stringify(jsonObject, null, 2));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(jsonObject));
    }
  };

  send(label, msg) {
    let bytes = msg.serializeBinary();
    let forwarder = this.event_forwarders[label];
    if (this.connected && forwarder && forwarder.readyState === "open") {
      forwarder.send(bytes);
    } else if (this.emulator) {
      switch (label) {
        case "mouse":
          this.emulator.sendMouse(msg);
          break;
        case "keyboard":
          this.emulator.sendKey(msg);
          break;
        case "touch":
          this.emulator.sendTouch(msg);
          break;
      }
    } else {
      logger.warn("Data channel not open and no gRPC fallback available for " + label);
    }
  }

  disconnect = () => {
    this.connected = false;

    // Clear out signaling queue so we don't process stale messages later
    this.signalQueue = [];
    this.isProcessingSignal = false;

    if (this.ws) {
      // Unbind handlers so close/error events don't trigger recursively
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.pendingCandidates = [];
    this.remoteDescriptionSet = false;
    this.event_forwarders = {};

    this.events.emit("disconnected", this);
  };

  cleanup = () => {
    this.disconnect();
    this.event_forwarders = {};
  };
}
