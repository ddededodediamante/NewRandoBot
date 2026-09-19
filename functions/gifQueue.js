const { Worker } = require("worker_threads");
const path = require("path");

const worker = new Worker(path.join(__dirname, "gifWorker.js"), {
  workerData: {
    effectsPath: require.resolve("./gifEffects"),
  },
});

const queue = [];
let busy = false;

worker.on("message", (msg) => {
  const job = queue.shift();
  busy = false;

  if (!job) return;

  if (msg && msg.__ERR) {
    job.reject(new Error(msg.__ERR));
  } else {
    job.resolve(msg);
  }

  processQueue();
});

worker.on("error", (err) => {
  const job = queue.shift();
  busy = false;
  if (job) job.reject(err);
  processQueue();
});

function getTransferList(payload) {
  const buffer = payload && payload.buffer;
  if (
    Buffer.isBuffer(buffer) &&
    buffer.byteOffset === 0 &&
    buffer.buffer instanceof ArrayBuffer
  ) {
    return [buffer.buffer];
  }
  return [];
}

function processQueue() {
  if (busy) return;
  const job = queue[0];
  if (!job) return;

  busy = true;
  try {
    worker.postMessage(job.payload, getTransferList(job.payload));
  } catch {
    worker.postMessage(job.payload);
  }
}

function enqueueGifJob(payload) {
  return new Promise((resolve, reject) => {
    queue.push({ payload, resolve, reject });
    processQueue();
  });
}

function getQueueLength() {
  return queue.length + (busy ? 1 : 0);
}

module.exports = {
  enqueueGifJob,
  getQueueLength,
};
