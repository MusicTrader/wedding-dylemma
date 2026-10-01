const places = {
  venue: {
    mode: 'weekend', title: 'AXIS Pioneer Square',
    copy: '308 1st Ave S, Seattle, WA 98104. Wedding day timing and arrival details are coming soon.',
    note: 'Saturday · Time to come', linkText: 'Open directions ↗',
    directions: 'https://www.google.com/maps/search/?api=1&query=47.599788575985%2C-122.333795679287'
  },
  cruise: {
    mode: 'weekend', title: 'Sunset cruise',
    copy: '6:00–9:00 PM. Board with Argosy Cruises at Pier 55, 1101 Alaskan Way, Seattle, WA 98101.',
    note: 'Friday · Argosy Cruises · Pier 55', linkText: 'Open directions ↗',
    directions: 'https://www.google.com/maps/search/?api=1&query=47.6047622694738%2C-122.339997237496'
  },
  sunday: {
    mode: 'weekend', title: 'One more morning',
    copy: 'Take your time with coffee, a waterfront walk, or one last wander through Pioneer Square. We’ll share any farewell plans here when they’re set.',
    note: 'Farewell plans to come'
  },
  alexis: {
    mode: 'hotels', title: 'The Alexis',
    copy: 'The Alexis Royal Sonesta Hotel Seattle · 1007 1st Ave, Seattle, WA 98104. Block booking details are coming soon.',
    note: 'Booking link and code coming soon', linkText: 'View hotel ↗',
    directions: 'https://www.sonesta.com/royal-sonesta/wa/seattle/alexis-royal-sonesta-hotel-seattle'
  },
  hotel1000: {
    mode: 'hotels', title: 'Hotel 1000',
    copy: 'Hotel 1000 · 1000 1st Ave, Seattle, WA 98104. Block booking details are coming soon.',
    note: 'Booking link and code coming soon', linkText: 'View hotel ↗',
    directions: 'https://www.hotel1000seattle.com/'
  },
  populus: {
    mode: 'hotels', title: 'Populus Seattle',
    copy: 'Populus Seattle · 100 S King St, Seattle, WA 98104. Block booking details are coming soon.',
    note: 'Booking link and code coming soon', linkText: 'View hotel ↗',
    directions: 'https://populusseattle.com/'
  },
  train: {
    mode: 'travel', route: 'train', title: 'The 1 Line',
    copy: 'Follow signs from the terminal to SeaTac/Airport Station. Ride north to Pioneer Square Station, then walk to your hotel or AXIS.',
    note: '$3 adult fare · About 38 minutes to downtown', linkText: 'Plan the train ↗',
    directions: 'https://www.soundtransit.org/ride-with-us/routes-schedules/1-line'
  },
  uber: {
    mode: 'travel', route: 'uber', title: 'An easy ride in',
    copy: 'Uber and Lyft pick up on level 3 of SEA’s parking garage. The route shown heads to Pioneer Square; the final trip and fare depend on your hotel and traffic.',
    note: '~$80 per ride · Planning estimate', linkText: 'SEA rideshare info ↗',
    directions: 'https://www.portseattle.org/sea/ground-transportation/app-based-rideshare'
  },
  rental: {
    mode: 'travel', route: 'rental', title: 'Take the wheel',
    copy: 'The free SEA shuttle takes you to the off-site rental car facility at 3150 S 160th St. Drive north toward Pioneer Square; hotel parking is extra.',
    note: '~$75 per day average · Rate varies', linkText: 'SEA rental info ↗',
    directions: 'https://www.portseattle.org/sea/ground-transportation/rental-car'
  },
  airport: {
    mode: 'travel', route: 'train', title: 'SEA Airport',
    copy: 'Seattle–Tacoma International Airport is south of downtown. The 1 Line, rideshare pickup, and rental car shuttles are all accessible from the terminal.',
    note: 'SEA · Seattle–Tacoma International', linkText: 'Airport ground transport ↗',
    directions: 'https://www.portseattle.org/sea/ground-transportation'
  },
  arrival: {
    mode: 'travel', route: 'train', title: 'Pioneer Square',
    copy: 'Our venue and the three hotel options sit around downtown and Pioneer Square. Select Where to stay to explore their exact locations.',
    note: 'AXIS · Waterfront · Nearby hotels', linkText: 'Explore the venue ↗',
    directions: 'https://axispioneersquare.com/contact-us/'
  }
};

