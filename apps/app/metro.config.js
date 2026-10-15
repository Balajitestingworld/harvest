// Expo auto-detects the npm-workspaces monorepo (SDK 52+), so packages/core
// resolves as @harvest/core without extra watchFolders config.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
