"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _events = require("events");
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
/**
 * Observe the logcat stream from the emulator.
 *
 * Streaming is done by polling the emulator REST endpoint.
 *
 * It will send out the following events:
 *
 * - `start` whenever the start method was called.
 * - `data` whenever new data became available.
 * - `end` whenever the stream is finished, either because it was stopped, or due to an error.
 */
var Logcat = /*#__PURE__*/(0, _createClass2["default"])(
/**
 * Creates a logcat stream.
 *
 *  The authentication service should implement the following methods:
 * - `authHeader()` which must return a set of headers that should be send along with a request.
 * - `unauthorized()` a function that gets called when a 401 was received.
 *
 * @constructor
 * @param {string} logcatUrl Full REST URL to the logcat endpoint.
 * @param {object} auth Authentication helper.
 */
function Logcat(logcatUrl, auth) {
  var _this = this;
  (0, _classCallCheck2["default"])(this, Logcat);
  /**
   * Register a listener.
   *
   * @param {string} name Name of the event.
   * @param  {Callback} fn Function to notify on the given event.
   * @memberof Logcat
   */
  (0, _defineProperty2["default"])(this, "on", function (name, fn) {
    _this.events.on(name, fn);
  });
  /**
   * Removes a listener.
   *
   * @param {string} name Name of the event.
   * @param  {Callback} fn Function to notify on the given event.
   * @memberof Logcat
   */
  (0, _defineProperty2["default"])(this, "off", function (name, fn) {
    _this.events.off(name, fn);
  });
  /**
   * Cancel the currently active logcat stream.
   *
   * @memberof Logcat
   */
  (0, _defineProperty2["default"])(this, "stop", function () {
    if (_this.timerID) {
      clearInterval(_this.timerID);
      _this.timerID = null;
    }
    _this.events.emit("end");
  });
  (0, _defineProperty2["default"])(this, "pollStream", function () {
    var self = _this;
    var url = new URL(_this.logcatUrl);
    url.searchParams.append("start", _this.offset);
    var headers = {
      "Accept": "application/json"
    };
    if (_this.auth && _this.auth.authHeader) {
      Object.assign(headers, _this.auth.authHeader());
    }
    fetch(url.toString(), {
      headers: headers
    }).then(function (res) {
      if (res.status === 401 && _this.auth && _this.auth.unauthorized) {
        _this.auth.unauthorized();
      }
      if (!res.ok) {
        throw new Error("HTTP error " + res.status);
      }
      return res.json();
    }).then(function (response) {
      var nextOffset = response.next;
      if (nextOffset > self.offset) {
        self.offset = nextOffset;
        self.events.emit("data", response.contents);
      }
    })["catch"](function (err) {
      console.error("Logcat error:", err);
      _this.stop();
    });
  });
  /**
   * Requests the logcat stream, invoking the callback when a log line arrives.
   *
   * @param  {Callback} fnNotify when a new log line arrives.
   * @param  {number} refreshRate polling interval. Must be > 0.
   * @memberof Logcat
   */
  (0, _defineProperty2["default"])(this, "start", function (fnNotify) {
    var refreshRate = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
    if (fnNotify) _this.on("data", fnNotify);
    _this.refreshRate = refreshRate;
    if (_this.refreshRate <= 0) {
      console.warn("Streaming logcat is no longer supported. Falling back to 1000ms polling.");
      _this.refreshRate = 1000;
    }
    _this.timerID = setInterval(function () {
      return _this.pollStream();
    }, _this.refreshRate);
    _this.events.emit("start");
  });
  this.logcatUrl = logcatUrl;
  this.auth = auth;
  this.offset = 0;
  this.events = new _events.EventEmitter();
  this.refreshRate = 1000;
  this.timerID = null;
});
var _default = Logcat;
exports["default"] = _default;