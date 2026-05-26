const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '..');
const source = process.argv[2] || path.join(root, 'build', 'icon-source.svg');
const outputDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');

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

async function renderSvg(svg, size) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    webPreferences: {
      backgroundThrottling: false,
      offscreen: true,
    },
  });

  const tempDir = path.join(root, 'artifacts', 'icon-render');
  fs.mkdirSync(tempDir, { recursive: true });
  const svgFile = path.join(tempDir, `protocolito-icon-${size}-${process.pid}.svg`);
  fs.writeFileSync(svgFile, svg, 'utf8');

  const html = `
    <!doctype html>
    <html>
      <head>
        <style>
          html, body {
            width: ${size}px;
            height: ${size}px;
            margin: 0;
            overflow: hidden;
            background: transparent;
          }
          img {
            width: ${size}px;
            height: ${size}px;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${pathToFileURL(svgFile).href}" />
      </body>
    </html>
  `;

  const tempFile = path.join(tempDir, `protocolito-icon-${size}-${process.pid}.html`);
  fs.writeFileSync(tempFile, html, 'utf8');
  await win.loadURL(pathToFileURL(tempFile).href);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const image = await win.capturePage();
  win.destroy();
  try {
    fs.unlinkSync(tempFile);
    fs.unlinkSync(svgFile);
  } catch {
    // Best-effort cleanup only.
  }
  return image;
}

async function main() {
  if (!fs.existsSync(source)) {
    throw new Error(`Icon source not found: ${source}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const svg = fs.readFileSync(source, 'utf8');
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const sourceImage = await renderSvg(svg, 512);
  const rendered = sizes.map((size) => ({
    size,
    png: size === 512
      ? sourceImage.toPNG()
      : sourceImage.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }));

  fs.writeFileSync(path.join(outputDir, 'icon.png'), rendered.find((entry) => entry.size === 512).png);
  fs.writeFileSync(path.join(outputDir, 'app_icon.ico'), buildIco(rendered.filter((entry) => entry.size <= 256)));
  fs.writeFileSync(path.join(publicDir, 'icon_128x128.png'), rendered.find((entry) => entry.size === 128).png);
  fs.writeFileSync(path.join(publicDir, 'icon_32x32@2x.png'), rendered.find((entry) => entry.size === 64).png);

  console.log(`Generated Protocolito icons from ${source}`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.quit();
    process.exitCode = 1;
  });
