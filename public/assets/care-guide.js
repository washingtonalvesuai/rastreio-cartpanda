/* My Natural Care — Livro ilustrado: leitura linear e progressiva para todas as idades. */
(function () {
  'use strict';
  const DATA_URL='/assets/neuropathy-guide-v2.json';
  const BATCH=4;
  const care=document.getElementById('careGuidePreview');
  const wellness=document.getElementById('habitsGuideLibrary');
  if(!care||!wellness)return;

  let guide=null, next=0, fetching=null, observer=null, root=null, content=null, sentinel=null;
  const escapeHTML=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const illustrated=x=>/^\/assets\/care-icons\/[a-z-]+\.svg$/.test(String(x||''));
  const img=x=>illustrated(x.image)?x.image:'/assets/care-icons/hospital.svg';
  const safeTitle=x=>escapeHTML(String(x||'').toLocaleLowerCase('pt-BR').replace(/^./,v=>v.toLocaleUpperCase('pt-BR')));
  const groupsOf=(source)=>{
    const rows=String(source||'').replace(/\r/g,'').split('\n');
    const groups=[{title:'',lines:[]}];
    for(const line of rows){
      const t=line.trim();
      if(t.length>=6&&t.length<=115&&t===t.toLocaleUpperCase('pt-BR')&&/[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t)&&!/^(?:[-•]|\d)/.test(t)&&!t.endsWith('.')){
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
      m=line.match(/^(Dia\s+\d{1,2}:|Segunda\s*[—–-]|Terça\s*[—–-]|Quarta\s*[—–-]|Quinta\s*[—–-]|Sexta\s*[—–-]|Sábado\s*[—–-]|Domingo\s*[—–-])\s*(.+)$/i);
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
      '<div class="book-ordinal"><span>CAPÍTULO '+number+' / '+guide.chapters.length+'</span><span>'+escapeHTML(item.category)+'</span></div>'+
      '<header class="book-chapter-header"><div class="book-heading-text"><h3 id="book-title-'+escapeHTML(item.id)+'">'+escapeHTML(item.title)+'</h3>'+
      '<p class="book-summary">'+escapeHTML(item.summary)+'</p></div><figure class="book-illustration">'+
      '<img src="'+escapeHTML(img(item))+'" alt="Ilustração sobre '+escapeHTML(item.title)+'" width="120" height="120" loading="lazy" decoding="async"><figcaption>Vamos aprender juntos</figcaption></figure></header>'+
      (item.action?'<aside class="book-today"><strong>✓ Seu pequeno passo de hoje</strong><p>'+escapeHTML(item.action)+'</p></aside>':'')+
      '<div class="book-chapter-text">'+sections+'</div><div class="book-chapter-foot">Cada cuidado conta. Continue no seu ritmo.</div></article>';
  }
  function renderMore(){
    if(!guide||!content)return;
    const stop=Math.min(guide.chapters.length,next+BATCH);
    if(stop<=next)return;
    content.insertAdjacentHTML('beforeend',guide.chapters.slice(next,stop).map((item,i)=>chapter(item,next+i)).join(''));
    next=stop;
    const label=root.querySelector('#mncBookLoadedCount');
    if(label)label.textContent=next+' de '+guide.chapters.length+' capítulos prontos para leitura';
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
      '<div class="book-cover-top"><span class="book-edition">MY NATURAL CARE · LIVRO DE CUIDADOS</span><span class="book-total">'+guide.chapters.length+' capítulos</span></div>'+
      '<div class="book-cover-layout"><div><h2>Um cuidado de cada vez.<br><em>Um dia melhor de cada vez.</em></h2>'+
      '<p>Um guia ilustrado para consultar com calma, aprender atitudes práticas e cuidar de você todos os dias.</p>'+
      '<div class="book-cover-tip">Role a página para ler o livro. Os capítulos aparecem em sequência, sem precisar abrir cartões.</div></div>'+
      '<div class="book-cover-art"><img src="/assets/care-icons/foot.svg" width="122" height="122" alt="Ilustração sobre cuidados e proteção dos pés" decoding="async"></div></div>'+
      '</header><div class="book-pages" id="mncBookPages"></div>'+
      '<div class="book-next" id="mncBookNext" aria-live="off"><span class="book-next-symbol" aria-hidden="true">✦</span><p id="mncBookLoadedCount">Preparando sua leitura...</p></div>'+
      '<footer class="book-ending"><strong>Cuide de você com carinho.</strong><p>Seu bem-estar merece atenção. Mantenha o acompanhamento de saúde, adapte as atividades às suas necessidades e valorize cada passo seguro.</p>'+
      '<small>Ilustrações: Health Icons (CC0) · Conteúdo educativo.</small></footer>';
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
  function mount(tab){
    const target=tab==='habits'?wellness:care;
    if(!root){
      if(!guide){
        target.innerHTML='<div class="book-loading"><strong>Preparando seu livro ilustrado...</strong><p>Seu guia prático de cuidados aparecerá aqui.</p></div>';
        return;
      }
      initBook();
    }
    if(root.parentNode!==target){
      target.replaceChildren(root);
    }
    // Capítulos não são duplicados quando o leitor alterna entre as duas abas.
  }
  function reportError(){
    const text='<div class="book-loading"><strong>Não foi possível carregar o livro neste momento.</strong><p>Confira sua conexão e tente novamente.</p><button type="button" data-book-retry>Tentar novamente</button></div>';
    for(const host of [care,wellness])if(!root||!host.contains(root))host.innerHTML=text;
  }
  async function init(){
    if(guide){mount(document.getElementById('habitsView')?.hidden===false?'habits':'care');return}
    if(fetching)return fetching;
    fetching=(async()=>{
      try{
        const response=await fetch(DATA_URL,{cache:'force-cache',credentials:'same-origin'});
        if(!response.ok)throw new Error('Não foi possível carregar o conteúdo');
        const data=await response.json();
        if(!Array.isArray(data.chapters)||data.chapters.length<15||data.chapters.some(x=>!x.title||!x.body))throw new Error('Livro incompleto');
        guide=data;
        mount(document.getElementById('habitsView')?.hidden===false?'habits':'care');
      }catch(e){reportError();throw e}
      finally{fetching=null}
    })();
    return fetching;
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-book-retry]'))init().catch(()=>{});
  });
  window.MNCGuide={mount,init};
  init().catch(()=>{});
})();
