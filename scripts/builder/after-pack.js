'use strict';

const { pruneOtherNativePackages } = require('./sherpa');

// electron-builder `afterPack`: keeps only the sherpa-onnx native package of the target.
exports.default = async function afterPack(context) {
  pruneOtherNativePackages(context);
};
