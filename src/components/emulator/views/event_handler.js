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
import PropTypes from "prop-types";
import React from "react";
import Proto from "../../../proto/emulator_controller_pb";
import EmulatorStatus from "../net/emulator_status";
import logger from "../net/logger";

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 2424;

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
export default function withMouseKeyHandler(WrappedComponent) {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        deviceHeight: DEFAULT_HEIGHT,
        deviceWidth: DEFAULT_WIDTH,
        mouse: {
          xp: 0,
          yp: 0,
          mouseDown: false, // Current state of mouse
          // Current button pressed.
          // In proto, 0 is "no button", 1 is left, and 2 is right.
          mouseButton: 0,
        },
      };
      this.handler = React.createRef();
      const { statusUrl, auth } = this.props;
      this.status = new EmulatorStatus(statusUrl, auth);
    }

    static propTypes = {
      /** The REST endpoint to retrieve status */
      statusUrl: PropTypes.string,
      /** Jsep protocol driver, used to send mouse & touch events. */
      jsep: PropTypes.object.isRequired,
      /** The authentication service to use */
      auth: PropTypes.object,
    };

    componentDidMount() {
      this.getScreenSize();
    }

    getScreenSize() {
      this.status.updateStatus((state) => {
        this.setState({
          deviceWidth: parseInt(state.hardwareConfig["hw.lcd.width"]) || DEFAULT_WIDTH,
          deviceHeight: parseInt(state.hardwareConfig["hw.lcd.height"]) || DEFAULT_HEIGHT,
        });
      });
    }

    onContextMenu = (e) => {
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
     *
     * @param {number} xp The x-coordinate relative to the event handler container's top-left corner.
     * @param {number} yp The y-coordinate relative to the event handler container's top-left corner.
     * @returns {Object} An object containing the mapped coordinates:
     *                  - x: The scaled x-coordinate on the emulator device (or -1 if invalid/out of bounds).
     *                  - y: The scaled y-coordinate on the emulator device (or -1 if invalid/out of bounds).
     *                  - scaleX: The scaling factor applied to the x-axis.
     *                  - scaleY: The scaling factor applied to the y-axis.
     */
    scaleCoordinates = (xp, yp) => {
      const { deviceWidth, deviceHeight } = this.state;
      const { clientHeight, clientWidth } = this.handler.current;

      const deviceRatio = deviceWidth / deviceHeight;
      const containerRatio = clientWidth / clientHeight;

      let renderedWidth = clientWidth;
      let renderedHeight = clientHeight;
      let offsetX = 0;
      let offsetY = 0;

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
      const adjustedXp = xp - offsetX;
      const adjustedYp = yp - offsetY;

      const scaleX = deviceWidth / renderedWidth;
      const scaleY = deviceHeight / renderedHeight;

      const x = Math.round(adjustedXp * scaleX);
      const y = Math.round(adjustedYp * scaleY);

      logger.debug(
        `scaleCoordinates: input(${xp}, ${yp}), container(${clientWidth}x${clientHeight}), ` +
        `device(${deviceWidth}x${deviceHeight}), offset(${Math.round(offsetX)}, ${Math.round(offsetY)}), ` +
        `adjusted(${Math.round(adjustedXp)}, ${Math.round(adjustedYp)}), scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}), output(${x}, ${y})`
      );

      // Guard against out of bounds or division by zero
      if (
        isNaN(x) ||
        isNaN(y) ||
        adjustedXp < 0 ||
        adjustedXp > renderedWidth ||
        adjustedYp < 0 ||
        adjustedYp > renderedHeight
      ) {
        logger.debug("Ignoring out of bounds or invalid click: x: " + x + ", y:" + y);
        return { x: -1, y: -1, scaleX, scaleY };
      }

      return { x: x, y: y, scaleX: scaleX, scaleY: scaleY };
    };

    setMouseCoordinates = () => {
      // Forward the request to the jsep engine.
      const { mouseDown, mouseButton, xp, yp } = this.state.mouse;
      var request = new Proto.MouseEvent();
      const { x, y } = this.scaleCoordinates(xp, yp);
      request.setX(x);
      request.setY(y);
      request.setButtons(mouseDown ? mouseButton : 0);
      const { jsep } = this.props;
      jsep.send("mouse", request);
    };

    handleKey = (eventType) => {
      return (e) => {
        // Disable jumping to next control when pressing the space bar.
        if (e.keyCode === 32) {
          e.preventDefault();
        }
        var request = new Proto.KeyboardEvent();
        request.setEventtype(
          eventType === "KEYDOWN"
            ? Proto.KeyboardEvent.KeyEventType.KEYDOWN
            : eventType === "KEYUP"
            ? Proto.KeyboardEvent.KeyEventType.KEYUP
            : Proto.KeyboardEvent.KeyEventType.KEYPRESS
        );
        request.setKey(e.key);
        const { jsep } = this.props;
        jsep.send("keyboard", request);
      };
    };

    // Properly handle the mouse events.
    handleMouseDown = (e) => {
      const rect = this.handler.current ? this.handler.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      this.setState(
        {
          mouse: {
            xp: xp,
            yp: yp,
            mouseDown: true,
            // In browser's MouseEvent.button property,
            // 0 stands for left button and 2 stands for right button.
            mouseButton: e.button === 0 ? 1 : e.button === 2 ? 2 : 0,
          },
        },
        this.setMouseCoordinates
      );
    };

    handleMouseUp = (e) => {
      const rect = this.handler.current ? this.handler.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      this.setState(
        {
          mouse: { xp: xp, yp: yp, mouseDown: false, mouseButton: 0 },
        },
        this.setMouseCoordinates
      );
    };

    handleMouseMove = (e) => {
      // Let's not overload the endpoint with useless events.
      if (!this.state.mouse.mouseDown) return;

      const rect = this.handler.current ? this.handler.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      var mouse = this.state.mouse;
      mouse.xp = xp;
      mouse.yp = yp;
      this.setState({ mouse: mouse }, this.setMouseCoordinates);
    };

    /**
     * Scales an axis to linux input codes that the emulator understands.
     *
     * @param {*} value The value to transform.
     * @param {*} minIn The minimum value, the lower bound of the value param.
     * @param {*} maxIn The maximum value, the upper bound of the value param.
     */
    scaleAxis = (value, minIn, maxIn) => {
      const minOut = 0x0; // EV_ABS_MIN
      const maxOut = 0x7fff; // EV_ABS_MAX
      const rangeOut = maxOut - minOut;
      const rangeIn = maxIn - minIn;
      if (rangeIn < 1) {
        return minOut + rangeOut / 2;
      }
      return (((value - minIn) * rangeOut) / rangeIn + minOut) | 0;
    };

    setTouchCoordinates = (type, touches, minForce, maxForce) => {
      // We need to calculate the offset of the touch events.
      const rect = this.handler.current.getBoundingClientRect();
      const scaleCoordinates = this.scaleCoordinates;
      const touchesToSend = Object.keys(touches).map((index) => {
        const touch = touches[index];
        const { clientX, clientY, identifier, force, radiusX, radiusY } = touch;
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;
        const { x, y, scaleX, scaleY } = scaleCoordinates(offsetX, offsetY);
        const scaledRadiusX = 2 * radiusX * scaleX;
        const scaledRadiusY = 2 * radiusY * scaleY;

        const protoTouch = new Proto.Touch();
        protoTouch.setX(x | 0);
        protoTouch.setY(y | 0);
        protoTouch.setIdentifier(identifier);

        // Normalize the force
        const MT_PRESSURE = this.scaleAxis(
          Math.max(minForce, Math.min(maxForce, force)),
          0,
          1
        );
        protoTouch.setPressure(MT_PRESSURE);
        protoTouch.setTouchMajor(Math.max(scaledRadiusX, scaledRadiusY) | 0);
        protoTouch.setTouchMinor(Math.min(scaledRadiusX, scaledRadiusY) | 0);

        return protoTouch;
      });

      // Make the grpc call.
      const requestTouchEvent = new Proto.TouchEvent();
      requestTouchEvent.setTouchesList(touchesToSend);
      const { jsep } = this.props;
      jsep.send("touch", requestTouchEvent);
    };

    handleTouch = (minForce, maxForce) => {
      return (e) => {
        // Make sure they are not processed as mouse events later on.
        // See https://developer.mozilla.org/en-US/docs/Web/API/Touch_events
        if (e.cancelable) {
          e.preventDefault();
        }
        // Some browsers do net have a force sensor, so we have to "fake" values
        // for start/move/end events.
        this.setTouchCoordinates(
          e.nativeEvent.type,
          e.nativeEvent.changedTouches,
          minForce,
          maxForce
        );
      };
    };

    render() {
      const { width, height } = this.props;
      return (
        <div /* handle interaction */
          onTouchStart={this.handleTouch(0.01, 1.0)}
          onTouchMove={this.handleTouch(0.01, 1.0)}
          onTouchEnd={this.handleTouch(0.0, 0.0)}
          onTouchCancel={this.handleTouch(0.0, 0.0)}
          onMouseDown={this.handleMouseDown}
          onMouseMove={this.handleMouseMove}
          onMouseUp={this.handleMouseUp}
          onMouseOut={this.handleMouseUp}
          onKeyDown={this.handleKey("KEYDOWN")}
          onKeyUp={this.handleKey("KEYUP")}
          onDragStart={this.preventDragHandler}
          tabIndex="0"
          ref={this.handler}
          style={{
            pointerEvents: "all",
            outline: "none",
            margin: "0",
            padding: "0",
            border: "0",
            display: "inline-block",
            width: width ? `${width}px` : "100%",
            height: height ? `${height}px` : "auto",
          }}
        >
          <WrappedComponent {...this.props} />
        </div>
      );
    }
  };
}
