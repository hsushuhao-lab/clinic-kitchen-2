const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ESBUILD = 'c:/Users/Asher/Documents/game/DutyNight/prototype/node_modules/.bin/esbuild.cmd';
const THREE_DIR = 'c:/Users/Asher/Documents/game/DutyNight/prototype/node_modules/three';

const entryContent = `
export * from '${THREE_DIR.replace(/\\/g, '/')}/build/three.module.js';
export { GLTFLoader } from '${THREE_DIR.replace(/\\/g, '/')}/examples/jsm/loaders/GLTFLoader.js';
export { GLTFExporter } from '${THREE_DIR.replace(/\\/g, '/')}/examples/jsm/exporters/GLTFExporter.js';
`;

const tempEntry = path.join(ROOT, 'tools', '_three_entry.js');
fs.writeFileSync(tempEntry, entryContent, 'utf8');

const outFile = path.join(ROOT, 'src', 'three.min.js');

try {
  const cmd = `"${ESBUILD}" "${tempEntry}" --bundle --format=iife --global-name=THREE --minify --outfile="${outFile}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Successfully bundled THREE with GLTFLoader and GLTFExporter to', outFile);
} finally {
  if (fs.existsSync(tempEntry)) fs.unlinkSync(tempEntry);
}
