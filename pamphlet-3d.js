import * as THREE from './assets/vendor/three.module.min.js';

const palette = Object.fromEntries(['ink','cream','paper','teal','gold','rust','harbor'].map(name => [name, getComputedStyle(document.documentElement).getPropertyValue('--'+name).trim()]));

const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { n = clamp(n); return n*n*n*(n*(n*6-15)+10); };

// Render the existing invitation into a texture; the accessible HTML is the
// source of truth for both the 3D texture and its accessible controls.
function pageTexture(element) {
  const rect = element.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, 1400 / rect.height);
  canvas.width = Math.ceil(rect.width * scale);
  canvas.height = Math.ceil(rect.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.cream; ctx.fillRect(0, 0, rect.width, rect.height);
  function paint(el) {
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const x = box.left-rect.left, y = box.top-rect.top;
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      ctx.fillStyle = style.backgroundColor; ctx.fillRect(x,y,box.width,box.height);
    }
    if (el instanceof HTMLImageElement && el.complete && el.naturalWidth) {
      const ratio = Math.max(box.width/el.naturalWidth,box.height/el.naturalHeight);
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,box.width,box.height); ctx.clip();
      ctx.drawImage(el,x+(box.width-el.naturalWidth*ratio)/2,y+(box.height-el.naturalHeight*ratio)/2,el.naturalWidth*ratio,el.naturalHeight*ratio); ctx.restore();
    }
    if (el.dataset.printIcon) {
      ctx.save();ctx.translate(x,y);ctx.scale(box.width/24,box.height/24);
      ctx.strokeStyle=style.color;ctx.lineWidth=1.7;ctx.lineCap='round';ctx.lineJoin='round';
      ctx.stroke(new Path2D(window.WeddingIcons.paths[el.dataset.printIcon]));ctx.restore();return;
    }
    for (const node of el.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) paint(node);
      else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        ctx.fillStyle = style.color; ctx.textBaseline='alphabetic';
        const range = document.createRange();
        for(let i=0;i<node.length;i++) {
          if (!node.textContent[i].trim()) continue;
          range.setStart(node,i); range.setEnd(node,i+1);
          const r = range.getBoundingClientRect();
          ctx.fillText(node.textContent[i],r.left-rect.left,r.top-rect.top+r.height*.79);
        }
      }
    }
  }
  paint(element);
  const crease=ctx.createLinearGradient(0,0,rect.width,0);
  crease.addColorStop(0,'#72512b30');crease.addColorStop(.04,'#72512b00');crease.addColorStop(.96,'#72512b00');crease.addColorStop(1,'#72512b30');
  ctx.fillStyle=crease;ctx.fillRect(0,0,rect.width,rect.height);
  ctx.fillStyle=palette.gold;ctx.fillRect(0,0,rect.width,5);
  return canvas;
}

function coverTexture() {
  const c=document.createElement('canvas');c.width=640;c.height=1100;
  const g=c.getContext('2d');g.fillStyle=palette.gold;g.fillRect(0,0,640,1100);g.strokeStyle=palette.ink;g.lineWidth=3;g.strokeRect(14,14,612,1072);
  g.fillStyle=palette.teal;g.fillRect(30,30,580,300);g.fillStyle=palette.harbor;g.beginPath();g.moveTo(30,330);g.lineTo(610,230);g.lineTo(610,330);g.closePath();g.fill();
  g.fillStyle=palette.ink;g.textAlign='center';g.font='italic 43px Georgia';g.fillText('You’re invited to',320,130);
  g.font='100px Impact';g.fillStyle='#477977';g.fillText('SEATTLE',325,260);g.fillStyle=palette.ink;g.strokeStyle=palette.gold;g.lineWidth=4;g.strokeText('SEATTLE',320,255);g.fillText('SEATTLE',320,255);
  const image=document.querySelector('#pamphlet-cover-photo');
  if(image.complete && image.naturalWidth) {
    g.save();g.beginPath();g.rect(30,330,580,545);g.clip();
    const ratio=Math.max(580/image.naturalWidth,545/image.naturalHeight);
    g.drawImage(image,30-(image.naturalWidth*ratio-580)*.65,330-(image.naturalHeight*ratio-545)*.5,image.naturalWidth*ratio,image.naturalHeight*ratio);g.restore();
  }
  g.fillStyle=palette.ink;g.fillRect(30,875,580,195);g.fillStyle=palette.rust;g.fillRect(30,875,580,95);g.fillStyle=palette.gold;g.fillRect(30,870,580,5);g.fillRect(30,970,580,4);g.fillStyle=palette.cream;g.font='bold 32px Georgia';g.fillText('Wedding Dylemma',320,936);g.fillStyle=palette.gold;g.font='28px Georgia';g.fillText('Dylan & Emma',320,1030);
  // The outer face is viewed through the back of the geometry.
  const back=document.createElement('canvas');back.width=c.width;back.height=c.height;
  const b=back.getContext('2d');b.translate(c.width,0);b.scale(-1,1);b.drawImage(c,0,0);
  return back;
}

