import PropTypes from "prop-types";
import React, { useState, useEffect, useRef } from "react";
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
  const MouseKeyHandler = (props) => {
    const { statusUrl, auth, jsep, width, height } = props;

    const [deviceWidth, setDeviceWidth] = useState(DEFAULT_WIDTH);
    const [deviceHeight, setDeviceHeight] = useState(DEFAULT_HEIGHT);
    const [mouse, setMouse] = useState({
      xp: 0,
      yp: 0,
      mouseDown: false,
      mouseButton: 0,
    });

    const handlerRef = useRef(null);
    const statusRef = useRef(null);

    if (!statusRef.current) {
      statusRef.current = new EmulatorStatus(statusUrl, auth);
    }

    useEffect(() => {
      statusRef.current.updateStatus((state) => {
        setDeviceWidth(parseInt(state.hardwareConfig["hw.lcd.width"]) || DEFAULT_WIDTH);
        setDeviceHeight(parseInt(state.hardwareConfig["hw.lcd.height"]) || DEFAULT_HEIGHT);
      });
    }, [statusUrl, auth]);

    const onContextMenu = (e) => {
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
    const scaleCoordinates = (xp, yp) => {
      const { clientHeight, clientWidth } = handlerRef.current;

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

      return { x, y, scaleX, scaleY };
    };

    const sendMouseCoordinates = (currentMouse) => {
      const { mouseDown, mouseButton, xp, yp } = currentMouse;
      const request = new Proto.MouseEvent();
      const { x, y } = scaleCoordinates(xp, yp);
      request.setX(x);
      request.setY(y);
      request.setButtons(mouseDown ? mouseButton : 0);
      jsep.send("mouse", request);
    };

    const handleKey = (eventType) => {
      return (e) => {
        // Disable jumping to next control when pressing the space bar.
        if (e.keyCode === 32) {
          e.preventDefault();
        }
        const request = new Proto.KeyboardEvent();
        request.setEventtype(
          eventType === "KEYDOWN"
            ? Proto.KeyboardEvent.KeyEventType.KEYDOWN
            : eventType === "KEYUP"
            ? Proto.KeyboardEvent.KeyEventType.KEYUP
            : Proto.KeyboardEvent.KeyEventType.KEYPRESS
        );
        request.setKey(e.key);
        jsep.send("keyboard", request);
      };
    };

    // Properly handle the mouse events.
    const handleMouseDown = (e) => {
      const rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      const newMouse = {
        xp,
        yp,
        mouseDown: true,
        // In browser's MouseEvent.button property,
        // 0 stands for left button and 2 stands for right button.
        mouseButton: e.button === 0 ? 1 : e.button === 2 ? 2 : 0,
      };
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };

    const handleMouseUp = (e) => {
      const rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      const newMouse = { xp, yp, mouseDown: false, mouseButton: 0 };
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };

    const handleMouseMove = (e) => {
      // Let's not overload the endpoint with useless events.
      if (!mouse.mouseDown) return;

      const rect = handlerRef.current ? handlerRef.current.getBoundingClientRect() : null;
      const xp = rect && rect.width > 0 ? e.clientX - rect.left : e.nativeEvent.offsetX || 0;
      const yp = rect && rect.height > 0 ? e.clientY - rect.top : e.nativeEvent.offsetY || 0;
      const newMouse = { ...mouse, xp, yp };
      setMouse(newMouse);
      sendMouseCoordinates(newMouse);
    };

    /**
     * Scales an axis to linux input codes that the emulator understands.
     */
    const scaleAxis = (value, minIn, maxIn) => {
      const minOut = 0x0; // EV_ABS_MIN
      const maxOut = 0x7fff; // EV_ABS_MAX
      const rangeOut = maxOut - minOut;
      const rangeIn = maxIn - minIn;
      if (rangeIn < 1) {
        return minOut + rangeOut / 2;
      }
      return (((value - minIn) * rangeOut) / rangeIn + minOut) | 0;
    };

    const setTouchCoordinates = (type, touches, minForce, maxForce) => {
      // We need to calculate the offset of the touch events.
      const rect = handlerRef.current.getBoundingClientRect();
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
        const MT_PRESSURE = scaleAxis(
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
      jsep.send("touch", requestTouchEvent);
    };

    const handleTouch = (minForce, maxForce) => {
      return (e) => {
        // Make sure they are not processed as mouse events later on.
        if (e.cancelable) {
          e.preventDefault();
        }
        setTouchCoordinates(
          e.nativeEvent.type,
          e.nativeEvent.changedTouches,
          minForce,
          maxForce
        );
      };
    };

    return (
      <div
        onTouchStart={handleTouch(0.01, 1.0)}
        onTouchMove={handleTouch(0.01, 1.0)}
        onTouchEnd={handleTouch(0.0, 0.0)}
        onTouchCancel={handleTouch(0.0, 0.0)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseOut={handleMouseUp}
        onKeyDown={handleKey("KEYDOWN")}
        onKeyUp={handleKey("KEYUP")}
        onContextMenu={onContextMenu}
        tabIndex="0"
        ref={handlerRef}
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
        <WrappedComponent {...props} />
      </div>
    );
  };

  MouseKeyHandler.propTypes = {
    /** The REST endpoint to retrieve status */
    statusUrl: PropTypes.string,
    /** Jsep protocol driver, used to send mouse & touch events. */
    jsep: PropTypes.object.isRequired,
    /** The authentication service to use */
    auth: PropTypes.object,
    width: PropTypes.number,
    height: PropTypes.number,
  };

  return MouseKeyHandler;
}
