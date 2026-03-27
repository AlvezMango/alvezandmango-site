
function getSupabaseClient(){
  if(window.supabaseClient) return window.supabaseClient;
  const url = window.SUPABASE_URL || window.supabaseUrl || null;
  const key = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || window.supabaseKey || null;
  if(window.supabase && url && key){
    try{
      window.supabaseClient = window.supabase.createClient(url, key);
      return window.supabaseClient;
    }catch(e){
      console.error('Unable to initialise Supabase client', e);
      return null;
    }
  }
  return null;
}

async function signOutSupabase(){
  const client = getSupabaseClient();
  if(client && client.auth){
    try{ await client.auth.signOut(); }catch(e){ console.warn('Supabase sign out failed', e); }
  }
}

async function fetchPhotographerProfileByEmail(email){
  const client = getSupabaseClient();
  if(!client || !email) return { data:null, error:new Error('Supabase unavailable') };
  return await client.from('photographers').select('*').ilike('email', email).limit(1).maybeSingle();
}

async function fetchPendingPhotographers(){
  const client = getSupabaseClient();
  if(!client) return { data:[], error:new Error('Supabase unavailable') };
  return await client.from('photographers').select('*').eq('status', 'pending').order('created_at', { ascending:true });
}

async function updatePhotographerStatus(email, status){
  const client = getSupabaseClient();
  if(!client) return { error:new Error('Supabase unavailable') };
  return await client.from('photographers').update({ status }).ilike('email', email).select();
}

async function deletePhotographerRow(email){
  const client = getSupabaseClient();
  if(!client) return { error:new Error('Supabase unavailable') };
  return await client.from('photographers').delete().ilike('email', email).select();
}

