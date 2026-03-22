
function getSupabaseClient(){
  if(window.supabaseClient) return window.supabaseClient;
  if(window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY){
    try{
      window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
      return window.supabaseClient;
    }catch(e){
      console.error('Unable to initialise Supabase client', e);
      return null;
    }
  }
  return null;
}

async function saveDraftToSupabase(item, user){
  const client = getSupabaseClient();
  if(!client) return { skipped:true };
  const statusMap = {
    'Draft':'draft',
    'In review':'pending',
    'Approved':'approved',
    'In production':'in_production',
    'Shipped':'delivered'
  };
  const payload = {
    draft_name: item.title || 'Untitled Project',
    status: statusMap[item.status] || 'draft',
    album_type: item.selectionType || item.albumType || 'Album',
    album_size: item.size || null,
    cover_material: item.coverMaterial || null,
    cover_color: item.cover || null,
    spreads: Number(item.spreads || 0) || null,
    has_parent_albums: item.selectionType === 'Set',
    parent_album_type: item.selectionType === 'Set' ? (item.replicaSize || null) : null,
    parent_album_qty: item.selectionType === 'Set' ? Number(item.replicaQty || 0) : 0,
    has_presentation_box: false,
    total_price: Number(item.price || 0) || 0,
    photographer_name: user && user.role === 'photographer' ? (user.photographerName || user.studioName || null) : null,
    photographer_instagram: user && user.role === 'photographer' ? (user.website || null) : null,
    guest_name: user && user.role === 'guest' ? (user.photographerName || user.studioName || 'Guest User') : null,
    guest_email: user && user.role === 'guest' ? (user.email || null) : null,
    notes: [
      item.printOnCover ? 'Print on cover: yes' : null,
      item.pictureWindow ? 'Picture window: yes' : null
    ].filter(Boolean).join(' | ') || null
  };
  const { data, error } = await client.from('drafts').insert([payload]).select().limit(1);
  if(error) return { error };
  return { data: data && data[0] ? data[0] : null };
}


function storageAvailable(){
  try{
    const key='__am_test__';
    localStorage.setItem(key,'1');
    localStorage.removeItem(key);
    return true;
  }catch(e){ return false; }
}
function warnStorage(){
  const banner=document.getElementById('storageWarning');
  if(banner && !storageAvailable()){
    banner.innerHTML='Your browser is blocking local storage for this local file, so demo login and saved projects may not work. Try another browser or serve the folder locally.';
    banner.className='notice';
  }
}
function safeJsonParse(value, fallback){ try{ return JSON.parse(value); }catch(e){ return fallback; } }
function readUsers(){ return safeJsonParse(localStorage.getItem('am_users') || '[]', []); }
function saveUsers(users){ try{ localStorage.setItem('am_users', JSON.stringify(users)); return true; }catch(e){ console.error('Unable to save users', e); return false; } }
function currentUser(){ return safeJsonParse(localStorage.getItem('am_current_user') || 'null', null); }
function setCurrentUser(user){ try{ localStorage.setItem('am_current_user', JSON.stringify(user)); return true; }catch(e){ console.error('Unable to save current user', e); return false; } }
function signOut(){ localStorage.removeItem('am_current_user'); location.href='login.html'; }
function readProjects(){ return safeJsonParse(localStorage.getItem('am_projects') || '[]', []); }
function saveProjects(projects){ try{ localStorage.setItem('am_projects', JSON.stringify(projects)); return true; }catch(e){ console.error('Unable to save projects', e); return false; } }
function uuid(){ return 'AM-' + Math.floor(Date.now()/1000).toString().slice(-6); }

function seedDemoData(){
  if(!storageAvailable()) return;
  if(!localStorage.getItem('am_seeded')){
    const demo={
      studioName:'Demo Studio',
      photographerName:'Marco Demo',
      email:'demo@alvezmango.com',
      password:'demo123',
      phone:'+357 00000000',
      country:'Cyprus',
      website:'instagram.com/demo',
      approved:true,
      role:'photographer'
    };
    saveUsers([demo]);
    const projects=[
      {id:'AM-1001', userEmail:demo.email, title:'Sophia & Daniel', albumType:'Fine Art', selectionType:'Album', size:'30×30', cover:'Linen Sand', spreads:25, status:'In review', created:'2026-03-12', price:162},
      {id:'AM-1002', userEmail:demo.email, title:'Christening Album', albumType:'Classic', selectionType:'Album', size:'20×20', cover:'Velvet Olive', spreads:20, status:'Draft', created:'2026-03-10', price:88}
    ];
    saveProjects(projects);
    localStorage.setItem('am_seeded','1');
  }
}
function showMessage(id,text,isError){
  const el=document.getElementById(id);
  if(!el) return;
  el.className='notice';
  el.style.background=isError ? '#f8e8e8' : '#f4ede4';
  el.style.borderColor=isError ? '#e1b9b9' : '#e4d7c7';
  el.textContent=text;
}
function ensureAuth(){
  const user=currentUser();
  if(!user){ location.href='login.html'; return null; }
  document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=user.photographerName || user.studioName || user.email);
  document.querySelectorAll('[data-studio-name]').forEach(el=>el.textContent=user.studioName || 'Your Studio');
  document.querySelectorAll('[data-role]').forEach(el=>el.textContent=user.role || 'photographer');
  return user;
}
function setupRegister(){
  const form=document.getElementById('registerForm');
  if(!form) return;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    if(!storageAvailable()){ showMessage('registerMsg','Local storage is unavailable in this browser, so the mockup cannot save accounts.', true); return; }
    const data=Object.fromEntries(new FormData(form).entries());
    const users=readUsers();
    if(users.some(u=>u.email.toLowerCase()===data.email.toLowerCase())){
      showMessage('registerMsg','An account with this email already exists.', true); return;
    }
    data.approved=false;
    data.role='photographer';
    users.push(data);
    saveUsers(users);
    showMessage('registerMsg','Account created successfully. Your account is pending approval.', false);
    form.reset();
  });
}
function setupLogin(){
  const form=document.getElementById('loginForm');
  if(!form) return;
  const fillDemo=document.getElementById('fillDemo');
  if(fillDemo){
    fillDemo.addEventListener('click', function(){
      document.getElementById('loginEmail').value='demo@alvezmango.com';
      document.getElementById('loginPassword').value='demo123';
    });
  }
  form.addEventListener('submit', function(e){
    e.preventDefault();
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    const password=document.getElementById('loginPassword').value;
    const user=readUsers().find(u=>u.email.toLowerCase()===email && u.password===password);
    if(!user){
      showMessage('loginMsg','Email or password not found. Use the demo account button to test the photographer area.', true); return;
    }
    if(user && user.approved === false){
      showMessage('loginMsg','Your account is pending approval.', true);
      return;
    }
    setCurrentUser(user);
    location.href='dashboard.html';
  });
}



