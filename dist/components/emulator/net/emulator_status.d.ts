export interface AuthService {
    authHeader?(): Record<string, string>;
    unauthorized?(): void;
}
export interface EmulatorStatusData {
    status?: string;
    hardwareConfig?: Record<string, string>;
    [key: string]: any;
}
/**
 * Utility class to query and manage the emulator's status by communicating
 * with its REST configuration endpoint. It parses the hardware configuration
 * and caches the status.
 *
 * @export
 * @class EmulatorStatus
 */
declare class EmulatorStatus {
    statusUrl: string;
    auth: AuthService | null;
    status: EmulatorStatusData | null;
    /**
     * Creates an EmulatorStatus object that can retrieve the status of the running emulator.
     *
     * @param statusUrl The REST endpoint to retrieve status.
     * @param auth The authentication service to use, or null for no authentication.
     */
    constructor(statusUrl: string, auth?: AuthService | null);
    /**
     * Gets the cached status object.
     *
     * @returns The cached emulator status or null if not yet loaded.
     * @memberof EmulatorStatus
     */
    getStatus: () => EmulatorStatusData | null;
    /**
     * Retrieves the current status from the emulator REST endpoint.
     *
     * @param fnNotify Callback invoked when the status is retrieved. Receives the status object.
     * @param cache If true, uses the cached status if available instead of fetching.
     * @memberof EmulatorStatus
     */
    updateStatus: (fnNotify: (status: EmulatorStatusData) => void, cache?: boolean) => EmulatorStatusData;
}
export default EmulatorStatus;
