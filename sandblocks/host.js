export function hostAvailable() {
  return !!window.io;
}

export const socket = hostAvailable() ? io() : null;
export function request(name, data) {
  return new Promise((resolve, reject) => {
    socket.emit(name, data, (ret) => {
      if (ret.error) reject(ret.error);
      else resolve(ret);
    });
  });
}

export class Process {
  static complete(command, args, cwd, input) {
    return new Promise(async (resolve) => {
      const process = new Process();
      await process.start(command, args, cwd);
      await process.write(input);
      await process.close();

      const out = [];
      const err = [];
      process.onStdout((data) => out.push(data));
      process.onStderr((data) => err.push(data));
      process.onClose(() => resolve(out.join("")));
    });
  }

  async start(command, args, cwd, binary = false) {
    const res = await request("startProcess", { command, args, cwd, binary });
    this.pid = res.pid;
    this.binary = binary;

    socket.on("process", (data) => {
      if (data.pid === this.pid) {
        switch (data.type) {
          case "close":
            this._onClose?.(data.code);
            break;
          case "stderr":
            this._emit(this._onStderr, data.data);
            break;
          case "stdout":
            this._emit(this._onStdout, data.data);
            break;
        }
      }
    });
  }

  onStdout(cb) {
    this._onStdout = cb;
    return this;
  }

  onStderr(cb) {
    this._onStderr = cb;
    return this;
  }

  onClose(cb) {
    this._onClose = cb;
    return this;
  }

  // if binary, expect data to be Uint8Array
  async write(data) {
    console.assert(!!this.pid);
    await request("writeProcess", {
      pid: this.pid,
      data: this.binary ? await this._arrayToBase64(data) : data,
    });
  }

  async _arrayToBase64(array) {
    return (
      await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(new Blob([array]));
      })
    ).substring("data:application/octet-stream;base64,".length);
  }

  async _base64ToArray(base64) {
    return new Uint8Array(
      await (
        await fetch("data:application/octet-binary;base64," + base64)
      ).arrayBuffer(),
    );
  }

  _emit(cb, data) {
    if (cb) {
      if (this.binary) this._emitBinary(cb, data);
      else cb(data);
    }
  }

  _binaryQueue = [];

  _emitBinary(cb, data) {
    this._binaryQueue.push([cb, this._base64ToArray(data)]);

    if (!this._isProcessing) {
      this._processBinaryQueue();
    }
  }

  async _processBinaryQueue() {
    this._isProcessing = true;
    while (this._binaryQueue.length > 0) {
      const [cb, promise] = this._binaryQueue.shift();
      cb(await promise);
    }
    this._isProcessing = false;
  }

  async close() {
    console.assert(!!this.pid);
    await request("closeProcess", { pid: this.pid });
  }
}
