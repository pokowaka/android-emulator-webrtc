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
import { EventEmitter } from "events";

/**
 * Observe the logcat stream from the emulator.
 *
 * Streaming is done by polling the emulator REST endpoint.
 *
 * It will send out the following events:
 *
 * - `start` whenever the start method was called.
 * - `data` whenever new data became available.
 * - `end` whenever the stream is finished, either because it was stopped, or due to an error.
 */
class Logcat {
  /**
   * Creates a logcat stream.
   *
   *  The authentication service should implement the following methods:
   * - `authHeader()` which must return a set of headers that should be send along with a request.
   * - `unauthorized()` a function that gets called when a 401 was received.
   *
   * @constructor
   * @param {string} logcatUrl Full REST URL to the logcat endpoint.
   * @param {object} auth Authentication helper.
   */
  constructor(logcatUrl, auth) {
    this.logcatUrl = logcatUrl;
    this.auth = auth;
    this.offset = 0;
    this.events = new EventEmitter();
    this.refreshRate = 1000;
    this.timerID = null;
  }

  /**
   * Register a listener.
   *
   * @param {string} name Name of the event.
   * @param  {Callback} fn Function to notify on the given event.
   * @memberof Logcat
   */
  on = (name, fn) => {
    this.events.on(name, fn);
  };

  /**
   * Removes a listener.
   *
   * @param {string} name Name of the event.
   * @param  {Callback} fn Function to notify on the given event.
   * @memberof Logcat
   */
  off = (name, fn) => {
    this.events.off(name, fn);
  };

  /**
   * Cancel the currently active logcat stream.
   *
   * @memberof Logcat
   */
  stop = () => {
    if (this.timerID) {
      clearInterval(this.timerID);
      this.timerID = null;
    }
    this.events.emit("end");
  };

  pollStream = () => {
    const self = this;
    const url = new URL(this.logcatUrl);
    url.searchParams.append("start", this.offset);

    const headers = {
      "Accept": "application/json",
    };
    if (this.auth && this.auth.authHeader) {
      Object.assign(headers, this.auth.authHeader());
    }

    fetch(url.toString(), { headers })
      .then((res) => {
        if (res.status === 401 && this.auth && this.auth.unauthorized) {
          this.auth.unauthorized();
        }
        if (!res.ok) {
          throw new Error("HTTP error " + res.status);
        }
        return res.json();
      })
      .then((response) => {
        const nextOffset = response.next;
        if (nextOffset > self.offset) {
          self.offset = nextOffset;
          self.events.emit("data", response.contents);
        }
      })
      .catch((err) => {
        console.error("Logcat error:", err);
        this.stop();
      });
  };

  /**
   * Requests the logcat stream, invoking the callback when a log line arrives.
   *
   * @param  {Callback} fnNotify when a new log line arrives.
   * @param  {number} refreshRate polling interval. Must be > 0.
   * @memberof Logcat
   */
  start = (fnNotify, refreshRate = 1000) => {
    if (fnNotify) this.on("data", fnNotify);

    this.refreshRate = refreshRate;
    if (this.refreshRate <= 0) {
      console.warn("Streaming logcat is no longer supported. Falling back to 1000ms polling.");
      this.refreshRate = 1000;
    }
    this.timerID = setInterval(() => this.pollStream(), this.refreshRate);
    this.events.emit("start");
  };
}

export default Logcat;
