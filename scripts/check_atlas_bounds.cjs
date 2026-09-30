// Run with node scripts/check_atlas_bounds.cjs. No browser dependencies required.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const sandbox = { document: { getElementById: () => ({ disabled: false }) } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'atlas.js'), 'utf8') + '\nthis.Atlas=SeattleAtlas;', sandbox);
const layout = JSON.parse(fs.readFileSync(path.join(root, 'data/atlas-layout.json')));
let checks = 0;
for (const mode of ['weekend', 'travel']) {
for (const [width, height] of [[1040, 670], [390, 410], [370, 200], [1900, 420]]) {
  for (const zoom of [.01, .4, .7, 1, 4]) {
    for (const [x, y] of [[-1e6, -1e6], [1e6, -1e6], [-1e6, 1e6], [1e6, 1e6], [1700, 1700]]) {
      const atlas = Object.create(sandbox.Atlas.prototype);
      Object.assign(atlas, {
        mode, layout, zoom, center: { x, y }, world: { style: {} },
        viewport: { clientWidth: width, clientHeight: height, dataset: {},
          getBoundingClientRect: () => ({ left: 0, right: width }) }
      });
      atlas.render();
      const match = atlas.world.style.transform.match(/translate\(([^p]+)px,([^p]+)px\) scale\(([^)]+)\)/);
      const [, left, top, scale] = match.map(Number);
      assert.ok(left <= 1e-8 && top <= 1e-8 && left + atlas.dimensions.width * scale >= width - 1e-8 && top + atlas.dimensions.height * scale >= height - 1e-8,
        JSON.stringify({ width, height, zoom, x, y, left, top, scale }));
      checks++;
    }
  }
}
}
console.log(`PASS: ${checks} viewport/zoom/corner combinations keep the entire viewport inside rendered coverage.`);
