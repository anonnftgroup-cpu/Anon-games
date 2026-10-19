(function(){
'use strict';
var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var SITE='https://anonnfts.com';
var D=null,YT=null,view='cinema',cat='All',genre='All',queue=[],qi=-1;
var CWK='anonMedia.cw.v1';
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(function(){t.classList.remove('show')},1800)}
function cwGet(){try{return JSON.parse(localStorage.getItem(CWK))||[]}catch(e){return[]}}
function cwAdd(id){var a=cwGet().filter(function(x){return x!==id});a.unshift(id);try{localStorage.setItem(CWK,JSON.stringify(a.slice(0,12)))}catch(e){}renderCW()}
function live(list){return (list||[]).filter(function(x){return !(x.flags&&x.flags.length)})}
function byId(id){var all=live(D.cinema).concat(live(D.tv));for(var i=0;i<all.length;i++)if(all[i].id===id)return all[i];return null}
function certOf(x){return x.certificate&&x.certificate.bbfc||'Not rated'}
function tile(x){
  var img=x.poster||x.thumb, sub=[x.year,x.runtime_min?Math.round(x.runtime_min)+' min':'',x.category].filter(Boolean).join(' · ');
  return '<button class="tile" data-id="'+esc(x.id)+'"><img class="thumb" loading="lazy" src="'+esc(img)+'" alt="'+esc(x.title)+' poster"><span class="badge">'+esc(certOf(x)==='Not rated'?'NR':certOf(x))+'</span><span class="meta"><span class="name">'+esc(x.title)+'</span><span class="tag">'+esc(sub)+(x.rating?' · '+esc(x.rating.source+' '+x.rating.value):'')+'</span></span></button>';
}
function seriesTiles(){var s={};live(D.tv).forEach(function(e){(s[e.series]=s[e.series]||[]).push(e)});return Object.keys(s).map(function(k){var e=s[k];return {id:'series:'+k,title:k,year:e[0].year+'–'+e[e.length-1].year,category:e.length+' episodes',thumb:e[0].thumb,certificate:e[0].certificate,series:k,eps:e,tags:e[0].tags,director:e[0].director,description:e[0].description,family:e[0].family}})}
function dailyPick(){
  var c=live(D.cinema),d=new Date(),pool=c;
  if(d.getMonth()===9){pool=c.filter(function(x){return x.category==='Horror'})}else if(d.getMonth()===11){pool=c.filter(function(x){return x.tags.indexOf('christmas')>=0})}
  if(!pool.length)pool=c;var n=Math.floor(d.getTime()/864e5);return pool[n%pool.length];
}
function renderHero(){var x=dailyPick();if(!x)return;$('#hero').innerHTML='<button class="hero" data-id="'+esc(x.id)+'"><img src="'+esc(x.poster)+'" alt=""><span class="hx"><span class="kick">★ NOW SHOWING'+(new Date().getMonth()===9?' · HALLOWEEN SHELF':'')+'</span><br><span class="ht">'+esc(x.title)+' ('+x.year+')</span><br><span class="hd">'+esc(x.description.split('. ')[0])+'.</span></span></button>'}
function renderCW(){var a=cwGet().map(byId).filter(Boolean);$('#cw').hidden=!a.length;$('#cwrow').innerHTML=a.map(tile).join('')}
function list(){
  if(view==='cinema')return live(D.cinema);
  if(view==='tv')return seriesTiles();
  if(view==='watch')return live(YT&&YT.videos).map(function(v){return{id:'yt:'+v.id,title:v.title.replace(/#\w+/g,'').trim(),year:v.published.slice(0,4),category:v.short?'Short':'Video',thumb:v.thumb,certificate:{bbfc:'Not rated'},tags:[],description:v.description,embed_url:v.embed_url,family:true,yt:v}});
  return [];
}
function filtered(){
  var q=$('#q').value.trim().toLowerCase(),dec=$('#fDecade').value,ce=$('#fCert').value,ra=$('#fRating').value,so=$('#fSort').value,fam=$('#fFam').checked;
  var a=list().filter(function(x){
    if(cat!=='All'&&x.category!==cat)return false;
    if(dec&&x.decade!==dec)return false; if(ce&&certOf(x)!==ce)return false; if(ra&&!x.rating)return false; if(fam&&!x.family)return false;
    if(q){var h=[x.title,x.director,x.category,(x.tags||[]).join(' '),x.description,x.year].join(' ').toLowerCase();if(h.indexOf(q)<0)return false}
    return true});
  a.sort(function(p,r){if(so==='yearDesc')return (r.year+'').localeCompare(p.year+'');if(so==='yearAsc')return (p.year+'').localeCompare(r.year+'');if(so==='rating')return ((r.rating&&r.rating.num)||0)-((p.rating&&p.rating.num)||0);return (r.added||'').localeCompare(p.added||'')||((r.order||0)-(p.order||0))});
  return a;
}
function renderChips(){var cats=['All'];list().forEach(function(x){if(cats.indexOf(x.category)<0)cats.push(x.category)});
  if(cats.indexOf(cat)<0)cat='All';
  $('#chips').innerHTML=cats.map(function(c){return '<button class="chip'+(c===cat?' on':'')+'" data-c="'+esc(c)+'">'+esc(c)+'</button>'}).join('');
  var decs=[],certs=[];list().forEach(function(x){if(x.decade&&decs.indexOf(x.decade)<0)decs.push(x.decade);var c=certOf(x);if(certs.indexOf(c)<0)certs.push(c)});
  decs.sort();$('#fDecade').innerHTML='<option value="">All decades</option>'+decs.map(function(d){return '<option>'+d+'</option>'}).join('');
  $('#fCert').innerHTML='<option value="">Any age rating</option>'+certs.map(function(d){return '<option>'+esc(d)+'</option>'}).join('');}
function renderGrid(){var a=filtered();$('#grid').innerHTML=a.map(tile).join('');$('#empty').classList.toggle('show',!a.length&&view!=='radio')}
function renderRadio(){
  var gs=['All'];D.radio.forEach(function(t){if(gs.indexOf(t.genre)<0)gs.push(t.genre)});
  $('#chips').innerHTML=gs.map(function(c){return '<button class="chip'+(c===genre?' on':'')+'" data-g="'+esc(c)+'">'+esc(c)+'</button>'}).join('');
  var q=$('#q').value.trim().toLowerCase();
  queue=live(D.radio).filter(function(t){return (genre==='All'||t.genre===genre)&&(!q||(t.title+' '+t.artist+' '+t.genre).toLowerCase().indexOf(q)>=0)});
  var cur=$('#audio').dataset.id;
  $('#tracks').innerHTML=queue.map(function(t,i){return '<button class="tr'+(t.id===cur?' on':'')+'" data-i="'+i+'"><span class="ic">'+(t.id===cur&&!$('#audio').paused?'❚❚':'▶')+'</span><span><span class="tt">'+esc(t.title)+'</span><br><span class="ta">'+esc(t.artist)+' · '+esc(t.genre)+' · '+esc(t.licence)+'</span></span></button>'}).join('');
}
function setView(v){view=v;cat='All';genre='All';
  document.querySelectorAll('.tab').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});
  $('#intro').textContent=D.intros[v]||'';
  var radio=v==='radio';$('#grid').hidden=radio;$('#tracks').hidden=!radio;
  document.querySelector('.filters').style.display=(v==='cinema')?'':'none';
  $('#hero').hidden=v!=='cinema';
  if(radio){renderRadio();$('#mini').hidden=false}else{renderChips();renderGrid()}
}
function share(url,title){var u=encodeURIComponent(url),t=encodeURIComponent(title);
  return '<a href="https://twitter.com/intent/tweet?url='+u+'&text='+t+'" target="_blank" rel="noopener">X</a><a href="https://www.facebook.com/sharer/sharer.php?u='+u+'" target="_blank" rel="noopener">Facebook</a><a href="https://wa.me/?text='+t+'%20'+u+'" target="_blank" rel="noopener">WhatsApp</a><button data-copy="'+esc(url)+'">Copy link</button>'}
function facts(x){var c=x.certificate||{};return '<div class="facts">'+[x.year,x.runtime_min?Math.round(x.runtime_min)+' min':'',x.category,x.director].filter(Boolean).map(function(f){return '<span>'+esc(f)+'</span>'}).join('')+'<span class="cert">'+esc(c.bbfc||'Not rated')+'</span>'+(x.rating?'<span>'+esc(x.rating.source+' '+x.rating.value)+'</span>':'')+'</div>'}
function playerBox(x,wide){return '<div class="player'+(wide?' wide':'')+'" data-src="'+esc(x.embed_url)+'"><button class="pbtn" aria-label="Play '+esc(x.title)+'" style="background-image:url(\''+esc(x.poster||x.thumb)+'\')"><span>▶</span></button></div>'}
function openItem(id){
  var x;
  if(id.indexOf('series:')===0){x=seriesTiles().filter(function(s){return s.id===id})[0];if(!x)return;
    var ep=x.eps[0];
    $('#sheet').innerHTML='<button class="x" aria-label="Close">✕</button><h3>'+esc(x.title)+'</h3>'+facts(ep)+'<div id="epPlayer">'+playerBox(ep,true)+'</div><div class="desc" id="epDesc"><b>'+esc(ep.title)+'</b>: '+esc(ep.description)+'</div><div class="small">'+esc(ep.certificate.note)+'<br>'+esc(ep.rights)+'</div><div class="eps">'+x.eps.map(function(e,i){return '<button class="ep'+(i?'':' on')+'" data-ep="'+esc(e.id)+'"><b>S'+e.season+' E'+e.episode+'</b> · '+esc(e.title)+' ('+e.year+')</button>'}).join('')+'</div><div class="share">Share: '+share(SITE,'Watching '+x.title+' free on ANON Cinema & Radio')+'</div>';
  } else if(id.indexOf('yt:')===0){x=list().filter(function(v){return v.id===id})[0]||null;if(!x){var v=(YT.videos||[]).filter(function(v){return 'yt:'+v.id===id})[0];if(!v)return;x={title:v.title,thumb:v.thumb,embed_url:v.embed_url,description:v.description,yt:v}}
    $('#sheet').innerHTML='<button class="x" aria-label="Close">✕</button><h3>'+esc(x.title)+'</h3>'+playerBox(x,!x.yt.short)+'<div class="desc">'+esc(x.yt.description)+'</div><div class="small">'+esc(x.yt.rights)+' · <a href="'+esc(YT.channel)+'" target="_blank" rel="noopener" style="color:#e0c060">Subscribe on YouTube</a></div><div class="share">Share: '+share(SITE,x.title+' | ANON NFTs')+'</div>';
  } else { x=byId(id);if(!x)return;
    $('#sheet').innerHTML='<button class="x" aria-label="Close">✕</button><h3>'+esc(x.title)+'</h3>'+facts(x)+playerBox(x,false)+'<div class="desc">'+esc(x.description)+'</div><div class="small"><b>Content:</b> '+esc(x.certificate.note)+(x.rating?'<br><b>Rating:</b> '+esc(x.rating.source+' '+x.rating.value)+' (via Wikidata)':'')+'<br><b>Rights:</b> '+esc(x.rights)+'<br><b>Source:</b> <a style="color:#e0c060" href="'+esc(x.source_url)+'" target="_blank" rel="noopener">Internet Archive</a> · last verified '+esc(x.last_verified)+'</div><div class="share">Share: '+share(SITE,'Watching '+x.title+' ('+x.year+') free on ANON Cinema & Radio')+'</div>';
  }
  $('#modal').hidden=false;document.body.style.overflow='hidden';
}
function closeModal(){$('#modal').hidden=true;$('#sheet').innerHTML='';document.body.style.overflow=''}
function startEmbed(box){var src=box.dataset.src,ifr=document.createElement('iframe');
  ifr.src=src+(src.indexOf('youtube')>=0?(src.indexOf('?')<0?'?':'&')+'autoplay=1&rel=0&playsinline=1':'');
  ifr.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';ifr.setAttribute('allowfullscreen','');ifr.title='Video player';
  box.innerHTML='';box.appendChild(ifr);
  var a=$('#audio');if(!a.paused){a.pause();syncMini()}
}
// radio
function playIdx(i){if(!queue.length)return;qi=(i+queue.length)%queue.length;var t=queue[qi],a=$('#audio');
  a.src=t.url;a.dataset.id=t.id;a.play().catch(function(){});$('#mpTitle').textContent=t.title+' · '+t.artist;$('#mpCredit').textContent=t.credit;$('#mini').hidden=false;syncMini();}
function syncMini(){var a=$('#audio');$('#mpPlay').textContent=a.paused?'▶':'❚❚';if(view==='radio')renderRadio()}
document.addEventListener('click',function(e){
  var t=e.target.closest('button,a');if(!t)return;
  if(t.classList.contains('tab'))return setView(t.dataset.v);
  if(t.dataset.c){cat=t.dataset.c;renderChips();renderGrid();return}
  if(t.dataset.g){genre=t.dataset.g;renderRadio();return}
  if(t.dataset.id&&(t.classList.contains('tile')||t.classList.contains('hero')))return openItem(t.dataset.id);
  if(t.classList.contains('x'))return closeModal();
  if(t.classList.contains('pbtn')){var box=t.parentNode;var on=document.querySelector('#sheet .ep.on');startEmbed(box);cwAdd(on?on.dataset.ep:(byId(currentId)||{}).id||currentId);return}
  if(t.dataset.ep){var ep=byId(t.dataset.ep);document.querySelectorAll('.ep').forEach(function(b){b.classList.toggle('on',b===t)});$('#epPlayer').innerHTML=playerBox(ep,true);$('#epDesc').innerHTML='<b>'+esc(ep.title)+'</b>: '+esc(ep.description);return}
  if(t.dataset.copy){(navigator.clipboard?navigator.clipboard.writeText(t.dataset.copy):Promise.reject()).then(function(){toast('Link copied')},function(){toast(t.dataset.copy)});return}
  if(t.dataset.i!=null&&t.classList.contains('tr')){var i=+t.dataset.i,a=$('#audio');if(queue[i]&&a.dataset.id===queue[i].id){a.paused?a.play():a.pause();return}playIdx(i);return}
  if(t.id==='mpPlay'){var a2=$('#audio');if(!a2.src){if(!queue.length){queue=live(D.radio)}playIdx(0);return}a2.paused?a2.play():a2.pause();return}
  if(t.id==='mpNext'){if(!queue.length)queue=live(D.radio);playIdx(qi+1);return}
});
var currentId=null;
document.addEventListener('click',function(e){var t=e.target.closest('.tile,.hero');if(t)currentId=t.dataset.id},true);
$('#modal').addEventListener('click',function(e){if(e.target.id==='modal')closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});
var a=$('#audio');['play','pause'].forEach(function(ev){a.addEventListener(ev,syncMini)});a.addEventListener('ended',function(){playIdx(qi+1)});
a.addEventListener('error',function(){if(a.src){toast('Track unavailable, skipping');setTimeout(function(){playIdx(qi+1)},800)}});
['input','change'].forEach(function(ev){['#q','#fDecade','#fCert','#fRating','#fSort','#fFam'].forEach(function(s){$(s).addEventListener(ev,function(){view==='radio'?renderRadio():renderGrid()})})});
$('#shareBar').insertAdjacentHTML('beforeend',share(SITE,'Free classic films, TV and music on ANON Cinema & Radio'));
Promise.all([fetch('media.json').then(function(r){return r.json()}),fetch('youtube.json').then(function(r){return r.json()}).catch(function(){return{videos:[]}})]).then(function(r){
  D=r[0];YT=r[1];renderHero();renderCW();var h=location.hash.slice(1);setView(['cinema','tv','radio','watch'].indexOf(h)>=0?h:'cinema');
  window.__mediaReady=true;
}).catch(function(){$('#grid').innerHTML='<div class="empty show">Could not load the catalogue. Please refresh.</div>'});
})();
