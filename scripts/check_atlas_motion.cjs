const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let time=0,id=0,reduced=false;const frames=new Map();
const context={performance:{now:()=>time},matchMedia:()=>({matches:reduced}),requestAnimationFrame:cb=>{frames.set(++id,cb);return id;},cancelAnimationFrame:id=>frames.delete(id)};
vm.createContext(context);vm.runInContext(fs.readFileSync('atlas.js','utf8')+'\nthis.Atlas=SeattleAtlas;',context);
const layout=JSON.parse(fs.readFileSync('data/atlas-layout.json'));
const atlas=Object.create(context.Atlas.prototype);
Object.assign(atlas,{layout,points:layout.places,mode:'weekend',place:'cruise',zoom:.78,center:{...layout.places.cruise},viewport:{clientWidth:390,clientHeight:844},image:{},render(){}});
function advance(ms){time+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(time));}
const initial={...atlas.center};atlas.show('venue','weekend');
assert.equal(atlas.center.x,initial.x,'Selection must not teleport the camera');
advance(325);assert.ok(atlas.center.x>initial.x,'Camera should move partway toward the venue');assert.equal(atlas.zoom,.78);
const middle={...atlas.center};atlas.show('alexis','hotels');assert.equal(atlas.center.x,middle.x,'Rapid selections start from the current camera');assert.equal(frames.size,1);
advance(650);assert.equal(frames.size,0);assert.equal(atlas.zoom,.78,'Hotel selection must not zoom in');
atlas.show('venue','weekend');advance(100);atlas.stopMotion();const stopped={...atlas.center};advance(1000);assert.equal(atlas.center.x,stopped.x,'User interruption stops the animation');
atlas.zoom=.6;atlas.show('cruise','weekend');advance(650);assert.equal(atlas.zoom,.6,'Preserve a user’s wider zoom');
reduced=true;atlas.show('venue','weekend');assert.equal(frames.size,0,'Reduced motion uses no animation');
atlas.mode='travel';atlas.center={x:1300,y:1100};atlas.zoom=1;atlas.show('uber','travel');assert.equal(atlas.center.x,1300,'Changing transport keeps regional context');
console.log('PASS: smooth camera motion, consistent zoom, rapid reselection, interruption, reduced motion, and regional context.');
