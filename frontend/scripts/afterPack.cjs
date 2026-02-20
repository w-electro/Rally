const path = require('path');
const rcedit = require('rcedit');

exports.default = async function afterPack(context) {
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const icoPath = path.join(context.packager.projectDir, 'public', 'icon.ico');
  const version = context.packager.appInfo.version;

  console.log(`  • patching exe icon and metadata: ${exePath}`);
  await rcedit(exePath, {
    icon: icoPath,
    'product-version': version,
    'file-version': version,
    'version-string': {
      ProductName: 'Rally',
      FileDescription: 'Rally - Next-gen gaming & social platform',
      CompanyName: 'Rally',
      OriginalFilename: 'Rally.exe',
    },
  });
  console.log('  • icon and metadata patched successfully');
};
