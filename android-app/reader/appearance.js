/* The native preference is the sole source of truth for every reading surface. */
window.applyAppAppearance=function(value){
 var d=value.dark,a=value.accent||'#AD3C58',r=document.documentElement;
 r.setAttribute('data-app-theme',d?'dark':'light');
 var css=document.getElementById('app-palette');if(!css){css=document.createElement('style');css.id='app-palette';document.head.appendChild(css)}
 var link=d?(a==='#1C6AA1'?'#7CC6FF':a==='#1A755B'?'#75DEB7':'#FFA8BE'):a;
 var bg=d?'#070d14':'#f9f7f3',fg=d?'#f8efe7':'#1f2731',surface=d?'#131c26':'#ffffff',muted=d?'#aeb9c6':'#566372',line=d?'#3c4a5a':'#cfd5dc';
 css.textContent='html,body{background:'+bg+'!important;color:'+fg+'!important;color-scheme:'+(d?'dark':'light')+'}body{--paper:'+bg+';--bg:'+bg+';--ink:'+fg+';--text:'+fg+';--muted:'+muted+';--surface:'+surface+';--line:'+line+';--accent:'+a+'}header,nav,.controls,main,section{background:'+bg+'!important;color:'+fg+'!important}article,.row,.grammar,.grammar:nth-child(n),.detail,.book,.paper-card,.answer,table,td,th,input,select,.listening-card,.listening-question{background:'+surface+'!important;color:'+fg+'!important;border-color:'+line+'!important}button,.chip{color:'+fg+'!important;border-color:'+line+'!important}nav button,.controls button,.chip{background:'+surface+'!important}nav .active,.selection,.unlock,button.primary,.chip.active{background:'+a+'!important;color:#fff!important}p,.reading,.tag,.notice,.book small,#bookTitle,small{color:'+muted+'!important}h1,h2,h3,h4,strong,.meaning,.character{color:'+fg+'!important}.sound,a{color:'+link+'!important}.correct,#feedback{background:'+(d?'#174536':'#d2e9d3')+'!important;color:'+(d?'#e2fff1':'#173526')+'!important}.wrong{background:'+(d?'#592638':'#f7d4d9')+'!important}.bar{background:'+line+'!important}canvas{'+(d?'filter:invert(.90) hue-rotate(180deg);':'filter:none;')+'}';
};
try{window.applyAppAppearance(JSON.parse(window.StudyNative.appearance()))}catch(e){window.applyAppAppearance({dark:true})}
