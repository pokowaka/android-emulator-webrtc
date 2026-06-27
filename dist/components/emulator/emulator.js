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
var _webrtc_view = _interopRequireDefault(require("./views/webrtc_view.js"));
var _event_handler = _interopRequireDefault(require("./views/event_handler"));
var _ws_jsep_protocol_driver = _interopRequireDefault(require("./net/ws_jsep_protocol_driver"));
var _emulator_controller_pb = _interopRequireDefault(require("../../proto/emulator_controller_pb"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
 * Copyright 2019 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
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

console.log("Imported WsJsepProtocol class:", _ws_jsep_protocol_driver["default"]);
var RtcView = (0, _event_handler["default"])(_webrtc_view["default"]);
var getUrls = function getUrls(uri) {
  var restBase = uri;
  if (!/^https?:\/\//i.test(uri)) {
    restBase = "http://" + uri;
  }
  var wsUrl = restBase.replace(/^http/i, "ws");
  restBase = restBase.replace(/\/$/, "");
  wsUrl = wsUrl.replace(/\/$/, "");
  return {
    status: "".concat(restBase, "/api/v1/emulator/status"),
    gps: "".concat(restBase, "/api/v1/emulator/gps"),
    jsep: "".concat(wsUrl, "/api/v1/emulator/ws-jsep")
  };
};

/**
 * A React component that displays a remote android emulator.
 *
 * The emulator will mount a webrtc view component to display the current state
 * of the emulator. It will translate mouse and touch events on this component and send them
 * to the actual emulator over WebRTC Data Channels.
 *
 * #### Authentication Service
 *
 * The authentication service should implement the following methods:
 *
 * - `authHeader()` which must return a set of headers that should be send along with a request.
 * - `unauthorized()` a function that gets called when a 401 was received.
 *
 * Note that chrome will not autoplay the video if it is not muted and no interaction
 * with the page has taken place. See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes.
 *
 * #### Pressing hardware buttons
 *
 * This component has a method `sendKey` that sends a key to the emulator.
 * You can use this to send physical button events to the emulator for example:
 *
 * "AudioVolumeDown" - 	Decreases the audio volume.
 * "AudioVolumeUp"   -	Increases the audio volume.
 * "Power"	         -  The Power button or key, turn off the device.
 * "AppSwitch"       -  Should bring up the application switcher dialog.
 * "GoHome"          -  Go to the home screen.
 * "GoBack"          -  Open the previous screen you were looking at.
 *
 * **Note**: The user must have interacted with the page before you can set the volume to "unmuted" (muted = false). Otherwise the video
 * will not play and will throw an error, which is currently not handled.
 *
 * **Note**: The volume is the volume of the video element that is displayed, this is not the actual volume used inside the emulator. You can change the audio inside the emulator by sending the proper keys as documented
 * above, or follow the steps in the [support](https://support.google.com/android/answer/9082609?hl=en) document
 * on how to change the audio volume.
 *
 */
var Emulator = /*#__PURE__*/(0, _react.forwardRef)(function (_ref, ref) {
  var uri = _ref.uri,
    _ref$auth = _ref.auth,
    auth = _ref$auth === void 0 ? null : _ref$auth,
    _ref$muted = _ref.muted,
    muted = _ref$muted === void 0 ? true : _ref$muted,
    _ref$volume = _ref.volume,
    volume = _ref$volume === void 0 ? 1.0 : _ref$volume,
    _ref$onStateChange = _ref.onStateChange,
    onStateChange = _ref$onStateChange === void 0 ? function (s) {
      console.debug("emulator state: " + s);
    } : _ref$onStateChange,
    _ref$onAudioStateChan = _ref.onAudioStateChange,
    onAudioStateChange = _ref$onAudioStateChan === void 0 ? function (s) {
      console.debug("emulator audio: " + s);
    } : _ref$onAudioStateChan,
    width = _ref.width,
    height = _ref.height,
    gps = _ref.gps,
    _ref$onError = _ref.onError,
    onError = _ref$onError === void 0 ? function (e) {
      console.error(e);
    } : _ref$onError;
  var _useState = (0, _react.useState)(false),
    _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
    audio = _useState2[0],
    setAudio = _useState2[1];
  var jsep = (0, _react.useRef)(null);
  var viewRef = (0, _react.useRef)(null);
  var onErrorRef = (0, _react.useRef)(onError);
  (0, _react.useEffect)(function () {
    onErrorRef.current = onError;
  }, [onError]);
  var urls = getUrls(uri);
  if (!jsep.current) {
    jsep.current = new _ws_jsep_protocol_driver["default"](urls.jsep);
    jsep.current.on("error", function (err) {
      if (onErrorRef.current) {
        onErrorRef.current(err);
      }
    });
    console.log("Created JSEP:", jsep.current);
  }
  (0, _react.useEffect)(function () {
    if (typeof gps === "undefined") {
      return;
    }
    var headers = {
      'Content-Type': 'application/json'
    };
    if (auth && auth.authHeader) {
      Object.assign(headers, auth.authHeader());
    }
    var body = JSON.stringify({
      latitude: gps.latitude,
      longitude: gps.longitude,
      altitude: gps.altitude,
      heading: gps.heading,
      speed: gps.speed
    });
    fetch(urls.gps, {
      method: 'POST',
      headers: headers,
      body: body
    })["catch"](function (err) {
      if (onError) onError(err);
    });
  }, [gps, uri, auth]);
  (0, _react.useEffect)(function () {
    return function () {
      if (jsep.current) {
        jsep.current.cleanup();
      }
    };
  }, []);
  (0, _react.useImperativeHandle)(ref, function () {
    return {
      sendKey: function sendKey(key) {
        var request = new _emulator_controller_pb["default"].KeyboardEvent();
        request.setEventtype(_emulator_controller_pb["default"].KeyboardEvent.KeyEventType.KEYPRESS);
        request.setKey(key);
        jsep.current.send("keyboard", request);
      }
    };
  });
  var _onAudioStateChange = function _onAudioStateChange(s) {
    setAudio(s);
    onAudioStateChange(s);
  };
  console.log("render ".concat(width, "x").concat(height));
  return /*#__PURE__*/_react["default"].createElement(RtcView, {
    ref: viewRef,
    width: width,
    height: height,
    statusUrl: urls.status,
    jsep: jsep.current,
    onStateChange: onStateChange,
    muted: muted,
    volume: volume,
    onError: onError,
    onAudioStateChange: _onAudioStateChange,
    auth: auth
  });
});
Emulator.propTypes = {
  /** Endpoint where we can reach the emulator gateway (host:port or http(s)://host:port). */
  uri: _propTypes["default"].string.isRequired,
  /** The authentication service to use, or null for no authentication. */
  auth: _propTypes["default"].object,
  /** True if the audio should be disabled. */
  muted: _propTypes["default"].bool,
  /** Volume between [0, 1] when audio is enabled. 0 is muted, 1.0 is 100% */
  volume: _propTypes["default"].number,
  /** Called upon state change, one of ["connecting", "connected", "disconnected"] */
  onStateChange: _propTypes["default"].func,
  /** Called when the audio becomes (un)available. True if audio is available, false otherwise. */
  onAudioStateChange: _propTypes["default"].func,
  /** The width of the component */
  width: _propTypes["default"].number,
  /** The height of the component */
  height: _propTypes["default"].number,
  /** A [GeolocationCoordinates](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates) like object indicating where the device is. */
  gps: _propTypes["default"].object,
  /** Callback that will be invoked in case of errors. */
  onError: _propTypes["default"].func
};
var _default = Emulator;
exports["default"] = _default;