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

/**
 * Gets the status of the emulator, parsing the hardware config into something
 * easy to digest.
 *
 * @export
 * @class EmulatorStatus
 */
class EmulatorStatus {
  /**
   * Creates an EmulatorStatus object that can retrieve the status of the running emulator.
   *
   * @param {string} statusUrl The REST endpoint to retrieve status.
   * @param {object} auth The authentication service to use, or null for no authentication.
   */
  constructor(statusUrl, auth) {
    this.statusUrl = statusUrl;
    this.auth = auth;
    this.status = null;
  }

  /**
   * Gets the cached status.
   *
   * @memberof EmulatorStatus
   */
  getStatus = () => {
    return this.status;
  };

  /**
   * Retrieves the current status from the emulator.
   *
   * @param  {Callback} fnNotify when the status is available, returns the retrieved status.
   * @param  {boolean} cache True if the cache can be used.
   * @memberof EmulatorStatus
   */
  updateStatus = (fnNotify, cache) => {
    if (!this.statusUrl) {
      return;
    }
    if (cache && this.status) {
      fnNotify(this.status);
      return this.status;
    }

    const headers = {
      Accept: "application/json",
    };
    if (this.auth && this.auth.authHeader) {
      Object.assign(headers, this.auth.authHeader());
    }

    fetch(this.statusUrl, { headers })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        this.status = data;
        fnNotify(this.status);
      })
      .catch((err) => {
        console.error("Failed to get emulator status:", err);
      });
  };
}

export default EmulatorStatus;