async function fetchOrdersForUser(user){
  const client = getSupabaseClient();
  if(!client) return { data:null, error:new Error('Supabase unavailable') };
  let query = client.from('orders').select('*').order('created_at', { ascending:false });
  if(!(user && user.role === 'admin')){
    query = query.ilike('photographer_name', user.photographerName || user.name || '');
  }
  return await query;
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
async function signOut(){ localStorage.removeItem('am_current_user'); await signOutSupabase(); location.href='login.html'; }
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
      {id:'AM-1001', userEmail:demo.email, title:'Sophia & Daniel', albumType:'Fine Art', selectionType:'Album', size:'30×30', cover:'Linen 01', spreads:25, status:'In review', created:'2026-03-12', price:162},
      {id:'AM-1002', userEmail:demo.email, title:'Christening Album', albumType:'Classic', selectionType:'Album', size:'20×20', cover:'Suede 01', spreads:20, status:'Draft', created:'2026-03-10', price:88}
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
async function setupLogin(){
  const form=document.getElementById('loginForm');
  if(!form) return;
  const fillDemo=document.getElementById('fillDemo');
  if(fillDemo){
    fillDemo.addEventListener('click', function(){
      document.getElementById('loginEmail').value='admin@alvezandmango.com';
      document.getElementById('loginPassword').value='';
    });
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const email=document.getElementById('loginEmail').value.trim().toLowerCase();
    const password=document.getElementById('loginPassword').value;
    const client = getSupabaseClient();
    if(!client){
      showMessage('loginMsg','Supabase is not available on this page.', true); return;
    }
    const { data: authData, error: authError } = await client.auth.signInWithPassword({ email, password });
    if(authError || !authData || !authData.user){
      showMessage('loginMsg','Wrong email or password.', true); return;
    }
    const { data: profile, error: profileError } = await fetchPhotographerProfileByEmail(email);
    if(profileError){
      await client.auth.signOut();
      showMessage('loginMsg','Could not load your photographer profile.', true); return;
    }
    if(!profile){
      await client.auth.signOut();
      showMessage('loginMsg','Your login works, but no photographer profile was found for this email.', true); return;
    }
    if(String(profile.status || '').toLowerCase() !== 'approved'){
      await client.auth.signOut();
      showMessage('loginMsg','Your account is pending approval.', true); return;
    }
    const user = {
      id: authData.user.id,
      email: email,
      role: email === 'admin@alvezandmango.com' ? 'admin' : 'photographer',
      approved: true,
      photographerName: profile.name || 'Photographer',
      studioName: profile.company_name || profile.name || 'Studio',
      phone: profile.phone || '',
      country: profile.country || '',
      city: profile.city || '',
      website: profile.website || profile.instagram || '',
      instagram: profile.instagram || ''
    };
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
    Linen: [
      {
        name: "Deep Charcoal 001",
        material: "Linen",
        image: "../assets/img/materials/linen/Deep-charcoal-linen-001.jpg"
      },
      {
        name: "Harvest Wheat 002",
        material: "Linen",
        image: "../assets/img/materials/linen/Harvest-wheat-linen-002.jpg"
      },
      {
        name: "Natural Beige 003",
        material: "Linen",
        image: "../assets/img/materials/linen/Natural-beige-linen-003.jpg"
      },
      {
        name: "Stone Grey 004",
        material: "Linen",
        image: "../assets/img/materials/linen/Stone-grey-linen-004.jpg"
      },
      {
        name: "Dusty Rose 005",
        material: "Linen",
        image: "../assets/img/materials/linen/Dusty-rose-linen-005.jpg"
      },
      {
        name: "Desert Sand 006",
        material: "Linen",
        image: "../assets/img/materials/linen/Desert-sand-linen-006.jpg"
      }
    ],
    "Premium Cloth": [
      {
        name: "SAVANNA Black",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/SAVANNA-5990-black.jpg"
      },
      {
        name: "SAVANNA Grey",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/SAVANNA-5950-grey.jpg"
      },
      {
        name: "Burgundy 001",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Burgundy-cloth-001.jpg"
      },
      {
        name: "Charcoal 002",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Charcoal-cloth-002.jpg"
      },
      {
        name: "Mustard 003",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Mustard-cloth-003.jpg"
      },
      {
        name: "Pine 004",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Pine-cloth-004.jpg"
      },
      {
        name: "Berry 005",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Berry-cloth-005.jpg"
      },
      {
        name: "Teal 006",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Teal-cloth-006.jpg"
      },
      {
        name: "Midnight Blue 007",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Midnight-blue-cloth-007.jpg"
      },
      {
        name: "Deep Black 008",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Deep-black-cloth-008.jpg"
      },
      {
        name: "Carbon Black 009",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Carbon-black-cloth-009.jpg"
      },
      {
        name: "Warm Grey 010",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Warm-grey-cloth-010.jpg"
      },
      {
        name: "Latte 011",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Latte-cloth-011.jpg"
      },
      {
        name: "Pure White 012",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Pure-white-cloth-012.jpg"
      },
      {
        name: "Soft Ivory 013",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Soft-ivory-cloth-013.jpg"
      },
      {
        name: "Camel 014",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Camel-cloth-014.jpg"
      },
      {
        name: "Amber 015",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Amber-cloth-015.jpg"
      },
      {
        name: "Nude Beige 016",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Nude-beige-cloth-016.jpg"
      },
      {
        name: "Golden Sand 017",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Golden-sand-cloth-017.jpg"
      },
      {
        name: "Desert Sand 018",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Desert-sand-cloth-018.jpg"
      },
      {
        name: "Forest Green 019",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Forest-green-fabric-019.jpg"
      },
      {
        name: "Lime 020",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Lime-fabric-020.jpg"
      },
      {
        name: "Fresh Mint 021",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Fresh-mint-fabric-021.jpg"
      },
      {
        name: "Chocolate Brown 022",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Chocolate-brown-fabric-022.jpg"
      },
      {
        name: "Blossom Pink 023",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Blossom-pink-fabric-023.jpg"
      },
      {
        name: "Grape 024",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Grape-fabric-024.jpg"
      },
      {
        name: "Soft Lilac 025",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Soft-lilac-fabric-025.jpg"
      },
      {
        name: "Aqua 026",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Aqua-fabric-026.jpg"
      },
      {
        name: "Sky Blue 027",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Sky-blue-fabric-027.jpg"
      },
      {
        name: "Silver 028",
        material: "Premium Cloth",
        image: "../assets/img/materials/premium-cloth/Silver-fabric-028.jpg"
      }
    ],
    "Faux Leather": [
      {
        name: "Chestnut 001",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Chestnut-faux-leather-001.jpg"
      },
      {
        name: "Midnight Teal 002",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Midnight-teal-faux-leather-002.jpg"
      },
      {
        name: "Deep Ocean 003",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Deep-ocean-faux-leather-003.jpg"
      },
      {
        name: "Warm Stone 004",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Warm-stone-faux-leather-004.jpg"
      },
      {
        name: "Saddle Tan 005",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Saddle-tan-faux-leather-005.jpg"
      },
      {
        name: "Ivory 006",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Ivory-faux-leather-006.jpg"
      },
      {
        name: "Crimson 007",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Crimson-faux-leather-007.jpg"
      },
      {
        name: "Charcoal 008",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Charcoal-faux-leather-008.jpg"
      },
      {
        name: "Forest Green 009",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Forest-green-faux-leather-009.jpg"
      },
      {
        name: "Navy Classic 010",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Navy-classic-faux-leather-010.jpg"
      },
      {
        name: "Jet Black 011",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Jet-black-faux-leather-011.jpg"
      },
      {
        name: "Powder Blue 012",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Powder-blue-faux-leather-012.jpg"
      },
      {
        name: "Coral Blush 013",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Coral-blush-faux-leather-013.jpg"
      },
      {
        name: "Steel Blue 014",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Steel-blue-faux-leather-014.jpg"
      },
      {
        name: "Burgundy 015",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Burgundy-faux-leather-015.jpg"
      },
      {
        name: "Champagne 016",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Champagne-faux-leather-016.jpg"
      },
      {
        name: "Cocoa Brown 017",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Cocoa-brown-faux-leather-017.jpg"
      },
      {
        name: "Ash Grey 018",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Ash-grey-faux-leather-018.jpg"
      },
      {
        name: "Graphite 019",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Graphite-faux-leather-019.jpg"
      },
      {
        name: "Plum 020",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Plum-faux-leather-020.jpg"
      },
      {
        name: "Pure White 021",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Pure-white-faux-leather-021.jpg"
      },
      {
        name: "Dark Mocha 022",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Dark-mocha-faux-leather-022.jpg"
      },
      {
        name: "Slate Blue 023",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Slate-blue-faux-leather-023.jpg"
      },
      {
        name: "Ink Blue 024",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Ink-blue-faux-leather-024.jpg"
      },
      {
        name: "Taupe 025",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Taupe-faux-leather-025.jpg"
      },
      {
        name: "Olive Green 026",
        material: "Faux Leather",
        image: "../assets/img/materials/faux-leather/Olive-green-faux-leather-026.jpg"
      }
    ],
    Suede: [
      {
        name: "Graphite 001",
        material: "Suede",
        image: "../assets/img/materials/suede/Graphite-faux-suede-001.jpg"
      },
      {
        name: "Desert Tan 002",
        material: "Suede",
        image: "../assets/img/materials/suede/Desert-tan-faux-suede-002.jpg"
      },
      {
        name: "Mist Blue 003",
        material: "Suede",
        image: "../assets/img/materials/suede/Mist-blue-faux-suede-003.jpg"
      },
      {
        name: "Sage 004",
        material: "Suede",
        image: "../assets/img/materials/suede/Sage-faux-suede-004.jpg"
      },
      {
        name: "Deep Forest 005",
        material: "Suede",
        image: "../assets/img/materials/suede/Deep-forest-faux-suede-005.jpg"
      },
      {
        name: "Blush Rose 006",
        material: "Suede",
        image: "../assets/img/materials/suede/Blush-rose-faux-suede-006.jpg"
      },
      {
        name: "Baltic Blue 007",
        material: "Suede",
        image: "../assets/img/materials/suede/Baltic-blue-faux-suede-007.jpg"
      },
      {
        name: "Aqua 008",
        material: "Suede",
        image: "../assets/img/materials/suede/Aqua-faux-suede-008.jpg"
      },
      {
        name: "Bordeaux 009",
        material: "Suede",
        image: "../assets/img/materials/suede/Bordeaux-faux-suede-009.jpg"
      },
      {
        name: "Amber Brown 010",
        material: "Suede",
        image: "../assets/img/materials/suede/Amber-brown-faux-suede-010.jpg"
      },
      {
        name: "Carbon 011",
        material: "Suede",
        image: "../assets/img/materials/suede/Carbon-faux-suede-011.jpg"
      },
      {
        name: "Sandstone 012",
        material: "Suede",
        image: "../assets/img/materials/suede/Sandstone-faux-suede-012.jpg"
      },
      {
        name: "Pine 013",
        material: "Suede",
        image: "../assets/img/materials/suede/Pine-faux-suede-013.jpg"
      },
      {
        name: "Fuchsia 014",
        material: "Suede",
        image: "../assets/img/materials/suede/Fuchsia-faux-suede-014.jpg"
      },
      {
        name: "Indigo 015",
        material: "Suede",
        image: "../assets/img/materials/suede/Indigo-faux-suede-015.jpg"
      },
      {
        name: "Midnight Navy 016",
        material: "Suede",
        image: "../assets/img/materials/suede/Midnight-navy-faux-suede-016.jpg"
      },
      {
        name: "Mauve 017",
        material: "Suede",
        image: "../assets/img/materials/suede/Mauve-faux-suede-017.jpg"
      },
      {
        name: "Snow 018",
        material: "Suede",
        image: "../assets/img/materials/suede/Snow-faux-suede-018.jpg"
      },
      {
        name: "Dusty Rose 019",
        material: "Suede",
        image: "../assets/img/materials/suede/Dusty-rose-faux-suede-019.jpg"
      },
      {
        name: "Platinum Grey 020",
        material: "Suede",
        image: "../assets/img/materials/suede/Platinum-grey-faux-suede-020.jpg"
      }
    ]
  };
}

function resolveAssetUrl(path){
  if(!path) return '';
  try{ return new URL(path, window.location.href).href; }catch(e){ return path; }
}

function coverSwatches(material){
  const mats = coverMaterials();
  return mats[material] || mats['Linen'];
}
function getAllCovers(){
  return Object.values(coverMaterials()).flat();
}
function getDefaultCover(material='Linen'){
  const swatches = coverSwatches(material);
  return swatches && swatches.length ? swatches[0] : getAllCovers()[0];
}
function getCoverByName(name){
  return getAllCovers().find(item => item.name === name) || getDefaultCover('Linen');
}
function updateCoverTrigger(selectedName){
  const item = getCoverByName(selectedName);
  if(!item) return;
  const nameEl = document.getElementById('selectedCoverName');
  const materialEl = document.getElementById('selectedCoverMaterial');
  const thumbEl = document.getElementById('selectedCoverThumb');
  if(nameEl) nameEl.textContent = item.name;
  if(materialEl) materialEl.textContent = item.material;
  if(thumbEl){
    const resolvedImage = resolveAssetUrl(item.image || '');
    if(resolvedImage){
      thumbEl.innerHTML = `<img src="${resolvedImage}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
      thumbEl.style.backgroundImage = `url(${resolvedImage})`;
      thumbEl.style.backgroundColor = 'transparent';
    } else {
      thumbEl.innerHTML = '';
      thumbEl.style.backgroundImage = 'none';
      thumbEl.style.backgroundColor = item.color || '#e7dfd4';
    }
  }
}
function currentSelectedMaterial(){
  const el = document.getElementById('coverMaterialInput');
  return el ? el.value : 'Linen';
}
function materialLibraryCards(){
  return {
    'Linen': {image:'../assets/img/material-linen.jpg', label:'Linen', link:'View Colours'},
    'Premium Cloth': {image:'../assets/img/material-cotton.jpg', label:'Premium Cloth', link:'View Colours'},
    'Faux Leather': {image:'../assets/img/material-faux-leather.jpg', label:'Faux Leather', link:'View Colours'},
    'Suede': {image:'../assets/img/material-suede.jpg', label:'Suede', link:'View Colours'}
  };
}
function renderMaterialTabs(activeMaterial){
  const wrap = document.getElementById('materialTabs');
  if(!wrap) return;
  const cards = materialLibraryCards();
  const materials = Object.keys(coverMaterials());
  wrap.innerHTML = materials.map(m => {
    const card = cards[m] || {};
    return `<button type="button" class="category-card material-source-card ${m===activeMaterial ? 'active' : ''}" data-material="${m}" aria-pressed="${m===activeMaterial ? 'true' : 'false'}">
      <span class="material-source-media">
        <img src="${card.image || ''}" alt="${card.label || m}">
      </span>
      <span class="material-source-copy">
        <h4>${card.label || m}</h4>
        <span class="text-link">${card.link || 'View Colours'}</span>
      </span>
    </button>`;
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
  wrap.innerHTML=coverSwatches(mat).map(item => {
    const resolvedImage = resolveAssetUrl(item.image || '');
    return `
    <div class="swatch-option ${selectedName===item.name ? 'selected':''}" data-cover="${item.name}" data-material="${item.material}">
      <div class="swatch-sample">${resolvedImage ? `<img src="${resolvedImage}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;display:block;">` : ''}</div>
      <div class="swatch-meta">
        <h4>${item.name}</h4>
        <div class="small">${item.material}</div>
      </div>
    </div>
  `}).join('');
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
  if(subtitle) subtitle.textContent = 'Choose from ' + coverSwatches(material).length + ' swatches in ' + material + '.';
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


async function renderPendingApprovals(currentUser){
  if(!currentUser || currentUser.role !== 'admin') return;

  const panel = document.getElementById('approvalPanel');
  const listEl = document.getElementById('approvalList');
  const msgEl = document.getElementById('approvalMsg');
  if(!panel || !listEl) return;

  const { data, error } = await fetchPendingPhotographers();
  if(error){
    panel.style.display = 'block';
    if(msgEl) showMessage('approvalMsg', 'Could not load pending photographers from Supabase.', true);
    listEl.innerHTML = '<div class="empty">No pending photographers loaded.</div>';
    return;
  }
  const pending = data || [];
  if(!pending.length){
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  if(msgEl) msgEl.innerHTML = '';
  listEl.innerHTML = pending.map(u => `
    <div class="panel" style="margin-bottom:12px">
      <strong>${u.name || 'Unnamed photographer'}</strong> (${u.email || ''})<br>
      <span class="small">${u.phone || ''} · ${u.city || ''} · ${u.country || ''}</span><br>
      <span class="small">${u.website || u.instagram || ''}</span><br><br>

      <button onclick="approveUser('${u.email}')" class="btn">Approve</button>
      <button onclick="deleteUser('${u.email}')" class="btn secondary">Delete</button>
    </div>
  `).join('');
}

async function approveUser(email){
  const result = await updatePhotographerStatus(email, 'approved');
  if(result.error){
    showMessage('approvalMsg', 'Could not approve this photographer.', true);
    return;
  }
  showMessage('approvalMsg', 'Photographer approved.', false);
  await renderPendingApprovals(currentUser());
}

async function deleteUser(email){
  if(!confirm('Delete this account?')) return;
  const result = await deletePhotographerRow(email);
  if(result.error){
    showMessage('approvalMsg', 'Could not delete this photographer row.', true);
    return;
  }
  showMessage('approvalMsg', 'Photographer row deleted.', false);
  await renderPendingApprovals(currentUser());
}

async function forgotPassword(){
  const email = prompt('Enter your email:');
  if(!email) return;
  const client = getSupabaseClient();
  if(!client){
    alert('Supabase is not available on this page.');
    return;
  }
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if(error){
    alert('Could not send reset email.');
    return;
  }
  alert('Password reset email sent.');
}

async function setupDashboard(){
  const user=ensureAuth(); if(!user) return;
  await renderPendingApprovals(user);
  const body=document.getElementById('projectRows');
  if(user.role === 'admin'){
    const { data, error } = await fetchOrdersForUser(user);
    const list = error ? [] : (data || []).map(o => ({
      id: o.order_number || o.id,
      title: o.cover_text || 'Order',
      selectionType: o.album_type || 'Album',
      size: o.album_size || '',
      cover: [o.cover_material, o.cover_color].filter(Boolean).join(' ') || '',
      status: o.status || 'pending',
      created: String(o.created_at || '').slice(0,10)
    }));
    if(document.getElementById('projectCount')) document.getElementById('projectCount').textContent=list.length;
    if(document.getElementById('draftCount')) document.getElementById('draftCount').textContent='0';
    if(document.getElementById('reviewCount')) document.getElementById('reviewCount').textContent=list.filter(p=>String(p.status).toLowerCase()!=='draft').length;
    if(body){
      if(!list.length){
        body.innerHTML='<tr><td colspan="8"><div class="empty">No orders found in Supabase yet.</div></td></tr>';
      }else{
        body.innerHTML=list.map(p=>`
        <tr>
          <td>${p.id}</td>
          <td>${p.title}</td>
          <td>${p.selectionType}</td>
          <td>${p.size}</td>
          <td>${p.cover}</td>
          <td><span class="chip">${p.status}</span></td>
          <td>${p.created}</td>
          <td><a class="btn secondary" href="orders.html" style="padding:8px 12px">Open orders</a></td>
        </tr>`).join('');
      }
    }
    return;
  }
  const list=readProjects().filter(p => p.userEmail===user.email).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')) || String(b.id||'').localeCompare(String(a.id||'')));
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
async function setupOrders(){
  const user=ensureAuth(); if(!user) return;
  await renderPendingApprovals(user);
  const wrap=document.getElementById('ordersList');
  if(!wrap) return;
  if(user.role === 'admin'){
    const { data, error } = await fetchOrdersForUser(user);
    if(error){ wrap.innerHTML='<div class="empty">Could not load orders from Supabase.</div>'; return; }
    const list = data || [];
    if(!list.length){ wrap.innerHTML='<div class="empty">No orders found yet.</div>'; return; }
    wrap.innerHTML=list.map(o=>`
      <div class="panel" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap">
          <div>
            <div class="kicker">${o.order_number || o.id}</div>
            <h3 style="margin:6px 0 6px">${o.cover_text || 'Order'}</h3>
            <div class="small">${o.photographer_name || ''} · ${o.album_type || 'Album'} · ${o.album_size || ''} · ${o.cover_material || ''} ${o.cover_color || ''} · ${o.spreads || ''} spreads</div>
            <div class="small" style="margin-top:4px">Total: €${Number(o.total_price || 0).toFixed(2)}</div>
          </div>
          <div style="display:flex; gap:10px; align-items:start; flex-wrap:wrap">
            <span class="chip">${o.status || 'pending'}</span>
          </div>
        </div>
      </div>
    `).join('');
    return;
  }
  const list=readProjects().filter(p => p.userEmail===user.email).sort((a,b)=>String(b.created||'').localeCompare(String(a.created||'')) || String(b.id||'').localeCompare(String(a.id||'')));
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
  const initialCover = getDefaultCover('Linen');
  const coverInput = document.getElementById('coverInput');
  const coverMaterialInput = document.getElementById('coverMaterialInput');
  if(coverInput && !getAllCovers().some(item => item.name === coverInput.value)) coverInput.value = initialCover.name;
  if(coverMaterialInput && !coverMaterials()[coverMaterialInput.value]) coverMaterialInput.value = initialCover.material;
  updateCoverTrigger((coverInput && coverInput.value) || initialCover.name);
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
  document.querySelectorAll('[data-project-cover-material]').forEach(el => el.textContent = project.coverMaterial || (project.cover ? getCoverByName(project.cover).material : '—'));
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
  const fallbackCover = getDefaultCover('Linen');
  document.getElementById('coverInput').value = project.cover || fallbackCover.name;
  document.getElementById('coverMaterialInput').value = project.coverMaterial || getCoverByName(project.cover || fallbackCover.name).material;
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
  const cover = getCoverByName(coverName || getDefaultCover('Linen').name);
  wrap.innerHTML = `
    <div class="album-preview-card">
      <div class="album-book" style="background:${cover.color};"></div>
      <div>
        <div class="kicker">Album preview</div>
        <h4 style="font-size:24px;font-family:Georgia,serif;margin:6px 0 8px">${coverName || getDefaultCover('Linen').name}</h4>
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
  const fallbackCover = getDefaultCover('Linen');
  document.getElementById('coverInput').value = project.cover || fallbackCover.name;
  document.getElementById('coverMaterialInput').value = project.coverMaterial || getCoverByName(project.cover || fallbackCover.name).material;
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

