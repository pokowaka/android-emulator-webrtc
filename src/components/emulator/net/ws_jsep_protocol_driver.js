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

/**
 * A JSEP protocol driver that uses WebSockets for signaling.
 *
 * @export
 * @class WsJsepProtocol
 */
export default class WsJsepProtocol {
  constructor(wsUrl, emulator = null) {
    this.wsUrl = wsUrl;
    this.emulator = emulator;
    this.events = new EventEmitter();
    this.connected = false;
    this.event_forwarders = {};
    this.peerConnection = null;
    this.ws = null;
  }

  on = (name, fn) => {
    this.events.on(name, fn);
  };

  startStream = () => {
    this.connected = false;
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onmessage = this._handleWsMessage;
    this.ws.onclose = this._handleWsClose;
    this.ws.onerror = this._handleWsError;
  };

  _handleWsMessage = (event) => {
    try {
      const signal = JSON.parse(event.data);
      this._handleSignal(signal);
    } catch (e) {
      console.error("Failed to handle WS message:", e);
    }
  };

  _handleWsClose = (event) => {
    console.log("WebSocket closed:", event);
    this.disconnect();
  };

  _handleWsError = (error) => {
    console.error("WebSocket error:", error);
    this.events.emit("error", error);
    this.disconnect();
  };

  _handleSignal = (signal) => {
    if (signal.start) {
      this._handleStart(signal.start);
    }
    if (signal.sdp) {
      this._handleSDP(signal.sdp);
    }
    if (signal.candidate) {
      this._handleCandidate(signal.candidate);
    }
    if (signal.bye) {
      this._handleBye();
    }
  };

  _handleStart = (config) => {
    this.peerConnection = new RTCPeerConnection(config);
    this.peerConnection.ontrack = this._handlePeerConnectionTrack;
    this.peerConnection.onicecandidate = this._handlePeerIceCandidate;
    this.peerConnection.onconnectionstatechange = this._handlePeerConnectionStateChange;
    this.peerConnection.ondatachannel = this._handleDataChannel;
    this.connected = true;
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

  _handleDataChannel = (e) => {
    let channel = e.channel;
    this.event_forwarders[channel.label] = channel;
  };

  _handleSDP = async (sdp) => {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    if (sdp.type === "offer") {
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this._sendJsep({ sdp: answer });
    }
  };

  _handleCandidate = (candidate) => {
    if (!this.peerConnection) return;
    this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  };

  _handleBye = () => {
    this.disconnect();
  };

  _sendJsep = (jsonObject) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(jsonObject));
    }
  };

  send(label, msg) {
    let bytes = msg.serializeBinary();
    let forwarder = this.event_forwarders[label];
    if (this.connected && forwarder && forwarder.readyState == "open") {
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
      console.warn("Data channel not open and no gRPC fallback available for " + label);
    }
  }

  disconnect = () => {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.event_forwarders = {};
    this.events.emit("disconnected", this);
  };

  cleanup = () => {
    this.disconnect();
    this.event_forwarders = {};
  };
}
