import { messages } from './i18n.js';
import { formatPrice, relatedHomes } from './listing-view.mjs';
import { revealOnScroll } from './scroll-reveal.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language = localStorage.getItem('diar.language') === 'ar' ? 'ar' : 'en';
const t = key => messages[language][key] ?? key;
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${({home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="m5 12 4 4L20 5"/>',sync:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M18 18a8 8 0 0 1-13-2"/>',size:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 17 10-10M7 12v5h5M12 7h5v5"/>',layers:'<path d="m2 8 10-5 10 5-10 5Zm0 5 10 5 10-5M2 18l10 5 10-5"/>',share:'<path d="M12 16V3m-5 5 5-5 5 5M5 13v8h14v-8"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-3-3 3-3m-6 0 3-3"/>'})[name] ?? ''}</svg>`;
const state = {user:null, csrf:'', configured:false, listings:[], favorites:new Set(), loading:true, error:'', pending:new Set(), limit:9, filters:{purpose:'',type:'',search:''}};
let draft = null, map = null, marker = null, toastTimer, syncing = false;
const locale = () => language === 'ar' ? 'ar-PS' : 'en-US';
const number = value => new Intl.NumberFormat(locale(), {maximumFractionDigits:2}).format(Number(value));
const money = item => `<bdi class="money-value" dir="ltr">${formatPrice(item.price)}</bdi>${item.purpose==='rent' ? ' '+t('month') : ''}`;
const route = () => location.pathname;
const isOwner = item => Boolean(state.user && state.user.id === item.owner_id);
const digits = value => String(value).replace(/[٠-٩]/g, c => String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c => String(c.charCodeAt(0)-1776));
const floor = item => t(`floor${item.floors}`);
function errorText(error) {
  const code = typeof error === 'string' ? error : error.code;
  const aliases = {connection_failed:'connectionFailed',not_configured:'notConfigured',backend_not_configured:'notConfigured',invalid_listing:'invalidListing',invalid_input:'invalidInput',invalid_name:'invalidName',invalid_photo:'invalidPhoto',photo_too_large:'photoTooLarge',not_owner:'notOwner',sign_in_required:'signinFirst',23505:'conflict'};
  if(error.status===429 || /rate_limit|over_request/.test(code ?? '')) return t('rateLimit');
  return messages[language][aliases[code] ?? code] ?? t('errorGeneric');
}
async function api(path, options={}) {
  let response;
  try {
    response=await fetch('/api'+path,{...options,credentials:'same-origin',headers:{...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}),...(options.method && options.method!=='GET' ? {'X-CSRF-TOKEN':state.csrf} : {}),...options.headers}});
  } catch { throw {code:'connection_failed',status:0}; }
  const result = await response.json().catch(()=>({}));
  if(!response.ok) {
    if(response.status===401) {state.user=null;state.favorites.clear();}
    throw {code:result.code ?? 'errorGeneric',status:response.status};
  }
  return result;
}
async function session() {
  const data=await api('/session'); state.user=data.user?.id ? data.user : null; state.csrf=data.csrf; state.configured=data.configured;
}
function toast(message) {
  const el=$('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),4500);
}
function navigate(path) {
  if(path !== location.pathname+location.search) history.pushState({},'',path);
  window.scrollTo({top:0,behavior:'instant'}); render(); $('#main').focus({preventScroll:true});
}
function header() {
  const path=route();
  $('#header').innerHTML=`<div class="wrap site-header"><a href="/" class="wordmark" aria-label="Diar · ديار">${icon('home')}<span>Diar</span><span>ديار</span></a><nav class="navlinks" aria-label="${t('menu')}">${[['/listings','browse'],['/favorites','saved'],['/my-listings','mine']].map(([url,label])=>`<a href="${url}" ${path===url || label==='browse'&&path==='/' ? 'class="active" aria-current="page"' : ''}>${t(label)}</a>`).join('')}</nav><div class="header-actions"><button class="language" data-action="language" lang="${language==='en'?'ar':'en'}">${t('language')}</button><a class="account-link" href="/account" aria-label="${t('account')}">${icon('user')}<span>${state.user ? escape(state.user.name||t('account')) : t('signin')}</span></a><a href="/list-home" class="btn">${icon('plus')}${t('list')}</a></div></div>`;
  $('#footer').innerHTML=`<div class="wrap site-footer"><a href="/" class="wordmark">${icon('home')}<span>Diar</span><span>ديار</span></a><p>${t('footer')}</p><p>${t('footerNote')} · v1.0.1</p></div>`;
}
function empty(title,text,action='browse') {
  return `<div class="empty">${icon('home')}<h3>${t(title)}</h3><p>${t(text)}</p>${action==='clear'?`<button class="btn soft" data-action="clear">${t('clear')}</button>`:`<a class="btn soft" href="${action==='list'?'/list-home':'/listings'}">${t(action==='list'?'list':'browse')}</a>`}</div>`;
}
function card(item) {
  const saved=state.favorites.has(item.id), photo=item.photo_url||'/assets/sample-house.jpg';
  return `<article class="property-card"><div class="card-image"><a href="/listing/${escape(item.id)}" aria-label="${escape(item.title)}"><img loading="lazy" src="${escape(photo)}" alt="${item.photo_url?escape(item.title):t('samplePhoto')}"></a>${!item.photo_url?`<span class="placeholder-label">${t('samplePhoto')}</span>`:''}<button class="icon-btn" data-action="favorite" data-id="${escape(item.id)}" aria-label="${t(saved?'favoriteRemove':'favoriteAdd')}" aria-pressed="${saved}" ${state.pending.has(item.id)?'disabled':''}>${icon('heart')}</button></div><a class="card-info" href="/listing/${escape(item.id)}"><span class="eyebrow">${t(item.purpose==='sale'?'forSale':'forRent')} · ${t(item.type)}</span><h3>${escape(item.title)}</h3><div class="card-price">${money(item)}${item.negotiable?` <span class="small">· ${t('negotiable')}</span>`:''}</div><p>${escape(item.location)} · ${number(item.area)} ${language==='ar'?'م²':'m²'}</p></a></article>`;
}
function filters() {
  return `<div class="filters"><div class="filter-field"><label for="filter-purpose">${t('purpose')}</label><select id="filter-purpose" data-filter="purpose"><option value="">${t('all')}</option><option value="sale" ${state.filters.purpose==='sale'?'selected':''}>${t('sale')}</option><option value="rent" ${state.filters.purpose==='rent'?'selected':''}>${t('rent')}</option></select></div><div class="filter-field search-field"><label for="filter-search">${t('searchLabel')}</label><input id="filter-search" data-filter="search" type="search" maxlength="300" value="${escape(state.filters.search)}" placeholder="${t('searchPlaceholder')}"></div><div class="filter-field"><label for="filter-type">${t('type')}</label><select id="filter-type" data-filter="type"><option value="">${t('allTypes')}</option>${['apartment','house','villa'].map(type=>`<option value="${type}" ${state.filters.type===type?'selected':''}>${t(type)}</option>`).join('')}</select></div><button class="btn soft" data-action="refresh">${icon('sync')}${t('refresh')}</button></div>`;
}
function inventoryHTML(kind) {
  if(state.loading) return `<div class="grid" aria-label="${t('loading')}" aria-busy="true">${'<div class="skeleton"></div>'.repeat(3)}</div>`;
  if(state.error) return `<div class="error-panel" role="alert"><p>${errorText(state.error)}</p><button class="btn" data-action="refresh">${t('refresh')}</button></div>`;
  let items=state.listings;
  if(kind==='favorites') items=items.filter(item=>state.favorites.has(item.id));
  if(kind==='mine') items=items.filter(isOwner);
  if(kind==='browse') {
    const search=state.filters.search.trim().toLocaleLowerCase();
    items=items.filter(item=>(!state.filters.purpose||item.purpose===state.filters.purpose)&&(!state.filters.type||item.type===state.filters.type)&&(!search||`${item.title} ${item.location}`.toLocaleLowerCase().includes(search)));
  }
  if(!items.length) return kind==='favorites'?empty('favoritesEmpty','favoritesEmptyText'):kind==='mine'?empty('mineEmpty','mineEmptyText','list'):empty('emptyTitle',state.listings.length?'emptyText':'noListings',state.listings.length?'clear':'list');
  return `<p class="small muted" aria-live="polite">${number(items.length)} ${items.length===1?(language==='ar'?'عقار':'home'):t('count')}</p><div class="grid">${items.slice(0,state.limit).map(card).join('')}</div>${items.length>state.limit?`<div class="inventory-footer"><button class="btn light" data-action="more">${t('loadMore')}</button></div>`:''}`;
}
function inventoryKind() { return route()==='/favorites'?'favorites':route()==='/my-listings'?'mine':'browse'; }
function updateInventory() {
  const el=$('#inventory-results');
  if(el) {el.innerHTML=inventoryHTML(inventoryKind());revealOnScroll();}
}
function signedOut(title,text) {
  return `<div class="wrap"><div class="page-head"><h1>${t(title)}</h1><p>${t(text)}</p></div><div class="account-box"><p>${t('signinFirst')}</p><button class="btn" data-action="auth">${t('signin')}</button></div></div>`;
}
function browsePage(home) {
  return `<div class="wrap">${home?`<section class="hero"><div class="hero-copy"><span class="eyebrow">${t('eyebrow')}</span><h1>${t('hero1')}<br><em>${t('hero2')}</em></h1><p>${t('heroDescription')}</p><div class="hero-actions"><a class="btn" href="#homes">${t('heroBrowse')}</a><a class="text-button" href="/list-home">${t('list')}</a></div></div><div class="hero-image"><img src="/assets/hero-villa.jpg" alt="${t('villa')}" fetchpriority="high"><div class="hero-note">${icon('home')}<div><strong>${t('heroNote')}</strong><span>${t('heroNoteSmall')}</span></div></div></div></section><div class="intro-strip">${['home','sync','key'].map((name,i)=>`<div>${icon(name)}<strong>${t('feature'+(i+1))}</strong></div>`).join('')}</div>`:`<div class="page-head"><span class="eyebrow">${t('collection')}</span><h1>${t('inventory')}</h1><p>${t('inventoryNote')}</p></div>`}<section class="inventory" id="homes">${home?`<div class="section-top"><div><span class="eyebrow">${t('collection')}</span><h2>${t('inventory')}</h2></div><p>${t('inventoryNote')}</p></div>`:''}${filters()}<div id="inventory-results">${inventoryHTML('browse')}</div></section><section class="invitation"><div><h2>${t('inviteTitle')}</h2><p>${t('inviteText')}</p></div><a class="btn gold" href="/list-home">${t('list')}</a></section></div>`;
}
function collectionPage(kind) {
  const own=kind==='mine', title=own?'mineTitle':'favoritesTitle', text=own?'mineText':'favoritesText';
  if(!state.user) return signedOut(title,text);
  return `<div class="wrap"><div class="section-top page-head"><div><h1>${t(title)}</h1><p>${t(text)}</p></div></div><section class="inventory"><div class="section-top"><span class="small muted">${t('sharedLive')}</span><button class="btn light" data-action="refresh">${icon('sync')}${t('refresh')}</button></div><div id="inventory-results">${inventoryHTML(kind)}</div></section></div>`;
}
function moreHomes(current) {
  const homes=relatedHomes(state.listings,current);
  return `<section class="more-homes" aria-labelledby="more-homes-title"><div class="section-top"><div><span class="eyebrow">${t('keepExploring')}</span><h2 id="more-homes-title">${t('moreHomes')}</h2><p>${t('moreHomesText')}</p></div><a href="/listings" class="btn light">${t('viewAllHomes')}</a></div>${homes.length?`<div class="grid mini-listings">${homes.map(card).join('')}</div>`:`<p class="more-homes-empty">${t('moreHomesEmpty')}</p>`}</section>`;
}
function detailPage(id) {
  if(state.loading) return `<div class="wrap page-head"><p>${t('loading')}</p></div>`;
  if(state.error) return `<div class="wrap page-head"><div class="error-panel"><p>${errorText(state.error)}</p><button class="btn" data-action="refresh">${t('refresh')}</button></div></div>`;
  const item=state.listings.find(item=>item.id===id);
  if(!item) return `<div class="wrap page-head">${empty('unavailable','unavailableText')}</div>`;
  const saved=state.favorites.has(id);
  return `<div class="wrap"><div class="breadcrumb"><a href="/listings">${t('browse')}</a><span>/</span><span>${escape(item.location)}</span></div><div class="detail-layout"><article class="detail-main"><img class="photo" src="${escape(item.photo_url||'/assets/sample-house.jpg')}" alt="${escape(item.photo_url?item.title:t('samplePhoto'))}">${!item.photo_url?`<p class="small">${t('samplePhoto')}</p>`:''}<div class="detail-copy"><span class="eyebrow">${t(item.purpose==='sale'?'forSale':'forRent')} · ${t(item.type)}</span><h1>${escape(item.title)}</h1><p>${icon('pin')} ${escape(item.location)}</p><div class="facts">${[['area',number(item.area)+(language==='ar'?' م²':' m²')],['type',t(item.type)],['floors',floor(item)]].map(([key,value])=>`<div class="fact"><span>${t(key)}</span><strong>${escape(value)}</strong></div>`).join('')}</div>${item.description?`<h2 style="font-size:1.6rem">${t('description')}</h2><p class="description">${escape(item.description)}</p>`:''}</div></article><aside class="detail-panel"><span class="eyebrow">${t(item.purpose==='sale'?'forSale':'forRent')}</span><div class="price">${money(item)}</div><span class="badge">${t(item.negotiable?'negotiable':'fixed')}</span><hr class="panel-line"><button class="btn ${saved?'soft':''}" data-action="favorite" data-id="${escape(id)}" aria-pressed="${saved}" ${state.pending.has(id)?'disabled':''}>${icon('heart')}${t(saved?'favoriteRemove':'favoriteAdd')}</button><a class="btn light" href="https://www.openstreetmap.org/?mlat=${Number(item.latitude)}&mlon=${Number(item.longitude)}#map=17/${Number(item.latitude)}/${Number(item.longitude)}" target="_blank" rel="noopener noreferrer">${icon('pin')}${t('viewMap')}</a><button class="btn light" data-action="share">${icon('share')}${t('share')}</button><hr class="panel-line"><p>${t('publishedHint')}</p>${isOwner(item)?`<div class="owner-controls"><h3>${t('ownerTools')}</h3><a class="btn soft" href="/list-home?edit=${escape(id)}">${t('edit')}</a><button class="btn danger" data-action="delete" data-id="${escape(id)}">${t('delete')}</button></div>`:''}</aside></div>${moreHomes(item)}</div>`;
}
function accountPage() {
  return `<div class="wrap"><div class="page-head"><span class="eyebrow">Diar · ديار</span><h1>${t('account')}</h1><p>${t('accountText')}</p></div><div class="account-box">${state.user?`<h2>${escape(state.user.name||state.user.email)}</h2><p dir="ltr">${escape(state.user.email)}</p><p>${t('syncNote')}</p><a class="btn" href="/my-listings">${t('mine')}</a><button class="btn light" data-action="logout">${t('signout')}</button>`:`<p>${t('accountSignedOut')}</p><button class="btn" data-action="auth">${t('signin')}</button><button class="btn light" data-action="signup">${t('signup')}</button>`}</div></div>`;
}
function render() {
  if(map) { map.remove(); map=null; marker=null; }
  document.documentElement.lang=language; document.documentElement.dir=language==='ar'?'rtl':'ltr';
  document.title=language==='ar'?'ديار — بيت لكل حكاية':'Diar — A home for every story';
  header();
  const path=route(); let html;
  if(path==='/') html=browsePage(true);
  else if(path==='/listings') html=browsePage(false);
  else if(path==='/favorites') html=collectionPage('favorites');
  else if(path==='/my-listings') html=collectionPage('mine');
  else if(path==='/account') html=accountPage();
  else if(path==='/list-home') html=composerPage();
  else if(path.startsWith('/listing/')) html=detailPage(path.split('/')[2]);
  else html=`<div class="wrap page-head">${empty('unavailable','unavailableText')}</div>`;
  $('#main').innerHTML=html;
  revealOnScroll();
  if(path==='/list-home' && state.user && draft) bindComposer();
}
async function refresh({quiet=false}={}) {
  if(syncing) return; syncing=true;
  try {
    const [homes,saved]=await Promise.all([api('/listings'),state.user?api('/favorites'):Promise.resolve([])]);
    const changed=JSON.stringify(homes)!==JSON.stringify(state.listings) || saved.slice().sort().join()!==[...state.favorites].sort().join();
    state.listings=homes; state.favorites=new Set(saved); state.error=''; state.loading=false;
    if(!quiet || changed) {
      if($('#inventory-results')) updateInventory();
      else if(route().startsWith('/listing/')) render();
    }
  } catch(error) {
    state.loading=false;
    if(!quiet) { state.error=error.code; render(); }
    if(error.status===401) { state.user=null; state.favorites.clear(); header(); }
  } finally { syncing=false; }
}
async function favorite(id) {
  if(!state.user) { openAuth(false); return; }
  if(state.pending.has(id)) return;
  const saved=!state.favorites.has(id); state.pending.add(id);
  try {
    await api('/favorites/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({saved})});
    if(saved) state.favorites.add(id); else state.favorites.delete(id);
  } catch(error) { toast(errorText(error)); }
  finally {
    state.pending.delete(id);
    if($('#inventory-results')) updateInventory(); else render();
  }
}
function openAuth(signup=false) {
  const dialog=$('#auth-dialog');
  dialog.innerHTML=`<div class="dialog-top"><h2 id="auth-title">${t(signup?'signup':'signin')}</h2><button class="icon-btn" data-action="close-auth" aria-label="${t('close')}">${icon('close')}</button></div><p>${t(signup?'signupHint':'authHint')}</p><form id="auth-form"><div id="auth-error" role="alert"></div>${signup?`<label class="field"><span>${t('name')}</span><input name="name" autocomplete="name" minlength="2" maxlength="100" required></label>`:''}<label class="field"><span>${t('email')}</span><input name="email" type="email" dir="ltr" autocomplete="email" maxlength="254" required></label><label class="field"><span>${t('password')}</span><input name="password" type="password" dir="ltr" autocomplete="${signup?'new-password':'current-password'}" minlength="6" maxlength="128" required></label><button class="btn auth-submit" type="submit">${t(signup?'signup':'signin')}</button><button class="text-button" type="button" data-action="${signup?'auth':'signup'}">${t(signup?'hasAccount':'noAccount')}</button></form>`;
  if(!dialog.open) dialog.showModal();
  $('#auth-form').addEventListener('submit',async event=>{
    event.preventDefault(); const form=event.target, button=$('button[type=submit]',form); button.disabled=true; $('#auth-error').innerHTML='';
    try {
      const fields=Object.fromEntries(new FormData(form));
      await session();
      const result=await api('/auth/'+(signup?'signup':'login'),{method:'POST',body:JSON.stringify(fields)});
      if(result.confirmationRequired) { if($('#auth-error')) $('#auth-error').innerHTML=`<p class="inline-error">${t('confirmEmail')}</p>`;else toast(t('confirmEmail')); return; }
      await session(); state.favorites=new Set(await api('/favorites')); dialog.close(); render(); toast(t('welcome')); await refresh({quiet:true});
    } catch(error) { if($('#auth-error')) $('#auth-error').innerHTML=`<p class="inline-error">${errorText(error)}</p>`;else toast(errorText(error)); }
    finally { button.disabled=false; }
  });
}
async function logout() {
  try { await api('/auth/logout',{method:'POST'}); state.user=null; state.favorites.clear(); draft=null; await session(); navigate('/account'); toast(t('signedOut')); }
  catch(error) { toast(errorText(error)); }
}
function confirmDelete(id) {
  const dialog=$('#confirm-dialog');
  dialog.innerHTML=`<h2 id="confirm-title">${t('deleteTitle')}</h2><p>${t('deleteText')}</p><div class="form-buttons"><button class="btn light" data-action="cancel-delete">${t('cancel')}</button><button class="btn danger" id="delete-confirm">${t('delete')}</button></div>`;
  dialog.showModal();
  $('#delete-confirm').addEventListener('click',async event=>{
    event.target.disabled=true;
    try { await api('/listings/'+encodeURIComponent(id),{method:'DELETE'}); state.listings=state.listings.filter(item=>item.id!==id); state.favorites.delete(id); dialog.close(); navigate('/my-listings'); toast(t('deleteSuccess')); }
    catch(error) { dialog.close(); toast(errorText(error)); }
  });
}
function newDraft(item) {
  return {...{id:crypto.randomUUID(),title:'',area:'',purpose:'sale',type:'apartment',floors:1,location:'',latitude:null,longitude:null,location_source:'map',price:'',negotiable:false,description:''},...item,editing:Boolean(item),step:0,photo:null,photoPreview:item?.photo_url||'',permission:false,processing:false};
}
function radioChoices(name,values) {
  return `<fieldset class="choice-group"><legend class="form-label">${t({purpose:'listingPurpose',type:'listingType',floors:'listingFloors'}[name])}</legend><div class="choices ${values.length===2?'two':''}">${values.map(value=>`<label class="choice"><input type="radio" name="${name}" value="${value}" ${String(draft[name])===String(value)?'checked':''}><span>${t(name==='floors'?'floor'+value:value==='sale'?'forSale':value==='rent'?'forRent':value)}</span></label>`).join('')}</div></fieldset>`;
}
function field(name,label,extra='') {
  return `<label class="field"><span>${t(label)}</span><input name="${name}" value="${escape(draft[name])}" ${extra}></label>`;
}
function composerPage() {
  if(!state.user) return signedOut('createTitle','composerIntro');
  const editId=new URLSearchParams(location.search).get('edit');
  if(editId) {
    const item=state.listings.find(item=>item.id===editId);
    if(!item) return `<div class="wrap page-head">${empty('unavailable','unavailableText')}</div>`;
    if(!isOwner(item)) return `<div class="wrap page-head"><p role="alert">${t('notOwner')}</p></div>`;
    if(!draft || draft.id!==editId) draft=newDraft(item);
  } else if(!draft || draft.editing) draft=newDraft();
  draft.price=digits(draft.price);
  return `<div class="wrap"><div class="page-head"><span class="eyebrow">Diar · ديار</span><h1>${t(draft.editing?'editTitle':'createTitle')}</h1><p>${t('composerIntro')}</p></div><form id="composer" class="form-shell" novalidate><div class="steps" aria-label="${t('review')}">${[0,1,2].map((i)=>`<div class="step ${draft.step===i?'active':''}" ${draft.step===i?'aria-current="step"':''}>${number(i+1)}. ${t('step'+(i+1))}</div>`).join('')}</div><div id="composer-error" role="alert"></div><section class="step-panel" ${draft.step!==0?'hidden':''}><h2>${t('step1Title')}</h2><p>${t('step1Text')}</p>${field('title','title',`minlength="2" maxlength="160" placeholder="${t('titlePlaceholder')}" autocomplete="off" required`)}${field('area','size','inputmode="decimal" maxlength="15" dir="ltr" required')}${radioChoices('purpose',['sale','rent'])}${radioChoices('type',['apartment','house','villa'])}${radioChoices('floors',[1,2,3])}</section><section class="step-panel" ${draft.step!==1?'hidden':''}><h2>${t('step2Title')}</h2><p>${t('step2Text')}</p><div class="location-actions"><button type="button" class="btn soft" data-action="locate">${icon('pin')}${t('useLocation')}</button><button type="button" class="btn light" data-action="map">${t('chooseMap')}</button></div><p id="pin-status" class="pin-label" aria-live="polite">${pinText()}</p><div id="map" class="map-box" ${draft.step!==1?'hidden':''} aria-label="${t('chooseMap')}"></div><p class="small">${t('mapHelp')}</p><div class="coordinates">${field('latitude','latitude','inputmode="decimal" dir="ltr"')}${field('longitude','longitude','inputmode="decimal" dir="ltr"')}</div><button type="button" class="text-button" data-action="coordinates">${t('coordinateApply')}</button>${field('location','location',`maxlength="300" placeholder="${t('locationPlaceholder')}" required`)}</section><section class="step-panel" ${draft.step!==2?'hidden':''}><h2>${t('step3Title')}</h2><p>${t('step3Text')}</p>${field('price','price','inputmode="numeric" maxlength="10" dir="ltr" lang="en" required')}<p class="small">${t('priceHint')}</p><label class="check"><input type="checkbox" name="negotiable" ${draft.negotiable?'checked':''}>${t('negotiableCheck')}</label><label class="field"><span>${t('photo')}</span><input type="file" id="home-photo" accept="image/jpeg,image/png,image/webp"><span class="small muted">${t('photoHint')}</span></label><img id="photo-preview" class="photo-preview" src="${escape(draft.photoPreview)}" alt="${t('photoCurrent')}" ${draft.photoPreview?'':'hidden'}><p id="photo-status" class="small" aria-live="polite">${draft.photo?t('photoChosen'):''}</p><label class="field"><span>${t('descriptionLabel')}</span><textarea name="description" maxlength="5000" placeholder="${t('descriptionPlaceholder')}">${escape(draft.description)}</textarea></label><div class="publication-note"><p>${t('publication')}</p></div><label class="check"><input type="checkbox" name="permission" ${draft.permission?'checked':''}>${t('publicationCheck')}</label></section><div class="form-buttons"><button type="button" class="btn light" data-action="previous">${t(draft.step===0?'cancel':'previous')}</button><button type="submit" class="btn">${t(draft.step===2?(draft.editing?'saveChanges':'publish'):'next')}</button></div></form></div>`;
}
function pinText() { return draft.latitude!==null&&draft.longitude!==null?`${t('pinSelected')} · ${Number(draft.latitude).toFixed(5)}, ${Number(draft.longitude).toFixed(5)}`:t('pinNone'); }
function collectDraft() {
  const form=$('#composer'); if(!form||!draft) return;
  ['title','area','purpose','type','floors','location','price','description'].forEach(name=>{draft[name]=new FormData(form).get(name)??draft[name];});
  draft.floors=Number(draft.floors); draft.negotiable=form.elements.negotiable.checked; draft.permission=form.elements.permission.checked;
}
function setPin(lat,lon,source='map') {
  if(!draft) return;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180) {toast(t('validPin'));return;}
  draft.latitude=lat;draft.longitude=lon;draft.location_source=source;
  $('#pin-status').textContent=pinText(); $('#composer').elements.latitude.value=lat.toFixed(6);$('#composer').elements.longitude.value=lon.toFixed(6);
  if(map) {if(marker) marker.setLatLng([lat,lon]);else marker=L.circleMarker([lat,lon],{radius:11,color:'#fff',weight:3,fillColor:'#195d60',fillOpacity:1}).addTo(map);map.panTo([lat,lon]);}
}
function showMap() {
  if(!$('#map')||!window.L) return;
  $('#map').hidden=false;
  if(!map) {
    map=L.map('map',{scrollWheelZoom:false,zoomControl:false}).setView([draft.latitude??31.78,draft.longitude??35.22],draft.latitude===null?10:15);
    L.control.zoom({zoomInTitle:t('zoomIn'),zoomOutTitle:t('zoomOut')}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(map);
    map.on('click',event=>setPin(event.latlng.lat,event.latlng.lng));
    if(draft.latitude!==null) setPin(draft.latitude,draft.longitude,draft.location_source);
  }
  map.invalidateSize();
}
function bindComposer() {
  const form=$('#composer');
  form.addEventListener('input',event=>{
    if(event.target.name==='price' && !event.isComposing) event.target.value=digits(event.target.value);
    collectDraft();
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();collectDraft();$('#composer-error').innerHTML='';
    const error=validateStep();
    if(error) {$('#composer-error').innerHTML=`<p class="inline-error">${t(error)}</p>`;$('#composer-error').scrollIntoView({block:'center'});return;}
    if(draft.step<2) {draft.step++;render();return;}
    await publish();
  });
  $('#home-photo').addEventListener('change',preparePhoto);
  if(draft.step===1) showMap();
}
function validateStep() {
  if(draft.step===0) {
    if(draft.title.trim().length<2||draft.title.length>160) return 'validTitle';
    const area=digits(draft.area).replace('٫','.');
    if(!/^\d+(\.\d{1,2})?$/.test(area)||Number(area)<=0||Number(area)>1e9) return 'validArea';
    draft.area=area;
  } else if(draft.step===1) {
    if(!draft.location.trim()||draft.latitude===null||draft.longitude===null) return 'validPin';
  } else {
    const price=digits(draft.price);
    if(!/^\d+$/.test(price)||Number(price)<1||Number(price)>1e9) return 'wholePrice';
    draft.price=price;
    if(!draft.permission) return 'permissionRequired';
    if(draft.processing) return 'photoProcessing';
  }
  return '';
}
async function preparePhoto(event) {
  const file=event.target.files?.[0]; if(!file) return;
  if(file.size>5*1024*1024) {toast(t('photoTooLarge'));event.target.value='';return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) {toast(t('invalidPhoto'));event.target.value='';return;}
  const current=draft; current.processing=true;$('#photo-status').textContent=t('photoProcessing');
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();
    if(image.width*image.height>20_000_000) throw Error();
    const scale=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));if(!blob) throw Error();
    if(current.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(current.photoPreview);
    current.photo=blob;current.photoPreview=URL.createObjectURL(blob);
    if(draft===current && $('#photo-preview')) {$('#photo-preview').src=current.photoPreview;$('#photo-preview').hidden=false;$('#photo-status').textContent=t('photoChosen');}
  } catch {toast(t('invalidPhoto'));if($('#photo-status')) $('#photo-status').textContent='';}
  finally {URL.revokeObjectURL(url);current.processing=false;}
}
async function publish() {
  const current=draft,button=$('#composer button[type=submit]');button.disabled=true;button.textContent=t('working');
  try {
    const payload={id:current.id,title:current.title.trim(),area:current.area,purpose:current.purpose,type:current.type,floors:Number(current.floors),location:current.location.trim(),latitude:current.latitude,longitude:current.longitude,location_source:current.location_source,price:Number(current.price),negotiable:current.negotiable,description:current.description};
    const body=new FormData();body.append('listing',JSON.stringify(payload));if(current.photo) body.append('photo',current.photo,'home.jpg');
    const saved=await api('/listings'+(current.editing?'/'+encodeURIComponent(current.id):''),{method:current.editing?'PUT':'POST',body});
    state.listings=[saved,...state.listings.filter(item=>item.id!==saved.id)];
    const message=t(current.editing?'updateSuccess':'publishSuccess');if(current.photoPreview?.startsWith('blob:')) URL.revokeObjectURL(current.photoPreview);draft=null;navigate('/listing/'+saved.id);toast(message);
  } catch(error) {if($('#composer-error')) $('#composer-error').innerHTML=`<p class="inline-error">${errorText(error)}</p>`;else toast(errorText(error));}
  finally {button.disabled=false;button.textContent=t(current.editing?'saveChanges':'publish');}
}
document.addEventListener('click',async event=>{
  const link=event.target.closest('a[href]');
  if(link && link.origin===location.origin && !link.target && !event.ctrlKey&&!event.metaKey&&!event.shiftKey && !link.getAttribute('href').startsWith('#')) {event.preventDefault();navigate(link.pathname+link.search);return;}
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  if(action==='language') {collectDraft();language=language==='en'?'ar':'en';localStorage.setItem('diar.language',language);render();if($('#auth-dialog').open)openAuth(false);}
  else if(action==='auth'||action==='signup')openAuth(action==='signup');
  else if(action==='close-auth')$('#auth-dialog').close();
  else if(action==='logout')await logout();
  else if(action==='favorite')await favorite(button.dataset.id);
  else if(action==='refresh')await refresh();
  else if(action==='clear') {state.filters={purpose:'',type:'',search:''};state.limit=9;render();}
  else if(action==='more') {state.limit+=9;updateInventory();}
  else if(action==='share') {try {await navigator.clipboard.writeText(location.href);toast(t('copied'));}catch {toast(t('copyFailed'));}}
  else if(action==='delete')confirmDelete(button.dataset.id);
  else if(action==='cancel-delete')$('#confirm-dialog').close();
  else if(action==='previous') {collectDraft();if(draft.step===0)navigate('/my-listings');else {draft.step--;render();}}
  else if(action==='map')showMap();
  else if(action==='coordinates') {
    const form=$('#composer'),lat=digits(form.elements.latitude.value).trim(),lon=digits(form.elements.longitude.value).trim();
    if(!lat||!lon)toast(t('validPin'));else setPin(Number(lat),Number(lon));
  } else if(action==='locate') {
    if(!navigator.geolocation) {toast(t('locationDenied'));return;}
    button.disabled=true;const current=draft;$('#pin-status').textContent=t('locationWorking');
    navigator.geolocation.getCurrentPosition(position=>{if(current===draft&&$('#pin-status')){setPin(position.coords.latitude,position.coords.longitude,'current');toast(t('locationAccuracy'));button.disabled=false;}},()=>{if(current===draft&&$('#pin-status')){$('#pin-status').textContent=t('locationDenied');button.disabled=false;}},{enableHighAccuracy:true,timeout:20000,maximumAge:30000});
  }
});
document.addEventListener('input',event=>{const key=event.target.dataset.filter;if(key){state.filters[key]=event.target.value;state.limit=9;updateInventory();}});
window.addEventListener('popstate',render);
async function backgroundSync() {
  if(document.visibilityState!=='visible'||route()==='/list-home'||$('#auth-dialog').open||$('#confirm-dialog').open||state.pending.size) return;
  await refresh({quiet:true});
}
document.addEventListener('visibilitychange',backgroundSync);
setInterval(backgroundSync,30000);
$('#auth-dialog').addEventListener('close',()=>$('#auth-dialog').replaceChildren());
try {await session();}catch(error){state.error=error.code;}
render();await refresh();render();