const placeControls = document.querySelectorAll('[data-place]');
const detailTitle = document.getElementById('map-detail-title');
const detailCopy = document.getElementById('map-detail-copy');
const detailNote = document.getElementById('map-detail-note');
const detailLink = document.getElementById('map-detail-link');
const priceSources = document.getElementById('map-price-sources');
const guideMap = document.getElementById('guide-map');
const guideRoute = document.getElementById('guide-route');
const guideGroups = document.querySelectorAll('[data-guide-group]');
const guideModeControls = document.querySelectorAll('[data-guide-mode]');
const mapScaleCaption = document.getElementById('map-scale-caption');
const guideDialog = document.getElementById('guide-dialog');
const guideOpen = document.getElementById('guide-open');
const guideClose = document.getElementById('guide-close');
let guideReturnTo = guideOpen;
let selectedPlace = 'cruise';

const atlas = new SeattleAtlas((place) => showPlace(place));
const mobileMap = setupMobileMap(guideDialog, atlas);

function showPlace(place) {
  const content = places[place];
  if (!content) return;
  selectedPlace = place;
  guideMap.dataset.mode = content.mode;
  guideMap.dataset.view = content.mode === 'travel' ? 'region' : 'downtown';
  guideRoute.src = `assets/route-${content.route || 'train'}.svg?v=regional-expanded`;
  guideRoute.hidden = content.mode !== 'travel';
  WeddingIcons.setText(mapScaleCaption, content.mode === 'travel' ? 'SEA AIRPORT ↗ DOWNTOWN SEATTLE' : place === 'sunday' ? 'SUNDAY ↗ DOWNTOWN SEATTLE' : 'WATERFRONT ↗ PIONEER SQUARE');
  guideGroups.forEach((group) => { group.hidden = group.dataset.guideGroup !== content.mode; });
  guideModeControls.forEach((control) => {
    const active = control.dataset.guideMode === content.mode;
    control.classList.toggle('active', active);
    control.setAttribute('aria-pressed', String(active));
  });
  const introductions = {
    weekend: ['The weekend, mapped.', 'Choose a stop to see where we’ll be.'],
    hotels: ['Make yourself at home.', 'Compare nearby hotels. Block details are coming soon.'],
    travel: ['Next stop: Seattle.', 'Choose your route from SEA Airport.']
  };
  const [heading, introduction] = introductions[content.mode];
  document.querySelector('.atlas-list-heading h3').textContent = heading;
  document.querySelector('.atlas-list-heading p').textContent = introduction;
  detailTitle.textContent = content.title;
  detailCopy.textContent = content.copy;
  detailNote.textContent = window.innerWidth<=760 && place==='cruise' ? 'Friday · 6–9 PM' : content.note;
  detailLink.hidden = !content.directions;
  priceSources.hidden = content.mode !== 'travel';
  if (content.directions) { detailLink.href = content.directions; WeddingIcons.setText(detailLink, window.innerWidth<=760 && content.linkText.startsWith("Open directions") ? "Directions ↗" : content.linkText); }
  placeControls.forEach((control) => {
    const active = control.dataset.place === place;
    control.classList.toggle('active', active);
    control.setAttribute('aria-pressed', String(active));
  });
  atlas.show(place, content.mode);
  if (guideDialog.open && window.innerWidth <= 760) {
    const card = document.querySelector(`.guide-option[data-place="${place}"]`);
    if (card) card.parentElement.scrollTo({left:card.offsetLeft-12,behavior: "instant"});
  }
}

placeControls.forEach((control) => control.addEventListener('click', () => showPlace(control.dataset.place)));
guideModeControls.forEach((control) => control.addEventListener('click', () => {
  showPlace({ weekend: 'cruise', hotels: 'alexis', travel: 'train' }[control.dataset.guideMode]);
  if (window.innerWidth <= 760 && guideDialog.open) guideDialog.scrollTo(0, 0);
}));
showPlace('cruise');

