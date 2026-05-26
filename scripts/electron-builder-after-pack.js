const path = require('path');
const { rcedit } = require('rcedit');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const exePath = path.join(context.appOutDir, 'Protocolito.exe');
  const iconPath = path.join(context.packager.projectDir, 'resources', 'app_icon.ico');

  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      FileDescription: 'Protocolito',
      ProductName: 'Protocolito',
      InternalName: 'Protocolito',
      OriginalFilename: 'Protocolito.exe',
    },
  });
};
