"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _loglevel = _interopRequireDefault(require("loglevel"));
/**
 * @fileoverview Configures and exports a loglevel logger instance scoped to
 * the 'android-emulator-webrtc' package.
 */

// Create a logger specific to the emulator package
var logger = _loglevel["default"].getLogger("android-emulator-webrtc");

// Default to "info" level so that verbose signaling (debug) is hidden by default,
// but warnings and errors are still printed.
logger.setDefaultLevel("info");
var _default = exports["default"] = logger;