function openGuide(place, trigger) {
  guideReturnTo = trigger || guideOpen;
  if (!guideDialog.open) guideDialog.showModal();
  document.body.classList.add('guide-open');
  mobileMap.open();
  showPlace(place);
  atlas.render();
  guideClose.focus({preventScroll:true});
}
document.querySelectorAll('[data-open-map]').forEach(trigger => {
  trigger.addEventListener('click', () => openGuide(trigger.dataset.openMap, trigger));
});
atlas.ready.then(() => { if (guideDialog.open) showPlace(selectedPlace); });
guideClose.addEventListener('click', () => guideDialog.close());
guideDialog.addEventListener('close', () => {
  atlas.stopMotion();
  document.body.classList.remove('guide-open');
  (guideReturnTo?.isConnected ? guideReturnTo : guideOpen).focus({preventScroll:true});
  paperModel?.restoreFocus(guideReturnTo);
});

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

// Keep the paper invitation and the detailed map as separate native dialogs.
// Opening the map over the invitation preserves its place and focus underneath.
const pamphletDialog = document.getElementById('pamphlet-dialog');
const pamphletOpen = document.getElementById('pamphlet-open');
const pamphletClose = document.getElementById('pamphlet-close');
let paperModel;
let closingPaper = false;
const paperReady = (async () => {
  const module = await import('./pamphlet-3d.js?v=scroll-icons-1');
  await document.fonts.ready;
  await Promise.all([...document.querySelectorAll('.pamphlet-page img, .travel-hero-image, #pamphlet-cover-photo')].map(img => img.decode().catch(() => {})));
  paperModel = await module.createPamphlet({dialog:pamphletDialog,cover:pamphletOpen,onFailure:() => { paperModel = null; }});
})().catch(error => console.warn('3D paper unavailable; the accessible invitation remains available.', error));
pamphletOpen.addEventListener('click', async () => {
  pamphletOpen.setAttribute('aria-busy','true');
  await paperReady;
  pamphletOpen.removeAttribute('aria-busy');
  if (pamphletDialog.open) return;
  pamphletDialog.showModal();
  document.body.classList.add('pamphlet-open');
  pamphletClose.focus({preventScroll:true});
  await paperModel?.open();
});
async function closePaper() {
  if(closingPaper)return;
  closingPaper=true;
  await paperModel?.close();
  await new Promise(resolve => {
    pamphletDialog.addEventListener('close',resolve,{once:true});
    pamphletDialog.close();
  });
  closingPaper=false;
}
pamphletClose.addEventListener('click', closePaper);
pamphletDialog.addEventListener('cancel', event => { event.preventDefault();closePaper(); });
pamphletDialog.addEventListener('close', () => {
  document.body.classList.remove('pamphlet-open');
  pamphletOpen.focus({preventScroll:true});
});
document.getElementById('pamphlet-read-all').addEventListener('click', async () => {
  await closePaper();
  const weekend = document.getElementById('weekend');
  weekend.tabIndex = -1;
  weekend.focus({preventScroll:true});
  weekend.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});

// Reflect the current page section without adding history entries while scrolling.
const appLinks=[...document.querySelectorAll('[data-nav-section]')];
let appNavFrame=0;
function updateAppNavigation(){
  appNavFrame=0;
  if(innerWidth>760)return;
  let current='top';
  for(const link of appLinks){
    if(link.dataset.navSection==='top')continue;
    if(document.getElementById(link.dataset.navSection).getBoundingClientRect().top<innerHeight*.35)current=link.dataset.navSection;
  }
  for(const link of appLinks){
    if(link.dataset.navSection===current)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
function queueAppNavigation(){if(!appNavFrame)appNavFrame=requestAnimationFrame(updateAppNavigation);}
window.addEventListener('scroll',queueAppNavigation,{passive:true});
window.addEventListener('resize',queueAppNavigation);
updateAppNavigation();