function albumPricingConfig(){
  return {
    sizes: ['30×30','40×30','35×25','30×20','20×20','20×15'],
    shapeMap: {
      '30×30':'square',
      '20×20':'square',
      '40×30':'rect',
      '35×25':'rect',
      '30×20':'rect',
      '20×15':'rect'
    },
    defaults: {
      '30×30':'20×20',
      '40×30':'20×15',
      '35×25':'30×20',
      '30×20':'30×20',
      '20×20':'20×20',
      '20×15':'20×15'
    },
    pricing: {
      '30×30': {perSpread:1.856097142857143, fixed:7.583333333333334},
      '20×20': {perSpread:0.8894844444444444, fixed:4.791666666666667},
      '40×30': {perSpread:2.4455149206349205, fixed:9},
      '20×15': {perSpread:0.7186812698412698, fixed:4.791666666666667},
      '35×25': {perSpread:1.485992380952381, fixed:7.583333333333334},
      '30×20': {perSpread:1.3595066666666666, fixed:7.583333333333334}
    }
  };
}
function sizeOrder(){ return albumPricingConfig().sizes.slice(); }
function replicaOptionsForSize(size){
  const cfg = albumPricingConfig();
  const shape = cfg.shapeMap[size];
  return cfg.sizes.filter(s => cfg.shapeMap[s] === shape);
}
function defaultReplicaSize(size){
  return albumPricingConfig().defaults[size] || size;
}
function roundMoney(value){
  return Math.round(Number(value || 0));
}
function formatMoney(value){
  return '€' + roundMoney(value);
}
function rawAlbumPrice(size, spreads){
  const cfg = albumPricingConfig().pricing[size];
  if(!cfg) return 0;
  const safeSpreads = Math.min(35, Math.max(10, Number(spreads || 20)));
  return ((safeSpreads * cfg.perSpread) + cfg.fixed) * 3;
}
function addonPrice(enabled, units){
  if(!enabled) return 0;
  const count = Math.max(1, Number(units || 1));
  return 10 + Math.max(0, count - 1) * 5;
}
function getPricingResult(selectionType, size, spreads, quantity, replicaQty, replicaSize, printOnCover, pictureWindow, role){
  if(role === 'guest'){
    return { value: null, display: '—', note: 'Quote available through your photographer.' };
  }
  const mainQty = Math.max(1, Number(quantity || 1));
  const replicaCount = selectionType === 'Set' ? Math.max(0, Number(replicaQty || 0)) : 0;
  const mainBase = rawAlbumPrice(size, spreads) * mainQty;
  const replicaBase = selectionType === 'Set' ? rawAlbumPrice(replicaSize || defaultReplicaSize(size), spreads) * replicaCount : 0;
  const combined = mainBase + replicaBase;
  const discounted = selectionType === 'Set' ? combined * 0.85 : combined;
  const units = mainQty + replicaCount;
  const printCost = addonPrice(printOnCover, units);
  const windowCost = addonPrice(pictureWindow, units);
  const total = roundMoney(discounted + printCost + windowCost);
  let note = selectionType === 'Set'
    ? `Set price = combined selling price × 0.85. Main ${size} × ${mainQty}${replicaCount ? ` · Replicas ${replicaSize} × ${replicaCount}` : ''} · ${spreads} spreads.`
    : `Album price follows the Excel spread logic. ${size} × ${mainQty} · ${spreads} spreads.`;
  if(printOnCover || pictureWindow){
    const bits = [];
    if(printOnCover) bits.push(`Print on cover ${formatMoney(printCost)}`);
    if(pictureWindow) bits.push(`Picture window ${formatMoney(windowCost)}`);
    note += ' ' + bits.join(' · ');
  }
  return { value: total, display: formatMoney(total), note };
}
function calcQuote(size, spreads, selectionType, quantity, replicaQty, replicaSize, printOnCover, pictureWindow, role){
  const result = getPricingResult(selectionType || 'Album', size, spreads, quantity, replicaQty, replicaSize, printOnCover, pictureWindow, role);
  return role === 'guest' ? result.note : result.value;
}
function updateReplicaOptions(form){
  if(!form) return;
  const sizeEl = form.querySelector('[name="size"]');
  const replicaSelect = form.querySelector('[name="replicaSize"]');
  if(!sizeEl || !replicaSelect) return;
  const current = replicaSelect.value || defaultReplicaSize(sizeEl.value);
  const options = replicaOptionsForSize(sizeEl.value);
  replicaSelect.innerHTML = options.map(size => `<option value="${size}">${size}</option>`).join('');
  replicaSelect.value = options.includes(current) ? current : defaultReplicaSize(sizeEl.value);
}
function syncPackageSummary(form){
  if(!form) return;
  const fd = new FormData(form);
  const selectionType = fd.get('selectionType') || 'Album';
  const size = fd.get('size') || '30×30';
  const spreads = Number(fd.get('spreads') || 20);
  const quantity = Math.max(1, Number(fd.get('quantity') || 1));
  const replicaQty = Math.max(0, Number(fd.get('replicaQty') || 0));
  const replicaSize = (fd.get('replicaSize') || defaultReplicaSize(size));
  const summary = `${size} · ${spreads} spreads`;
  form.querySelectorAll('[data-main-package-summary]').forEach(el => el.textContent = summary);
  form.querySelectorAll('[data-main-size]').forEach(el => el.textContent = size);
  form.querySelectorAll('[data-main-qty]').forEach(el => el.textContent = quantity);
  form.querySelectorAll('[data-replica-summary]').forEach(el => el.textContent = `${replicaSize} · ${spreads} spreads`);
  form.querySelectorAll('[data-replica-qty]').forEach(el => el.textContent = replicaQty);
  const replicaRow = form.querySelector('[data-replica-row]');
  if(replicaRow){
    replicaRow.classList.toggle('disabled', selectionType !== 'Set');
    replicaRow.querySelectorAll('input,select').forEach(el => el.disabled = selectionType !== 'Set');
  }
  const printUpload = form.querySelector('#printCoverUploadWrap');
  const windowUpload = form.querySelector('#pictureWindowUploadWrap');
  if(printUpload) printUpload.style.display = fd.get('printOnCover') === 'yes' ? 'block' : 'none';
  if(windowUpload) windowUpload.style.display = fd.get('pictureWindow') === 'yes' ? 'block' : 'none';
}
function ensureCoreOrderFields(form, titleLabel){
  if(!form) return;
  const alreadyComplete = form.querySelector('select[name="selectionType"]') && form.querySelector('input[name="quantity"]') && form.querySelector('select[name="replicaSize"]') && form.querySelector('select[name="printOnCover"]') && form.querySelector('select[name="pictureWindow"]');
  const firstGrid = form.querySelector('.form-grid');
  if(firstGrid && !alreadyComplete){
    firstGrid.innerHTML = `
      <div class="field"><label>${titleLabel}</label><input name="projectTitle" placeholder="e.g. Sophia & Daniel" required></div>
      <div class="field"><label>Album or Set</label><select name="selectionType"><option value="Album">Album</option><option value="Set">Set</option></select></div>
      <div class="field"><label>Size</label><select name="size">${sizeOrder().map(s => `<option value="${s}">${s}</option>`).join('')}</select></div>
      <div class="field"><label>Number of Spreads</label><input name="spreads" type="number" min="10" max="35" value="20"></div>
    `;
    let albumTypeHidden = form.querySelector('input[type="hidden"][name="albumType"]');
    if(!albumTypeHidden){
      albumTypeHidden = document.createElement('input');
      albumTypeHidden.type = 'hidden';
      albumTypeHidden.name = 'albumType';
      form.prepend(albumTypeHidden);
    }
    albumTypeHidden.value = 'Album';
    const oldSelectionHidden = form.querySelector('input[type="hidden"][name="selectionType"]');
    if(oldSelectionHidden) oldSelectionHidden.remove();

    const oldPriceNote = form.querySelector('#pricingModeNote');
    if(oldPriceNote) oldPriceNote.remove();
    const packageHtml = document.createElement('div');
    packageHtml.className = 'package-builder';
    packageHtml.innerHTML = `
      <div class="package-row">
        <div>
          <div class="package-label">Album</div>
          <div class="small">Chosen album from the size and spread options above.</div>
        </div>
        <div class="package-meta"><strong data-main-size>30×30</strong></div>
        <div class="package-meta">
          <label>Quantity</label>
          <input name="quantity" type="number" min="1" value="1">
        </div>
        <div class="package-meta package-summary" data-main-package-summary>30×30 · 20 spreads</div>
      </div>
      <div class="package-row" data-replica-row>
        <div>
          <div class="package-label">Replicas</div>
          <div class="small">Enabled when Set is selected.</div>
        </div>
        <div class="package-meta">
          <label>Size</label>
          <select name="replicaSize"></select>
        </div>
        <div class="package-meta">
          <label>Quantity</label>
          <input name="replicaQty" type="number" min="0" value="2">
        </div>
        <div class="package-meta package-summary" data-replica-summary>20×20 · 20 spreads</div>
      </div>
    `;
    firstGrid.insertAdjacentElement('afterend', packageHtml);

    const coverLabel = Array.from(form.querySelectorAll('label')).find(el => el.textContent.trim().toLowerCase().includes('cover option'));
    const coverSection = coverLabel ? coverLabel.closest('div') : null;
    if(coverSection){
      const trigger = coverSection.querySelector('.cover-trigger');
      const helper = coverSection.querySelector('.small');
      if(helper) helper.textContent = 'Choose one of the 4 cover material groups below, then select a swatch.';
      const tabs = coverSection.querySelector('#materialTabs');
      if(trigger && tabs) tabs.insertAdjacentElement('afterend', trigger);
      if(trigger) trigger.classList.add('cover-preview-panel');
      const setToggle = coverSection.querySelector('.set-toggle-wrap');
      if(setToggle) setToggle.remove();
      const existingExtras = coverSection.querySelector('.cover-extra-options');
      if(existingExtras) existingExtras.remove();
      const extras = document.createElement('div');
      extras.className = 'cover-extra-options';
      extras.innerHTML = `
        <div class="form-grid" style="margin-top:18px">
          <div class="field">
            <label>Print on Cover</label>
            <select name="printOnCover"><option value="no">No</option><option value="yes">Yes</option></select>
            <div class="small">€10 for the first album, then €5 for each extra album in a set.</div>
            <div id="printCoverUploadWrap" style="display:none;margin-top:10px"><input type="file" name="printCoverFile" accept=".pdf,.jpg,.jpeg,image/jpeg,application/pdf"></div>
          </div>
          <div class="field">
            <label>Picture Window</label>
            <select name="pictureWindow"><option value="no">No</option><option value="yes">Yes</option></select>
            <div class="small">€10 for the first album, then €5 for each extra album in a set.</div>
            <div id="pictureWindowUploadWrap" style="display:none;margin-top:10px"><input type="file" name="pictureWindowFile" accept=".jpg,.jpeg,image/jpeg"></div>
          </div>
        </div>
      `;
      coverSection.appendChild(extras);
    }
    form.setAttribute('data-upgraded','1');
  }
  updateReplicaOptions(form);
  syncPackageSummary(form);
}
function applyPricingSelectionBehavior(form){
  if(!form) return;
  updateReplicaOptions(form);
  syncPackageSummary(form);
}



