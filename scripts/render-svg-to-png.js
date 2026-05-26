const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '..');
const source = process.argv[2] || path.join(root, 'resources', 'app-icon-source.svg');
const output = process.argv[3] || path.join(root, 'resources', 'app-icon-source.png');
const size = Number(process.argv[4] || 1024);

async function main() {
  const sourcePath = path.resolve(source);
  const outputPath = path.resolve(output);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`SVG source not found: ${sourcePath}`);
  }

  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  const svg = fs.readFileSync(sourcePath, 'utf8');
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
          svg {
            width: ${size}px;
            height: ${size}px;
            display: block;
          }
        </style>
      </head>
      <body>
        ${svg}
      </body>
    </html>
  `;

  const tempDir = path.join(root, 'artifacts', 'icon-render');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, `render-svg-${process.pid}.html`);
  fs.writeFileSync(tempFile, html, 'utf8');

  await win.loadURL(pathToFileURL(tempFile).href);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const image = await win.capturePage();
  win.destroy();

  fs.writeFileSync(outputPath, image.toPNG());
  fs.rmSync(tempFile, { force: true });
  console.log(`Rendered ${sourcePath} -> ${outputPath}`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.quit();
    process.exitCode = 1;
  });
