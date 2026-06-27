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
  /**
   * Creates an instance of WsJsepProtocol.
   *
   * @param {string} wsUrl The WebSocket JSEP signaling URL.
   * @param {Object} [emulator=null] Fallback emulator controller for sending events when WebRTC is unavailable.
   * @param {Object} [config={}] Configuration options.
   * @param {boolean} [config.enableLogging=false] Whether verbose signaling logging is enabled.
   */
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

  /**
   * Registers an event listener on the internal EventEmitter.
   *
   * @param {string} name Event name (e.g., "connected", "disconnected", "error").
   * @param {function} fn Callback function.
   */
  on = (name, fn) => {
    this.events.on(name, fn);
  };

  /**
   * Establishes the WebSocket connection and starts the signaling process.
   * Cleans up any existing connection beforehand.
   */
  startStream = () => {
    this.cleanup();

    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = this._handleWsMessage;
    this.ws.onclose = this._handleWsClose;
    this.ws.onerror = this._handleWsError;
  };

  /**
   * Internal handler for incoming WebSocket messages. Parses the signal
   * and queues it for sequential processing.
   *
   * @private
   * @param {MessageEvent} event The WebSocket message event.
   */
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

  /**
   * Sequentially processes JSEP signals from the queue.
   *
   * @private
   */
  _processSignalQueue = async () => {
    if (this.isProcessingSignal) return;
    this.isProcessingSignal = true;

    while (this.signalQueue.length > 0) {
      const signal = this.signalQueue.shift();
      await this._handleSignal(signal);
    }

    this.isProcessingSignal = false;
  };

  /**
   * Handles WebSocket connection close events.
   *
   * @private
   * @param {CloseEvent} event The WebSocket close event.
   */
  _handleWsClose = (event) => {
    logger.debug("WebSocket closed:", event);
    this.disconnect();
  };

  /**
   * Handles WebSocket error events.
   *
   * @private
   * @param {Event} error The WebSocket error event.
   */
  _handleWsError = (error) => {
    logger.error("WebSocket error:", error);
    this.events.emit("error", error);
    this.disconnect();
  };

  /**
   * Processes a single JSEP signal (e.g., start, offer, answer, candidate, bye).
   *
   * @private
   * @param {Object} signal The JSEP signaling message.
   */
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

  /**
   * Initializes the RTCPeerConnection and local data channels based on the start configuration.
   *
   * @private
   * @param {Object} config The signaling start configuration.
   */
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
      if (!this.peerConnection) return;

      await this.peerConnection.setLocalDescription(offer);
      if (!this.peerConnection) return;

      this._sendJsep({ sdp: offer });
    } catch (e) {
      logger.error("Failed to create or set local offer:", e);
    }
  };

  /**
   * Handles incoming media track events from the RTCPeerConnection.
   *
   * @private
   * @param {RTCTrackEvent} e The track event.
   */
  _handlePeerConnectionTrack = (e) => {
    this.events.emit("connected", e.track);
  };

  /**
   * Handles ICE candidate generation from the local RTCPeerConnection.
   *
   * @private
   * @param {RTCPeerConnectionIceEvent} e The ICE candidate event.
   */
  _handlePeerIceCandidate = (e) => {
    if (e.candidate === null) return;
    this._sendJsep({ candidate: e.candidate });
  };

  /**
   * Monitors connection state changes on the RTCPeerConnection to trigger disconnection.
   *
   * @private
   * @param {Event} e The state change event.
   */
  _handlePeerConnectionStateChange = (e) => {
    if (!this.peerConnection) return;
    switch (this.peerConnection.connectionState) {
      case "disconnected":
      case "failed":
      case "closed":
        this.disconnect();
    }
  };

  /**
   * Registers a data channel for event forwarding.
   *
   * @private
   * @param {RTCDataChannel} channel The data channel.
   */
  _setupDataChannel = (channel) => {
    this.event_forwarders[channel.label] = channel;
  };

  /**
   * Handles remote data channel creation.
   *
   * @private
   * @param {RTCDataChannelEvent} e The data channel event.
   */
  _handleDataChannel = (e) => {
    this._setupDataChannel(e.channel);
  };

  /**
   * Processes a remote SDP offer or answer, applying it to the RTCPeerConnection.
   *
   * @private
   * @param {RTCSessionDescriptionInit} sdp The session description.
   */
  _handleSDP = async (sdp) => {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
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

  /**
   * Adds a remote ICE candidate to the RTCPeerConnection.
   *
   * @private
   * @param {RTCIceCandidateInit|string} candidate The ICE candidate object or string.
   */
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

  /**
   * Handles an incoming remote ICE candidate, queueing it if the remote description is not yet set.
   *
   * @private
   * @param {RTCIceCandidateInit} candidate The remote ICE candidate.
   */
  _handleCandidate = (candidate) => {
    if (!this.peerConnection) return;
    if (!this.remoteDescriptionSet) {
      logger.debug("Queueing ICE candidate until remote description is set:", candidate);
      this.pendingCandidates.push(candidate);
    } else {
      this._addIceCandidate(candidate);
    }
  };

  /**
   * Handles the 'bye' signal from the remote side, triggering disconnection.
   *
   * @private
   */
  _handleBye = () => {
    this.disconnect();
  };

  /**
   * Serializes and sends a JSEP JSON message over the WebSocket.
   *
   * @private
   * @param {Object} jsonObject The JSON payload.
   */
  _sendJsep = (jsonObject) => {
    logger.debug("JSEP >> [Sending to Server]:", JSON.stringify(jsonObject, null, 2));
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(jsonObject));
    }
  };

  /**
   * Sends a control message (mouse, keyboard, touch) over either the corresponding
   * WebRTC DataChannel or via the fallback emulator controller.
   *
   * @param {string} label The channel label ("mouse", "keyboard", "touch").
   * @param {Object} msg The protobuf message instance.
   */
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
      logger.warn(`Data channel '${label}' is not open. Event was dropped.`);
    }
  }

  /**
   * Disconnects both the WebSocket signaling connection and the WebRTC PeerConnection.
   */
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

  /**
   * Fully cleans up signaling and WebRTC state.
   */
  cleanup = () => {
    this.disconnect();
    this.event_forwarders = {};
  };
}
