'use strict';

// Run with the packaged app binary in Node mode (ELECTRON_RUN_AS_NODE=1): proves the native
// sherpa-onnx runtime of that platform loads from inside the packaged app.
const path = require('path');

const exeDir = path.dirname(process.execPath);
const resources = process.platform === 'darwin' ? path.join(exeDir, '..', 'Resources') : path.join(exeDir, 'resources');
const sherpa = require(path.join(resources, 'app.asar', 'node_modules', 'sherpa-onnx-node'));

console.log('sherpa ok:', typeof sherpa.OfflineRecognizer);
process.exit(typeof sherpa.OfflineRecognizer === 'function' ? 0 : 1);
