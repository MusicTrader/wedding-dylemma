/* Geographic coordinates and illustrated ground share build_atlas.py's projection.
   The camera changes only screen space; pin anchors never get hand-positioned. */
class SeattleAtlas {
  constructor(onSelect) {
    this.viewport = document.getElementById('atlas-viewport');
    this.world = document.getElementById('atlas-world');
    this.image = document.getElementById('atlas-image');
    this.pinLayer = document.getElementById('atlas-pins');
    this.status = document.getElementById('atlas-status');
    this.onSelect = onSelect;
    this.mode = 'weekend';
    this.place = 'cruise';
    this.zoom = 1;
    this.center = { x: 800, y: 650 };
    this.pointers = new Map();
    this.dragged = false;
    this.bindControls();
    this.ready = fetch('data/atlas-layout.json').then(r => {
      if (!r.ok) throw new Error('Atlas coordinates unavailable');
      return r.json();
    }).then(layout => {
      this.layout = layout;
      this.createPins();
      this.reset();
    }).catch(() => {
      this.status.textContent = 'Location pins couldn’t load. You can still choose a stop and open directions.';
      this.status.hidden = false;
      this.render();
    });
    new ResizeObserver(() => { this.stopMotion(); this.render(); }).observe(this.viewport);
  }
  get regional() { return this.mode === 'travel'; }
  get dimensions() { return this.regional ? (this.layout?.regional || {width:3000,height:1600}) : (this.layout || {width:1600,height:1300}); }
  get baseScale() {
    if(this.regional) {
      const view=this.layout?.regional || {overviewWidth:900,overviewHeight:700};
      return Math.min(this.viewport.clientWidth/view.overviewWidth,Math.max(120,this.viewport.clientHeight-(this.padding?.top||0)-(this.padding?.bottom||0))/view.overviewHeight);
    }
    // Preserve the intimate event framing while allowing exploration of a larger atlas.
    return Math.max(this.viewport.clientWidth/(this.layout?.overviewWidth || 1600),
      this.viewport.clientHeight/(this.layout?.overviewHeight || 1300));
  }
  get minZoom() {
    const {width,height}=this.dimensions;
    if(!this.baseScale)return .4;
    return Math.max(.4,Math.max(this.viewport.clientWidth/width,this.viewport.clientHeight/height)/this.baseScale);
  }
  get scale() { return this.baseScale*this.zoom; }
  createPins() {
    const labels = {cruise:['01','Pier 55 · Sunset cruise'],venue:['02','AXIS · The wedding'],alexis:['A','The Alexis'],hotel1000:['B','Hotel 1000'],populus:['C','Populus Seattle'],airport:['✈','SEA Airport'],arrival:['↗','Pioneer Square']};
    this.points = {...this.layout.places, ...this.layout.regionalPlaces};
    Object.entries(labels).forEach(([key,[number,label]]) => {
      const pin = document.createElement('button');
      pin.type = 'button'; pin.className = `atlas-pin atlas-pin-${key}`;
      pin.dataset.location = key;
      pin.setAttribute('aria-label',`Show ${label.replace(' · ', ', ')}`);
      const dot = document.createElement('span'); dot.className='atlas-anchor'; dot.setAttribute('aria-hidden','true');
      const marker = document.createElement('span'); marker.className='atlas-marker'; WeddingIcons.setText(marker,number);
      const text = document.createElement('span'); text.className='atlas-pin-label'; text.textContent=label;
      pin.append(dot,marker,text);
      pin.addEventListener('click', () => {if (!this.dragged) this.onSelect(key);});
      this.pinLayer.append(pin);
    });
    this.pins = [...this.pinLayer.children];
    this.render();
  }
  show(place, mode) {
    const wasRegional = this.regional;
    this.mode = mode; this.place = place;
    this.image.src = this.regional ? 'assets/seattle-atlas-region.svg?v=regional-expanded' : 'assets/seattle-atlas.svg';
    this.image.alt = this.regional ? 'Regional GIS map from SEA Airport to downtown Seattle' : 'Illustrated downtown Seattle map with real streets, shoreline, parks and building outlines';
    if (wasRegional !== this.regional) { this.reset(); return; }
    if (!this.layout || this.regional) { this.render(); return; }
    const a=this.layout.places.cruise,b=this.layout.places.venue;
    const overview={x:(a.x+b.x)/2-45,y:(a.y+b.y)/2};
    const p=this.points[place];
    // A gentle bias toward the stop keeps the surrounding weekend in view.
    const target=p ? {x:overview.x*.65+p.x*.35,y:overview.y*.65+p.y*.35} : overview;
    this.moveTo(target,Math.min(this.zoom,.78));
  }
  stopMotion() {
    if(this.motionFrame)cancelAnimationFrame(this.motionFrame);
    this.motionFrame=0;
  }
  moveTo(center,zoom) {
    this.stopMotion();
    const targetZoom=Math.max(this.minZoom,Math.min(4,zoom));
    if(!this.viewport.clientWidth || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.center={...center};this.zoom=targetZoom;this.render();return;
    }
    const from={...this.center},fromZoom=this.zoom,start=performance.now();
    const tick=now=>{
      const t=Math.min(1,Math.max(0,(now-start)/650)),blend=t*t*(3-2*t);
      this.center={x:from.x+(center.x-from.x)*blend,y:from.y+(center.y-from.y)*blend};
      this.zoom=fromZoom+(targetZoom-fromZoom)*blend;this.render();
      this.motionFrame=t<1?requestAnimationFrame(tick):0;
    };
    this.render();this.motionFrame=requestAnimationFrame(tick);
  }
  reset() {
    this.stopMotion();
    this.zoom=this.regional?1:.78;
    if (this.regional) this.center={...(this.layout?.regional?.center || {x:1500,y:800})};
    else if (this.layout) {
      const a=this.layout.places.cruise,b=this.layout.places.venue;
      this.center={x:(a.x+b.x)/2-95,y:(a.y+b.y)/2};
    } else this.center={x:800,y:650};
    this.render();
  }
  render() {
    const w=this.viewport.clientWidth,h=this.viewport.clientHeight;
    if (!w || !h) return;
    this.zoom=Math.max(this.minZoom,Math.min(4,this.zoom));
    const {width,height}=this.dimensions, s=this.scale;
    // Clamp the whole visible rectangle, not just its center, to the rendered data.
    const halfWidth=w/(2*s),halfHeight=h/(2*s);
    const clampCenter=(value,half,extent)=>half*2>=extent ? extent/2 : Math.max(half,Math.min(extent-half,value));
    this.center.x=clampCenter(this.center.x,halfWidth,width);
    this.center.y=clampCenter(this.center.y,halfHeight,height);
    const centerY=(h+(this.padding?.top||0)-(this.padding?.bottom||0))/2;
    const left=w/2-this.center.x*s,top=Math.max(h-height*s,Math.min(0,centerY-this.center.y*s));
    this.world.style.width=`${width}px`; this.world.style.height=`${height}px`;
    this.world.style.transform=`translate(${left}px,${top}px) scale(${s})`;
    this.viewport.dataset.regional=String(this.regional);
    for (const pin of this.pins || []) {
      const key=pin.dataset.location,p=this.points[key];
      const isRegion=key==='airport'||key==='arrival';
      const visible=this.regional ? isRegion : this.mode==='hotels' ? !isRegion&&key!=='cruise' : key==='cruise'||key==='venue';
      pin.hidden=!visible;
      pin.style.left=`${left+p.x*s}px`;pin.style.top=`${top+p.y*s}px`;
      pin.classList.toggle('active',key===this.place);
      pin.setAttribute('aria-pressed',String(key===this.place));
    }
    const viewportBounds=this.viewport.getBoundingClientRect();
    for (const pin of this.pins || []) {
      if(pin.hidden)continue;
      const label=pin.querySelector('.atlas-pin-label');
      label.style.translate='none';
      const bounds=label.getBoundingClientRect();
      const shift=Math.max(viewportBounds.left+10-bounds.left, Math.min(0,viewportBounds.right-10-bounds.right));
      label.style.translate=`${shift}px 0`;
    }
    document.getElementById('atlas-zoom-in').disabled=this.zoom>=4;
    document.getElementById('atlas-zoom-out').disabled=this.zoom<=this.minZoom+.00001;
  }
  zoomAt(factor, point) {
    this.stopMotion();
    const before=this.scale;
    const x=(point?.x ?? this.viewport.clientWidth/2)-this.viewport.clientWidth/2;
    const centerY=(this.viewport.clientHeight+(this.padding?.top||0)-(this.padding?.bottom||0))/2;
    const y=(point?.y ?? centerY)-centerY;
    this.zoom=Math.max(this.minZoom,Math.min(4,this.zoom*factor));
    const after=this.scale;
    this.center.x+=x/before-x/after;this.center.y+=y/before-y/after;
    this.render();
  }
  bindControls() {
    document.getElementById('atlas-zoom-in').addEventListener('click',()=>this.zoomAt(1.3));
    document.getElementById('atlas-zoom-out').addEventListener('click',()=>this.zoomAt(1/1.3));
    document.getElementById('atlas-reset').addEventListener('click',()=>this.reset());
    const v=this.viewport;
    const interactive=t=>t.closest('button,a');
    v.addEventListener('wheel',e=>{ if(interactive(e.target))return; e.preventDefault(); const r=v.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top}); },{passive:false});
    v.addEventListener('keydown',e=>{
      if(e.target!==v)return;
      this.stopMotion();
      const delta=65/this.scale;
      if (e.key==='+'||e.key==='=')this.zoomAt(1.3);
      else if(e.key==='-')this.zoomAt(1/1.3);
      else if(e.key==='Home')this.reset();
      else if(e.key==='ArrowLeft')this.center.x-=delta;
      else if(e.key==='ArrowRight')this.center.x+=delta;
      else if(e.key==='ArrowUp')this.center.y-=delta;
      else if(e.key==='ArrowDown')this.center.y+=delta;
      else return;
      e.preventDefault();this.render();
    });
    v.addEventListener('pointerdown',e=>{
      if(interactive(e.target)||e.button>0)return;
      this.stopMotion();
      this.dragged=false;v.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      v.classList.add('is-dragging');
    });
    v.addEventListener('pointermove',e=>{
      if(!this.pointers.has(e.pointerId))return;
      const prev=this.pointers.get(e.pointerId),next={x:e.clientX,y:e.clientY};
      const old=[...this.pointers.values()];this.pointers.set(e.pointerId,next);
      if(this.pointers.size===2){
        const now=[...this.pointers.values()];
        const distance=a=>Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
        const r=v.getBoundingClientRect();
        this.zoomAt(distance(now)/Math.max(1,distance(old)),{x:(now[0].x+now[1].x)/2-r.left,y:(now[0].y+now[1].y)/2-r.top});
      } else {
        this.center.x-=(next.x-prev.x)/this.scale;this.center.y-=(next.y-prev.y)/this.scale;
      }
      if(Math.abs(next.x-prev.x)+Math.abs(next.y-prev.y)>2)this.dragged=true;
      this.render();
    });
    const end=e=>{this.pointers.delete(e.pointerId);if(!this.pointers.size){v.classList.remove('is-dragging');this.dragged=false;}};
    v.addEventListener('pointerup',end);v.addEventListener('pointercancel',end);v.addEventListener('lostpointercapture',end);
  }
}
