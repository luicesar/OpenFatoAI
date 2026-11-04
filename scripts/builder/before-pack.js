'use strict';

const { nativePackageName, ensureNativePackage } = require('./sherpa');

// electron-builder `beforePack`: runs once per platform/arch target.
exports.default = async function beforePack(context) {
  ensureNativePackage(nativePackageName(context.electronPlatformName, context.arch));
};
