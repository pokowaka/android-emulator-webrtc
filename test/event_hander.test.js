// __tests__/hidden-message.js
// these imports are something you'd normally configure Jest to import for you
// automatically. Learn more in the setup docs: https://testing-library.com/docs/react-testing-library/setup#cleanup
import "@testing-library/jest-dom";
// NOTE: jest-dom adds handy assertions to Jest and is recommended, but not required

import React from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import withMouseKeyHandler from "../src/components/emulator/views/event_handler";
import * as Proto from "../src/proto/emulator_controller_pb";
import * as Rtc from "../src/proto/rtc_service_pb";

import JsepProtocol from "../src/components/emulator/net/jsep_protocol_driver";
import {
  RtcService,
  EmulatorControllerService,
} from "../src/components/emulator/net/emulator_web_client";

jest.mock("../src/components/emulator/net/emulator_web_client");
jest.mock("../src/components/emulator/net/jsep_protocol_driver");

class FakeEmulator extends React.Component {
  render() {
    return (
      <div
        data-testid="fake"
        style={{ height: "200px", width: "200px", backgroundColor: "#555" }}
      ></div>
    );
  }
}

const fakeMouseEvent = (tp, x, y, props = {}) => {
  const event = new MouseEvent(tp, {
    bubbles: true,
    cancelable: true,
    ...props,
  });

  Object.defineProperty(event, "offsetX", { get: () => x });
  Object.defineProperty(event, "offsetY", { get: () => y });
  return event;
};

const fakeTouchEvent = (tp, x, y, force, props = {}) => {
  const event = new TouchEvent(tp, {
    bubbles: true,
    cancelable: true,
    ...props,
  });

  Object.defineProperty(event, "touches", {
    get: () => [
      { clientX: x, clientY: y, radiusX: 4, radiusY: 4, force: force },
    ],
  });
  return event;
};

const TestView = withMouseKeyHandler(FakeEmulator);
describe("The event handler", () => {
  const rtcServiceInstance = new RtcService("http://foo");
  const emulatorServiceInstance = new EmulatorControllerService("http://foo");
  let jsep, fakeScreen;

  beforeEach(() => {
    jsep = new JsepProtocol(emulatorServiceInstance, rtcServiceInstance, true);

    render(<TestView emulator={emulatorServiceInstance} jsep={jsep} />);
    fakeScreen = screen.getByTestId("fake").parentElement;
    Object.defineProperty(fakeScreen, "clientWidth", { get: () => 200 });
    Object.defineProperty(fakeScreen, "clientHeight", { get: () => 200 });

    expect(fakeScreen).toBeInTheDocument();
  });

  test("Forwards mouse events", () => {
    fireEvent(fakeScreen, fakeMouseEvent("mousedown", 10, 10));
    fireEvent(fakeScreen, fakeMouseEvent("mouseup", 20, 20));

    // Shipped out a mouse event
    expect(jsep.send.mock.calls[0][0]).toBe("mouse");
    expect(jsep.send).toHaveBeenCalledTimes(2);
  });

  test("Forwards keyboard events", () => {
    fireEvent.keyDown(fakeScreen, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(fakeScreen, { key: "Enter", code: "Enter" });

    // Shipped out a keyboard event
    expect(jsep.send.mock.calls[0][0]).toBe("keyboard");
    expect(jsep.send).toHaveBeenCalledTimes(2);
  });

  test("Forwards touch events", () => {
    fireEvent(fakeScreen, fakeTouchEvent("touchstart", 10, 10, 1));
    fireEvent(fakeScreen, fakeTouchEvent("touchmove", 20, 20, 2));
    fireEvent(fakeScreen, fakeTouchEvent("touchend", 30, 30, 0));

    // Shipped out a touch event
    expect(jsep.send.mock.calls[0][0]).toBe("touch");
    expect(jsep.send).toHaveBeenCalledTimes(3);
  });

  test("Normalizes touch pressure of 1.0 to EV_MAX", () => {
    fireEvent(fakeScreen, fakeTouchEvent("touchstart", 10, 10, 1.0));

    // We scaled 1 ===> (0x7fff/327677)
    expect(jsep.send.mock.calls[0][1]["array"].flat(3)[3]).toBe(0x7fff);
  });


  test("Normalizes touch pressure of 0.0 to EV_MIN", () => {
    fireEvent(fakeScreen, fakeTouchEvent("touchstart", 10, 10, 0.0));

    // So the result we test against is a protobuf message. Protobuf
    // is optimized to not ship the value 0 and will set it to "null".
    expect(jsep.send.mock.calls[0][1]["array"].flat(3)[3]).toBe(null);
  });

  test("Normalizes touch pressure of 0.5 to an integer of half EV_MAX", () => {
    fireEvent(fakeScreen, fakeTouchEvent("touchstart", 10, 10, 0.5));
    expect(jsep.send.mock.calls[0][1]["array"].flat(3)[3]).toBe(16384);
  });
});
