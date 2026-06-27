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
import React, { useEffect, useRef, useState } from "react";
import logger from "../net/logger";

/**
 * A React component that renders the WebRTC video stream of the emulator.
 * Handles establishing the stream via the JSEP protocol driver and managing
 * local playback (including handling autoplay constraints).
 *
 * @param {Object} props Component properties.
 * @param {Object} props.jsep The JSEP protocol driver instance.
 * @param {function(string): void} [props.onStateChange] Callback for connection state changes ("connecting", "connected", "disconnected").
 * @param {function(boolean): void} [props.onAudioStateChange] Callback when audio track status changes.
 * @param {boolean} [props.muted=true] Whether the audio should be muted.
 * @param {number} [props.volume=1.0] Audio volume (between 0.0 and 1.0).
 * @param {function(Error): void} props.onError Callback invoked on signaling or playback errors.
 * @param {number} [props.width] Component width.
 * @param {number} [props.height] Component height.
 */
const EmulatorWebrtcView = ({
  jsep,
  onStateChange,
  onAudioStateChange,
  muted = true,
  volume = 1.0,
  onError = (e) => logger.error("WebRTC error: " + e),
  width,
  height,
}) => {
  const [audio, setAudio] = useState(false);
  const videoRef = useRef(null);
  const [connect, setConnect] = useState("connecting");


  useEffect(() => {
    if (onStateChange) {
      onStateChange(connect);
    }
  }, [connect]);


  useEffect(() => {
    if (onAudioStateChange) {
      onAudioStateChange(audio);
    }
  }, [audio]);

  const onDisconnect = () => {
    setConnect("disconnected");
    setAudio(false);
  };

  const onConnect = (track) => {
    setConnect("connected");
    const video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }

    if (!video.srcObject) {
      video.srcObject = new MediaStream();
    }
    video.srcObject.addTrack(track);
    if (track.kind === "audio") {
      setAudio(true);
    }
  };

  const safePlay = () => {
    const video = videoRef.current;
    if (!video) {
      // Component was unmounted.
      return;
    }

    const possiblePromise = video.play();
    if (possiblePromise) {
      possiblePromise
        .then((_) => {
          logger.debug("Automatic playback started!");
        })
        .catch((error) => {
          // Notify listeners that we cannot start.
          onError(error);
        });
    }
  };

  const onCanPlay = () => {
    safePlay();
  };

  const onContextMenu = (e) => {
    e.preventDefault();
  };

  useEffect(() => {
    jsep.startStream({
      onConnected: onConnect,
      onDisconnected: onDisconnect,
    });

    setConnect("connecting");

    return () => {
      jsep.disconnect();
    };
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <video
      ref={videoRef}
      style={{
        display: "block",
        position: "relative",
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "100%",
        objectFit: "contain",
        objectPosition: "center",
      }}
      muted={muted}
      onContextMenu={onContextMenu}
      onCanPlay={onCanPlay}
    />
  );
};

EmulatorWebrtcView.propTypes = {
  jsep: PropTypes.object,
  onStateChange: PropTypes.func,
  onAudioStateChange: PropTypes.func,
  muted: PropTypes.bool,
  volume: PropTypes.number,
  onError: PropTypes.func,
  width: PropTypes.number,
  height: PropTypes.number,
};

export default EmulatorWebrtcView;

