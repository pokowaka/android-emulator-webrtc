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
import React from "react";
import { render, waitFor } from "@testing-library/react";
import Emulator from "../src/components/emulator/emulator";
import * as Proto from "../src/proto/emulator_controller_pb";
import WsJsepProtocol from "../src/components/emulator/net/ws_jsep_protocol_driver";

const mockDisconnect = jest.fn();
const mockStartStream = jest.fn();
const mockOn = jest.fn();
const mockSend = jest.fn();
const mockCleanup = jest.fn();

jest.mock("../src/components/emulator/net/ws_jsep_protocol_driver", () => {
  return {
    __esModule: true,
    default: jest.fn(),
  };
});

describe("The emulator", () => {
  beforeEach(() => {
    WsJsepProtocol.mockReset();
    WsJsepProtocol.mockImplementation(() => {
      console.log("WsJsepProtocol mock constructor called!");
      return {
        disconnect: mockDisconnect,
        startStream: mockStartStream,
        on: mockOn,
        send: mockSend,
        cleanup: mockCleanup,
      };
    });

    mockDisconnect.mockClear();
    mockStartStream.mockClear();
    mockOn.mockClear();
    mockSend.mockClear();
    mockCleanup.mockClear();

    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: "success", hardwareConfig: {} }),
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderEmulator = async (ui, options) => {
    const result = render(ui, options);
    await waitFor(() => {
      const statusCalls = global.fetch.mock.calls.filter(call => call[0].endsWith("/api/v1/emulator/status"));
      expect(statusCalls).toHaveLength(1);
    });
    return result;
  };

  test("Creates WsJsepProtocol with correct URL", async () => {
    await renderEmulator(<Emulator uri="localhost:8080" width={300} height={300} />);
    expect(WsJsepProtocol).toHaveBeenCalledWith("ws://localhost:8080/api/v1/emulator/ws-jsep");
  });

  test("Creates WsJsepProtocol with correct URL when HTTPS is used", async () => {
    await renderEmulator(<Emulator uri="https://example.com" width={300} height={300} />);
    expect(WsJsepProtocol).toHaveBeenCalledWith("wss://example.com/api/v1/emulator/ws-jsep");
  });

  test("Tries to establish a WebRTC connection", async () => {
    await renderEmulator(
      <Emulator
        uri="localhost:8080"
        width={300}
        height={300}
      />
    );

    expect(mockStartStream).toHaveBeenCalled();
  });

  test("Sends a gps location to the emulator via REST", async () => {
    await renderEmulator(
      <Emulator
        uri="localhost:8080"
        width={300}
        height={300}
        gps={{ latitude: 47.6062, longitude: 122.3321 }}
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/emulator/gps",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          latitude: 47.6062,
          longitude: 122.3321,
        }),
      })
    ));
  });

  test("Exposes sendKey via ref", async () => {
    const ref = React.createRef();
    await renderEmulator(<Emulator uri="localhost:8080" width={300} height={300} ref={ref} />);
    expect(ref.current).toBeDefined();
    expect(ref.current.sendKey).toBeDefined();

    ref.current.sendKey("Enter");
    expect(mockSend).toHaveBeenCalledWith("keyboard", expect.any(Proto.KeyboardEvent));
    const callArg = mockSend.mock.calls[0][1];
    expect(callArg.getKey()).toBe("Enter");
    expect(callArg.getEventtype()).toBe(Proto.KeyboardEvent.KeyEventType.KEYPRESS);
  });

  test("Sends a gps location to the emulator on update", async () => {
    const { rerender } = await renderEmulator(
      <Emulator
        uri="localhost:8080"
        width={300}
        height={300}
        gps={{ latitude: 47.6062, longitude: 122.3321 }}
      />
    );

    // Update GPS
    rerender(
      <Emulator
        uri="localhost:8080"
        width={300}
        height={300}
        gps={{ latitude: 48.0, longitude: 122.0 }}
      />
    );

    await waitFor(() => {
      const gpsCalls = global.fetch.mock.calls.filter(call => call[0] === "http://localhost:8080/api/v1/emulator/gps");
      expect(gpsCalls).toHaveLength(2);
      expect(gpsCalls[1][1].body).toBe(JSON.stringify({
        latitude: 48.0,
        longitude: 122.0,
      }));
    });
  });

  test("Cleans up JsepProtocol on unmount", async () => {
    const { unmount } = await renderEmulator(
      <Emulator uri="localhost:8080" width={300} height={300} />
    );
    unmount();
    expect(mockCleanup).toHaveBeenCalled();
  });
});
