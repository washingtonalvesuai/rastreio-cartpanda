/* My Natural Care | Biblioteca de autocuidados | carregada sob demanda */
(function(){
  "use strict";
  const DATA_URL="/assets/neuropathy-guide-v1.json";
  const MAX_INITIAL=8;
  const categories=["Todos","Comece aqui","Alimentação","Movimento","Proteção dos pés","Sono e bem-estar","Acompanhamento","Situações especiais"];
  const featured=["PR03","PR04","PR06","PR08","PR13","PR14"];
  const preview=document.getElementById("careGuidePreview");
  const library=document.getElementById("habitsGuideLibrary");
  if(!preview||!library)return;
  let guide=null,filter="Todos",search="",visible=MAX_INITIAL,currentArticle=null;
  const h=(x)=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const plain=(x)=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const isIconPath=(s)=>/^\/assets\/care-icons\/[a-z-]+\.svg$/.test(String(s||""));
  const icon=(item)=>isIconPath(item.image)?item.image:"/assets/care-icons/hospital.svg";
  function picture(item,priority){
    return '<span class="gc-illustration"><img src="'+h(icon(item))+'" alt="Ilustração: '+h(item.title)+'" width="88" height="88" loading="'+(priority?"eager":"lazy")+'" decoding="async"></span>';
  }
  function card(item,mini){
    return '<button class="gc-card '+(mini?"gc-card-mini":"")+'" type="button" data-guide-id="'+h(item.id)+'" aria-label="Abrir: '+h(item.title)+'">'+
      picture(item,false)+'<span class="gc-card-copy"><small>'+h(item.category)+' · '+h(item.id)+'</small>'+
      '<strong>'+h(item.title)+'</strong><span>'+h(item.summary)+'</span><em>Ver orientações <span aria-hidden="true">→</span></em></span></button>';
  }
  function openLibrary(){
    const b=document.querySelector('.bottom-nav [data-goto="habits"]');
    if(b)b.click();
  }
  function renderPreview(){
    if(!guide)return;
    const set=featured.map(id=>guide.chapters.find(x=>x.id===id)).filter(Boolean);
    preview.innerHTML='<div class="gc-section-head"><div><span class="gc-eyebrow">CONHECIMENTO QUE AJUDA NO DIA A DIA</span><h2>Seu guia ilustrado de cuidados</h2><p>Aprenda um cuidado por vez, com orientações práticas e imagens fáceis de identificar.</p></div><span class="gc-chapter-count">'+guide.chapters.length+' temas</span></div>'+
      '<div class="gc-preview-grid">'+set.map(x=>card(x,true)).join("")+'</div>'+
      '<button class="gc-see-all" type="button" data-guide-open-all>Explorar os '+guide.chapters.length+' assuntos <span aria-hidden="true">→</span></button>';
  }
  function renderLibrary(){
    if(!guide)return;
    library.innerHTML='<div id="gcIndex"><div class="gc-hero"><div><span class="gc-eyebrow">SEU GUIA PRÁTICO COMPLETO</span>'+
      '<h2>Cuide de você, um hábito de cada vez.</h2><p>São '+guide.chapters.length+' assuntos com orientações do dia a dia. Escolha o que você quer aprender hoje.</p>'+
      '<span class="gc-source">Baseado no Guia Prático Completo de Cuidados com a Neuropatia Periférica</span></div>'+
      '<div class="gc-hero-icons" aria-hidden="true"><img src="/assets/care-icons/nutrition.svg" alt="" width="80" height="80" decoding="async" loading="lazy"><img src="/assets/care-icons/foot.svg" alt="" width="80" height="80" decoding="async" loading="lazy"><img src="/assets/care-icons/walking.svg" alt="" width="80" height="80" decoding="async" loading="lazy"></div></div>'+
      '<label class="gc-search"><span>Buscar um cuidado</span><input id="gcSearchInput" type="search" placeholder="Ex.: alimentação, pés, sono..." autocomplete="off" enterkeyhint="search" aria-label="Buscar nos assuntos do guia"></label>'+
      '<div id="gcCategoryFilters" class="gc-filters" role="group" aria-label="Categorias dos cuidados"></div>'+
      '<div id="gcIndexMeta" class="gc-meta" aria-live="polite"></div><div id="gcGrid" class="gc-grid"></div>'+
      '<button id="gcMore" class="gc-more" type="button" hidden>Ver mais orientações</button>'+
      '<div class="gc-responsible"><strong>Seu cuidado vem em primeiro lugar.</strong><p>Escolha orientações apropriadas para você. Em caso de sintomas novos ou importantes, procure ajuda profissional. Os exercícios apresentados são educativos e podem precisar de adaptação.</p></div></div>'+
      '<article id="gcReader" class="gc-reader" hidden tabindex="-1"><button id="gcBack" class="gc-back" type="button">← Voltar para o guia</button><div id="gcArticle"></div><div class="gc-reader-bottom"><button id="gcBackBottom" class="gc-back" type="button">← Voltar aos assuntos</button></div></article>';
    renderCategoryFilters();
    renderGrid();
    document.getElementById("gcSearchInput").addEventListener("input",e=>{search=e.target.value;visible=MAX_INITIAL;renderGrid();});
  }
  function renderCategoryFilters(){
    const box=document.getElementById("gcCategoryFilters");if(!box)return;
    box.innerHTML=categories.map(c=>'<button type="button" data-guide-category="'+h(c)+'" aria-pressed="'+String(filter===c)+'">'+h(c)+'</button>').join("");
  }
  function filtered(){
    const term=plain(search.trim());
    return guide.chapters.filter(x=>(filter==="Todos"||x.category===filter)&&
      (!term||plain([x.title,x.summary,x.category,x.body].join(" ")).includes(term)));
  }
  function renderGrid(){
    if(!guide)return;
    const results=filtered(),el=document.getElementById("gcGrid"),more=document.getElementById("gcMore"),meta=document.getElementById("gcIndexMeta");
    if(!el||!more||!meta)return;
    el.innerHTML=results.length?results.slice(0,visible).map(x=>card(x,false)).join(""):
      '<div class="gc-empty"><strong>Nenhum assunto encontrado.</strong><p>Tente outra palavra ou toque em “Todos”.</p></div>';
    meta.textContent=results.length+' '+(results.length===1?'assunto encontrado':'assuntos encontrados');
    more.hidden=results.length<=visible;
    more.textContent="Ver mais orientações ("+(results.length-visible)+")";
  }
  function isHeading(line){
    const s=line.trim();
    return s.length>5&&s.length<112&&/[A-ZÁÂÃÉÊÍÓÔÕÚÇ]/.test(s)&&s===s.toLocaleUpperCase("pt-BR")&&
      !/^[\d\[\]\-]/.test(s)&&!s.endsWith(".");
  }
  function splitGroups(body){
    const lines=String(body||"").replace(/\r/g,"").split("\n");
    const groups=[{heading:"",lines:[]}];
    lines.forEach(line=>{
      if(isHeading(line)&&line.trim().length>4){
        groups.push({heading:line.trim(),lines:[]});
      }else groups[groups.length-1].lines.push(line);
    });
    return groups.filter(g=>g.heading||g.lines.some(x=>x.trim().length));
  }
  function renderLines(lines){
    let out="",current="",items=[],para=[];
    function flushPara(){if(para.length){out+='<p>'+h(para.join(" "))+'</p>';para=[]}}
    function flushList(){if(items.length){out+='<'+current+'>'+items.map(x=>'<li>'+h(x)+'</li>').join("")+'</'+current+'>';items=[];current=""}}
    function addList(kind,body){flushPara();if(current&&current!==kind)flushList();current=kind;items.push(body)}
    lines.forEach(raw=>{
      const line=raw.trim();
      if(!line){flushPara();flushList();return}
      let match=line.match(/^(?:[-•]\s+|\[\s?\]\s*)(.+)$/);
      if(match){addList("ul",match[1]);return}
      match=line.match(/^\d{1,2}[.)]\s+(.+)$/);
      if(match){addList("ol",match[1]);return}
      flushList();para.push(line);
    });
    flushPara();flushList();
    return out;
  }
  function article(item){
    const parts=splitGroups(item.body);
    let content="";
    parts.forEach((section,i)=>{
      const body=renderLines(section.lines);
      if(!body)return;
      const heading=section.heading?'<h3>'+h(section.heading)+'</h3>':"";
      if(i<=1){content+='<section class="gc-article-section">'+heading+body+'</section>'}
      else {content+='<details class="gc-details"><summary>'+h(section.heading||"Mais orientações")+'<span aria-hidden="true">+</span></summary><div class="gc-details-body">'+body+'</div></details>'}
    });
    const action=item.action?'<div class="gc-today"><strong>✨ Sua ação de hoje</strong><p>'+h(item.action)+'</p></div>':"";
    return '<header class="gc-reader-head">'+picture(item,true)+'<div><span class="gc-eyebrow">'+h(item.category)+' · '+h(item.id)+'</span><h2>'+h(item.title)+'</h2><p>'+h(item.summary)+'</p></div></header>'+
      action+'<div class="gc-rich">'+content+'</div>'+
      '<div class="gc-care-note"><strong>Um passo de cada vez.</strong><p>Adapte os cuidados à sua saúde e às orientações profissionais. Cada atitude segura e consistente merece ser valorizada.</p></div>';
  }
  function showArticle(id){
    if(!guide)return;
    const item=guide.chapters.find(x=>x.id===id);if(!item)return;
    openLibrary();
    const grid=document.getElementById("gcIndex"),reader=document.getElementById("gcReader"),inside=document.getElementById("gcArticle");
    if(!grid||!reader||!inside)return;
    currentArticle=item.id;
    inside.innerHTML=article(item);
    grid.hidden=true;reader.hidden=false;
    window.scrollTo({top:0,behavior:"instant"});
    reader.focus({preventScroll:true});
  }
  function backToLibrary(){
    currentArticle=null;
    const grid=document.getElementById("gcIndex"),reader=document.getElementById("gcReader");
    if(!grid||!reader)return;
    reader.hidden=true;grid.hidden=false;
    window.scrollTo({top:0,behavior:"instant"});
    document.getElementById("gcSearchInput")?.focus({preventScroll:true});
  }
  function click(e){
    const target=e.target;
    const articleButton=target.closest("[data-guide-id]");
    if(articleButton){showArticle(articleButton.getAttribute("data-guide-id"));return}
    const category=target.closest("[data-guide-category]");
    if(category){filter=category.getAttribute("data-guide-category");visible=MAX_INITIAL;renderCategoryFilters();renderGrid();return}
    if(target.closest("[data-guide-open-all]")){openLibrary();backToLibrary();return}
    if(target.closest("#gcMore")){visible+=8;renderGrid();return}
    if(target.closest("#gcBack,#gcBackBottom")){backToLibrary();return}
  }
  async function init(){
    if(!guide){
      try{
        const response=await fetch(DATA_URL,{cache:"force-cache",credentials:"same-origin"});
        if(!response.ok)throw new Error("Guia indisponível");
        const json=await response.json();
        if(!Array.isArray(json.chapters)||json.chapters.length!==28)throw new Error("Conteúdo incompleto");
        guide=json;
      }catch(err){
        const help='<div class="gc-load-error"><strong>Não foi possível abrir o guia agora.</strong><p>Verifique a conexão e tente novamente.</p><button type="button" data-guide-retry>Recarregar guia</button></div>';
        preview.innerHTML=help;library.innerHTML=help;
        return;
      }
    }
    renderPreview();renderLibrary();
  }
  document.addEventListener("click",e=>{
    if(e.target.closest("[data-guide-retry]")){init();return}
    click(e);
  });
  window.MNCGuide={init,open:showArticle};
  init();
})();
