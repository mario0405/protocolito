const fs = require('fs');
const path = require('path');
const { rcedit } = require('rcedit');

const root = path.resolve(__dirname, '..');
const exePath = path.join(root, 'dist', 'win-unpacked', 'Protocolito.exe');
const iconPath = path.join(root, 'build', 'app_icon.ico');

async function main() {
  if (process.platform !== 'win32') {
    console.log('Skipping Windows icon patch on non-Windows platform.');
    return;
  }

  if (!fs.existsSync(exePath)) throw new Error(`Packaged exe not found: ${exePath}`);
  if (!fs.existsSync(iconPath)) throw new Error(`Icon not found: ${iconPath}`);

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: 'Protocolito',
      ProductName: 'Protocolito',
      InternalName: 'Protocolito',
      OriginalFilename: 'Protocolito.exe',
    },
  });

  console.log(`Patched Windows executable icon: ${exePath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
