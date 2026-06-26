
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
import "babel-polyfill";
import { EventEmitter } from "events";
import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import Emulator from "../src/components/emulator/emulator";
import * as Proto from "../src/proto/emulator_controller_pb";
import * as Rtc from "../src/proto/rtc_service_pb";
import {
  RtcService,
  EmulatorControllerService,
} from "../src/proto/emulator_web_client";
import JsepProtocol from "../src/components/emulator/net/jsep_protocol_driver";
import WsJsepProtocol from "../src/components/emulator/net/ws_jsep_protocol_driver";

jest.mock("../src/proto/emulator_web_client");
jest.mock("../src/components/emulator/net/jsep_protocol_driver");
jest.mock("../src/components/emulator/net/ws_jsep_protocol_driver");

const mockDisconnect = jest.fn();
const mockStartStream = jest.fn();
const mockOn = jest.fn();
const mockSend = jest.fn();
const mockCleanup = jest.fn();

const mockWsDisconnect = jest.fn();
const mockWsStartStream = jest.fn();
const mockWsOn = jest.fn();
const mockWsSend = jest.fn();
const mockWsCleanup = jest.fn();

JsepProtocol.mockImplementation(() => {
  return {
    disconnect: mockDisconnect,
    startStream: mockStartStream,
    on: mockOn,
    send: mockSend,
    cleanup: mockCleanup,
  };
});

WsJsepProtocol.mockImplementation(() => {
  return {
    disconnect: mockWsDisconnect,
    startStream: mockWsStartStream,
    on: mockWsOn,
    send: mockWsSend,
    cleanup: mockWsCleanup,
  };
});



// See https://github.com/testing-library/react-testing-library/issues/470
// As well as https://github.com/facebook/react/issues/10389
// All because of the "muted" tag on our video element inside webrtc_view
const renderIgnoringUnstableFlushDiscreteUpdates = (component) => {
  // tslint:disable: no-console
  const originalError = console.error;
  const error = jest.fn();
  console.error = error;
  const result = render(component);
  expect(error).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledWith(
    "Warning: unstable_flushDiscreteUpdates: Cannot flush updates when React is already rendering.%s",
    expect.any(String)
  );
  console.error = originalError;
  // tslint:enable: no-console
  return result;
};

describe("The emulator", () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    RtcService.mockClear();
    EmulatorControllerService.mockClear();
    mockDisconnect.mockClear();
    mockStartStream.mockClear();
    mockOn.mockClear();
    mockSend.mockClear();
    mockCleanup.mockClear();
    mockWsDisconnect.mockClear();
    mockWsStartStream.mockClear();
    mockWsOn.mockClear();
    mockWsSend.mockClear();
    mockWsCleanup.mockClear();
    WsJsepProtocol.mockClear();
  });


  test("Creates gRPC services", async () => {
    render(
      <Emulator uri="/test" width={300} height={300} />
    );

    expect(EmulatorControllerService).toHaveBeenCalled();
    expect(RtcService).toHaveBeenCalled();
    // Shipped out a gps call
  });
  test("Tries to establish a webrtc connection", async () => {
    let state;
    render(
      <Emulator
        uri="/test"
        width={300}
        height={300}
        onStateChange={(e) => {
          state = e;
        }}
      />
    );

    await waitFor(() => state === "connecting");
    expect(RtcService).toHaveBeenCalled();
  });

  test("Sends a gps location to the emulator", async () => {
    // Let's go to Seattle!
    render(
      <Emulator
        uri="/test"
        width={300}
        height={300}
        gps={{ latitude: 47.6062, longitude: 122.3321 }}
      />
    );

    const setGps = EmulatorControllerService.mock.instances[0].setGps;
    expect(setGps).toHaveBeenCalled();

    const location = new Proto.GpsState();
    location.setLatitude(47.6062);
    location.setLongitude(122.3321);
    location.setAltitude(undefined);
    location.setBearing(undefined);
    location.setSpeed(undefined);
    expect(setGps).toHaveBeenCalledWith(location);
  });

  test("The png view requests images", async () => {
    let pngCall = false
    EmulatorControllerService.mockImplementationOnce(() => {
      return {
        streamScreenshot: jest.fn((request) => {
            pngCall = true
          return { on: jest.fn(), cancel: jest.fn() };
        }),
        getStatus: jest.fn(() => {}),
      };
    });

    render(<Emulator uri="/test" width={300} height={300} view="png" />);
    expect(pngCall).toBeTruthy()
  });

  test("Exposes sendKey via ref", () => {
    const ref = React.createRef();
    render(<Emulator uri="/test" width={300} height={300} ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(ref.current.sendKey).toBeDefined();

    ref.current.sendKey("Enter");
    expect(mockSend).toHaveBeenCalledWith("keyboard", expect.any(Proto.KeyboardEvent));
    const callArg = mockSend.mock.calls[0][1];
    expect(callArg.getKey()).toBe("Enter");
    expect(callArg.getEventtype()).toBe(Proto.KeyboardEvent.KeyEventType.KEYPRESS);
  });

  test("Sends a gps location to the emulator on update", () => {
    const { rerender } = render(
      <Emulator
        uri="/test"
        width={300}
        height={300}
        gps={{ latitude: 47.6062, longitude: 122.3321 }}
      />
    );

    const setGps = EmulatorControllerService.mock.instances[0].setGps;
    expect(setGps).toHaveBeenCalledTimes(1);

    // Update GPS
    rerender(
      <Emulator
        uri="/test"
        width={300}
        height={300}
        gps={{ latitude: 48.0, longitude: 122.0 }}
      />
    );
    expect(setGps).toHaveBeenCalledTimes(2);

    const location = new Proto.GpsState();
    location.setLatitude(48.0);
    location.setLongitude(122.0);
    location.setAltitude(undefined);
    location.setBearing(undefined);
    location.setSpeed(undefined);
    expect(setGps).toHaveBeenLastCalledWith(location);
  });

  test("Cleans up JsepProtocol on unmount", () => {
    const { unmount } = render(
      <Emulator uri="/test" width={300} height={300} />
    );
    unmount();
    expect(mockCleanup).toHaveBeenCalled();
  });

  test("Uses WsJsepProtocol when uri starts with ws://", () => {
    render(<Emulator uri="ws://localhost:8080" width={300} height={300} />);
    expect(WsJsepProtocol).toHaveBeenCalledWith("ws://localhost:8080");
    expect(EmulatorControllerService).not.toHaveBeenCalled();
    expect(RtcService).not.toHaveBeenCalled();
  });

  test("Uses WsJsepProtocol when uri starts with wss://", () => {
    render(<Emulator uri="wss://localhost:8080" width={300} height={300} />);
    expect(WsJsepProtocol).toHaveBeenCalledWith("wss://localhost:8080");
  });
});
