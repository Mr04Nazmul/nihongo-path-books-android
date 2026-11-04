(function(global){
  'use strict';
  var ns='http://www.w3.org/2000/svg';
  function mount(host, character, level){
    var alive=true, frame=0, paths=[], lengths=[], index=0, progress=0, playing=false, previous=0;
    host.textContent='স্ট্রোক লোড হচ্ছে…';
    function stop(){playing=false;cancelAnimationFrame(frame);previous=0;}
    function dispose(){alive=false;stop();}
    var code=Array.from(character||'');
    if(code.length!==1){host.textContent='এই অক্ষরের স্ট্রোক পাওয়া যায়নি।';return dispose;}
    var id=code[0].codePointAt(0).toString(16).padStart(5,'0');
    fetch('strokes/'+String(level||'').toLowerCase()+'/'+id+'.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('missing');return r.json();}).then(function(data){
      if(!alive)return;
      if(!Array.isArray(data.paths)||!data.paths.length)throw Error('missing');
      host.textContent='';
      var heading=document.createElement('h3');heading.textContent='লেখার ক্রম / Stroke order';host.appendChild(heading);
      var svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 109 109');svg.setAttribute('role','img');svg.setAttribute('aria-label',character+' stroke order');svg.style.cssText='width:100%;max-width:280px;display:block;margin:auto;background:var(--surface,#fffdf7);border:1px solid var(--line,#e4d8c8);border-radius:16px';
      data.paths.forEach(function(d){var ghost=document.createElementNS(ns,'path');ghost.setAttribute('d',d);ghost.setAttribute('fill','none');ghost.setAttribute('stroke','var(--line,#e5ddd1)');ghost.setAttribute('stroke-width','3');svg.appendChild(ghost);});
      data.paths.forEach(function(d){var p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke','var(--accent,#a74462)');p.setAttribute('stroke-width','3');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.appendChild(p);paths.push(p);});host.appendChild(svg);
      lengths=paths.map(function(p){return p.getTotalLength();});
      var numbers=[];paths.forEach(function(p,i){var point=p.getPointAtLength(0),n=document.createElementNS(ns,'text');n.setAttribute('x',String(Math.max(4,Math.min(103,point.x-4))));n.setAttribute('y',String(Math.max(7,Math.min(105,point.y-3))));n.setAttribute('font-size','6');n.setAttribute('fill','#77576a');n.textContent=String(i+1);svg.appendChild(n);numbers.push(n);});var tip=document.createElementNS(ns,'circle');tip.setAttribute('r','2.4');tip.setAttribute('fill','#d44b72');svg.appendChild(tip);
      var label=document.createElement('p');label.setAttribute('aria-live','polite');host.appendChild(label);
      var controls=document.createElement('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px';host.appendChild(controls);
      function button(name,fn){var b=document.createElement('button');b.type='button';b.textContent=name;b.style.cssText='float:none;font-size:14px;padding:10px;border:1px solid #dacdbd;border-radius:12px';b.onclick=fn;controls.appendChild(b);return b;}
      function paint(){paths.forEach(function(p,i){var length=lengths[i];p.style.strokeDasharray=String(length);p.style.strokeDashoffset=String(i<index?0:i===index?length*(1-progress):length);});if(index<paths.length){var point=paths[index].getPointAtLength(lengths[index]*progress);tip.setAttribute('cx',String(point.x));tip.setAttribute('cy',String(point.y));tip.style.display='';}else tip.style.display='none';numbers.forEach(function(n,i){n.setAttribute('fill',i===index?'#ad3c58':'#77576a');});label.textContent=Math.min(index+1,paths.length)+' / '+paths.length+' স্ট্রোক';}
      var play=button('▶ চালু',function(){if(playing){stop();play.textContent='▶ চালু';return;}if(index>=paths.length){index=0;progress=0;}playing=true;previous=0;play.textContent='Ⅱ বিরতি';frame=requestAnimationFrame(tick);});
      button('↺ আবার',function(){stop();index=0;progress=0;paint();play.onclick();});
      button('← আগের স্ট্রোক',function(){stop();index=Math.max(0,index-1);progress=0;paint();play.textContent='▶ চালু';});
      button('পরের স্ট্রোক →',function(){stop();index=Math.min(index+1,paths.length);progress=0;paint();play.textContent='▶ চালু';});
      var speed=document.createElement('select');speed.setAttribute('aria-label','Animation speed');[[0.5,'ধীরে'],[1,'স্বাভাবিক'],[2,'দ্রুত']].forEach(function(pair){var o=document.createElement('option');o.value=pair[0];o.textContent=pair[1];o.selected=pair[0]===1;speed.appendChild(o);});controls.appendChild(speed);
      function tick(time){if(!alive||!playing)return;if(!host.isConnected){dispose();return;}if(previous)progress+=Math.min(time-previous,100)/700*Number(speed.value);previous=time;if(progress>=1){index++;progress=0;}paint();if(index>=paths.length){stop();play.textContent='▶ আবার চালু';return;}frame=requestAnimationFrame(tick);}
      var credit=document.createElement('p');credit.style.cssText='font-size:11px;line-height:1.5';credit.textContent='KanjiVG © Ulrich Apel · CC BY-SA 3.0 · kanjivg.tagaini.net · SVG paths converted to JSON; stroke geometry unchanged. License: creativecommons.org/licenses/by-sa/3.0/';host.appendChild(credit);paint();play.onclick();
    }).catch(function(){if(alive)host.textContent='এই অক্ষরের যাচাইকৃত স্ট্রোক পাওয়া যায়নি।';});
    return dispose;
  }
  global.NPStrokes={mount:mount};
})(window);
