/**
 * @jest-environment jsdom
 */
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
import "@testing-library/jest-dom";
import React from "react";
import { render, fireEvent, screen, waitFor, act } from "@testing-library/react";
import { fakeMouseEvent, fakeTouchEvent} from "./fake_events";
import withMouseKeyHandler from "../src/components/emulator/views/event_handler";
import * as Proto from "../src/proto/emulator_controller_pb";

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

const TestView = withMouseKeyHandler(FakeEmulator);

describe("The event handler", () => {
  let mockJsep, fakeScreen;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockJsep = {
      send: jest.fn(),
    };

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          status: "success",
          hardwareConfig: {
            "hw.lcd.width": "200",
            "hw.lcd.height": "200",
          }
        }),
      })
    );

    render(<TestView statusUrl="http://foo/status" jsep={mockJsep} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("http://foo/status", expect.any(Object));
    });
    // Allow microtasks (fetch promise resolution and setState) to flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    fakeScreen = screen.getByTestId("fake").parentElement;
    Object.defineProperty(fakeScreen, "clientWidth", { get: () => 200 });
    Object.defineProperty(fakeScreen, "clientHeight", { get: () => 200 });

    expect(fakeScreen).toBeInTheDocument();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Forwards mouse events", () => {
    fireEvent(fakeScreen, fakeMouseEvent("mousedown", 10, 10));
    fireEvent(fakeScreen, fakeMouseEvent("mouseup", 20, 20));

    expect(mockJsep.send).toHaveBeenCalledTimes(2);

    expect(mockJsep.send).toHaveBeenNthCalledWith(1, "mouse", expect.any(Proto.MouseEvent));
    const mouseEvent1 = mockJsep.send.mock.calls[0][1];
    expect(mouseEvent1.getX()).toBe(10);
    expect(mouseEvent1.getY()).toBe(10);
    expect(mouseEvent1.getButtons()).toBe(1); // Left button

    expect(mockJsep.send).toHaveBeenNthCalledWith(2, "mouse", expect.any(Proto.MouseEvent));
    const mouseEvent2 = mockJsep.send.mock.calls[1][1];
    expect(mouseEvent2.getX()).toBe(20);
    expect(mouseEvent2.getY()).toBe(20);
    expect(mouseEvent2.getButtons()).toBe(0); // No buttons
  });

  test("Forwards keyboard events", () => {
    fireEvent.keyDown(fakeScreen, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(fakeScreen, { key: "Enter", code: "Enter" });

    expect(mockJsep.send).toHaveBeenCalledTimes(2);
    expect(mockJsep.send).toHaveBeenNthCalledWith(1, "keyboard", expect.any(Proto.KeyboardEvent));
    const keyEvent1 = mockJsep.send.mock.calls[0][1];
    expect(keyEvent1.getKey()).toBe("Enter");
    expect(keyEvent1.getEventtype()).toBe(Proto.KeyboardEvent.KeyEventType.KEYDOWN);

    expect(mockJsep.send).toHaveBeenNthCalledWith(2, "keyboard", expect.any(Proto.KeyboardEvent));
    const keyEvent2 = mockJsep.send.mock.calls[1][1];
    expect(keyEvent2.getKey()).toBe("Enter");
    expect(keyEvent2.getEventtype()).toBe(Proto.KeyboardEvent.KeyEventType.KEYUP);
  });

  test("Forwards touch events", () => {
    fireEvent(fakeScreen, fakeTouchEvent("touchstart", 10, 10, 1));
    fireEvent(fakeScreen, fakeTouchEvent("touchmove", 20, 20, 2));
    fireEvent(fakeScreen, fakeTouchEvent("touchend", 30, 30, 0));

    expect(mockJsep.send).toHaveBeenCalledTimes(3);
    expect(mockJsep.send).toHaveBeenNthCalledWith(1, "touch", expect.any(Proto.TouchEvent));
    const touchEvent1 = mockJsep.send.mock.calls[0][1];
    expect(touchEvent1.getTouchesList()[0].getX()).toBe(10);
    expect(touchEvent1.getTouchesList()[0].getY()).toBe(10);
  });

  describe("scaleCoordinates aspect ratio scaling & bounds", () => {
    let eventHandlerInstance;

    beforeEach(async () => {
      const hocRef = React.createRef();
      await act(async () => {
        render(<TestView ref={hocRef} statusUrl="http://foo/status" jsep={mockJsep} />);
      });
      // Wait for the async status update to finish so it doesn't overwrite our test state
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      eventHandlerInstance = hocRef.current;
    });

    test("1:1 Perfect Match (no letterbox/pillarbox)", async () => {
      await act(async () => {
        eventHandlerInstance.setState({ deviceWidth: 1000, deviceHeight: 1000 });
      });
      eventHandlerInstance.handler.current = { clientWidth: 500, clientHeight: 500 };

      // Normal scaling: 500x500 -> 1000x1000 (factor of 2)
      expect(eventHandlerInstance.scaleCoordinates(250, 250)).toEqual({
        x: 500,
        y: 500,
        scaleX: 2,
        scaleY: 2,
      });
    });

    test("Pillarboxed (wide container: 1000x500 container, 1000x1000 device)", async () => {
      await act(async () => {
        eventHandlerInstance.setState({ deviceWidth: 1000, deviceHeight: 1000 });
      });
      // Container is twice as wide as height. But device is 1:1.
      // Rendered area should be centered: 500x500 in the middle of 1000x500 container.
      // offsetX = (1000 - 500) / 2 = 250.
      eventHandlerInstance.handler.current = { clientWidth: 1000, clientHeight: 500 };

      // Clicking at the exact center of the container (500, 250)
      // adjustedXp = 500 - 250 = 250. adjustedYp = 250 - 0 = 250.
      // Rendered width/height = 500x500, so scale is 2.
      expect(eventHandlerInstance.scaleCoordinates(500, 250)).toEqual({
        x: 500,
        y: 500,
        scaleX: 2,
        scaleY: 2,
      });

      // Click in the left pillar box (offsetX is 250, so clicking at 100 is out of bounds)
      expect(eventHandlerInstance.scaleCoordinates(100, 250)).toEqual({
        x: -1,
        y: -1,
        scaleX: 2,
        scaleY: 2,
      });
    });

    test("Letterboxed (tall container: 500x1000 container, 1000x1000 device)", async () => {
      await act(async () => {
        eventHandlerInstance.setState({ deviceWidth: 1000, deviceHeight: 1000 });
      });
      // Container is twice as tall as width. But device is 1:1.
      // Rendered area should be centered: 500x500 in the middle of 500x1000 container.
      // offsetY = (1000 - 500) / 2 = 250.
      eventHandlerInstance.handler.current = { clientWidth: 500, clientHeight: 1000 };

      // Clicking at the exact center of the container (250, 500)
      // adjustedXp = 250 - 0 = 250. adjustedYp = 500 - 250 = 250.
      expect(eventHandlerInstance.scaleCoordinates(250, 500)).toEqual({
        x: 500,
        y: 500,
        scaleX: 2,
        scaleY: 2,
      });

      // Click in the top letter box (offsetY is 250, so clicking at 100 is out of bounds)
      expect(eventHandlerInstance.scaleCoordinates(250, 100)).toEqual({
        x: -1,
        y: -1,
        scaleX: 2,
        scaleY: 2,
      });
    });
  });
});
