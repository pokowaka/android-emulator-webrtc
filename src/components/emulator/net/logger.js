import log from "loglevel";

// Create a logger specific to the emulator package
const logger = log.getLogger("android-emulator-webrtc");

// Default to "info" level so that verbose signaling (debug) is hidden by default,
// but warnings and errors are still printed.
logger.setDefaultLevel("info");

export default logger;
