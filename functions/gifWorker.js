const { parentPort, workerData } = require("worker_threads");
const effects = require(workerData.effectsPath);

parentPort.on("message", async ({ buffer, effect, isGif }) => {
  const startTime = performance.now();

  try {
    const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    const out = await effects[effect](input, isGif);

    const timeMs = Math.round(performance.now() - startTime);

    if (out === "only_gif") {
      parentPort.postMessage({ result: "only_gif", timeMs });
      return;
    }

    const result = Buffer.isBuffer(out) ? out : Buffer.from(out);
    const transfer =
      result.byteOffset === 0 && result.buffer instanceof ArrayBuffer
        ? [result.buffer]
        : [];
    try {
      parentPort.postMessage({ result, timeMs }, transfer);
    } catch {
      parentPort.postMessage({ result, timeMs });
    }
  } catch (err) {
    parentPort.postMessage({
      __ERR: err?.message ?? String(err),
    });
  }
});
