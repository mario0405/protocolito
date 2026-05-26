const fs = require('fs');
const path = require('path');
const { app, nativeImage } = require('electron');

const root = path.resolve(__dirname, '..');
const source = process.argv[2] || path.join(root, 'resources', 'app-icon-source.png');

function icoDimension(size) {
  return size >= 256 ? 0 : size;
}

function buildIco(entries) {
  const headerSize = 6;
  const directorySize = 16 * entries.length;
  let offset = headerSize + directorySize;
  const header = Buffer.alloc(headerSize + directorySize);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  entries.forEach((entry, index) => {
    const pos = headerSize + index * 16;
    header.writeUInt8(icoDimension(entry.size), pos);
    header.writeUInt8(icoDimension(entry.size), pos + 1);
    header.writeUInt8(0, pos + 2);
    header.writeUInt8(0, pos + 3);
    header.writeUInt16LE(1, pos + 4);
    header.writeUInt16LE(32, pos + 6);
    header.writeUInt32LE(entry.png.length, pos + 8);
    header.writeUInt32LE(offset, pos + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, ...entries.map((entry) => entry.png)]);
}

function renderSize(image, size) {
  return image.resize({ width: size, height: size, quality: 'best' }).toPNG();
}

async function main() {
  const sourcePath = path.resolve(source);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Icon source not found: ${sourcePath}`);
  }

  const resourcesDir = path.join(root, 'resources');
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const sourceImage = nativeImage.createFromPath(sourcePath);
  if (sourceImage.isEmpty()) {
    throw new Error(`Unable to read icon source: ${sourcePath}`);
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const rendered = sizes.map((size) => ({
    size,
    png: renderSize(sourceImage, size),
  }));

  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), rendered.find((entry) => entry.size === 512).png);
  fs.writeFileSync(path.join(resourcesDir, 'app_icon.ico'), buildIco(rendered.filter((entry) => entry.size <= 256)));
  fs.writeFileSync(path.join(publicDir, 'app-icon.png'), rendered.find((entry) => entry.size === 512).png);
  fs.writeFileSync(path.join(publicDir, 'icon_128x128.png'), rendered.find((entry) => entry.size === 128).png);
  fs.writeFileSync(path.join(publicDir, 'icon_32x32@2x.png'), rendered.find((entry) => entry.size === 64).png);

  console.log(`Generated app icons from ${sourcePath}`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.quit();
    process.exitCode = 1;
  });
