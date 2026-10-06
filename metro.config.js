const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Workers were crashing on this machine ("Call retries were exceeded").
// Run transforms in-process so Metro can surface the real error.
config.maxWorkers = 0;
config.transformer = {
  ...config.transformer,
  unstable_workerThreads: false,
};

module.exports = withNativeWind(config, { input: './global.css' });
