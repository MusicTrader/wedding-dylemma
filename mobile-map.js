// Reuse the same controls and details in a mobile sheet; restore their desktop homes.
function setupMobileMap(dialog, atlas) {
  const mobile=matchMedia('(max-width:760px)'), panel=dialog.querySelector('.map-panel');
  const tabs=dialog.querySelector('.guide-mode-tabs'), detail=dialog.querySelector('.map-detail'), footnote=dialog.querySelector('.map-footnote');
  const homes=[tabs,detail,footnote].map(el=>{const marker=document.createComment('desktop position');el.before(marker);return {el,marker};});
  const handle=document.createElement('button');handle.type='button';handle.className='map-sheet-handle';
  handle.innerHTML='<span aria-hidden="true"></span><span class="sheet-handle-label">More details</span>';
  handle.setAttribute('aria-controls','mobile-map-sheet-content');panel.prepend(handle);detail.id='mobile-map-sheet-content';
  let state=0, drag=null, moved=false;
  const stops=()=>{const h=dialog.clientHeight||innerHeight,max=Math.max(180,h-132);return [Math.min(250,max),Math.min(Math.max(300,h*.57),max),max];};
  function layout(height=stops()[state]) {
    if(!mobile.matches){atlas.padding={top:0,bottom:0};atlas.render();return;}
    dialog.style.setProperty('--map-sheet-height',`${height}px`);
    atlas.padding={top:126,bottom:height};atlas.render();
  }
  function snap(next) {
    state=Math.max(0,Math.min(2,next));panel.dataset.sheet=String(state);
    handle.setAttribute('aria-expanded',String(state>0));handle.setAttribute('aria-label',state===0?'Expand map details':state===1?'Expand map details fully':'Collapse map details');
    handle.querySelector('.sheet-handle-label').textContent=state===0?'More details':state===1?'Full details':'Show more map';layout();
  }
  function sync() {
    dialog.classList.toggle('mobile-map',mobile.matches);
    if(mobile.matches){dialog.append(tabs);panel.append(detail,footnote);snap(0);}
    else {homes.forEach(({el,marker})=>marker.after(el));layout();}
  }
  handle.addEventListener('click',()=>{if(!moved)snap((state+1)%3);moved=false;});
  handle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();snap(e.key==='Home'?0:e.key==='End'?2:state+(e.key==='ArrowUp'?1:-1));}});
  handle.addEventListener('pointerdown',e=>{if(e.button>0)return;drag={y:e.clientY,height:panel.getBoundingClientRect().height};moved=false;handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(!drag)return;const delta=drag.y-e.clientY;if(Math.abs(delta)>5)moved=true;const heights=stops();layout(Math.max(heights[0],Math.min(heights[2],drag.height+delta)));});
  function end(){if(!drag)return;const height=panel.getBoundingClientRect().height;drag=null;const heights=stops();snap(heights.reduce((best,h,i)=>Math.abs(h-height)<Math.abs(heights[best]-height)?i:best,0));}
  handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',()=>{drag=null;snap(state);});
  mobile.addEventListener('change',sync);window.addEventListener('resize',()=>layout());
  sync();return {open(){if(mobile.matches)snap(0);},select(){if(mobile.matches)snap(0);}};
}
