const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const packageRoot = path.resolve(__dirname, '..');
const patchedParser = fs.readFileSync(
  path.join(packageRoot, 'node_modules/image-size/dist/index.cjs'),
  'utf8',
);

test('the Metro image parser patch is present after install', () => {
  assert.match(patchedParser, /if \(ispeBox\.size <= 0\) break;/);
  assert.match(patchedParser, /if \(imageHeader\[1\] <= 0\) break;/);
  assert.match(patchedParser, /if \(jxlpBox\.size <= 0\) break;/);
  assert.ok(fs.existsSync(path.join(packageRoot, 'patches/image-size+2.0.2.patch')));
});

test('a malformed zero-length ICNS box fails fast instead of looping', () => {
  const imageSizePath = path.join(packageRoot, 'node_modules/image-size');
  const script = [
    `const imageSize = require(${JSON.stringify(imageSizePath)});`,
    'const input = Buffer.alloc(16);',
    "input.write('icns', 0, 'ascii');",
    'input.writeUInt32BE(16, 4);',
    "input.write('xxxx', 8, 'ascii');",
    'try { imageSize(input); } catch (_) {}',
  ].join('\n');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['-e', script], {timeout: 500}));
});