// A single renderer, scene and set of meshes live from page load to page unload.
// Moving the canvas into the native dialog changes its stacking context only.
export async function createPamphlet({dialog, cover, onFailure}) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  const resources=[], hinges=[], hits=[];
  let progress=0, view='all', frame=0, animation=null, disposed=false, active=false, generation=0, viewTween=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const host=document.createElement('div');host.className='paper-live-stage';
  renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);cover.append(host);
  const hitLayer=document.createElement('div');hitLayer.className='paper-hit-layer';host.append(hitLayer);
  const sheet=dialog.querySelector('.pamphlet-sheet');
  const pages=[...sheet.querySelectorAll('.pamphlet-page')];
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(36,1,.1,50),root=new THREE.Group();scene.add(root);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.AmbientLight(0xffffff,1.85));
  const light=new THREE.DirectionalLight(0xffffff,1.5);light.position.set(-3,5,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);
  Object.assign(light.shadow.camera,{left:-5,right:5,top:5,bottom:-5});light.shadow.bias=-.0004;light.shadow.normalBias=.012;light.shadow.radius=1;scene.add(light);
  function texture(c){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());resources.push(t);return t;}
  const coverMap=texture(coverTexture());
  const blank=document.createElement('canvas');blank.width=32;blank.height=32;const ctx=blank.getContext('2d');ctx.fillStyle=palette.paper;ctx.fillRect(0,0,32,32);const stock=texture(blank);
  const sourceTabindex=new Map();
  // Measure the real HTML in a fixed print layout even while its dialog is closed.
  dialog.classList.add('paper-measuring');sheet.classList.add('paper-source');
  const pageHeight=pages[0].getBoundingClientRect().height;
  const paperHeight=pageHeight/360;
  pages.forEach((page,index)=>{
    const rect=page.getBoundingClientRect();
    const geometry=new THREE.PlaneGeometry(1,paperHeight,36,12);resources.push(geometry);
    const front=new THREE.MeshStandardMaterial({map:texture(pageTexture(page)),roughness:.96,side:THREE.FrontSide});
    const back=new THREE.MeshStandardMaterial({map:index===2?coverMap:stock,roughness:.96,side:THREE.BackSide});resources.push(front,back);
    const hinge=new THREE.Group();hinge.position.set(index===0?-.5:index===2?.5:0,0,index===0?.012:index===2?.025:0);root.add(hinge);
    const mesh=new THREE.Mesh(geometry,front),reverse=new THREE.Mesh(geometry,back);
    mesh.position.x=reverse.position.x=index===0?-.5:index===2?.5:0;
    mesh.castShadow=reverse.castShadow=true;mesh.receiveShadow=reverse.receiveShadow=true;hinge.add(mesh,reverse);
    hinges.push({hinge,mesh,geometry,index,base:Float32Array.from(geometry.attributes.position.array)});
    page.querySelectorAll('button').forEach(source=>{
      const r=source.getBoundingClientRect();
      const button=document.createElement('button');button.type='button';button.className='paper-hit';
      button.setAttribute('aria-label',source.getAttribute('aria-label')||source.textContent.trim());
      if(source.hasAttribute('aria-haspopup'))button.setAttribute('aria-haspopup','dialog');
      button.addEventListener('click',()=>source.click());
      button.addEventListener('focus',()=>{
        if(view==='all'&&innerWidth<761)setView(['invitation','weekend','travel'][index]);
        if(view!=='all' && progress===1){
          const r=button.getBoundingClientRect(),bottom=innerHeight-(innerWidth<761?130:94);
          const delta=r.bottom>bottom?r.bottom-bottom+8:r.top<96?r.top-104:0;
          if(delta)onScroll({preventDefault(){},deltaY:delta});
        }
      });
      hitLayer.append(button);
      hits.push({button,source,index,x:(r.left-rect.left)/rect.width-.5,y:paperHeight/2-(r.top-rect.top)/rect.height*paperHeight,w:r.width/rect.width,h:r.height/rect.height*paperHeight});
      sourceTabindex.set(source,source.getAttribute('tabindex'));source.tabIndex=-1;source.setAttribute('aria-hidden','true');
    });
  });
  dialog.classList.remove('paper-measuring');
  const shadowGeo=new THREE.PlaneGeometry(20,20),shadowMat=new THREE.ShadowMaterial({color:palette.ink,opacity:.3});resources.push(shadowGeo,shadowMat);
  const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.position.z=-.16;shadow.receiveShadow=true;root.add(shadow);
  const controls=document.createElement('nav');controls.className='paper-view-controls';controls.setAttribute('aria-label','Pamphlet views');
  for(const [id,label] of [['all','Whole pamphlet'],['invitation','Invitation'],['weekend','Weekend'],['travel','Travel']]){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.paperView=id;button.addEventListener('click',()=>setView(id));controls.append(button);
  }
  dialog.append(controls);
  const skip=document.createElement('button');skip.type='button';skip.className='paper-skip';skip.textContent='Skip opening';skip.hidden=true;skip.addEventListener('click',()=>{stopAnimation();progress=1;completeOpen();render();});dialog.append(skip);
  cover.classList.add('paper-cover-live');cover.style.aspectRatio=`1 / ${paperHeight}`;cover.style.height='auto';dialog.classList.add('paper-live');
  function setView(next){
    if(active && progress===1 && !reduced.matches) viewTween={start:performance.now(),position:root.position.clone(),scale:root.scale.x};
    view=next;host.dataset.pan='0';dialog.querySelector('.pamphlet-toolbar>span').textContent=next==='all'?'Your invitation to Seattle':'Scroll to read · '+next[0].toUpperCase()+next.slice(1);controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paperView===view)));render();
  }
  function stopAnimation(){if(animation){const resolve=animation.resolve;animation=null;resolve();}cancelAnimationFrame(frame);frame=0;}
  function completeOpen(){skip.hidden=true;controls.hidden=false;dialog.dataset.paperState='open';if(document.activeElement===skip)dialog.querySelector('#pamphlet-close').focus({preventScroll:true});}
  function project(mesh,x,y){return new THREE.Vector3(x,y,0).applyMatrix4(mesh.matrixWorld).project(camera);}
  function render(){
    if(disposed)return;
    const width=active?innerWidth:host.clientWidth, screenHeight=active?innerHeight:host.clientHeight;
    renderer.setSize(width,screenHeight,false);camera.aspect=width/screenHeight;camera.position.z=8;camera.updateProjectionMatrix();
    const worldHeight=16*Math.tan(THREE.MathUtils.degToRad(18));
    const coverRect=cover.getBoundingClientRect();
    const rect=active?coverRect:{left:40,top:40,width:coverRect.width,height:coverRect.height};
    const stageTop=96,stageBottom=screenHeight-(innerWidth<761?126:90);
    const availableH=Math.max(160,stageBottom-stageTop);
    const overviewWidth=Math.min(width*.91,availableH/paperHeight*3);
    // A focused panel stays at print size and can be scrolled vertically on short screens.
    const focusedWidth=Math.min(width-40,440);
    const targetWidth=view==='all'?overviewWidth:focusedWidth*3;
    const lift=ease(progress/.22);
    const initialScale=rect.width/screenHeight*worldHeight;
    const targetScale=targetWidth/3/screenHeight*worldHeight;
    const scale=initialScale+(targetScale-initialScale)*lift;
    const initialX=(rect.left+rect.width/2-width/2)/screenHeight*worldHeight;
    const initialY=(screenHeight/2-(rect.top+rect.height/2))/screenHeight*worldHeight;
    const focusIndex={invitation:0,weekend:1,travel:2}[view];
    const targetX=view==='all'?0:-(focusIndex-1)*targetScale;
    const tallHeight=view==='all'?availableH:focusedWidth*paperHeight;
    const pan=Number(host.dataset.pan||0);
    const targetY=(screenHeight/2-(stageTop+tallHeight/2))/screenHeight*worldHeight+pan/screenHeight*worldHeight;
    root.position.set(initialX*(1-lift)+targetX*lift,initialY*(1-lift)+targetY*lift,0);
    root.scale.setScalar(scale);root.rotation.set(.055*Math.sin(Math.PI*progress),-.08*Math.sin(Math.PI*progress),-.055*(1-lift));
    const right=ease((progress-.13)/.43),left=ease((progress-.39)/.43);
    for(const item of hinges){
      const p=item.index===0?left:item.index===2?right:1;
      item.hinge.rotation.y=item.index===0?Math.PI*.998*(1-p):item.index===2?-Math.PI*.998*(1-p):0;
      const pos=item.geometry.attributes.position,bend=Math.sin(p*Math.PI)*.075;
      for(let i=0;i<pos.count;i++){const x=item.base[i*3],y=item.base[i*3+1],edge=item.index===0?.5-x:item.index===2?x+.5:0;pos.setZ(i,bend*edge*edge*(1+.15*Math.sin(y*3)));}
      pos.needsUpdate=true;item.geometry.computeVertexNormals();
    }
    if(viewTween){
      const blend=ease((performance.now()-viewTween.start)/500);
      root.position.lerp(viewTween.position,1-blend);
      root.scale.setScalar(viewTween.scale+(root.scale.x-viewTween.scale)*blend);
      if(blend<1){cancelAnimationFrame(frame);frame=requestAnimationFrame(render);}else viewTween=null;
    }
    scene.updateMatrixWorld(true);
    renderer.setScissorTest(false);renderer.clear();
    renderer.render(scene,camera);renderer.setScissorTest(false);
    for(const hit of hits){
      const show=active&&progress===1&&(view==='all'||focusIndex===hit.index);
      hit.button.hidden=!show;if(!show)continue;
      const mesh=hinges[hit.index].mesh;
      const a=project(mesh,hit.x,hit.y),b=project(mesh,hit.x+hit.w,hit.y-hit.h);
      Object.assign(hit.button.style,{left:`${(a.x+1)*width/2}px`,top:`${(1-a.y)*screenHeight/2}px`,width:`${(b.x-a.x)*width/2}px`,height:`${(a.y-b.y)*screenHeight/2}px`});
    }
  }
  function transition(target){
    stopAnimation();const from=progress;
    if(reduced.matches){progress=target;render();return Promise.resolve();}
    return new Promise(resolve=>{animation={resolve};const start=performance.now(),duration=target?3100:1800;
      function tick(now){if(!animation)return;const t=clamp((now-start)/duration);progress=from+(target-from)*t;render();if(t===1){animation=null;frame=0;resolve();}else frame=requestAnimationFrame(tick);}
      frame=requestAnimationFrame(tick);
    });
  }
  function onLayout(){if(!animation)render();}
  function onScroll(event){if(!active||progress!==1||view==='all')return;event.preventDefault();const max=Math.max(0,Math.min(innerWidth-40,440)*paperHeight-(innerHeight-222));host.dataset.pan=String(Math.max(0,Math.min(max,Number(host.dataset.pan||0)+event.deltaY)));render();}
  host.addEventListener('wheel',onScroll,{passive:false});
  host.tabIndex=-1;host.setAttribute('role','region');host.setAttribute('aria-label','3D pamphlet. Use up and down arrow keys to move a magnified panel.');
  dialog.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp'].includes(event.key)&&active&&view!=='all')onScroll({preventDefault:()=>event.preventDefault(),deltaY:(event.key.endsWith('Down')?1:-1)*(event.key.startsWith('Page')?220:55)});});
  let touchY;
  host.addEventListener('touchstart',event=>{touchY=event.touches[0].clientY;},{passive:true});
  host.addEventListener('touchmove',event=>{if(touchY===undefined)return;const y=event.touches[0].clientY;onScroll({preventDefault:()=>event.preventDefault(),deltaY:touchY-y});touchY=y;},{passive:false});
  const coverObserver=new ResizeObserver(onLayout);coverObserver.observe(cover);window.addEventListener('resize',onLayout);document.addEventListener('visibilitychange',onLayout);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();dispose();onFailure();});
  function dispose(){if(disposed)return;disposed=true;stopAnimation();coverObserver.disconnect();window.removeEventListener('resize',onLayout);document.removeEventListener('visibilitychange',onLayout);host.remove();controls.remove();skip.remove();sheet.classList.remove('paper-source');cover.classList.remove('paper-cover-live');cover.style.removeProperty('height');cover.style.removeProperty('aspect-ratio');dialog.classList.remove('paper-live','paper-measuring');for(const [el,tabindex] of sourceTabindex){if(tabindex===null)el.removeAttribute('tabindex');else el.setAttribute('tabindex',tabindex);el.removeAttribute('aria-hidden');}resources.forEach(r=>r.dispose());renderer.dispose();}
  setView('all');render();
  return {
    async open(){const run=++generation;active=true;host.dataset.pan='0';dialog.append(host);host.classList.add('is-open');view=innerWidth<761?'weekend':'all';setView(view);controls.hidden=true;skip.hidden=reduced.matches;dialog.dataset.paperState='unfolding';await transition(1);if(active && generation===run)completeOpen();},
    async close(){++generation;viewTween=null;controls.hidden=true;skip.hidden=true;await transition(0);active=false;host.classList.remove('is-open');cover.append(host);dialog.dataset.paperState='closed';render();},
    restoreFocus(source){const hit=hits.find(h=>h.source===source);if(hit)hit.button.focus({preventScroll:true});},
    dispose
  };
}
