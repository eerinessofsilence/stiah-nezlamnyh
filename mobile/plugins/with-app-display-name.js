const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

module.exports = function withAppDisplayName(config) {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: 'Стяг незламних' }],
      config.modResults,
    );
    return config;
  });
};
