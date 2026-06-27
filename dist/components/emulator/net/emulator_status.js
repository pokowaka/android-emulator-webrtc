"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));
var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
/*
 * Copyright 2020 The Android Open Source Project
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
 * Gets the status of the emulator, parsing the hardware config into something
 * easy to digest.
 *
 * @export
 * @class EmulatorStatus
 */
var EmulatorStatus = /*#__PURE__*/(0, _createClass2["default"])(
/**
 * Creates an EmulatorStatus object that can retrieve the status of the running emulator.
 *
 * @param {string} statusUrl The REST endpoint to retrieve status.
 * @param {object} auth The authentication service to use, or null for no authentication.
 */
function EmulatorStatus(statusUrl, auth) {
  var _this = this;
  (0, _classCallCheck2["default"])(this, EmulatorStatus);
  /**
   * Gets the cached status.
   *
   * @memberof EmulatorStatus
   */
  (0, _defineProperty2["default"])(this, "getStatus", function () {
    return _this.status;
  });
  /**
   * Retrieves the current status from the emulator.
   *
   * @param  {Callback} fnNotify when the status is available, returns the retrieved status.
   * @param  {boolean} cache True if the cache can be used.
   * @memberof EmulatorStatus
   */
  (0, _defineProperty2["default"])(this, "updateStatus", function (fnNotify, cache) {
    if (!_this.statusUrl) {
      return;
    }
    if (cache && _this.status) {
      fnNotify(_this.status);
      return _this.status;
    }
    var headers = {
      Accept: "application/json"
    };
    if (_this.auth && _this.auth.authHeader) {
      Object.assign(headers, _this.auth.authHeader());
    }
    fetch(_this.statusUrl, {
      headers: headers
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("HTTP error! status: ".concat(response.status));
      }
      return response.json();
    }).then(function (data) {
      _this.status = data;
      fnNotify(_this.status);
    })["catch"](function (err) {
      console.error("Failed to get emulator status:", err);
    });
  });
  this.statusUrl = statusUrl;
  this.auth = auth;
  this.status = null;
});
var _default = EmulatorStatus;
exports["default"] = _default;