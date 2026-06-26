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
import PropTypes from "prop-types";
import React, {
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import EmulatorWebrtcView from "./views/webrtc_view.js";
import withMouseKeyHandler from "./views/event_handler";
import WsJsepProtocol from "./net/ws_jsep_protocol_driver";
console.log("Imported WsJsepProtocol class:", WsJsepProtocol);
import * as Proto from "../../proto/emulator_controller_pb";

const RtcView = withMouseKeyHandler(EmulatorWebrtcView);

const getUrls = (uri) => {
  let restBase = uri;
  if (!/^https?:\/\//i.test(uri)) {
    restBase = "http://" + uri;
  }
  let wsUrl = restBase.replace(/^http/i, "ws");
  restBase = restBase.replace(/\/$/, "");
  wsUrl = wsUrl.replace(/\/$/, "");

  return {
    status: `${restBase}/api/v1/emulator/status`,
    gps: `${restBase}/api/v1/emulator/gps`,
    jsep: `${wsUrl}/api/v1/emulator/ws-jsep`,
  };
};

/**
 * A React component that displays a remote android emulator.
 *
 * The emulator will mount a png or webrtc view component to display the current state
 * of the emulator. It will translate mouse events on this component and send them
 * to the actual emulator.
 *
 * #### Authentication Service
 *
 * The authentication service should implement the following methods:
 *
 * - `authHeader()` which must return a set of headers that should be send along with a request.
 * - `unauthorized()` a function that gets called when a 401 was received.
 *
 * #### Type of view
 *
 * You usually want this to be webrtc as this will make use of the efficient
 * webrtc implementation. The png view will request screenshots, which are
 * very slow, and require the envoy proxy. You should not use this for remote emulators.
 *
 * Note that chrome will not autoplay the video if it is not muted and no interaction
 * with the page has taken place. See https://developers.google.com/web/updates/2017/09/autoplay-policy-changes.
 *
 * #### Pressing hardware buttons
 *
 * This component has a method `sendKey` that sends a key to the emulator.
 * You can use this to send physical button events to the emulator for example:
 *
 * "AudioVolumeDown" - 	Decreases the audio volume.
 * "AudioVolumeUp"   -	Increases the audio volume.
 * "Power"	         -  The Power button or key, turn off the device.
 * "AppSwitch"       -  Should bring up the application switcher dialog.
 * "GoHome"          -  Go to the home screen.
 * "GoBack"          -  Open the previous screen you were looking at.
 *
 */
const Emulator = forwardRef(
  (
    {
      uri,
      auth = null,
      muted = true,
      volume = 1.0,
      onStateChange = (s) => {
        console.debug("emulator state: " + s);
      },
      onAudioStateChange = (s) => {
        console.debug("emulator audio: " + s);
      },
      width,
      height,
      gps,
      onError = (e) => {
        console.error(e);
      },
    },
    ref
  ) => {
    const [audio, setAudio] = useState(false);
    const jsep = useRef(null);
    const viewRef = useRef(null);

    const urls = getUrls(uri);

    if (!jsep.current) {
      jsep.current = new WsJsepProtocol(urls.jsep);
      console.log("Created JSEP:", jsep.current);
    }

    useEffect(() => {
      if (typeof gps === "undefined") {
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
      };
      if (auth && auth.authHeader) {
        Object.assign(headers, auth.authHeader());
      }

      const body = JSON.stringify({
        latitude: gps.latitude,
        longitude: gps.longitude,
        altitude: gps.altitude,
        heading: gps.heading,
        speed: gps.speed,
      });

      fetch(urls.gps, {
        method: 'POST',
        headers,
        body,
      }).catch(err => {
        if (onError) onError(err);
      });
    }, [gps, uri, auth]);

    useEffect(() => {
      return () => {
        if (jsep.current) {
          jsep.current.cleanup();
        }
      };
    }, []);

    useImperativeHandle(ref, () => ({
      sendKey: (key) => {
        var request = new Proto.KeyboardEvent();
        request.setEventtype(Proto.KeyboardEvent.KeyEventType.KEYPRESS);
        request.setKey(key);
        jsep.current.send("keyboard", request);
      },
    }));

    const _onAudioStateChange = (s) => {
      setAudio(s);
      onAudioStateChange(s);
    };

    console.log(`render ${width}x${height}`);
    return (
      <RtcView
        ref={viewRef}
        width={width}
        height={height}
        statusUrl={urls.status}
        jsep={jsep.current}
        onStateChange={onStateChange}
        muted={muted}
        volume={volume}
        onError={onError}
        onAudioStateChange={_onAudioStateChange}
        auth={auth}
      />
    );
  }
);

Emulator.propTypes = {
  /** Endpoint where we can reach the emulator gateway (host:port or http(s)://host:port). */
  uri: PropTypes.string.isRequired,
  /** The authentication service to use, or null for no authentication. */
  auth: PropTypes.object,
  /** True if the audio should be disabled. */
  muted: PropTypes.bool,
  /** Volume between [0, 1] when audio is enabled. 0 is muted, 1.0 is 100% */
  volume: PropTypes.number,
  /** Called upon state change, one of ["connecting", "connected", "disconnected"] */
  onStateChange: PropTypes.func,
  /** Called when the audio becomes (un)available. True if audio is available, false otherwise. */
  onAudioStateChange: PropTypes.func,
  /** The width of the component */
  width: PropTypes.number,
  /** The height of the component */
  height: PropTypes.number,
  /** A [GeolocationCoordinates](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates) like object indicating where the device is. */
  gps: PropTypes.object,
  /** Callback that will be invoked in case of errors. */
  onError: PropTypes.func,
};

export default Emulator;
