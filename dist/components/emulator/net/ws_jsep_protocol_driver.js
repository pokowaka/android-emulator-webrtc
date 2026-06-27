"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));
var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; } /*
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             */ /*
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
/**
 * A JSEP protocol driver that uses WebSockets for signaling.
 *
 * @export
 * @class WsJsepProtocol
 */
var WsJsepProtocol = /*#__PURE__*/function () {
  function WsJsepProtocol(wsUrl) {
    var _this = this;
    var emulator = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    (0, _classCallCheck2["default"])(this, WsJsepProtocol);
    (0, _defineProperty2["default"])(this, "on", function (name, fn) {
      _this.events.on(name, fn);
    });
    (0, _defineProperty2["default"])(this, "startStream", function () {
      // FIX 3: Prevent Zombie connections by cleaning up first
      _this.cleanup();
      _this.ws = new WebSocket(_this.wsUrl);
      _this.ws.onmessage = _this._handleWsMessage;
      _this.ws.onclose = _this._handleWsClose;
      _this.ws.onerror = _this._handleWsError;
    });
    (0, _defineProperty2["default"])(this, "_handleWsMessage", function (event) {
      try {
        var signal = JSON.parse(event.data);
        // Push to queue instead of handling immediately
        _this.signalQueue.push(signal);
        _this._processSignalQueue();
      } catch (e) {
        console.error("Failed to handle WS message:", e, "Raw payload:", event.data);
      }
    });
    // NEW: Process signals strictly sequentially
    (0, _defineProperty2["default"])(this, "_processSignalQueue", /*#__PURE__*/(0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee() {
      var signal;
      return _regenerator["default"].wrap(function _callee$(_context) {
        while (1) switch (_context.prev = _context.next) {
          case 0:
            if (!_this.isProcessingSignal) {
              _context.next = 2;
              break;
            }
            return _context.abrupt("return");
          case 2:
            _this.isProcessingSignal = true;
          case 3:
            if (!(_this.signalQueue.length > 0)) {
              _context.next = 9;
              break;
            }
            signal = _this.signalQueue.shift();
            _context.next = 7;
            return _this._handleSignal(signal);
          case 7:
            _context.next = 3;
            break;
          case 9:
            _this.isProcessingSignal = false;
          case 10:
          case "end":
            return _context.stop();
        }
      }, _callee);
    })));
    (0, _defineProperty2["default"])(this, "_handleWsClose", function (event) {
      console.log("WebSocket closed:", event);
      _this.disconnect();
    });
    (0, _defineProperty2["default"])(this, "_handleWsError", function (error) {
      console.error("WebSocket error:", error);
      _this.events.emit("error", error);
      _this.disconnect();
    });
    // FIX 2: Await asynchronous handlers to prevent concurrent WebRTC state mutations
    (0, _defineProperty2["default"])(this, "_handleSignal", /*#__PURE__*/function () {
      var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(signal) {
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              console.log("JSEP << [Received from Server]:", JSON.stringify(signal, null, 2));
              _context2.prev = 1;
              if (!signal.start) {
                _context2.next = 5;
                break;
              }
              _context2.next = 5;
              return _this._handleStart(signal.start);
            case 5:
              if (!(signal.type === "offer" || signal.type === "answer")) {
                _context2.next = 10;
                break;
              }
              _context2.next = 8;
              return _this._handleSDP(signal);
            case 8:
              _context2.next = 13;
              break;
            case 10:
              if (!(signal.sdp && signal.sdp.type)) {
                _context2.next = 13;
                break;
              }
              _context2.next = 13;
              return _this._handleSDP(signal.sdp);
            case 13:
              if (signal.candidate) {
                _this._handleCandidate(signal.candidate);
              }
              if (signal.bye) {
                _this._handleBye();
              }
              _context2.next = 20;
              break;
            case 17:
              _context2.prev = 17;
              _context2.t0 = _context2["catch"](1);
              console.error("Error processing signal:", _context2.t0);
            case 20:
            case "end":
              return _context2.stop();
          }
        }, _callee2, null, [[1, 17]]);
      }));
      return function (_x) {
        return _ref2.apply(this, arguments);
      };
    }());
    (0, _defineProperty2["default"])(this, "_handleStart", /*#__PURE__*/function () {
      var _ref3 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(config) {
        var localOnlyConfig, mouse, keyboard, touch, offer;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              localOnlyConfig = _objectSpread(_objectSpread({}, config), {}, {
                iceServers: []
              });
              _this.peerConnection = new RTCPeerConnection(localOnlyConfig);
              _this.peerConnection.ontrack = _this._handlePeerConnectionTrack;
              _this.peerConnection.onicecandidate = _this._handlePeerIceCandidate;
              _this.peerConnection.onconnectionstatechange = _this._handlePeerConnectionStateChange;
              _this.peerConnection.ondatachannel = _this._handleDataChannel;
              _this.peerConnection.addTransceiver("video", {
                direction: "recvonly"
              });
              _this.peerConnection.addTransceiver("audio", {
                direction: "recvonly"
              });
              mouse = _this.peerConnection.createDataChannel("mouse");
              keyboard = _this.peerConnection.createDataChannel("keyboard");
              touch = _this.peerConnection.createDataChannel("touch");
              _this._setupDataChannel(mouse);
              _this._setupDataChannel(keyboard);
              _this._setupDataChannel(touch);
              _this.connected = true;
              _context3.prev = 15;
              _context3.next = 18;
              return _this.peerConnection.createOffer();
            case 18:
              offer = _context3.sent;
              if (_this.peerConnection) {
                _context3.next = 21;
                break;
              }
              return _context3.abrupt("return");
            case 21:
              _context3.next = 23;
              return _this.peerConnection.setLocalDescription(offer);
            case 23:
              if (_this.peerConnection) {
                _context3.next = 25;
                break;
              }
              return _context3.abrupt("return");
            case 25:
              _this._sendJsep({
                sdp: offer
              });
              _context3.next = 31;
              break;
            case 28:
              _context3.prev = 28;
              _context3.t0 = _context3["catch"](15);
              console.error("Failed to create or set local offer:", _context3.t0);
            case 31:
            case "end":
              return _context3.stop();
          }
        }, _callee3, null, [[15, 28]]);
      }));
      return function (_x2) {
        return _ref3.apply(this, arguments);
      };
    }());
    (0, _defineProperty2["default"])(this, "_handlePeerConnectionTrack", function (e) {
      _this.events.emit("connected", e.track);
    });
    (0, _defineProperty2["default"])(this, "_handlePeerIceCandidate", function (e) {
      if (e.candidate === null) return;
      _this._sendJsep({
        candidate: e.candidate
      });
    });
    (0, _defineProperty2["default"])(this, "_handlePeerConnectionStateChange", function (e) {
      if (!_this.peerConnection) return;
      switch (_this.peerConnection.connectionState) {
        case "disconnected":
        case "failed":
        case "closed":
          _this.disconnect();
      }
    });
    (0, _defineProperty2["default"])(this, "_setupDataChannel", function (channel) {
      _this.event_forwarders[channel.label] = channel;
    });
    (0, _defineProperty2["default"])(this, "_handleDataChannel", function (e) {
      _this._setupDataChannel(e.channel);
    });
    (0, _defineProperty2["default"])(this, "_handleSDP", /*#__PURE__*/function () {
      var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(sdp) {
        var candidate, answer;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              if (_this.peerConnection) {
                _context4.next = 2;
                break;
              }
              return _context4.abrupt("return");
            case 2:
              _context4.prev = 2;
              _context4.next = 5;
              return _this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
            case 5:
              if (_this.peerConnection) {
                _context4.next = 7;
                break;
              }
              return _context4.abrupt("return");
            case 7:
              _this.remoteDescriptionSet = true;
              console.log("Processing ".concat(_this.pendingCandidates.length, " queued ICE candidates."));
              while (_this.pendingCandidates.length > 0) {
                candidate = _this.pendingCandidates.shift();
                _this._addIceCandidate(candidate);
              }
              if (!(sdp.type === "offer")) {
                _context4.next = 21;
                break;
              }
              _context4.next = 13;
              return _this.peerConnection.createAnswer();
            case 13:
              answer = _context4.sent;
              if (_this.peerConnection) {
                _context4.next = 16;
                break;
              }
              return _context4.abrupt("return");
            case 16:
              _context4.next = 18;
              return _this.peerConnection.setLocalDescription(answer);
            case 18:
              if (_this.peerConnection) {
                _context4.next = 20;
                break;
              }
              return _context4.abrupt("return");
            case 20:
              _this._sendJsep({
                sdp: answer
              });
            case 21:
              _context4.next = 26;
              break;
            case 23:
              _context4.prev = 23;
              _context4.t0 = _context4["catch"](2);
              console.error("Failed to process remote SDP:", _context4.t0);
            case 26:
            case "end":
              return _context4.stop();
          }
        }, _callee4, null, [[2, 23]]);
      }));
      return function (_x3) {
        return _ref4.apply(this, arguments);
      };
    }());
    (0, _defineProperty2["default"])(this, "_addIceCandidate", function (candidate) {
      try {
        var candidateInit = typeof candidate === 'string' ? {
          candidate: candidate,
          sdpMid: "0",
          sdpMLineIndex: 0
        } : candidate;
        _this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (e) {
        console.warn("Failed to add ICE candidate:", e, candidate);
      }
    });
    (0, _defineProperty2["default"])(this, "_handleCandidate", function (candidate) {
      if (!_this.peerConnection) return;
      if (!_this.remoteDescriptionSet) {
        console.log("Queueing ICE candidate until remote description is set:", candidate);
        _this.pendingCandidates.push(candidate);
      } else {
        _this._addIceCandidate(candidate);
      }
    });
    (0, _defineProperty2["default"])(this, "_handleBye", function () {
      _this.disconnect();
    });
    (0, _defineProperty2["default"])(this, "_sendJsep", function (jsonObject) {
      console.log("JSEP >> [Sending to Server]:", JSON.stringify(jsonObject, null, 2));
      if (_this.ws && _this.ws.readyState === WebSocket.OPEN) {
        _this.ws.send(JSON.stringify(jsonObject));
      }
    });
    (0, _defineProperty2["default"])(this, "disconnect", function () {
      _this.connected = false;

      // Clear out signaling queue so we don't process stale messages later
      _this.signalQueue = [];
      _this.isProcessingSignal = false;
      if (_this.ws) {
        // Unbind handlers so close/error events don't trigger recursively
        _this.ws.onclose = null;
        _this.ws.onerror = null;
        _this.ws.onmessage = null;
        _this.ws.close();
        _this.ws = null;
      }
      if (_this.peerConnection) {
        _this.peerConnection.close();
        _this.peerConnection = null;
      }
      _this.pendingCandidates = [];
      _this.remoteDescriptionSet = false;
      _this.event_forwarders = {};
      _this.events.emit("disconnected", _this);
    });
    (0, _defineProperty2["default"])(this, "cleanup", function () {
      _this.disconnect();
      _this.event_forwarders = {};
    });
    this.wsUrl = wsUrl;
    this.emulator = emulator;
    this.events = new _events.EventEmitter();
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
  (0, _createClass2["default"])(WsJsepProtocol, [{
    key: "send",
    value: function send(label, msg) {
      var bytes = msg.serializeBinary();
      var forwarder = this.event_forwarders[label];
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
        console.warn("Data channel not open and no gRPC fallback available for " + label);
      }
    }
  }]);
  return WsJsepProtocol;
}();
exports["default"] = WsJsepProtocol;