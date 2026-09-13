const { toValidPath } = require("./path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");
const gifFrames = require("gif-frames");

if (typeof document === "undefined") {
  global.document = {
    createElement: () => {
      return createCanvas(100, 100);
    },
  };
}

const DEFAULT_QUALITY = 1;
const MAX_OUTPUT_FRAMES = 30;

async function loadFrames(buffer, isGif) {
  return isGif
    ? await gifFrames({
        url: buffer,
        frames: "all",
        outputType: "canvas",
        cumulative: false,
      })
    : await loadImage(buffer);
}

function getFrameIndex(i, spriteCount, framesLength) {
  const speed = framesLength / spriteCount;
  return Math.floor(i * speed) % framesLength;
}

function easeInOut(x) {
  return x * x * (3 - 2 * x);
}

function createEncoder(width, height) {
  const encoder = new GIFEncoder(width, height, "octree", true);
  encoder.setRepeat(0);
  encoder.setQuality(DEFAULT_QUALITY);
  encoder.setThreshold(0);
  encoder.setPaletteSize(7);
  encoder.sample = 10;
  return encoder;
}

async function rainbow(buffer, isGif) {
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;

  const sourceFramesLength = Array.isArray(frames) ? frames.length : 30;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 60);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.globalCompositeOperation = "source-over";

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);

    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(frame, 0, 0, width, height);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = `hsl(${(i / framesLength) * 360}, 100%, 50%)`;
    ctx.fillRect(0, 0, width, height);

    if (isGif)
      encoder.setDelay((frames[sourceIndex].frameInfo.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function boykisser(buffer, isGif) {
  const spriteImage = await loadImage(toValidPath("../images/boykisser.png"));
  const spriteWidth = 320;
  const spriteHeight = 342;
  const spriteCount = 22;

  const frames = await loadFrames(buffer, isGif);

  const framesLength = Array.isArray(frames) ? frames.length : 1;

  const encoder = createEncoder(spriteWidth, spriteHeight);
  encoder.setDelay(100);
  encoder.start();

  const canvas = createCanvas(spriteWidth, spriteHeight);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < spriteCount; i++) {
    const frame = isGif
      ? await frames[getFrameIndex(i, spriteCount, framesLength)].getImage()
      : frames;

    ctx.clearRect(0, 0, spriteWidth, spriteHeight);

    ctx.drawImage(
      spriteImage,
      (i % spriteCount) * spriteWidth,
      0,
      spriteWidth,
      spriteHeight,
      0,
      0,
      spriteWidth,
      spriteHeight,
    );

    ctx.drawImage(frame, 236, 16, 61, 31);
    ctx.drawImage(frame, 129, 55, 47, 31);

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function thanosReactThisMan(buffer, isGif) {
  const spriteImage = await loadImage(toValidPath("../images/thanos.png"));
  const spriteWidth = 498;
  const spriteHeight = 348;
  const spriteCount = 37;

  const frames = await loadFrames(buffer, isGif);

  const framesLength = Array.isArray(frames) ? frames.length : 1;

  const encoder = createEncoder(spriteWidth, spriteHeight);
  encoder.setDelay(50);
  encoder.start();

  const canvas = createCanvas(spriteWidth, spriteHeight);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < spriteCount; i++) {
    const frame = isGif
      ? await frames[getFrameIndex(i, spriteCount, framesLength)].getImage()
      : frames;

    ctx.clearRect(0, 0, spriteWidth, spriteHeight);

    ctx.drawImage(
      spriteImage,
      (i % spriteCount) * spriteWidth,
      0,
      spriteWidth,
      spriteHeight,
      0,
      0,
      spriteWidth,
      spriteHeight,
    );

    ctx.drawImage(frame, 211, 26, 77, 61);

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function scaryAttack(buffer, isGif) {
  const spriteImage = await loadImage(
    toValidPath("../images/scary-attack.png"),
  );
  const spriteWidth = 240;
  const spriteHeight = 300;
  const spriteCount = 64;

  const frames = await loadFrames(buffer, isGif);

  const framesLength = Array.isArray(frames) ? frames.length : 1;

  const encoder = createEncoder(spriteWidth, spriteHeight);
  encoder.setDelay(4);
  encoder.start();

  const canvas = createCanvas(spriteWidth, spriteHeight);
  const ctx = canvas.getContext("2d", { alpha: false });

  const positions = JSON.parse(
    "[[195, -72],[195, -72],[191, -65],[189, -63],[188, -61],[187, -58],[185, -54],[182, -49],[180, -47],[178, -42],[174, -36],[173, -34],[172, -30],[170, -28],[167, -23],[165, -19],[162, -12],[159, -7],[157, -4],[156, 0],[155, 1],[152, 25],[150, 70],[149, 100],[146, 119],[146, 120],[144, 120],[143, 120],[142, 120],[140, 120],[137, 120],[135, 120],[134, 121],[134, 121],[132, 122],[131, 122],[129, 122],[127, 122],[127, 122],[126, 122],[124, 122],[122, 122],[119, 123],[118, 124],[112, 126],[108, 127],[104, 128],[96, 132],[86, 134],[81, 137],[75, 140],[73, 141],[71, 142],[70, 142],[66, 144],[64, 145],[64, 146],[63, 137],[69, 116],[67, 120],[64, 124],[57, 131],[52, 136],[49, 140],[49, 140]]",
  );

  for (let i = 0; i < spriteCount; i++) {
    const frame = isGif
      ? await frames[getFrameIndex(i, spriteCount, framesLength)].getImage()
      : frames;

    ctx.clearRect(0, 0, spriteWidth, spriteHeight);

    ctx.drawImage(
      spriteImage,
      (i % spriteCount) * spriteWidth,
      0,
      spriteWidth,
      spriteHeight,
      0,
      0,
      spriteWidth,
      spriteHeight,
    );

    ctx.drawImage(frame, ...positions[i], 87, 96);

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function compress(buffer, isGif) {
  if (!isGif) return "only_gif";

  const frames = await loadFrames(buffer, true);

  const width = Math.max(1, frames[0].frameInfo.width / 2);
  const height = Math.max(1, frames[0].frameInfo.height / 2);

  const framesLength = frames.length;

  const encoder = createEncoder(width, height);
  encoder.setRepeat(0);
  encoder.setQuality(255);
  encoder.setDelay(0);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(await frames[i].getImage(), 0, 0, width, height);
    encoder.setDelay((frames[i].frameInfo.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function waveDistortAnimated(buffer, isGif) {
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;

  const sourceFramesLength = Array.isArray(frames) ? frames.length : 30;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 40);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  const amplitude = 10;
  const frequency = 0.05;

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);

    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;
    ctx.drawImage(frame, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const outputCanvas = createCanvas(width, height);
    const outputCtx = outputCanvas.getContext("2d", { alpha: false });
    const outputImageData = outputCtx.createImageData(width, height);

    const phaseOffset = (i / framesLength) * 2 * Math.PI;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offsetX = Math.sin(y * frequency + phaseOffset) * amplitude;
        const newX = Math.round(x + offsetX);

        if (newX >= 0 && newX < width) {
          const srcIndex = (y * width + x) * 4;
          const destIndex = (y * width + newX) * 4;

          outputImageData.data[destIndex] = data[srcIndex];
          outputImageData.data[destIndex + 1] = data[srcIndex + 1];
          outputImageData.data[destIndex + 2] = data[srcIndex + 2];
          outputImageData.data[destIndex + 3] = data[srcIndex + 3];
        }
      }
    }

    outputCtx.putImageData(outputImageData, 0, 0);
    if (isGif)
      encoder.setDelay((frames[sourceIndex]?.frameInfo?.delay ?? 5) * 10);
    encoder.addFrame(outputCtx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function violentSquish(buffer, isGif) {
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;
  const sourceFramesLength = Array.isArray(frames) ? frames.length : 20;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 30);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);

    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;

    const scaleX = Math.random() * 0.3 + 0.7;
    const scaleY = Math.random() * 0.3 + 0.7;

    const newWidth = width * scaleX;
    const newHeight = height * scaleY;

    const posX = (width - newWidth) / 2;
    const posY = height - newHeight;

    ctx.drawImage(frame, posX, posY, newWidth, newHeight);

    if (isGif)
      encoder.setDelay((frames[sourceIndex]?.frameInfo?.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function rotate(buffer, isGif) {
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;
  const sourceFramesLength = Array.isArray(frames) ? frames.length : 30;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 50);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);
    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;

    const angle = (i / framesLength) * 2 * Math.PI;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.drawImage(frame, -centerX, -centerY, width, height);
    ctx.restore();

    if (isGif)
      encoder.setDelay((frames[sourceIndex]?.frameInfo?.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function rotateCounterclockwise(buffer, isGif) {
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;
  const sourceFramesLength = Array.isArray(frames) ? frames.length : 30;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 50);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);
    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;

    const angle = -(i / framesLength) * 2 * Math.PI;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.drawImage(frame, -centerX, -centerY, width, height);
    ctx.restore();

    if (isGif)
      encoder.setDelay((frames[sourceIndex]?.frameInfo?.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function shuffle(buffer, isGif) {
  if (!isGif) return "only_gif";

  const frames = await loadFrames(buffer, true);
  for (let i = frames.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [frames[i], frames[j]] = [frames[j], frames[i]];
  }

  const width = Math.max(1, frames[0].frameInfo.width);
  const height = Math.max(1, frames[0].frameInfo.height);

  const framesLength = frames.length;

  const encoder = createEncoder(width, height);
  encoder.setDelay(0);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(await frames[i].getImage(), 0, 0, width, height);
    encoder.setDelay((frames[i].frameInfo.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function heartbeat(buffer, isGif) {
  const minScale = 0.75;
  const frames = await loadFrames(buffer, isGif);

  const width = isGif ? frames[0].frameInfo.width : frames.width;
  const height = isGif ? frames[0].frameInfo.height : frames.height;

  const sourceFramesLength = Array.isArray(frames) ? frames.length : 30;
  const framesLength = Math.min(sourceFramesLength, MAX_OUTPUT_FRAMES);

  const heartbeatScale = (i) => {
    const t = i / (framesLength - 1);

    let progress;
    if (t < 0.5) {
      progress = t / 0.5;
      return 1 - (1 - minScale) * easeInOut(progress);
    } else {
      progress = (t - 0.5) / 0.5;
      return minScale + (1 - minScale) * easeInOut(progress);
    }
  };

  const encoder = createEncoder(width, height);
  encoder.setDelay(isGif ? 0 : 40);
  encoder.start();

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });

  const drawHeartbeatFrame = (img, scale) => {
    const scaledW = width * scale;
    const scaledH = height * scale;

    const x = (width - scaledW) / 2;
    const y = (height - scaledH) / 2;

    ctx.drawImage(img, x, y, scaledW, scaledH);
  };

  for (let i = 0; i < framesLength; i++) {
    ctx.clearRect(0, 0, width, height);

    const sourceIndex = isGif
      ? getFrameIndex(i, framesLength, sourceFramesLength)
      : 0;
    const frame = isGif ? await frames[sourceIndex].getImage() : frames;

    drawHeartbeatFrame(frame, heartbeatScale(i));

    if (isGif)
      encoder.setDelay((frames[sourceIndex]?.frameInfo?.delay ?? 5) * 10);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

async function getThisManA(buffer, isGif) {
  const spriteImage = await loadImage(
    toValidPath("../images/get-this-man-a.png"),
  );
  const spriteWidth = 485;
  const spriteHeight = 200;
  const spriteCount = 39;

  const frames = await loadFrames(buffer, isGif);

  const framesLength = Array.isArray(frames) ? frames.length : 1;

  const encoder = createEncoder(spriteWidth, spriteHeight);
  encoder.setDelay(40);
  encoder.start();

  const canvas = createCanvas(spriteWidth, spriteHeight);
  const ctx = canvas.getContext("2d", { alpha: false });

  for (let i = 0; i < spriteCount; i++) {
    const frame = isGif
      ? await frames[getFrameIndex(i, spriteCount, framesLength)].getImage()
      : frames;

    ctx.clearRect(0, 0, spriteWidth, spriteHeight);

    ctx.drawImage(
      spriteImage,
      (i % spriteCount) * spriteWidth,
      0,
      spriteWidth,
      spriteHeight,
      0,
      0,
      spriteWidth,
      spriteHeight,
    );

    ctx.drawImage(frame, 319, 157, 68, 33);

    encoder.addFrame(ctx);
  }

  encoder.finish();
  return encoder.out.getData();
}

module.exports = {
  rainbow,
  boykisser,
  thanosReactThisMan,
  compress,
  waveDistortAnimated,
  violentSquish,
  rotate,
  rotateCounterclockwise,
  shuffle,
  scaryAttack,
  heartbeat,
  getThisManA,
};
