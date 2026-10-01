// Draw print ornaments as paths, independent of the device's emoji fonts.
window.WeddingIcons = (() => {
  const paths = {
    home: 'M3 11L12 3L21 11M5 10V21H10V15H14V21H19V10',
    calendar: 'M4 5H20V21H4ZM8 3V7M16 3V7M4 10H20M8 14H10M14 14H16M8 18H10',
    map: 'M3 5L9 3L15 5L21 3V19L15 21L9 19L3 21ZM9 3V19M15 5V21',
    mail: 'M3 5H21V19H3ZM3 6L12 13L21 6',
    ne: 'M5 19L19 5M5 5H19V19',
    down: 'M12 3V21M5 14L12 21L19 14',
    up: 'M12 21V3M5 10L12 3L19 10',
    star: 'M12 2V22M2 12H22M5 5L19 19M5 19L19 5',
    plane: 'M12 2L14 10L21 14V16L14 14V19L17 21H7L10 19V14L3 16V14L10 10Z'
  };
  const symbols = {'↗':'ne','↓':'down','↑':'up','✳':'star','✈':'plane'};
  function paint(el) {
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg'), path=document.createElementNS(ns,'path');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');
    svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('focusable','false');svg.setAttribute('aria-hidden','true');
    path.setAttribute('d',paths[el.dataset.printIcon]);svg.append(path);el.replaceChildren(svg);
  }
  function setText(el,text) {
    el.replaceChildren();
    for(const part of text.split(/([↗↓↑✳✈])/u)) {
      if(!symbols[part]) {el.append(document.createTextNode(part));continue;}
      const icon=document.createElement('span');icon.className='print-icon';
      icon.dataset.printIcon=symbols[part];icon.setAttribute('aria-hidden','true');paint(icon);el.append(icon);
    }
  }
  document.querySelectorAll('[data-print-icon]').forEach(paint);
  return {paths,setText};
})();
