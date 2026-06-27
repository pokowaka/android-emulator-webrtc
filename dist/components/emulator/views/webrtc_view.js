"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _react = _interopRequireWildcard(require("react"));
var _logger = _interopRequireDefault(require("../net/logger"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
 * Copyright 2019 The Android Open Source Project
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
 * A React component that renders the WebRTC video stream of the emulator.
 * Handles establishing the stream via the JSEP protocol driver and managing
 * local playback (including handling autoplay constraints).
 *
 * @param {Object} props Component properties.
 * @param {Object} props.jsep The JSEP protocol driver instance.
 * @param {function(string): void} [props.onStateChange] Callback for connection state changes ("connecting", "connected", "disconnected").
 * @param {function(boolean): void} [props.onAudioStateChange] Callback when audio track status changes.
 * @param {boolean} [props.muted=true] Whether the audio should be muted.
 * @param {number} [props.volume=1.0] Audio volume (between 0.0 and 1.0).
 * @param {function(Error): void} props.onError Callback invoked on signaling or playback errors.
 * @param {number} [props.width] Component width.
 * @param {number} [props.height] Component height.
 */
var EmulatorWebrtcView = function EmulatorWebrtcView(_ref) {
  var jsep = _ref.jsep,
    onStateChange = _ref.onStateChange,
    onAudioStateChange = _ref.onAudioStateChange,
    _ref$muted = _ref.muted,
    muted = _ref$muted === void 0 ? true : _ref$muted,
    _ref$volume = _ref.volume,
    volume = _ref$volume === void 0 ? 1.0 : _ref$volume,
    _ref$onError = _ref.onError,
    onError = _ref$onError === void 0 ? function (e) {
      return _logger["default"].error("WebRTC error: " + e);
    } : _ref$onError,
    width = _ref.width,
    height = _ref.height;
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    audio = _useState2[0],
    setAudio = _useState2[1];
  var videoRef = (0, _react.useRef)(null);
  var _useState3 = (0, _react.useState)("connecting"),
    _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
    connect = _useState4[0],
    setConnect = _useState4[1];
  (0, _react.useEffect)(function () {
    if (onStateChange) {
      onStateChange(connect);
    }
  }, [connect]);
  (0, _react.useEffect)(function () {
    if (onAudioStateChange) {
      onAudioStateChange(audio);
    }
  }, [audio]);
  var onDisconnect = function onDisconnect() {
    setConnect("disconnected");
    setAudio(false);
  };
  var onConnect = function onConnect(track) {
    setConnect("connected");
    var video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }
    if (!video.srcObject) {
      video.srcObject = new MediaStream();
    }
    video.srcObject.addTrack(track);
    if (track.kind === "audio") {
      setAudio(true);
    }
  };
  var safePlay = function safePlay() {
    var video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }
    var possiblePromise = video.play();
    if (possiblePromise) {
      possiblePromise.then(function (_) {
        _logger["default"].debug("Automatic playback started!");
      })["catch"](function (error) {
        // Notify listeners that we cannot start.
        onError(error);
      });
    }
  };
  var onCanPlay = function onCanPlay() {
    safePlay();
  };
  var onContextMenu = function onContextMenu(e) {
    e.preventDefault();
  };
  (0, _react.useEffect)(function () {
    jsep.on("connected", onConnect);
    jsep.on("disconnected", onDisconnect);
    jsep.startStream();
    setConnect("connecting");
    return function () {
      jsep.disconnect();
    };
  }, []);
  return /*#__PURE__*/_react["default"].createElement("video", {
    ref: videoRef,
    style: {
      display: "block",
      position: "relative",
      width: width ? "".concat(width, "px") : "100%",
      height: height ? "".concat(height, "px") : "100%",
      objectFit: "contain",
      objectPosition: "center"
    },
    volume: volume,
    muted: muted,
    onContextMenu: onContextMenu,
    onCanPlay: onCanPlay
  });
};
EmulatorWebrtcView.propTypes = {
  jsep: _propTypes["default"].object,
  onStateChange: _propTypes["default"].func,
  onAudioStateChange: _propTypes["default"].func,
  muted: _propTypes["default"].bool,
  volume: _propTypes["default"].number,
  onError: _propTypes["default"].func,
  width: _propTypes["default"].number,
  height: _propTypes["default"].number
};
var _default = exports["default"] = EmulatorWebrtcView;