function coverMaterials(){
  return {
    'Linen': [
      {name:'Linen Sand', material:'Linen', color:'#d8c8b2'},
      {name:'Linen Ivory', material:'Linen', color:'#ece4d6'},
      {name:'Linen Stone', material:'Linen', color:'#b9b1a6'},
      {name:'Linen Dusty Rose', material:'Linen', color:'#c8a6a1'},
      {name:'Linen Oat', material:'Linen', color:'#cab89e'},
      {name:'Linen Sage', material:'Linen', color:'#aab59d'},
      {name:'Linen Mist Blue', material:'Linen', color:'#9eaaba'},
      {name:'Linen Clay', material:'Linen', color:'#b68f79'}
    ],
    'Leatherette': [
      {name:'Leatherette Black', material:'Leatherette', color:'#2b2b2b'},
      {name:'Leatherette Camel', material:'Leatherette', color:'#b58053'},
      {name:'Leatherette Chocolate', material:'Leatherette', color:'#5c4437'},
      {name:'Leatherette Dove Grey', material:'Leatherette', color:'#9a9b9a'},
      {name:'Leatherette Walnut', material:'Leatherette', color:'#7b5d47'},
      {name:'Leatherette Taupe', material:'Leatherette', color:'#9a836f'},
      {name:'Leatherette Cloud', material:'Leatherette', color:'#c8c6c1'},
      {name:'Leatherette Midnight', material:'Leatherette', color:'#2e3546'}
    ],
    'Cotton': [
      {name:'Cotton Pearl', material:'Cotton', color:'#e8e0d4'},
      {name:'Cotton Almond', material:'Cotton', color:'#d8c9b0'},
      {name:'Cotton Wheat', material:'Cotton', color:'#c6b08d'},
      {name:'Cotton Dust Blue', material:'Cotton', color:'#a3b1bd'},
      {name:'Cotton Terracotta', material:'Cotton', color:'#b8745c'},
      {name:'Cotton Olive', material:'Cotton', color:'#848a63'},
      {name:'Cotton Charcoal', material:'Cotton', color:'#56504b'},
      {name:'Cotton Rosewood', material:'Cotton', color:'#9f6f68'}
    ],
    'Velvet': [
      {name:'Velvet Olive', material:'Velvet', color:'#7e8362'},
      {name:'Velvet Midnight', material:'Velvet', color:'#273248'},
      {name:'Velvet Burgundy', material:'Velvet', color:'#6d2f39'},
      {name:'Velvet Forest', material:'Velvet', color:'#2f5b48'},
      {name:'Velvet Plum', material:'Velvet', color:'#5b425f'},
      {name:'Velvet Rust', material:'Velvet', color:'#9a5841'},
      {name:'Velvet Charcoal', material:'Velvet', color:'#414247'},
      {name:'Velvet Dust Rose', material:'Velvet', color:'#b18286'}
    ]
  };
}
function coverSwatches(material){
  const mats = coverMaterials();
  return mats[material] || mats['Linen'];
}
function getAllCovers(){
  return Object.values(coverMaterials()).flat();
}
function getCoverByName(name){
  return getAllCovers().find(item => item.name === name) || coverSwatches('Linen')[0];
}
function updateCoverTrigger(selectedName){
  const item = getCoverByName(selectedName);
  const nameEl = document.getElementById('selectedCoverName');
  const materialEl = document.getElementById('selectedCoverMaterial');
  const thumbEl = document.getElementById('selectedCoverThumb');
  if(nameEl) nameEl.textContent = item.name;
  if(materialEl) materialEl.textContent = item.material;
  if(thumbEl){
    thumbEl.style.backgroundImage = 'none';
    thumbEl.style.backgroundColor = item.color;
  }
}
function currentSelectedMaterial(){
  const el = document.getElementById('coverMaterialInput');
  return el ? el.value : 'Linen';
}
function renderMaterialTabs(activeMaterial){
  const wrap = document.getElementById('materialTabs');
  if(!wrap) return;
  const materials = Object.keys(coverMaterials());
  wrap.innerHTML = materials.map(m => {
    const minis = coverSwatches(m).slice(0,4).map(s => `<span style="background:${s.color}"></span>`).join('');
    return `<div class="category-card ${m===activeMaterial ? 'active' : ''}" data-material="${m}">
      <h4>${m}</h4>
      <div class="category-mini">${minis}</div>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', function(){
      const material = this.getAttribute('data-material');
      document.getElementById('coverMaterialInput').value = material;
      renderMaterialTabs(material);
      openCoverModalForMaterial(material);
    });
  });
}
function renderCoverSwatches(selectedName, material){
  const mat = material || currentSelectedMaterial();
  const wrap=document.getElementById('coverSwatches');
  if(!wrap) return;
  wrap.innerHTML=coverSwatches(mat).map(item => `
    <div class="swatch-option ${selectedName===item.name ? 'selected':''}" data-cover="${item.name}" data-material="${item.material}">
      <div class="swatch-sample" style="background:${item.color};"></div>
      <div class="swatch-meta">
        <h4>${item.name}</h4>
        <div class="small">${item.material}</div>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('.swatch-option').forEach(card=>{
    card.addEventListener('click', function(){
      const val=this.getAttribute('data-cover');
      const matSelected=this.getAttribute('data-material');
      const coverInput = document.getElementById('coverInput');
      const matInput = document.getElementById('coverMaterialInput');
      if(coverInput) coverInput.value=val;
      if(matInput) matInput.value=matSelected;
      renderMaterialTabs(matSelected);
      renderCoverSwatches(val, matSelected);
      updateCoverTrigger(val);
      closeCoverModal();
      const form = document.getElementById('orderForm') || document.getElementById('guestDraftForm') || document.getElementById('photographerDraftForm');
      if(form) form.dispatchEvent(new Event('input', {bubbles:true}));
    });
  });
}
function openCoverModalForMaterial(material){
  const matInput = document.getElementById('coverMaterialInput');
  if(matInput) matInput.value = material;
  const title = document.getElementById('coverModalTitle');
  const subtitle = document.getElementById('coverModalSubtitle');
  if(title) title.textContent = material + ' colours';
  if(subtitle) subtitle.textContent = 'Choose from 8 named swatches in ' + material + '.';
  const currentName = (document.getElementById('coverInput') || {}).value || '';
  const current = getCoverByName(currentName);
  const valid = coverSwatches(material).some(x => x.name === current.name);
  const selected = valid ? current.name : coverSwatches(material)[0].name;
  renderCoverSwatches(selected, material);
  openCoverModal();
}
function openCoverModal(){
  const modal = document.getElementById('coverModal');
  if(modal) modal.classList.add('open');
}
function closeCoverModal(){
  const modal = document.getElementById('coverModal');
  if(modal) modal.classList.remove('open');
}

function setupCoverModal(){
  const trigger = document.getElementById('openCoverModal') || document.querySelector('.cover-trigger');
  const closeBtn = document.getElementById('closeCoverModal');
  const modal = document.getElementById('coverModal');
  if(trigger) trigger.addEventListener('click', openCoverModal);
  if(closeBtn) closeBtn.addEventListener('click', closeCoverModal);
  if(modal){
    modal.addEventListener('click', function(e){
      if(e.target === modal) closeCoverModal();
    });
  }
}


function renderPendingApprovals(currentUser){
  if(!currentUser || currentUser.email !== 'demo@alvezmango.com') return;

  const panel = document.getElementById('approvalPanel');
  const listEl = document.getElementById('approvalList');

  const users = readUsers();
  const pending = users.filter(u => u.role === 'photographer' && !u.approved);

  if(!pending.length){
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  listEl.innerHTML = pending.map(u => `
    <div class="panel" style="margin-bottom:12px">
      <strong>${u.photographerName}</strong> (${u.email})<br>
      <span class="small">${u.phone} · ${u.city} · ${u.country}</span><br>
      <span class="small">${u.website}</span><br><br>

      <button onclick="approveUser('${u.email}')" class="btn">Approve</button>
      <button onclick="deleteUser('${u.email}')" class="btn secondary">Delete</button>
    </div>
  `).join('');
}

function approveUser(email){
  let users = readUsers();
  users = users.map(u => {
    if(u.email === email){
      u.approved = true;
    }
    return u;
  });
  saveUsers(users);
  location.reload();
}

function deleteUser(email){
  if(!confirm('Delete this account?')) return;
  let users = readUsers().filter(u => u.email !== email);
  saveUsers(users);
  location.reload();
}

function forgotPassword(){
  const email = prompt("Enter your email:");
  if(!email) return;

  const user = readUsers().find(u => u.email === email);

  if(!user){
    alert("No account found.");
    return;
  }

  alert("Password reset is a mockup. Your password is: " + user.password);
}

function setupDashboard(){
  const user=ensureAuth(); if(!user) return;
  renderPendingApprovals(user);
  const list=readProjects().filter(p => p.userEmail===user.email).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')) || String(b.id||'').localeCompare(String(a.id||'')));
  renderPendingApprovals(user);
  const body=document.getElementById('projectRows');
  if(document.getElementById('projectCount')) document.getElementById('projectCount').textContent=list.length;
  if(document.getElementById('draftCount')) document.getElementById('draftCount').textContent=list.filter(p=>p.status==='Draft').length;
  if(document.getElementById('reviewCount')) document.getElementById('reviewCount').textContent=list.filter(p=>p.status!=='Draft').length;
  if(body){
    if(!list.length){
      body.innerHTML='<tr><td colspan="8"><div class="empty">No projects yet. Create your first album order.</div></td></tr>';
    }else{
      body.innerHTML=list.map(p=>`
      <tr>
        <td><a href="#" class="linkish" onclick="openDraft('${p.id}');return false;">${p.id}</a></td>
        <td><a href="#" class="linkish" onclick="openDraft('${p.id}');return false;">${p.title}</a></td>
        <td>${p.selectionType || p.albumType}</td>
        <td>${p.size}</td>
        <td>${p.cover}</td>
        <td><span class="chip">${p.status}</span></td>
        <td>${p.created}</td>
        <td>
          <div class="action-row">
            <button onclick="openDraft('${p.id}')" class="btn secondary" style="padding:8px 12px">View</button>
            ${p.status==='Draft' ? `<button onclick="deleteDraft('${p.id}')" class="btn secondary" style="padding:8px 12px">Delete</button>` : ''}
          </div>
        </td>
      </tr>`).join('');
    }
  }
}

function getProjectById(id){
  return readProjects().find(p => p.id === id) || null;
}
function openDraft(id){
  localStorage.setItem('am_current_project_id', id);
  const user = currentUser();
  if(user && user.role === 'guest'){
    location.assign('./guest-draft-edit.html');
  } else {
    location.assign('./photographer-draft-edit.html');
  }
}
function shareProjectByEmail(email, project){
  return 'In the real site, this would send the draft "' + project.title + '" to ' + email + '. In this mockup, it demonstrates the sharing flow.';
}

function deleteDraft(id){
  if(!confirm('Delete this draft project?')) return;
  const user=currentUser();
  let projects=readProjects();
  projects=projects.filter(p => !(p.id===id && p.userEmail===user.email && p.status==='Draft'));
  saveProjects(projects);
  window.location.reload();
}
function setupOrders(){
  const user=ensureAuth(); if(!user) return;
  renderPendingApprovals(user);
  const list=readProjects().filter(p => p.userEmail===user.email).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')) || String(b.id||'').localeCompare(String(a.id||'')));
  const wrap=document.getElementById('ordersList');
  if(!wrap) return;
  if(!list.length){ wrap.innerHTML='<div class="empty">No orders found yet.</div>'; return; }
  wrap.innerHTML=list.map(p=>`
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap">
        <div>
          <div class="kicker">${p.id}</div>
          <h3 style="margin:6px 0 6px"><a href="#" class="linkish" onclick="openDraft('${p.id}');return false;">${p.title}</a></h3>
          <div class="small">${p.selectionType || p.albumType} · ${p.size} · ${p.cover} · ${p.spreads} spreads${p.sharedByGuest ? ' · Shared by guest' : ''}</div>
          <div class="small" style="margin-top:4px">${user.role === 'guest' ? 'Quote available through your photographer' : 'Estimate: €' + Number(p.price || 0).toFixed(2)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:start; flex-wrap:wrap">
          <span class="chip">${p.status}</span>
          <button onclick="openDraft('${p.id}')" class="btn secondary" style="padding:9px 12px">View draft</button>
          ${p.status==='Draft' ? `<button onclick="deleteDraft('${p.id}')" class="btn secondary" style="padding:9px 12px">Delete draft</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}
function setupNewOrder(){
  const user=ensureAuth(); if(!user) return;
  const form=document.getElementById('orderForm'); if(!form) return;
  const isGuest = user.role === 'guest';
  ensureCoreOrderFields(form, isGuest ? 'Your names / project title' : 'Project title');
  const quoteEl=document.getElementById('quotePrice');
  renderMaterialTabs('Linen');
  updateCoverTrigger('Linen Sand');
  setupCoverModal();
  const shareForm = document.getElementById('shareForm');
  if(shareForm) shareForm.style.display = 'none';
  function updateQuote(){
    const fd=new FormData(form);
    applyPricingSelectionBehavior(form);
    const result=getPricingResult(
      fd.get('selectionType') || 'Album',
      fd.get('size'),
      Number(fd.get('spreads') || 20),
      Number(fd.get('quantity') || 1),
      Number(fd.get('replicaQty') || 2),
      fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      fd.get('printOnCover') === 'yes',
      fd.get('pictureWindow') === 'yes',
      user.role
    );
    if(quoteEl) quoteEl.textContent=result.display;
    const hint=document.getElementById('quoteHint');
    if(hint) hint.textContent=result.note;
  }
  form.addEventListener('input', updateQuote);
  form.addEventListener('change', updateQuote);
  updateQuote();
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const submitter = e.submitter;
    const action = submitter && submitter.value ? submitter.value : 'save';
    const fd=new FormData(form);
    const pricingResult=getPricingResult(
      fd.get('selectionType') || 'Album',
      fd.get('size'),
      Number(fd.get('spreads') || 20),
      Number(fd.get('quantity') || 1),
      Number(fd.get('replicaQty') || 2),
      fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      fd.get('printOnCover') === 'yes',
      fd.get('pictureWindow') === 'yes',
      user.role
    );
    const projects=readProjects();
    const item={
      id:uuid(),
      userEmail:user.email,
      title:fd.get('projectTitle'),
      albumType:'Album',
      selectionType:fd.get('selectionType') || 'Album',
      size:fd.get('size'),
      cover:fd.get('cover'),
      coverMaterial:fd.get('coverMaterial') || document.getElementById('coverMaterialInput').value,
      spreads:Number(fd.get('spreads') || 20),
      quantity:Number(fd.get('quantity') || 1),
      replicaQty:Number(fd.get('replicaQty') || 2),
      replicaSize:fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      printOnCover: fd.get('printOnCover') === 'yes',
      pictureWindow: fd.get('pictureWindow') === 'yes',
      status: action === 'place-order' ? 'In review' : 'Draft',
      created:new Date().toISOString().slice(0,10),
      price: roundMoney(pricingResult.value || 0)
    };
    const remoteResult = await saveDraftToSupabase(item, user);
    if(remoteResult && remoteResult.data && remoteResult.data.id){
      item.remoteId = remoteResult.data.id;
    }
    if(remoteResult && remoteResult.error){
      console.error('Supabase draft save error:', remoteResult.error);
    }
    projects.unshift(item);
    if(!saveProjects(projects)){
      showMessage('orderMsg','Unable to save the project in browser storage. Please allow local storage and try again.', true);
      return;
    }
    localStorage.setItem('am_current_project_id', item.id);
    const saveMsg = user.role==='guest'
      ? 'Preview saved. Opening the preview editor now.'
      : (action === 'place-order' ? 'Order placed. Opening your orders page now.' : 'Project saved. Opening your orders page now.');
    showMessage('orderMsg', remoteResult && remoteResult.error ? saveMsg + ' Database sync failed, but the local save is safe.' : saveMsg, !!(remoteResult && remoteResult.error));
    location.href = user.role==='guest' ? 'guest-draft-edit.html' : 'orders.html';
  });
}
function setupGuestPreview(){
  const guestBtn=document.getElementById('enterGuest');
  if(guestBtn){
    guestBtn.addEventListener('click', function(){
      const guest={
        studioName:'Guest Preview',
        photographerName:'Guest User',
        email:'guest@preview.local',
        approved:false,
        role:'guest'
      };
      setCurrentUser(guest);
      location.assign('./guest-order.html');
    });
  }
}
function initPage(){
  warnStorage();
  seedDemoData();
  const page=document.body.getAttribute('data-page');
  if(page==='register') setupRegister();
  if(page==='login') setupLogin();
  if(page==='dashboard') setupDashboard();
  if(page==='new-order') setupNewOrder();
  if(page==='orders') setupOrders();
  if(page==='guest-preview') setupGuestPreview();
  if(page==='draft-detail') setupDraftDetail();
  if(page==='guest-draft-edit') setupGuestDraftEditor();
  if(page==='photographer-draft-edit') setupPhotographerDraftEditor();
}
document.addEventListener('DOMContentLoaded', initPage);


function setupDraftDetail(){
  const user = ensureAuth(); if(!user) return;
  const id = localStorage.getItem('am_current_project_id');
  const project = getProjectById(id);
  const wrap = document.getElementById('draftDetailWrap');
  const noData = document.getElementById('draftDetailEmpty');
  if(!project){
    if(noData) noData.style.display = 'block';
    if(wrap) wrap.style.display = 'none';
    return;
  }
  document.querySelectorAll('[data-project-title]').forEach(el => el.textContent = project.title || 'Untitled Project');
  document.querySelectorAll('[data-project-id]').forEach(el => el.textContent = project.id || '—');
  document.querySelectorAll('[data-project-type]').forEach(el => el.textContent = project.selectionType || project.albumType || '—');
  document.querySelectorAll('[data-project-size]').forEach(el => el.textContent = project.size || '—');
  document.querySelectorAll('[data-project-cover]').forEach(el => el.textContent = project.cover || '—');
  document.querySelectorAll('[data-project-cover-material]').forEach(el => el.textContent = project.coverMaterial || (project.cover ? project.cover.split(' ')[0] : '—'));
  document.querySelectorAll('[data-project-spreads]').forEach(el => el.textContent = project.spreads || '—');
  document.querySelectorAll('[data-project-status]').forEach(el => el.textContent = project.status || '—');
  document.querySelectorAll('[data-project-created]').forEach(el => el.textContent = project.created || '—');
  const estimate = document.getElementById('detailEstimate');
  if(estimate){
    estimate.textContent = user.role === 'guest'
      ? 'Quote available through your photographer'
      : '€' + Number(project.price || 0).toFixed(2);
  }
  const shareForm = document.getElementById('detailShareForm');
  if(shareForm){
    shareForm.addEventListener('submit', function(e){
      e.preventDefault();
      const email = document.getElementById('detailShareEmail').value.trim();
      showMessage('detailShareMsg', shareProjectByEmail(email, project), false);
    });
  }
  const deleteBtn = document.getElementById('detailDeleteBtn');
  if(deleteBtn){
    if(project.status === 'Draft'){
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.onclick = function(){
        deleteDraft(project.id);
      };
    } else {
      deleteBtn.style.display = 'none';
    }
  }
}


function convertGuestDraft(targetEmail){
  const projectId = localStorage.getItem('am_current_project_id');
  const project = getProjectById(projectId);
  if(!project) return null;
  let projects = readProjects();
  const copy = {...project};
  copy.id = uuid();
  copy.userEmail = (targetEmail || '').trim().toLowerCase() || 'demo@alvezmango.com';
  copy.status = 'Draft';
  copy.created = new Date().toISOString().slice(0,10);
  const quote = calcQuote(copy.size, Number(copy.spreads || 20), copy.selectionType || 'Album', Number(copy.quantity || 1), Number(copy.replicaQty || 2), copy.replicaSize || defaultReplicaSize(copy.size), !!copy.printOnCover, !!copy.pictureWindow, 'photographer');
  copy.price = typeof quote === 'number' ? quote : 0;
  copy.sharedByGuest = true;
  copy.sharedToEmail = copy.userEmail;
  projects.unshift(copy);
  if(!saveProjects(projects)) return null;
  return copy;
}


function setupPhotographerDraftEditor(){
  const user = ensureAuth(); if(!user) return;
  const id = localStorage.getItem('am_current_project_id');
  const project = getProjectById(id);
  const form = document.getElementById('photographerDraftForm');
  const empty = document.getElementById('photographerDraftEmpty');
  const wrap = document.getElementById('photographerDraftWrap');
  if(!project || !form){
    if(empty) empty.style.display = 'block';
    if(wrap) wrap.style.display = 'none';
    return;
  }
  document.querySelectorAll('[data-project-title]').forEach(el => el.textContent = project.title || 'Untitled Project');
  document.querySelectorAll('[data-project-id]').forEach(el => el.textContent = project.id || '—');
  document.querySelectorAll('[data-project-status]').forEach(el => el.textContent = project.status || '—');
  document.querySelectorAll('[data-project-created]').forEach(el => el.textContent = project.created || '—');
  ensureCoreOrderFields(form, 'Project title');
  form.projectTitle.value = project.title || '';
  form.selectionType.value = project.selectionType || 'Album';
  form.size.value = project.size || '30×30';
  form.spreads.value = project.spreads || 20;
  form.quantity.value = project.quantity || 1;
  updateReplicaOptions(form);
  form.replicaSize.value = project.replicaSize || defaultReplicaSize(form.size.value);
  form.replicaQty.value = project.replicaQty ?? 2;
  form.printOnCover.value = project.printOnCover ? 'yes' : 'no';
  form.pictureWindow.value = project.pictureWindow ? 'yes' : 'no';
  document.getElementById('coverInput').value = project.cover || 'Linen Sand';
  document.getElementById('coverMaterialInput').value = project.coverMaterial || ((project.cover || 'Linen Sand').split(' ')[0]);
  renderMaterialTabs(document.getElementById('coverMaterialInput').value);
  updateCoverTrigger(document.getElementById('coverInput').value);
  setupCoverModal();
  const submitBtn = document.getElementById('convertToOrderBtn');
  if(submitBtn) submitBtn.textContent = 'Place Order';
  const inlinePlaceOrderBtn = document.getElementById('inlinePlaceOrderBtn');
  if(inlinePlaceOrderBtn){
    inlinePlaceOrderBtn.addEventListener('click', function(){
      const original = document.getElementById('convertToOrderBtn');
      if(original) original.click();
    });
  }
  renderStatusRail(project.status || 'Draft', 'editorStatusRail');
  makeUploadList('photographerUploadList');
  function refreshSummaryAndQuote(){
    const fd = new FormData(form);
    applyPricingSelectionBehavior(form);
    document.querySelectorAll('[data-side-selection-type]').forEach(el => el.textContent = fd.get('selectionType') || 'Album');
    document.querySelectorAll('[data-side-size]').forEach(el => el.textContent = fd.get('size'));
    document.querySelectorAll('[data-side-cover]').forEach(el => el.textContent = document.getElementById('coverInput').value);
    document.querySelectorAll('[data-side-material]').forEach(el => el.textContent = document.getElementById('coverMaterialInput').value);
    document.querySelectorAll('[data-side-spreads]').forEach(el => el.textContent = fd.get('spreads'));
    document.querySelectorAll('[data-side-main-qty]').forEach(el => el.textContent = fd.get('quantity') || '1');
    document.querySelectorAll('[data-side-replica-size]').forEach(el => el.textContent = fd.get('selectionType') === 'Set' ? (fd.get('replicaSize') || defaultReplicaSize(fd.get('size'))) : '—');
    document.querySelectorAll('[data-side-replica-qty]').forEach(el => el.textContent = fd.get('selectionType') === 'Set' ? (fd.get('replicaQty') || '2') : '—');
    document.querySelectorAll('[data-side-print]').forEach(el => el.textContent = fd.get('printOnCover') === 'yes' ? 'Yes' : 'No');
    document.querySelectorAll('[data-side-window]').forEach(el => el.textContent = fd.get('pictureWindow') === 'yes' ? 'Yes' : 'No');
    const result = getPricingResult(fd.get('selectionType') || 'Album', fd.get('size'), Number(fd.get('spreads') || 20), Number(fd.get('quantity') || 1), Number(fd.get('replicaQty') || 2), fd.get('replicaSize') || defaultReplicaSize(fd.get('size')), fd.get('printOnCover') === 'yes', fd.get('pictureWindow') === 'yes', user.role || 'photographer');
    renderAlbumPreview('albumPreviewTarget', document.getElementById('coverInput').value, document.getElementById('coverMaterialInput').value, fd.get('size'));
    const quoteEl = document.getElementById('editorQuotePrice');
    if(quoteEl) quoteEl.textContent = result.display;
    const quoteNote = document.getElementById('editorQuoteNote');
    if(quoteNote) quoteNote.textContent = '';
  }
  form.addEventListener('input', refreshSummaryAndQuote);
  form.addEventListener('change', refreshSummaryAndQuote);
  refreshSummaryAndQuote();
  form.addEventListener('submit', function(e){
    e.preventDefault();
    let projects = readProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if(idx === -1) return;
    const fd = new FormData(form);
    const result = getPricingResult(fd.get('selectionType') || 'Album', fd.get('size'), Number(fd.get('spreads') || 20), Number(fd.get('quantity') || 1), Number(fd.get('replicaQty') || 2), fd.get('replicaSize') || defaultReplicaSize(fd.get('size')), fd.get('printOnCover') === 'yes', fd.get('pictureWindow') === 'yes', 'photographer');
    projects[idx] = {...projects[idx], title: fd.get('projectTitle'), albumType: 'Album', selectionType: fd.get('selectionType') || 'Album', size: fd.get('size'), spreads: Number(fd.get('spreads') || 20), quantity: Number(fd.get('quantity') || 1), replicaQty: Number(fd.get('replicaQty') || 2), replicaSize: fd.get('replicaSize') || defaultReplicaSize(fd.get('size')), printOnCover: fd.get('printOnCover') === 'yes', pictureWindow: fd.get('pictureWindow') === 'yes', cover: document.getElementById('coverInput').value, coverMaterial: document.getElementById('coverMaterialInput').value, price: roundMoney(result.value || 0)};
    if(!saveProjects(projects)){ showMessage('editorMsg', 'Unable to save changes in browser storage.', true); return; }
    showMessage('editorMsg', 'Project updated locally.', false);
    refreshSummaryAndQuote();
  });
  if(submitBtn){
    submitBtn.addEventListener('click', function(){
      let projects = readProjects();
      const idx = projects.findIndex(p => p.id === project.id);
      if(idx === -1) return;
      projects[idx].status = 'In review';
      projects[idx].notification = 'Project moved to In review';
      if(!saveProjects(projects)){ showMessage('editorMsg', 'Unable to update project status in browser storage.', true); return; }
      showMessage('editorMsg', 'Project placed and moved to In review.', false);
      document.querySelectorAll('[data-project-status]').forEach(el => el.textContent = 'In review');
      renderStatusRail('In review', 'editorStatusRail');
    });
  }
}


function projectStatusSteps(status){
  const steps = ['Draft','In review','Approved','In production','Shipped'];
  const currentIndex = Math.max(0, steps.indexOf(status || 'Draft'));
  return steps.map((s, i) => ({label:s, active:i <= currentIndex}));
}
function renderStatusRail(status, targetId){
  const wrap = document.getElementById(targetId);
  if(!wrap) return;
  wrap.innerHTML = projectStatusSteps(status).map(step => `
    <div class="status-step ${step.active ? 'active' : ''}">
      <span class="dot"></span>
      <strong>${step.label}</strong>
    </div>
  `).join('');
}
function makeUploadList(targetId){
  const wrap = document.getElementById(targetId);
  if(!wrap) return;
  const spreads = [
    ['Spread_01.jpg', 'Ready'],
    ['Spread_02.jpg', 'Ready'],
    ['Spread_03.jpg', 'Pending'],
    ['Spread_04.jpg', 'Pending']
  ];
  wrap.innerHTML = spreads.map(item => `
    <div class="upload-item">
      <strong>${item[0]}</strong>
      <span class="progress-pill">${item[1]}</span>
    </div>
  `).join('');
}
function renderAlbumPreview(targetId, coverName, material, size){
  const wrap = document.getElementById(targetId);
  if(!wrap) return;
  const cover = getCoverByName(coverName || 'Linen Sand');
  wrap.innerHTML = `
    <div class="album-preview-card">
      <div class="album-book" style="background:${cover.color};"></div>
      <div>
        <div class="kicker">Album preview</div>
        <h4 style="font-size:24px;font-family:Georgia,serif;margin:6px 0 8px">${coverName || 'Linen Sand'}</h4>
        <div class="small">${material || cover.material} · ${size || '30×30'}</div>
        <div class="note-strip">This is a simple visual mockup of the chosen cover. Later this can become a richer 3D preview.</div>
      </div>
    </div>
  `;
}


function setupGuestDraftEditor(){
  const user = ensureAuth(); if(!user) return;
  const id = localStorage.getItem('am_current_project_id');
  const project = getProjectById(id);
  const form = document.getElementById('guestDraftForm');
  const empty = document.getElementById('guestDraftEmpty');
  const wrap = document.getElementById('guestDraftWrap');
  if(!project || !form){
    if(empty) empty.style.display = 'block';
    if(wrap) wrap.style.display = 'none';
    return;
  }
  document.querySelectorAll('[data-project-title]').forEach(el => el.textContent = project.title || 'Untitled Project');
  document.querySelectorAll('[data-project-id]').forEach(el => el.textContent = project.id || '—');
  document.querySelectorAll('[data-project-status]').forEach(el => el.textContent = project.status || '—');
  document.querySelectorAll('[data-project-created]').forEach(el => el.textContent = project.created || '—');
  ensureCoreOrderFields(form, 'Your names / project title');
  form.projectTitle.value = project.title || '';
  form.selectionType.value = project.selectionType || 'Album';
  form.size.value = project.size || '30×30';
  form.spreads.value = project.spreads || 20;
  form.quantity.value = project.quantity || 1;
  updateReplicaOptions(form);
  form.replicaSize.value = project.replicaSize || defaultReplicaSize(form.size.value);
  form.replicaQty.value = project.replicaQty ?? 2;
  form.printOnCover.value = project.printOnCover ? 'yes' : 'no';
  form.pictureWindow.value = project.pictureWindow ? 'yes' : 'no';
  document.getElementById('coverInput').value = project.cover || 'Linen Sand';
  document.getElementById('coverMaterialInput').value = project.coverMaterial || ((project.cover || 'Linen Sand').split(' ')[0]);
  renderMaterialTabs(document.getElementById('coverMaterialInput').value);
  updateCoverTrigger(document.getElementById('coverInput').value);
  setupCoverModal();
  function refreshGuestSummary(){
    const fd = new FormData(form);
    applyPricingSelectionBehavior(form);
    document.querySelectorAll('[data-side-selection-type]').forEach(el => el.textContent = fd.get('selectionType') || 'Album');
    document.querySelectorAll('[data-side-size]').forEach(el => el.textContent = fd.get('size'));
    document.querySelectorAll('[data-side-cover]').forEach(el => el.textContent = document.getElementById('coverInput').value);
    document.querySelectorAll('[data-side-material]').forEach(el => el.textContent = document.getElementById('coverMaterialInput').value);
    document.querySelectorAll('[data-side-spreads]').forEach(el => el.textContent = fd.get('spreads'));
    document.querySelectorAll('[data-side-main-qty]').forEach(el => el.textContent = fd.get('quantity') || '1');
    document.querySelectorAll('[data-side-replica-size]').forEach(el => el.textContent = fd.get('selectionType') === 'Set' ? (fd.get('replicaSize') || defaultReplicaSize(fd.get('size'))) : '—');
    document.querySelectorAll('[data-side-replica-qty]').forEach(el => el.textContent = fd.get('selectionType') === 'Set' ? (fd.get('replicaQty') || '2') : '—');
    document.querySelectorAll('[data-side-print]').forEach(el => el.textContent = fd.get('printOnCover') === 'yes' ? 'Yes' : 'No');
    document.querySelectorAll('[data-side-window]').forEach(el => el.textContent = fd.get('pictureWindow') === 'yes' ? 'Yes' : 'No');
  }
  form.addEventListener('input', refreshGuestSummary);
  form.addEventListener('change', refreshGuestSummary);
  refreshGuestSummary();
  form.addEventListener('submit', function(e){
    e.preventDefault();
    let projects = readProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if(idx === -1) return;
    const fd = new FormData(form);
    projects[idx] = {...projects[idx], title: fd.get('projectTitle'), albumType: 'Album', selectionType: fd.get('selectionType') || 'Album', size: fd.get('size'), spreads: Number(fd.get('spreads') || 20), quantity: Number(fd.get('quantity') || 1), replicaQty: Number(fd.get('replicaQty') || 2), replicaSize: fd.get('replicaSize') || defaultReplicaSize(fd.get('size')), printOnCover: fd.get('printOnCover') === 'yes', pictureWindow: fd.get('pictureWindow') === 'yes', cover: document.getElementById('coverInput').value, coverMaterial: document.getElementById('coverMaterialInput').value, price: 0};
    if(!saveProjects(projects)){ showMessage('guestEditorMsg', 'Unable to save changes in browser storage.', true); return; }
    showMessage('guestEditorMsg', 'Project updated locally. You can now share it with your photographer from this preview page.', false);
    document.querySelectorAll('[data-project-title]').forEach(el => el.textContent = projects[idx].title || 'Untitled Project');
    refreshGuestSummary();
  });
  const shareForm = document.getElementById('detailShareForm');
  if(shareForm){
    shareForm.addEventListener('submit', function(e){
      e.preventDefault();
      const email = document.getElementById('detailShareEmail').value.trim();
      let projects = readProjects();
      const idx = projects.findIndex(p => p.id === project.id);
      if(idx !== -1){
        const fd = new FormData(form);
        projects[idx] = {...projects[idx], title: fd.get('projectTitle'), albumType: 'Album', selectionType: fd.get('selectionType') || 'Album', size: fd.get('size'), spreads: Number(fd.get('spreads') || 20), quantity: Number(fd.get('quantity') || 1), replicaQty: Number(fd.get('replicaQty') || 2), replicaSize: fd.get('replicaSize') || defaultReplicaSize(fd.get('size')), printOnCover: fd.get('printOnCover') === 'yes', pictureWindow: fd.get('pictureWindow') === 'yes', cover: document.getElementById('coverInput').value, coverMaterial: document.getElementById('coverMaterialInput').value};
        if(!saveProjects(projects)){ showMessage('detailShareMsg', 'Unable to save your latest changes before sharing.', true); return; }
      }
      const copy = convertGuestDraft(email);
      showMessage('detailShareMsg', copy ? `Draft shared locally to ${email}. It can now appear in that photographer account as a draft.` : 'Unable to share the draft right now.', !copy);
    });
  }
  const deleteBtn = document.getElementById('detailDeleteBtn');
  if(deleteBtn){
    if(project.status === 'Draft'){
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.onclick = function(){ deleteDraft(project.id); };
    } else {
      deleteBtn.style.display = 'none';
    }
  }
}


/* =========================
   Stable Supabase rebuild v1
   admin + centralized orders
   ========================= */
const ADMIN_EMAILS = ['demo@alvezmango.com'];

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function normalizeOrderStatus(status){
  const raw = String(status || '').replaceAll('"','').trim().toLowerCase();
  if(raw === 'draft') return 'Draft';
  if(raw === 'approved') return 'Approved';
  if(raw === 'in_production') return 'In production';
  if(raw === 'delivered' || raw === 'shipped') return 'Shipped';
  return raw === 'pending' || raw === 'submitted' || raw === '' ? 'In review' : raw.replace(/_/g,' ').replace(/\b\w/g, s => s.toUpperCase());
}
function dbDraftStatusFromUi(status){
  const clean = String(status || '').toLowerCase();
  if(clean === 'draft') return 'draft';
  if(clean === 'approved') return 'approved';
  if(clean === 'in production' || clean === 'in_production') return 'in_production';
  if(clean === 'shipped') return 'delivered';
  return clean === 'in review' ? 'pending' : 'draft';
}
function dbOrderStatusFromUi(status){
  const clean = String(status || '').toLowerCase();
  if(clean === 'approved') return 'approved';
  if(clean === 'in production' || clean === 'in_production') return 'in_production';
  if(clean === 'shipped') return 'delivered';
  return 'pending';
}
function isAdminUser(user){
  if(!user) return false;
  const status = String(user.status || '').replaceAll('"','').toLowerCase();
  return status === 'admin' || ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
}
async function getSessionUser(){
  const client = getSupabaseClient();
  if(!client || !client.auth) return null;
  const { data, error } = await client.auth.getUser();
  if(error) return null;
  return data && data.user ? data.user : null;
}
async function getPhotographerByEmail(email){
  const client = getSupabaseClient();
  if(!client || !email) return null;
  const { data, error } = await client.from('photographers').select('*').ilike('email', email).limit(1);
  if(error) return null;
  return data && data[0] ? data[0] : null;
}
async function buildCurrentUserFromSession(){
  const authUser = await getSessionUser();
  if(!authUser || !authUser.email) return null;
  const row = await getPhotographerByEmail(authUser.email);
  const merged = {
    id: authUser.id,
    email: authUser.email,
    approved: row ? String(row.status || '').replaceAll('"','').toLowerCase() !== 'pending' : true,
    role: row ? (isAdminUser(row) ? 'admin' : 'photographer') : 'photographer',
    status: row ? String(row.status || '').replaceAll('"','').toLowerCase() : 'approved',
    studioName: row && row.company_name ? row.company_name : (row && row.name ? row.name : authUser.email),
    photographerName: row && row.name ? row.name : authUser.email,
    phone: row && row.phone ? row.phone : '',
    city: row && row.city ? row.city : '',
    country: row && row.country ? row.country : '',
    website: row && row.website ? row.website : '',
    instagram: row && row.instagram ? row.instagram : ''
  };
  setCurrentUser(merged);
  return merged;
}
async function ensureAuthFresh(){
  let user = currentUser();
  if(!user){
    user = await buildCurrentUserFromSession();
  }
  if(!user){
    location.href='login.html';
    return null;
  }
  document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent=user.photographerName || user.studioName || user.email);
  document.querySelectorAll('[data-studio-name]').forEach(el=>el.textContent=user.studioName || user.photographerName || 'Your Studio');
  document.querySelectorAll('[data-role]').forEach(el=>el.textContent=user.role || 'photographer');
  return user;
}
async function signOut(){
  const client = getSupabaseClient();
  if(client && client.auth){
    try{ await client.auth.signOut(); }catch(e){ console.error(e); }
  }
  localStorage.removeItem('am_current_user');
  location.href='login.html';
}
async function saveDraftToSupabaseStable(item, user){
  const client = getSupabaseClient();
  if(!client) return { skipped:true };
  const payload = {
    draft_name: item.title || 'Untitled Project',
    status: dbDraftStatusFromUi(item.status || 'Draft'),
    album_type: item.selectionType || item.albumType || 'Album',
    album_size: item.size || null,
    cover_material: item.coverMaterial || null,
    cover_color: item.cover || null,
    cover_text: item.coverText || null,
    font_choice: item.fontChoice || null,
    spreads: Number(item.spreads || 0) || null,
    has_parent_albums: item.selectionType === 'Set',
    parent_album_type: item.selectionType === 'Set' ? (item.replicaSize || null) : null,
    parent_album_qty: item.selectionType === 'Set' ? Number(item.replicaQty || 0) : null,
    has_presentation_box: false,
    total_price: Number(item.price || 0) || 0,
    photographer_name: user && user.photographerName ? user.photographerName : null,
    photographer_instagram: user && (user.instagram || user.website || user.email) ? (user.instagram || user.website || user.email) : null,
    notes: [
      item.printOnCover ? 'Print on cover: yes' : null,
      item.pictureWindow ? 'Picture window: yes' : null,
      user && user.email ? `owner_email:${user.email}` : null
    ].filter(Boolean).join(' | ') || null,
    is_submitted: item.status === 'In review'
  };
  const { data, error } = await client.from('drafts').insert([payload]).select().limit(1);
  if(error) return { error };
  return { data: data && data[0] ? data[0] : null };
}
async function saveOrderToSupabase(item, user, remoteDraftId){
  const client = getSupabaseClient();
  if(!client) return { skipped:true };
  const orderNumber = item.id || ('AM-' + Date.now());
  const payload = {
    guest_id: null,
    draft_id: remoteDraftId || null,
    photographer_name: user && user.photographerName ? user.photographerName : null,
    photographer_instagram: user && (user.instagram || user.website || user.email) ? (user.instagram || user.website || user.email) : null,
    order_number: orderNumber,
    status: dbOrderStatusFromUi(item.status || 'In review'),
    album_type: item.selectionType || item.albumType || 'Album',
    album_size: item.size || null,
    cover_material: item.coverMaterial || null,
    cover_color: item.cover || null,
    cover_text: item.coverText || null,
    font_choice: item.fontChoice || null,
    spreads: Number(item.spreads || 0) || null,
    parent_album_type: item.selectionType === 'Set' ? (item.replicaSize || null) : null,
    parent_album_qty: item.selectionType === 'Set' ? Number(item.replicaQty || 0) : null,
    has_presentation_box: false,
    box_type: null,
    total_price: Number(item.price || 0) || 0,
    internal_notes: user && user.email ? `owner_email:${user.email}` : null,
    production_notes: [
      item.printOnCover ? 'Print on cover: yes' : null,
      item.pictureWindow ? 'Picture window: yes' : null
    ].filter(Boolean).join(' | ') || null
  };
  const { data, error } = await client.from('orders').insert([payload]).select().limit(1);
  if(error) return { error };
  return { data: data && data[0] ? data[0] : null };
}
function notesContainOwnerEmail(notes, email){
  if(!notes || !email) return false;
  return String(notes).toLowerCase().includes(`owner_email:${String(email).toLowerCase()}`);
}
async function fetchPendingPhotographers(){
  const client = getSupabaseClient();
  if(!client) return [];
  const { data, error } = await client.from('photographers').select('*').order('created_at', { ascending:false });
  if(error || !Array.isArray(data)) return [];
  return data.filter(row => String(row.status || '').replaceAll('"','').toLowerCase() === 'pending');
}
async function approveUser(email){
  const client = getSupabaseClient();
  if(!client) return;
  const { error } = await client.from('photographers').update({ status:'approved' }).ilike('email', email);
  if(error){
    showMessage('approvalMsg', 'Could not approve this photographer.', true);
    return;
  }
  showMessage('approvalMsg', 'Photographer approved.', false);
  await setupDashboard();
}
async function deleteUser(email){
  if(!confirm('Delete this account?')) return;
  const client = getSupabaseClient();
  if(!client) return;
  const { error } = await client.from('photographers').delete().ilike('email', email);
  if(error){
    showMessage('approvalMsg', 'Could not delete this photographer row.', true);
    return;
  }
  showMessage('approvalMsg', 'Photographer removed from the photographer table.', false);
  await setupDashboard();
}
async function renderPendingApprovals(currentUser){
  const panel = document.getElementById('approvalPanel');
  const listEl = document.getElementById('approvalList');
  if(!panel || !listEl) return;
  if(!isAdminUser(currentUser)){
    panel.style.display = 'none';
    return;
  }
  const pending = await fetchPendingPhotographers();
  if(!pending.length){
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  listEl.innerHTML = pending.map(u => `
    <div class="panel" style="margin-bottom:12px">
      <strong>${escapeHtml(u.name || 'Unnamed photographer')}</strong> (${escapeHtml(u.email || '')})<br>
      <span class="small">${escapeHtml(u.phone || '—')} · ${escapeHtml(u.city || '—')} · ${escapeHtml(u.country || '—')}</span><br>
      <span class="small">${escapeHtml(u.instagram || u.website || '')}</span><br><br>
      <button onclick="approveUser('${escapeHtml(u.email || '')}')" class="btn">Approve</button>
      <button onclick="deleteUser('${escapeHtml(u.email || '')}')" class="btn secondary">Delete</button>
    </div>
  `).join('');
}
async function fetchOrdersForUser(user){
  const client = getSupabaseClient();
  if(!client) return [];
  let query = client.from('orders').select('*').order('created_at', { ascending:false });
  if(!isAdminUser(user)){
    const email = String(user.email || '').trim();
    const name = String(user.photographerName || '').trim();
    const insta = String(user.instagram || user.website || '').trim();
    const { data, error } = await query;
    if(error || !Array.isArray(data)) return [];
    return data.filter(row => {
      return (name && String(row.photographer_name || '') === name)
        || (email && (String(row.photographer_instagram || '') === email || notesContainOwnerEmail(row.internal_notes, email)))
        || (insta && String(row.photographer_instagram || '') === insta);
    });
  }
  const { data, error } = await query;
  if(error || !Array.isArray(data)) return [];
  return data;
}
async function fetchDraftsForUser(user){
  const client = getSupabaseClient();
  if(!client) return [];
  const { data, error } = await client.from('drafts').select('*').order('created_at', { ascending:false });
  if(error || !Array.isArray(data)) return [];
  if(isAdminUser(user)) return data;
  const email = String(user.email || '').trim();
  const name = String(user.photographerName || '').trim();
  const insta = String(user.instagram || user.website || '').trim();
  return data.filter(row => {
    return (name && String(row.photographer_name || '') === name)
      || (email && (String(row.photographer_instagram || '') === email || notesContainOwnerEmail(row.notes, email)))
      || (insta && String(row.photographer_instagram || '') === insta);
  });
}
function projectCardFromOrder(order){
  return {
    id: order.id,
    displayId: order.order_number || order.id,
    title: order.order_number || 'Order',
    albumType: order.album_type || 'Album',
    selectionType: order.album_type || 'Album',
    size: order.album_size || '—',
    cover: order.cover_color || '—',
    coverMaterial: order.cover_material || '—',
    spreads: order.spreads || '—',
    status: normalizeOrderStatus(order.status),
    created: order.created_at ? String(order.created_at).slice(0,10) : '—',
    price: roundMoney(order.total_price || 0),
    owner: order.photographer_name || '—',
    remoteOrderId: order.id
  };
}
function projectCardFromDraft(draft){
  return {
    id: draft.id,
    displayId: draft.id,
    title: draft.draft_name || 'Untitled Project',
    albumType: draft.album_type || 'Album',
    selectionType: draft.album_type || 'Album',
    size: draft.album_size || '—',
    cover: draft.cover_color || '—',
    coverMaterial: draft.cover_material || '—',
    spreads: draft.spreads || '—',
    status: normalizeOrderStatus(draft.status),
    created: draft.created_at ? String(draft.created_at).slice(0,10) : '—',
    price: roundMoney(draft.total_price || 0),
    owner: draft.photographer_name || '—',
    remoteDraftId: draft.id
  };
}
async function setupRegister(){
  const form=document.getElementById('registerForm');
  if(!form) return;
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const client = getSupabaseClient();
    if(!client){
      showMessage('registerMsg','Supabase is not available on this page.', true);
      return;
    }
    const data=Object.fromEntries(new FormData(form).entries());
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '');
    const profile = {
      email,
      name: data.photographerName,
      phone: data.phone,
      instagram: data.website,
      website: data.website,
      city: data.city,
      country: data.country,
      status: 'pending'
    };
    const { error: authError } = await client.auth.signUp({ email, password });
    if(authError){
      showMessage('registerMsg', authError.message || 'Could not create the authentication account.', true);
      return;
    }
    const existing = await getPhotographerByEmail(email);
    if(!existing){
      const { error: insertError } = await client.from('photographers').insert([profile]);
      if(insertError){
        showMessage('registerMsg', insertError.message || 'Authentication was created, but photographer profile insert failed.', true);
        return;
      }
    }
    showMessage('registerMsg','Account created successfully. It is now pending approval.', false);
    form.reset();
  }, { once:true });
}
async function setupLogin(){
  const form=document.getElementById('loginForm');
  if(!form) return;
  const fillDemo=document.getElementById('fillDemo');
  if(fillDemo){
    fillDemo.addEventListener('click', function(){
      document.getElementById('loginEmail').value='demo@alvezmango.com';
      document.getElementById('loginPassword').value='demo123';
    });
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const client = getSupabaseClient();
    if(!client){
      showMessage('loginMsg','Supabase is not available on this page.', true);
      return;
    }
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    const password=document.getElementById('loginPassword').value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if(error){
      showMessage('loginMsg', error.message || 'Email or password not found.', true);
      return;
    }
    const user = await buildCurrentUserFromSession();
    if(!user){
      showMessage('loginMsg','Login succeeded, but the photographer profile was not found.', true);
      return;
    }
    if(String(user.status || '').toLowerCase() === 'pending'){
      await client.auth.signOut();
      localStorage.removeItem('am_current_user');
      showMessage('loginMsg','Your account is pending approval.', true);
      return;
    }
    location.href='dashboard.html';
  }, { once:true });
}
async function forgotPassword(){
  const client = getSupabaseClient();
  if(!client) return alert('Supabase is not available on this page.');
  const email = prompt('Enter your email:');
  if(!email) return;
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/login.html'
  });
  if(error){
    alert(error.message || 'Could not send reset email.');
    return;
  }
  alert('Password reset email sent if the account exists.');
}
async function setupDashboard(){
  const user = await ensureAuthFresh();
  if(!user) return;
  await renderPendingApprovals(user);
  const orders = await fetchOrdersForUser(user);
  const drafts = await fetchDraftsForUser(user);
  const combined = [
    ...drafts.map(projectCardFromDraft),
    ...orders.map(projectCardFromOrder)
  ].sort((a,b)=> String(b.created||'').localeCompare(String(a.created||'')) || String(b.id||'').localeCompare(String(a.id||'')));
  const body=document.getElementById('projectRows');
  if(document.getElementById('projectCount')) document.getElementById('projectCount').textContent=combined.length;
  if(document.getElementById('draftCount')) document.getElementById('draftCount').textContent=combined.filter(p=>p.status==='Draft').length;
  if(document.getElementById('reviewCount')) document.getElementById('reviewCount').textContent=combined.filter(p=>p.status!=='Draft').length;
  if(body){
    if(!combined.length){
      body.innerHTML='<tr><td colspan="8"><div class="empty">No projects yet. Create your first album order.</div></td></tr>';
    }else{
      body.innerHTML=combined.slice(0,12).map(p=>`
      <tr>
        <td>${escapeHtml(p.displayId || p.id)}</td>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.selectionType || p.albumType || 'Album')}</td>
        <td>${escapeHtml(p.size)}</td>
        <td>${escapeHtml(p.cover)}</td>
        <td><span class="chip">${escapeHtml(p.status)}</span></td>
        <td>${escapeHtml(p.created)}</td>
        <td><div class="action-row"><a class="btn secondary" href="orders.html" style="padding:8px 12px">Open</a></div></td>
      </tr>`).join('');
    }
  }
}
function renderOrderFilters(isAdmin){
  const wrap = document.getElementById('ordersControls');
  if(!wrap) return;
  wrap.innerHTML = `
    <div class="panel" style="margin-bottom:18px">
      <div class="form-grid">
        <div class="field">
          <label>Search</label>
          <input id="orderSearch" placeholder="Search order number, photographer, album, size">
        </div>
        <div class="field">
          <label>Status</label>
          <select id="orderStatusFilter">
            <option value="all">All statuses</option>
            <option value="In review">In review</option>
            <option value="Approved">Approved</option>
            <option value="In production">In production</option>
            <option value="Shipped">Shipped</option>
          </select>
        </div>
        ${isAdmin ? `<div class="field"><label>View</label><div class="notice" style="margin-top:0">Admin view: all orders from every photographer.</div></div>` : ''}
      </div>
    </div>`;
}
function renderOrdersList(records, user){
  const wrap=document.getElementById('ordersList');
  if(!wrap) return;
  const search = String((document.getElementById('orderSearch') || {}).value || '').trim().toLowerCase();
  const status = String((document.getElementById('orderStatusFilter') || {}).value || 'all');
  const filtered = records.filter(p => {
    const hay = [p.displayId, p.title, p.owner, p.albumType, p.selectionType, p.size, p.cover, p.status].join(' ').toLowerCase();
    const searchOk = !search || hay.includes(search);
    const statusOk = status === 'all' || p.status === status;
    return searchOk && statusOk;
  });
  if(!filtered.length){ wrap.innerHTML='<div class="empty">No orders found for the current filters.</div>'; return; }
  wrap.innerHTML=filtered.map(p=>`
    <div class="panel" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap">
        <div>
          <div class="kicker">${escapeHtml(p.displayId || p.id)}</div>
          <h3 style="margin:6px 0 6px">${escapeHtml(p.title)}</h3>
          <div class="small">${escapeHtml(p.selectionType || p.albumType)} · ${escapeHtml(p.size)} · ${escapeHtml(p.cover)} · ${escapeHtml(p.spreads)} spreads</div>
          ${isAdminUser(user) ? `<div class="small" style="margin-top:4px">Photographer: ${escapeHtml(p.owner || '—')}</div>` : ''}
          <div class="small" style="margin-top:4px">Estimate: €${Number(p.price || 0).toFixed(2)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:start; flex-wrap:wrap">
          <span class="chip">${escapeHtml(p.status)}</span>
        </div>
      </div>
    </div>
  `).join('');
}
async function setupOrders(){
  const user=await ensureAuthFresh();
  if(!user) return;
  await renderPendingApprovals(user);
  renderOrderFilters(isAdminUser(user));
  const orders = await fetchOrdersForUser(user);
  const records = orders.map(projectCardFromOrder);
  renderOrdersList(records, user);
  ['orderSearch','orderStatusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('input', () => renderOrdersList(records, user));
      el.addEventListener('change', () => renderOrdersList(records, user));
    }
  });
}
async function setupNewOrder(){
  const user=await ensureAuthFresh(); if(!user) return;
  const form=document.getElementById('orderForm'); if(!form) return;
  const isGuest = user.role === 'guest';
  ensureCoreOrderFields(form, isGuest ? 'Your names / project title' : 'Project title');
  const quoteEl=document.getElementById('quotePrice');
  renderMaterialTabs('Linen');
  updateCoverTrigger('Linen Sand');
  setupCoverModal();
  const shareForm = document.getElementById('shareForm');
  if(shareForm) shareForm.style.display = 'none';
  function updateQuote(){
    const fd=new FormData(form);
    applyPricingSelectionBehavior(form);
    const result=getPricingResult(
      fd.get('selectionType') || 'Album',
      fd.get('size'),
      Number(fd.get('spreads') || 20),
      Number(fd.get('quantity') || 1),
      Number(fd.get('replicaQty') || 2),
      fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      fd.get('printOnCover') === 'yes',
      fd.get('pictureWindow') === 'yes',
      user.role
    );
    if(quoteEl) quoteEl.textContent=result.display;
    const hint=document.getElementById('quoteHint');
    if(hint) hint.textContent=result.note;
  }
  form.addEventListener('input', updateQuote);
  form.addEventListener('change', updateQuote);
  updateQuote();
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const submitter = e.submitter;
    const action = submitter && submitter.value ? submitter.value : 'save';
    const fd=new FormData(form);
    const pricingResult=getPricingResult(
      fd.get('selectionType') || 'Album',
      fd.get('size'),
      Number(fd.get('spreads') || 20),
      Number(fd.get('quantity') || 1),
      Number(fd.get('replicaQty') || 2),
      fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      fd.get('printOnCover') === 'yes',
      fd.get('pictureWindow') === 'yes',
      user.role
    );
    const projects=readProjects();
    const item={
      id:uuid(),
      userEmail:user.email,
      title:fd.get('projectTitle'),
      albumType:'Album',
      selectionType:fd.get('selectionType') || 'Album',
      size:fd.get('size'),
      cover:fd.get('cover'),
      coverMaterial:fd.get('coverMaterial') || document.getElementById('coverMaterialInput').value,
      spreads:Number(fd.get('spreads') || 20),
      quantity:Number(fd.get('quantity') || 1),
      replicaQty:Number(fd.get('replicaQty') || 2),
      replicaSize:fd.get('replicaSize') || defaultReplicaSize(fd.get('size')),
      printOnCover: fd.get('printOnCover') === 'yes',
      pictureWindow: fd.get('pictureWindow') === 'yes',
      status: action === 'place-order' ? 'In review' : 'Draft',
      created:new Date().toISOString().slice(0,10),
      price: roundMoney(pricingResult.value || 0)
    };
    const remoteDraftResult = await saveDraftToSupabaseStable(item, user);
    if(remoteDraftResult && remoteDraftResult.data && remoteDraftResult.data.id){
      item.remoteId = remoteDraftResult.data.id;
    }
    let remoteOrderError = null;
    if(action === 'place-order'){
      const remoteOrderResult = await saveOrderToSupabase(item, user, item.remoteId || null);
      if(remoteOrderResult && remoteOrderResult.error) remoteOrderError = remoteOrderResult.error;
      if(remoteOrderResult && remoteOrderResult.data && remoteOrderResult.data.id){
        item.remoteOrderId = remoteOrderResult.data.id;
      }
    }
    projects.unshift(item);
    if(!saveProjects(projects)){
      showMessage('orderMsg','Unable to save the project in browser storage. Please allow local storage and try again.', true);
      return;
    }
    localStorage.setItem('am_current_project_id', item.id);
    const saveMsg = user.role==='guest'
      ? 'Preview saved. Opening the preview editor now.'
      : (action === 'place-order' ? 'Order placed. Opening your orders page now.' : 'Project saved. Opening your orders page now.');
    const failed = !!((remoteDraftResult && remoteDraftResult.error) || remoteOrderError);
    showMessage('orderMsg', failed ? saveMsg + ' Database sync partly failed, but the local save is safe.' : saveMsg, failed);
    location.href = user.role==='guest' ? 'guest-draft-edit.html' : 'orders.html';
  }, { once:true });
}

window.approveUser = approveUser;
window.deleteUser = deleteUser;
window.forgotPassword = forgotPassword;
window.signOut = signOut;
