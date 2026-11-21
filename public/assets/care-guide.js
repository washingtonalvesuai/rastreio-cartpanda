/* My Natural Care — Livro ilustrado: leitura linear e progressiva para todas as idades. */
(function () {
  'use strict';
  const DATA_URL='/assets/neuropathy-guide-en-v3.json';
  const BATCH=4;
  const wellness=document.getElementById('habitsGuideLibrary');
  if(!wellness)return;

  let guide=null, next=0, fetching=null, observer=null, root=null, content=null, sentinel=null;
  const escapeHTML=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const illustrated=x=>/^\/assets\/care-icons\/[a-z-]+\.svg$/.test(String(x||''));
  const img=x=>illustrated(x.image)?x.image:'/assets/care-icons/hospital.svg';
  const safeTitle=x=>escapeHTML(String(x||'').toLocaleLowerCase('en-US').replace(/^./,v=>v.toLocaleUpperCase('en-US')));
  const groupsOf=(source)=>{
    const rows=String(source||'').replace(/\r/g,'').split('\n');
    const groups=[{title:'',lines:[]}];
    for(const line of rows){
      const t=line.trim();
      if(t.length>=6&&t.length<=115&&t===t.toLocaleUpperCase('en-US')&&/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t)&&!/^(?:[-•]|\d)/.test(t)&&!t.endsWith('.')){
        groups.push({title:t,lines:[]});
      }else groups[groups.length-1].lines.push(line);
    }
    return groups.filter(g=>g.title||g.lines.some(v=>v.trim()));
  };
  function paragraphs(lines){
    let result='', p=[], list=[], listType='';
    function flushP(){if(p.length){result+='<p>'+escapeHTML(p.join(' '))+'</p>';p=[]}}
    function flushList(){if(list.length){result+='<'+listType+'>'+list.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')+'</'+listType+'>';list=[];listType=''}}
    function appendList(kind,value){flushP();if(listType&&listType!==kind)flushList();listType=kind;list.push(value)}
    for(const row of lines){
      const line=row.trim();
      if(!line){flushP();flushList();continue}
      let m=line.match(/^(?:[-•]\s+|\[\s?\]\s*)(.+)$/);
      if(m){appendList('ul',m[1]);continue}
      m=line.match(/^(\d{1,2})[.)]\s+(.+)$/);
      if(m){appendList('ol',m[2]);continue}
      m=line.match(/^(Day\s+\d{1,2}:|Monday\s*[—–-]|Tuesday\s*[—–-]|Wednesday\s*[—–-]|Thursday\s*[—–-]|Friday\s*[—–-]|Saturday\s*[—–-]|Sunday\s*[—–-])\s*(.+)$/i);
      if(m){appendList('ul',m[1]+' '+m[2]);continue}
      flushList();p.push(line);
    }
    flushP();flushList();return result;
  }
  function chapter(item,index){
    const number=String(index+1).padStart(2,'0');
    const sections=groupsOf(item.body).map(group=>{
      const body=paragraphs(group.lines);
      if(!body)return '';
      return '<section class="book-section">'+(group.title?'<h4>'+safeTitle(group.title)+'</h4>':'')+body+'</section>';
    }).join('');
    return '<article class="book-chapter" id="mnc-chapter-'+escapeHTML(item.id)+'" aria-labelledby="book-title-'+escapeHTML(item.id)+'">'+
      '<div class="book-ordinal"><span>CHAPTER '+number+' / '+guide.chapters.length+'</span><span>'+escapeHTML(item.category)+'</span></div>'+
      '<header class="book-chapter-header"><div class="book-heading-text"><h3 id="book-title-'+escapeHTML(item.id)+'">'+escapeHTML(item.title)+'</h3>'+
      '<p class="book-summary">'+escapeHTML(item.summary)+'</p></div><figure class="book-illustration">'+
      '<img src="'+escapeHTML(img(item))+'" alt="Illustration: '+escapeHTML(item.title)+'" width="120" height="120" loading="lazy" decoding="async"><figcaption>Learn together</figcaption></figure></header>'+
      (item.action?'<aside class="book-today"><strong>✓ Your small step today</strong><p>'+escapeHTML(item.action)+'</p></aside>':'')+
      '<div class="book-chapter-text">'+sections+'</div><div class="book-chapter-foot">Every small step counts. Continue at your own pace.</div></article>';
  }
  function renderMore(){
    if(!guide||!content)return;
    const stop=Math.min(guide.chapters.length,next+BATCH);
    if(stop<=next)return;
    content.insertAdjacentHTML('beforeend',guide.chapters.slice(next,stop).map((item,i)=>chapter(item,next+i)).join(''));
    next=stop;
    const label=root.querySelector('#mncBookLoadedCount');
    if(label)label.textContent=next+' of '+guide.chapters.length+' chapters ready to read';
    if(next>=guide.chapters.length){
      if(observer){observer.disconnect();observer=null}
      if(sentinel)sentinel.hidden=true;
    }
  }
  function initBook(){
    root=document.createElement('div');
    root.id='mncReadingBook';
    root.className='mnc-book';
    root.innerHTML='<header class="book-cover">'+
      '<div class="book-cover-top"><span class="book-edition">MY NATURAL CARE · WELLNESS GUIDE</span><span class="book-total">'+guide.chapters.length+' chapters</span></div>'+
      '<div class="book-cover-layout"><div><h2>One small step at a time.<br><em>A healthier routine, every day.</em></h2>'+
      '<p>An illustrated guide to easy daily routines and practical self-care at home.</p>'+
      '<div class="book-cover-tip">Scroll to explore the guide. All chapters appear in order on one easy-to-read page.</div></div>'+
      '<div class="book-cover-art"><img src="/assets/care-icons/foot.svg" width="122" height="122" alt="Illustration: cuidados e proteção dos pés" decoding="async"></div></div>'+
      '</header><div class="book-pages" id="mncBookPages"></div>'+
      '<div class="book-next" id="mncBookNext" aria-live="off"><span class="book-next-symbol" aria-hidden="true">✦</span><p id="mncBookLoadedCount">Preparing your guide...</p></div>'+
      '<footer class="book-ending"><strong>Take care of yourself, one step at a time.</strong><p>Your well-being matters. Follow your care plan, adapt activities to your needs, and celebrate safe steps forward.</p>'+
      '<small>Illustrations: Health Icons (CC0) · Educational content.</small></footer>';
    content=root.querySelector('#mncBookPages');
    sentinel=root.querySelector('#mncBookNext');
    renderMore();
    if('IntersectionObserver' in window){
      observer=new IntersectionObserver(entries=>{
        if(entries.some(x=>x.isIntersecting))renderMore();
      },{root:null,rootMargin:'1100px 0px',threshold:0});
      observer.observe(sentinel);
    }else{
      // Fallback de compatibilidade: leitura completa sem botões ou interações extras.
      const fill=()=>{if(next<guide.chapters.length){renderMore();setTimeout(fill,0)}};
      setTimeout(fill,0);
    }
  }
  function mount(){
    if(!root){
      if(!guide){
        wellness.innerHTML='<div class="book-loading"><strong>Preparing your illustrated guide...</strong><p>Your practical self-care guide will appear here.</p></div>';
        return;
      }
      initBook();
    }
    if(root.parentNode!==wellness)wellness.replaceChildren(root);
  }
  async function openChapter(id){
    await init();
    const targetIndex=guide?.chapters?.findIndex(ch=>ch.id===id)??-1;
    if(targetIndex<0)return;
    mount();
    while(next<=targetIndex)renderMore();
    requestAnimationFrame(()=>{
      const target=document.getElementById('mnc-chapter-'+id);
      if(target)target.scrollIntoView({block:'start',behavior:'smooth'});
    });
  }
  function reportError(){
    const text='<div class="book-loading"><strong>The guide is not available right now.</strong><p>Check your connection and try again.</p><button type="button" data-book-retry>Try again</button></div>';
    if(!root||!wellness.contains(root))wellness.innerHTML=text;
  }
  async function init(){
    if(guide){mount();return}
    if(fetching)return fetching;
    fetching=(async()=>{
      try{
        const response=await fetch(DATA_URL,{cache:'force-cache',credentials:'same-origin'});
        if(!response.ok)throw new Error('Unable to load content');
        const data=await response.json();
        if(!Array.isArray(data.chapters)||data.chapters.length<15||data.chapters.some(x=>!x.title||!x.body))throw new Error('Incomplete guide');
        guide=data;
        mount();
      }catch(e){reportError();throw e}
      finally{fetching=null}
    })();
    return fetching;
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-book-retry]'))init().catch(()=>{});
  });
  window.MNCGuide={mount,init,openChapter};
  init().catch(()=>{});
})();
