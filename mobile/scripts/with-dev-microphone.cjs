const { AndroidConfig, withDangerousMod } = require('expo/config-plugins');
const { mkdir, access } = require('node:fs/promises');
const path = require('node:path');

module.exports = config => withDangerousMod(config, ['android', async config => {
  const directory = path.join(config.modRequest.platformProjectRoot, 'app/src/debug');
  const file = path.join(directory, 'AndroidManifest.xml');
  await mkdir(directory, { recursive: true });
  const exists = await access(file).then(() => true, () => false);
  const manifest = exists ? await AndroidConfig.Manifest.readAndroidManifestAsync(file) :
    { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' } } };
  const permissions = manifest.manifest['uses-permission'] ??= [];
  if (!permissions.some(entry => entry.$['android:name'] === 'android.permission.RECORD_AUDIO')) {
    permissions.push({ $: { 'android:name': 'android.permission.RECORD_AUDIO' } });
    await AndroidConfig.Manifest.writeAndroidManifestAsync(file, manifest);
  }
  return config;
}]);
