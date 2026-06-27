import React from "react";
export interface EmulatorProps {
    /** Endpoint where we can reach the emulator gateway (host:port or http(s)://host:port). */
    uri: string;
    /** The authentication service to use, or null for no authentication. */
    auth?: any;
    /** True if the audio should be disabled. */
    muted?: boolean;
    /** Volume between [0, 1] when audio is enabled. 0 is muted, 1.0 is 100% */
    volume?: number;
    /** Called upon state change, one of ["connecting", "connected", "disconnected"] */
    onStateChange?: (state: string) => void;
    /** Called when the audio becomes (un)available. True if audio is available, false otherwise. */
    onAudioStateChange?: (audio: boolean) => void;
    /** The width of the component */
    width?: number;
    /** The height of the component */
    height?: number;
    /** A [GeolocationCoordinates](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates) like object indicating where the device is. */
    gps?: {
        latitude: number;
        longitude: number;
        altitude?: number;
        heading?: number;
        speed?: number;
    };
    /** Callback that will be invoked in case of errors. */
    onError?: (error: any) => void;
}
export interface EmulatorRef {
    sendKey(key: string): void;
}
/**
 * A React component that displays a remote android emulator.
 *
 * The emulator will mount a webrtc view component to display the current state
 * of the emulator. It will translate mouse and touch events on this component and send them
 * to the actual emulator over WebRTC Data Channels.
 *
 * #### Authentication Service
 *
 * The authentication service should implement the following methods:
 *
 * - `authHeader()` which must return a set of headers that should be send along with a request.
 * - `unauthorized()` a function that gets called when a 401 was received.
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
declare const Emulator: React.ForwardRefExoticComponent<EmulatorProps & React.RefAttributes<EmulatorRef>>;
export default Emulator;
