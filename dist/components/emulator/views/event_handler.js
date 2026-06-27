"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
var _typeof = require("@babel/runtime/helpers/typeof");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = withMouseKeyHandler;
var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _propTypes = _interopRequireDefault(require("prop-types"));
var _react = _interopRequireWildcard(require("react"));
var _emulator_controller_pb = _interopRequireDefault(require("../../../proto/emulator_controller_pb"));
var _emulator_status = _interopRequireDefault(require("../net/emulator_status"));
var _logger = _interopRequireDefault(require("../net/logger"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { (0, _defineProperty2["default"])(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
var DEFAULT_WIDTH = 1080;
var DEFAULT_HEIGHT = 2424;

/**
 * A handler that extends a view to send key/mouse events to the emulator.
 * It wraps the inner component in a div, and will use the jsep handler
 * to send key/mouse/touch events over the proper channel.
 *
 * It will translate the mouse events based upon the returned display size of
 * the emulator.
 *
 * You usually want to wrap a EmulatorRtcview, or EmulatorPngView in it.
 */
function withMouseKeyHandler(WrappedComponent) {
  var MouseKeyHandler = /*#__PURE__*/(0, _react.forwardRef)(function (props, ref) {
    var statusUrl = props.statusUrl,
      auth = props.auth,
      jsep = props.jsep,
      width = props.width,
      height = props.height;
    var _useState = (0, _react.useState)(DEFAULT_WIDTH),
      _useState2 = (0, _slicedToArray2["default"])(_useState, 2),
      deviceWidth = _useState2[0],
      setDeviceWidth = _useState2[1];
    var _useState3 = (0, _react.useState)(DEFAULT_HEIGHT),
      _useState4 = (0, _slicedToArray2["default"])(_useState3, 2),
      deviceHeight = _useState4[0],
      setDeviceHeight = _useState4[1];
    var _useState5 = (0, _react.useState)({
        xp: 0,
        yp: 0,
        mouseDown: false,
        mouseButton: 0
      }),
      _useState6 = (0, _slicedToArray2["default"])(_useState5, 2),
      mouse = _useState6[0],
      setMouse = _useState6[1];
    var handlerRef = (0, _react.useRef)(null);
    var statusRef = (0, _react.useRef)(null);
    if (!statusRef.current) {
      statusRef.current = new _emulator_status["default"](statusUrl, auth);
    }
    (0, _react.useImperativeHandle)(ref, function () {
      return {
        scaleCoordinates: scaleCoordinates,
        setDeviceWidth: setDeviceWidth,
        setDeviceHeight: setDeviceHeight,
        handlerRef: handlerRef
      };
    });
    (0, _react.useEffect)(function () {
      statusRef.current.updateStatus(function (state) {
        setDeviceWidth(parseInt(state.hardwareConfig["hw.lcd.width"]) || DEFAULT_WIDTH);
        setDeviceHeight(parseInt(state.hardwareConfig["hw.lcd.height"]) || DEFAULT_HEIGHT);
      });
    }, [statusUrl, auth]);
    var onContextMenu = function onContextMenu(e) {
      e.preventDefault();
    };

    /**
     * Translates and scales HTML coordinates (xp, yp) from the event handler's
     * container element to the emulator's internal device coordinate system.
     * 
     * This method accounts for letterboxing or pillarboxing that occurs when
     * the container's aspect ratio differs from the emulator's native screen aspect ratio,
     * ensuring that clicks on black borders are ignored and clicks on the active area
     * are correctly mapped.
     */
    var scaleCoordinates = function scaleCoordinates(xp, yp) {
      var _handlerRef$current = handlerRef.current,
        clientHeight = _handlerRef$current.clientHeight,
        clientWidth = _handlerRef$current.clientWidth;
      var deviceRatio = deviceWidth / deviceHeight;
      var containerRatio = clientWidth / clientHeight;
      var renderedWidth = clientWidth;
      var renderedHeight = clientHeight;
      var offsetX = 0;
      var offsetY = 0;
      if (containerRatio > deviceRatio) {
        // Pillarboxed (bars on left and right)
        renderedWidth = clientHeight * deviceRatio;
        offsetX = (clientWidth - renderedWidth) / 2;
      } else {
        // Letterboxed (bars on top and bottom)
        renderedHeight = clientWidth / deviceRatio;
        offsetY = (clientHeight - renderedHeight) / 2;
      }

      // Adjust coordinate relative to the actual rendered video area
      var adjustedXp = xp - offsetX;
      var adjustedYp = yp - offsetY;
      var scaleX = deviceWidth / renderedWidth;
      var scaleY = deviceHeight / renderedHeight;
      var x = Math.round(adjustedXp * scaleX);
      var y = Math.round(adjustedYp * scaleY);
      _logger["default"].debug("scaleCoordinates: input(".concat(xp, ", ").concat(yp, "), container(").concat(clientWidth, "x").concat(clientHeight, "), ") + "device(".concat(deviceWidth, "x").concat(deviceHeight, "), offset(").concat(Math.round(offsetX), ", ").concat(Math.round(offsetY), "), ") + "adjusted(".concat(Math.round(adjustedXp), ", ").concat(Math.round(adjustedYp), "), scale(").concat(scaleX.toFixed(3), ", ").concat(scaleY.toFixed(3), "), output(").concat(x, ", ").concat(y, ")"));

      // Guard against out of bounds or division by zero
      if (isNaN(x) || isNaN(y) || adjustedXp < 0 || adjustedXp > renderedWidth || adjustedYp < 0 || adjustedYp > renderedHeight) {
        _logger["default"].debug("Ignoring out of bounds or invalid click: x: " + x + ", y:" + y);
        return {
          x: -1,
          y: -1,
          scaleX: scaleX,
          scaleY: scaleY
        };
      }
      return {
        x: x,
        y: y,
        scaleX: scaleX,
        scaleY: scaleY
      };
    };
    var sendMouseCoordinates = function sendMouseCoordinates(currentMouse) {
      var mouseDown = currentMouse.mouseDown,
        mouseButton = currentMouse.mouseButton,
        xp = currentMouse.xp,
        yp = currentMouse.yp;
      var _scaleCoordinates = scaleCoordinates(xp, yp),
        x = _scaleCoordinates.x,
        y = _scaleCoordinates.y;
      if (x < 0 || y < 0) {
        return;
      }
      var request = new _emulator_controller_pb["default"].MouseEvent();
      request.setX(x);
      request.setY(y);
      request.setButtons(mouseDown ? mouseButton : 0);
      jsep.send("mouse", request);
    };
    var handleKey = function handleKey(eventType) {
      return function (e) {
        // Disable jumping to next control when pressing the space bar.
        if (e.keyCode === 32) {
          e.preventDefault();
        }
        var request = new _emulator_controller_pb["default"].KeyboardEvent();
        request.setEventtype(eventType === "KEYDOWN" ? _emulator_controller_pb["default"].KeyboardEvent.KeyEventType.KEYDOWN : eventType === "KEYUP" ? _emulator_controller_pb["default"].KeyboardEvent.KeyEventType.KEYUP : _emulator_controller_pb["default"].KeyboardEvent.KeyEventType.KEYPRESS);
        request.setKey(e.key);
        jsep.send("keyboard", request);
      };
    };

    // Properly handle the mouse events.
    var handleMouseDown = function handleMouseDown(e) {
      var rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      var xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      var yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      var newMouse = {
        xp: xp,
        yp: yp,
        mouseDown: true,
        // In browser's MouseEvent.button property,
        // 0 stands for left button and 2 stands for right button.
        mouseButton: e.button === 0 ? 1 : e.button === 2 ? 2 : 0
      };
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };
    var handleMouseUp = function handleMouseUp(e) {
      var rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      var xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      var yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      var newMouse = {
        xp: xp,
        yp: yp,
        mouseDown: false,
        mouseButton: 0
      };
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };
    var handleMouseMove = function handleMouseMove(e) {
      // Let's not overload the endpoint with useless events.
      if (!mouse.mouseDown) return;
      var rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      var xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      var yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      var newMouse = _objectSpread(_objectSpread({}, mouse), {}, {
        xp: xp,
        yp: yp
      });
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };

    /**
     * Scales an axis to linux input codes that the emulator understands.
     */
    var scaleAxis = function scaleAxis(value, minIn, maxIn) {
      var minOut = 0x0; // EV_ABS_MIN
      var maxOut = 0x7fff; // EV_ABS_MAX
      var rangeOut = maxOut - minOut;
      var rangeIn = maxIn - minIn;
      if (rangeIn < 1) {
        return minOut + rangeOut / 2;
      }
      return (value - minIn) * rangeOut / rangeIn + minOut | 0;
    };
    var setTouchCoordinates = function setTouchCoordinates(type, touches, minForce, maxForce) {
      // We need to calculate the offset of the touch events.
      var rect = handlerRef.current.getBoundingClientRect();
      var touchesToSend = [];
      for (var i = 0; i < touches.length; i++) {
        var touch = touches[i];
        var clientX = touch.clientX,
          clientY = touch.clientY,
          identifier = touch.identifier,
          force = touch.force,
          radiusX = touch.radiusX,
          radiusY = touch.radiusY;
        var offsetX = clientX - rect.left;
        var offsetY = clientY - rect.top;
        var _scaleCoordinates2 = scaleCoordinates(offsetX, offsetY),
          x = _scaleCoordinates2.x,
          y = _scaleCoordinates2.y,
          scaleX = _scaleCoordinates2.scaleX,
          scaleY = _scaleCoordinates2.scaleY;
        if (x < 0 || y < 0) {
          continue;
        }
        var scaledRadiusX = 2 * radiusX * scaleX;
        var scaledRadiusY = 2 * radiusY * scaleY;
        var protoTouch = new _emulator_controller_pb["default"].Touch();
        protoTouch.setX(x | 0);
        protoTouch.setY(y | 0);
        protoTouch.setIdentifier(identifier);

        // Normalize the force
        var MT_PRESSURE = scaleAxis(Math.max(minForce, Math.min(maxForce, force)), 0, 1);
        protoTouch.setPressure(MT_PRESSURE);
        protoTouch.setTouchMajor(Math.max(scaledRadiusX, scaledRadiusY) | 0);
        protoTouch.setTouchMinor(Math.min(scaledRadiusX, scaledRadiusY) | 0);
        touchesToSend.push(protoTouch);
      }
      if (touchesToSend.length === 0) {
        return;
      }

      // Make the grpc call.
      var requestTouchEvent = new _emulator_controller_pb["default"].TouchEvent();
      requestTouchEvent.setTouchesList(touchesToSend);
      jsep.send("touch", requestTouchEvent);
    };
    var handleTouch = function handleTouch(minForce, maxForce) {
      return function (e) {
        // Make sure they are not processed as mouse events later on.
        if (e.cancelable) {
          e.preventDefault();
        }
        setTouchCoordinates(e.nativeEvent.type, e.nativeEvent.changedTouches, minForce, maxForce);
      };
    };
    return /*#__PURE__*/_react["default"].createElement("div", {
      onTouchStart: handleTouch(0.01, 1.0),
      onTouchMove: handleTouch(0.01, 1.0),
      onTouchEnd: handleTouch(0.0, 0.0),
      onTouchCancel: handleTouch(0.0, 0.0),
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseOut: handleMouseUp,
      onKeyDown: handleKey("KEYDOWN"),
      onKeyUp: handleKey("KEYUP"),
      onContextMenu: onContextMenu,
      tabIndex: "0",
      ref: handlerRef,
      style: {
        pointerEvents: "all",
        outline: "none",
        margin: "0",
        padding: "0",
        border: "0",
        display: "inline-block",
        width: width ? "".concat(width, "px") : "100%",
        height: height ? "".concat(height, "px") : "auto"
      }
    }, /*#__PURE__*/_react["default"].createElement(WrappedComponent, props));
  });
  MouseKeyHandler.propTypes = {
    /** The REST endpoint to retrieve status */
    statusUrl: _propTypes["default"].string,
    /** Jsep protocol driver, used to send mouse & touch events. */
    jsep: _propTypes["default"].object.isRequired,
    /** The authentication service to use */
    auth: _propTypes["default"].object,
    width: _propTypes["default"].number,
    height: _propTypes["default"].number
  };
  return MouseKeyHandler;
}