import React from "react";
import WsJsepProtocol from "../net/ws_jsep_protocol_driver";
export interface EmulatorWebrtcViewProps {
    /** The JSEP protocol driver instance. */
    jsep: WsJsepProtocol;
    /** Callback for connection state changes ("connecting", "connected", "disconnected"). */
    onStateChange?: (state: string) => void;
    /** Callback when audio track status changes. */
    onAudioStateChange?: (audio: boolean) => void;
    /** Whether the audio should be muted. */
    muted?: boolean;
    /** Audio volume (between 0.0 and 1.0). */
    volume?: number;
    /** Callback invoked on signaling or playback errors. */
    onError?: (error: Error) => void;
    /** Component width. */
    width?: number;
    /** Component height. */
    height?: number;
}
/**
 * A React component that renders the WebRTC video stream of the emulator.
 * Handles establishing the stream via the JSEP protocol driver and managing
 * local playback (including handling autoplay constraints).
 */
declare const EmulatorWebrtcView: React.FC<EmulatorWebrtcViewProps>;
export default EmulatorWebrtcView;
