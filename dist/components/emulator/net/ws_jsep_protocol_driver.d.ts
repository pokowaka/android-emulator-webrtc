export interface WsJsepConfig {
    enableLogging?: boolean;
    onError?: (error: Error | Event) => void;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    reconnectBackoffFactor?: number;
    [key: string]: any;
}
export interface StreamCallbacks {
    onConnected?: (track: MediaStreamTrack) => void;
    onDisconnected?: (driver: WsJsepProtocol) => void;
}
export interface EmulatorController {
    sendMouse?(msg: any): void;
    sendKey?(msg: any): void;
    sendTouch?(msg: any): void;
}
export interface JsepSignal {
    start?: RTCConfiguration;
    type?: "offer" | "answer";
    sdp?: RTCSessionDescriptionInit | string;
    candidate?: RTCIceCandidateInit | string;
    bye?: boolean;
}
/**
 * A JSEP protocol driver that uses WebSockets for signaling.
 *
 * @export
 * @class WsJsepProtocol
 */
export default class WsJsepProtocol {
    wsUrl: string;
    emulator: EmulatorController | null;
    config: WsJsepConfig;
    onError?: (error: Error | Event) => void;
    maxReconnectAttempts: number;
    reconnectDelay: number;
    reconnectBackoffFactor: number;
    connected: boolean;
    event_forwarders: Record<string, RTCDataChannel>;
    peerConnection: RTCPeerConnection | null;
    ws: WebSocket | null;
    pendingCandidates: (RTCIceCandidateInit | string)[];
    remoteDescriptionSet: boolean;
    signalQueue: JsepSignal[];
    isProcessingSignal: boolean;
    onConnected: ((track: MediaStreamTrack) => void) | null;
    onDisconnected: ((driver: WsJsepProtocol) => void) | null;
    reconnectAttempts: number;
    reconnectTimeoutId: any | null;
    /**
     * Creates an instance of WsJsepProtocol.
     *
     * @param wsUrl The WebSocket JSEP signaling URL.
     * @param emulator Fallback emulator controller for sending events when WebRTC is unavailable.
     * @param config Configuration options.
     */
    constructor(wsUrl: string, emulator?: EmulatorController | null, config?: WsJsepConfig);
    /**
     * Establishes the WebSocket connection and starts the signaling process.
     * Cleans up any existing connection beforehand.
     *
     * @param callbacks Callbacks for stream lifecycle events.
     */
    startStream: (callbacks?: StreamCallbacks) => void;
    /**
     * Internal method to establish WebSocket connection.
     *
     * @private
     */
    _connect: () => void;
    /**
     * Queues a reconnection attempt with exponential backoff.
     *
     * @private
     */
    _queueReconnect: () => void;
    /**
     * Internal handler for incoming WebSocket messages. Parses the signal
     * and queues it for sequential processing.
     *
     * @private
     * @param event The WebSocket message event.
     */
    _handleWsMessage: (event: MessageEvent) => void;
    /**
     * Sequentially processes JSEP signals from the queue.
     *
     * @private
     */
    _processSignalQueue: () => Promise<void>;
    /**
     * Handles WebSocket connection close events.
     *
     * @private
     * @param event The WebSocket close event.
     */
    _handleWsClose: (event: CloseEvent) => void;
    /**
     * Handles WebSocket error events.
     *
     * @private
     * @param error The WebSocket error event.
     */
    _handleWsError: (error: Event) => void;
    /**
     * Processes a single JSEP signal (e.g., start, offer, answer, candidate, bye).
     *
     * @private
     * @param signal The JSEP signaling message.
     */
    _handleSignal: (signal: JsepSignal) => Promise<void>;
    /**
     * Initializes the RTCPeerConnection and local data channels based on the start configuration.
     *
     * @private
     * @param config The signaling start configuration.
     */
    _handleStart: (config: RTCConfiguration) => Promise<void>;
    /**
     * Handles incoming media track events from the RTCPeerConnection.
     *
     * @private
     * @param e The track event.
     */
    _handlePeerConnectionTrack: (e: RTCTrackEvent) => void;
    /**
     * Handles ICE candidate generation from the local RTCPeerConnection.
     *
     * @private
     * @param e The ICE candidate event.
     */
    _handlePeerIceCandidate: (e: RTCPeerConnectionIceEvent) => void;
    /**
     * Monitors connection state changes on the RTCPeerConnection to trigger disconnection.
     *
     * @private
     * @param e The state change event.
     */
    _handlePeerConnectionStateChange: (e: Event) => void;
    /**
     * Registers a data channel for event forwarding.
     *
     * @private
     * @param channel The data channel.
     */
    _setupDataChannel: (channel: RTCDataChannel) => void;
    /**
     * Handles remote data channel creation.
     *
     * @private
     * @param e The data channel event.
     */
    _handleDataChannel: (e: RTCDataChannelEvent) => void;
    /**
     * Processes a remote SDP offer or answer, applying it to the RTCPeerConnection.
     *
     * @private
     * @param sdp The session description.
     */
    _handleSDP: (sdp: RTCSessionDescriptionInit) => Promise<void>;
    /**
     * Adds a remote ICE candidate to the RTCPeerConnection.
     *
     * @private
     * @param candidate The ICE candidate object or string.
     */
    _addIceCandidate: (candidate: RTCIceCandidateInit | string) => void;
    /**
     * Handles an incoming remote ICE candidate, queueing it if the remote description is not yet set.
     *
     * @private
     * @param candidate The remote ICE candidate.
     */
    _handleCandidate: (candidate: RTCIceCandidateInit | string) => void;
    /**
     * Handles the 'bye' signal from the remote side, triggering disconnection.
     *
     * @private
     */
    _handleBye: () => void;
    /**
     * Serializes and sends a JSEP JSON message over the WebSocket.
     *
     * @private
     * @param jsonObject The JSON payload.
     */
    _sendJsep: (jsonObject: JsepSignal) => void;
    /**
     * Sends a control message (mouse, keyboard, touch) over either the corresponding
     * WebRTC DataChannel or via the fallback emulator controller.
     *
     * @param label The channel label ("mouse", "keyboard", "touch").
     * @param msg The protobuf message instance.
     */
    send: (label: string, msg: any) => void;
    /**
     * Cleans up the current connection's WebSocket and PeerConnection state,
     * but does not mark the driver as permanently disconnected or trigger
     * the onDisconnected callback. Used during reconnection.
     *
     * @private
     */
    _disconnectState: () => void;
    /**
     * Disconnects both the WebSocket signaling connection and the WebRTC PeerConnection.
     */
    disconnect: () => void;
    /**
     * Fully cleans up signaling and WebRTC state.
     */
    cleanup: () => void;
}
