(function(){
  const ADMIN_EMAILS = [
    'admin@alvezandmango.com'
    // add more allowed internal accounts here
  ];

  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function safe(v, fallback='—'){ return v === null || v === undefined || v === '' ? fallback : v; }
  function lower(v){ return String(v || '').trim().toLowerCase(); }
  function parseDate(v){ return v ? new Date(v) : null; }
  function fmtDate(v){ const d=parseDate(v); return d && !isNaN(d) ? d.toLocaleDateString() : '—'; }
  function fmtDateTime(v){ const d=parseDate(v); return d && !isNaN(d) ? d.toLocaleString() : '—'; }
  function money(v){ const n=Number(v||0); return new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(isNaN(n)?0:n); }
  function initials(name){ return String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join('') || '?'; }
  function htmlEscape(v){ return String(v ?? '').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function slugStatus(v){ const s=lower(v).replaceAll('"',''); return s || 'pending'; }
  function statusBadge(status){ const s = slugStatus(status); return `<span class="badge ${s==='approved'?'approved':s==='blocked'?'blocked':'pending'}">${htmlEscape(s[0].toUpperCase()+s.slice(1))}</span>`; }
  function getConfig(){ return { url: window.SUPABASE_URL || window.supabaseUrl || null, key: window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || window.supabaseKey || null }; }
  function getClient(){
    if(window.amAdminSupabase) return window.amAdminSupabase;
    const cfg=getConfig();
    const api=window.supabase || window.supabaseJs;
    if(!api || typeof api.createClient!=='function') throw new Error('Supabase library missing.');
    if(!cfg.url || !cfg.key) throw new Error('Supabase config missing in /supabase.js');
    window.amAdminSupabase = api.createClient(cfg.url, cfg.key, { auth:{ persistSession:true, autoRefreshToken:true }});
    return window.amAdminSupabase;
  }
  function showNotice(target, text, type=''){ const el=typeof target==='string'?$(target):target; if(!el) return; el.className=`notice ${type}`; el.textContent=text; }
  async function getUser(){ const client=getClient(); const { data, error } = await client.auth.getUser(); if(error) throw error; return data.user || null; }
  async function getProfileByEmail(email){ const client=getClient(); const { data, error } = await client.from('photographers').select('*').ilike('email', lower(email)).limit(1).maybeSingle(); if(error) throw error; return data; }
  async function requireAdmin(){
    const client = getClient();
    const user = await getUser();
    if(!user){ location.href='index.html'; return null; }
    const profile = await getProfileByEmail(user.email);
    const role = lower(profile?.role);
    const allowed = ADMIN_EMAILS.includes(lower(user.email)) || role==='admin' || role==='staff';
    const blocked = !!profile?.is_blocked || slugStatus(profile?.status)==='blocked';
    if(!allowed || blocked){
      await client.auth.signOut();
      location.href='index.html?denied=1';
      return null;
    }
    window.amAdminUser = { user, profile };
    return { user, profile };
  }
  async function signOutAdmin(){ const client=getClient(); await client.auth.signOut(); location.href='index.html'; }
  window.signOutAdmin = signOutAdmin;

  function wireSidebar(path){
    $all('[data-nav]').forEach(a=>{ if(a.getAttribute('href')===path) a.classList.add('active'); });
  }
  function renderTopUser(profile, user){
    const host=$('#topUser'); if(!host) return;
    host.innerHTML = `<div class="avatar">${initials(profile?.name || user?.email)}</div><div><div style="font-weight:700">${htmlEscape(profile?.name || 'Admin')}</div><div class="small">${htmlEscape(user?.email || '')}</div></div>`;
  }

  async function loadPhotographers(){ const client=getClient(); const { data, error } = await client.from('photographers').select('*').order('created_at',{ascending:false}); if(error) throw error; return data || []; }
  async function loadOrders(){ const client=getClient(); const { data, error } = await client.from('orders').select('*').order('created_at',{ascending:false}); if(error) throw error; return data || []; }
  async function loadDrafts(){ const client=getClient(); const { data, error } = await client.from('drafts').select('*').order('created_at',{ascending:false}); if(error) throw error; return data || []; }
  async function loadGuests(){ const client=getClient(); const { data, error } = await client.from('guests').select('*').order('created_at',{ascending:false}); if(error) throw error; return data || []; }

  function inRange(dateString, from, to){
    if(!dateString) return false;
    const d = new Date(dateString);
    if(isNaN(d)) return false;
    if(from){ const f = new Date(from+'T00:00:00'); if(d < f) return false; }
    if(to){ const t = new Date(to+'T23:59:59'); if(d > t) return false; }
    return true;
  }

  function buildOrderAnalytics(orders){
    const byPhotographer = {};
    orders.forEach(o=>{
      const key = safe(o.photographer_name,'Unknown');
      byPhotographer[key] = (byPhotographer[key] || 0) + 1;
    });
    return Object.entries(byPhotographer).sort((a,b)=>b[1]-a[1]).slice(0,6);
  }

  async function setupLoginPage(){
    const denied = new URLSearchParams(location.search).get('denied');
    if(denied) showNotice('#loginMsg', 'This account is not allowed into the admin area.', 'error');
    try{
      const user = await getUser();
      if(user){
        const profile = await getProfileByEmail(user.email);
        const role = lower(profile?.role);
        if(ADMIN_EMAILS.includes(lower(user.email)) || role==='admin' || role==='staff'){
          location.href='dashboard.html';
          return;
        }
      }
    }catch(_){}
    const form = $('#adminLoginForm');
    form?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const email = lower($('#loginEmail').value);
      const password = $('#loginPassword').value;
      try{
        showNotice('#loginMsg', 'Signing in…');
        const client=getClient();
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if(error) throw error;
        const profile = await getProfileByEmail(data.user.email);
        const role = lower(profile?.role);
        const blocked = !!profile?.is_blocked || slugStatus(profile?.status)==='blocked';
        if(blocked){ await client.auth.signOut(); throw new Error('This account is blocked.'); }
        if(!(ADMIN_EMAILS.includes(lower(data.user.email)) || role==='admin' || role==='staff')){
          await client.auth.signOut();
          throw new Error('This account is not allowed into the admin area.');
        }
        location.href='dashboard.html';
      }catch(err){
        const msg = /invalid login credentials/i.test(String(err.message||err)) ? 'Wrong email or password.' : (err.message || 'Could not sign in.');
        showNotice('#loginMsg', msg, 'error');
      }
    });
  }

  async function setupDashboardPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('dashboard.html');
    const [photographers, orders, drafts] = await Promise.all([loadPhotographers(), loadOrders(), loadDrafts()]);
    const approved = photographers.filter(p=>slugStatus(p.status)==='approved');
    const pending = photographers.filter(p=>slugStatus(p.status)==='pending');
    const blocked = photographers.filter(p=>slugStatus(p.status)==='blocked' || p.is_blocked);
    const totalRevenue = orders.reduce((sum,o)=>sum + Number(o.total_price || 0), 0);
    const latestOrder = orders[0];
    const latestUser = photographers[0];
    $('#kpiPhotographers').textContent = photographers.length;
    $('#kpiPending').textContent = pending.length;
    $('#kpiOrders').textContent = orders.length;
    $('#kpiRevenue').textContent = money(totalRevenue);
    $('#latestOrderValue').textContent = latestOrder ? `${safe(latestOrder.order_number, latestOrder.id)} · ${safe(latestOrder.photographer_name,'No photographer')}` : 'No orders yet';
    $('#latestOrderDate').textContent = latestOrder ? fmtDateTime(latestOrder.created_at) : '—';
    $('#latestUserValue').textContent = latestUser ? `${safe(latestUser.name)} · ${safe(latestUser.email)}` : 'No users yet';
    $('#latestUserDate').textContent = latestUser ? fmtDateTime(latestUser.created_at) : '—';
    $('#approvedCount').textContent = approved.length;
    $('#blockedCount').textContent = blocked.length;
    $('#draftsCount').textContent = drafts.length;

    const pendingHost = $('#pendingApprovals');
    if(!pending.length){ pendingHost.innerHTML = '<div class="empty">No pending approvals right now.</div>'; }
    else {
      pendingHost.innerHTML = pending.slice(0,6).map(p=>`<div class="kpi-row"><div class="user-line"><div class="avatar">${initials(p.name)}</div><div><strong>${htmlEscape(safe(p.name))}</strong><div class="small">${htmlEscape(safe(p.email,''))}</div></div></div><div class="actions"><button class="btn secondary" data-approve="${htmlEscape(p.id)}">Approve</button><button class="btn ghost" data-block="${htmlEscape(p.id)}">Block</button></div></div>`).join('');
    }

    const recentBody = $('#recentOrdersBody');
    recentBody.innerHTML = orders.slice(0,8).map(o=>`<tr><td>${htmlEscape(safe(o.order_number, o.id))}</td><td>${htmlEscape(safe(o.photographer_name))}</td><td>${htmlEscape(safe(o.album_type))}</td><td>${money(o.total_price)}</td><td>${statusBadge(o.status)}</td><td>${fmtDate(o.created_at)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No orders yet.</td></tr>';

    const topChart = $('#topPhotographersChart');
    const top = buildOrderAnalytics(orders);
    topChart.innerHTML = top.length ? top.map(([name,count])=>`<div class="bar-row"><div>${htmlEscape(name)}</div><div class="bar"><span style="width:${Math.max(8,(count/top[0][1])*100)}%"></span></div><div>${count}</div></div>`).join('') : '<div class="empty">No order activity yet.</div>';

    pendingHost.addEventListener('click', async (e)=>{
      const approveId = e.target.getAttribute('data-approve');
      const blockId = e.target.getAttribute('data-block');
      if(!approveId && !blockId) return;
      const client = getClient();
      if(approveId){
        const { error } = await client.from('photographers').update({ status:'approved', is_blocked:false }).eq('id', approveId);
        if(error) return alert(error.message);
      }
      if(blockId){
        const { error } = await client.from('photographers').update({ status:'blocked', is_blocked:true }).eq('id', blockId);
        if(error) return alert(error.message);
      }
      location.reload();
    });
  }

  async function setupUsersPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('users.html');
    const [photographers, orders, drafts] = await Promise.all([loadPhotographers(), loadOrders(), loadDrafts()]);
    const tbody = $('#usersBody');
    const searchInput = $('#userSearch');
    const statusFilter = $('#userStatus');
    const render = ()=>{
      const q = lower(searchInput.value);
      const s = lower(statusFilter.value);
      const rows = photographers.filter(p=>{
        const matchQ = !q || [p.name,p.email,p.instagram,p.website,p.city,p.country,p.company_name,p.company].some(v=>lower(v).includes(q));
        const matchS = !s || slugStatus(p.status)===s;
        return matchQ && matchS;
      }).map(p=>{
        const userOrders = orders.filter(o=>lower(o.photographer_name)===lower(p.name));
        const userDrafts = drafts.filter(d=>lower(d.photographer_name)===lower(p.name));
        const lastOrder = userOrders[0]?.created_at;
        return `<tr>
          <td><div class="user-line"><div class="avatar">${initials(p.name)}</div><div><strong>${htmlEscape(safe(p.name))}</strong><div class="small">${htmlEscape(safe(p.email,''))}</div></div></div></td>
          <td>${statusBadge(p.status)} ${lower(p.role)==='admin'||lower(p.role)==='staff'?`<span class="badge admin">${htmlEscape(p.role)}</span>`:''}</td>
          <td>${htmlEscape(safe(p.city,''))}${p.city&&p.country?', ':''}${htmlEscape(safe(p.country,''))}</td>
          <td>${p.instagram?`<a class="link-pill" href="${p.instagram.startsWith('http')?p.instagram:'https://instagram.com/'+p.instagram.replace(/^@/,'')}" target="_blank" rel="noopener">Instagram</a>`:'—'}</td>
          <td>${p.website?`<a class="link-pill" href="${p.website.startsWith('http')?p.website:'https://'+p.website}" target="_blank" rel="noopener">Website</a>`:'—'}</td>
          <td>${userOrders.length}</td>
          <td>${userDrafts.length}</td>
          <td>${fmtDate(lastOrder)}</td>
          <td><div class="actions"><a class="btn secondary" href="user-detail.html?id=${encodeURIComponent(p.id)}">Open</a><button class="btn ghost" data-approve="${htmlEscape(p.id)}">Approve</button><button class="btn ghost" data-block="${htmlEscape(p.id)}">Block</button></div></td>
        </tr>`;
      });
      tbody.innerHTML = rows.join('') || '<tr><td colspan="9" class="muted">No users match this filter.</td></tr>';
    };
    searchInput.addEventListener('input', render);
    statusFilter.addEventListener('change', render);
    tbody.addEventListener('click', async (e)=>{
      const approveId = e.target.getAttribute('data-approve');
      const blockId = e.target.getAttribute('data-block');
      if(!approveId && !blockId) return;
      const client = getClient();
      if(approveId){ const { error } = await client.from('photographers').update({ status:'approved', is_blocked:false }).eq('id', approveId); if(error) return alert(error.message); }
      if(blockId){ const { error } = await client.from('photographers').update({ status:'blocked', is_blocked:true }).eq('id', blockId); if(error) return alert(error.message); }
      const updated = await loadPhotographers(); photographers.splice(0, photographers.length, ...updated); render();
    });
    render();
  }

  async function setupUserDetailPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('users.html');
    const id = new URLSearchParams(location.search).get('id');
    const [photographers, orders, drafts] = await Promise.all([loadPhotographers(), loadOrders(), loadDrafts()]);
    const profile = photographers.find(p=>String(p.id)===String(id));
    if(!profile){ $('#detailWrap').innerHTML = '<div class="empty">Photographer not found.</div>'; return; }
    const userOrders = orders.filter(o=>lower(o.photographer_name)===lower(profile.name));
    const userDrafts = drafts.filter(d=>lower(d.photographer_name)===lower(profile.name));
    $('#detailName').textContent = safe(profile.name);
    $('#detailEmail').textContent = safe(profile.email);
    $('#detailStatus').innerHTML = statusBadge(profile.status);
    $('#detailMeta').innerHTML = `${safe(profile.city,'')} ${profile.city&&profile.country?'·':''} ${safe(profile.country,'')}`;
    $('#detailCards').innerHTML = `
      <div class="metric-box"><div class="small">Orders</div><strong>${userOrders.length}</strong></div>
      <div class="metric-box"><div class="small">Drafts</div><strong>${userDrafts.length}</strong></div>
      <div class="metric-box"><div class="small">Last order</div><strong style="font-size:18px">${fmtDate(userOrders[0]?.created_at)}</strong></div>
      <div class="metric-box"><div class="small">Registered</div><strong style="font-size:18px">${fmtDate(profile.created_at)}</strong></div>`;
    $('#contactRows').innerHTML = `
      <div class="kpi-row"><span>Email</span><strong>${htmlEscape(safe(profile.email,''))}</strong></div>
      <div class="kpi-row"><span>Instagram</span><strong>${profile.instagram?`<a href="${profile.instagram.startsWith('http')?profile.instagram:'https://instagram.com/'+profile.instagram.replace(/^@/,'')}" target="_blank" rel="noopener">${htmlEscape(profile.instagram)}</a>`:'—'}</strong></div>
      <div class="kpi-row"><span>Website</span><strong>${profile.website?`<a href="${profile.website.startsWith('http')?profile.website:'https://'+profile.website}" target="_blank" rel="noopener">${htmlEscape(profile.website)}</a>`:'—'}</strong></div>
      <div class="kpi-row"><span>Role</span><strong>${htmlEscape(safe(profile.role,'photographer'))}</strong></div>
      <div class="kpi-row"><span>Last login</span><strong>Not tracked yet</strong></div>`;
    $('#detailOrders').innerHTML = userOrders.map(o=>`<tr><td>${htmlEscape(safe(o.order_number,o.id))}</td><td>${htmlEscape(safe(o.album_type))}</td><td>${money(o.total_price)}</td><td>${statusBadge(o.status)}</td><td>${fmtDate(o.created_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No orders for this photographer yet.</td></tr>';
    $('#detailDrafts').innerHTML = userDrafts.map(d=>`<tr><td>${htmlEscape(safe(d.draft_name,d.id))}</td><td>${htmlEscape(safe(d.album_type))}</td><td>${htmlEscape(safe(d.album_size))}</td><td>${money(d.total_price)}</td><td>${fmtDate(d.created_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No drafts for this photographer yet.</td></tr>';
    $('#approveBtn').addEventListener('click', async ()=>{ const { error } = await getClient().from('photographers').update({ status:'approved', is_blocked:false }).eq('id', profile.id); if(error) return alert(error.message); location.reload(); });
    $('#blockBtn').addEventListener('click', async ()=>{ const { error } = await getClient().from('photographers').update({ status:'blocked', is_blocked:true }).eq('id', profile.id); if(error) return alert(error.message); location.reload(); });
  }

  async function setupOrdersPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('orders.html');
    const orders = await loadOrders();
    const tbody = $('#ordersBody');
    const from = $('#fromDate'); const to = $('#toDate'); const status = $('#orderStatus'); const search = $('#orderSearch');
    const render = ()=>{
      const q = lower(search.value); const s = lower(status.value); const f = from.value; const t = to.value;
      const filtered = orders.filter(o=>{
        const matchQ = !q || [o.order_number,o.photographer_name,o.album_type,o.album_size,o.cover_text].some(v=>lower(v).includes(q));
        const matchS = !s || slugStatus(o.status)===s;
        const matchDate = (!f && !t) || inRange(o.created_at, f, t);
        return matchQ && matchS && matchDate;
      });
      $('#orderCount').textContent = filtered.length;
      tbody.innerHTML = filtered.map(o=>`<tr><td>${htmlEscape(safe(o.order_number,o.id))}</td><td>${htmlEscape(safe(o.photographer_name))}</td><td>${htmlEscape(safe(o.album_type))}</td><td>${htmlEscape(safe(o.album_size))}</td><td>${money(o.total_price)}</td><td>${statusBadge(o.status)}</td><td>${fmtDate(o.created_at)}</td><td>${htmlEscape(safe(o.cover_text,''))}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No orders match this filter.</td></tr>';
    };
    [from,to,status,search].forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input', render));
    render();
  }

  async function setupAnalyticsPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('analytics.html');
    const [orders, photographers] = await Promise.all([loadOrders(), loadPhotographers()]);
    const from = $('#analyticsFrom'); const to = $('#analyticsTo');
    const render = ()=>{
      const filteredOrders = orders.filter(o=>inRange(o.created_at, from.value, to.value));
      const filteredUsers = photographers.filter(p=>inRange(p.created_at, from.value, to.value));
      $('#analyticsOrders').textContent = filteredOrders.length;
      $('#analyticsUsers').textContent = filteredUsers.length;
      $('#analyticsRevenue').textContent = money(filteredOrders.reduce((sum,o)=>sum + Number(o.total_price||0), 0));
      $('#analyticsLatest').textContent = filteredOrders[0] ? `${safe(filteredOrders[0].order_number, filteredOrders[0].id)} · ${fmtDate(filteredOrders[0].created_at)}` : '—';
      const chart = $('#analyticsChart');
      const top = buildOrderAnalytics(filteredOrders);
      chart.innerHTML = top.length ? top.map(([name,count])=>`<div class="bar-row"><div>${htmlEscape(name)}</div><div class="bar"><span style="width:${Math.max(8,(count/top[0][1])*100)}%"></span></div><div>${count}</div></div>`).join('') : '<div class="empty">No order data in this range.</div>';
    };
    [from,to].forEach(el=>el.addEventListener('change', render));
    render();
  }

  async function setupNewOrderPage(){
    const auth = await requireAdmin(); if(!auth) return;
    renderTopUser(auth.profile, auth.user);
    wireSidebar('new-order.html');
    const [photographers, guests] = await Promise.all([loadPhotographers(), loadGuests()]);
    const photographerSelect = $('#manualPhotographer');
    photographerSelect.innerHTML = '<option value="">Direct / internal order</option>' + photographers.map(p=>`<option value="${htmlEscape(safe(p.name,''))}">${htmlEscape(safe(p.name,''))} · ${htmlEscape(safe(p.email,''))}</option>`).join('');
    const guestSelect = $('#manualGuest');
    guestSelect.innerHTML = '<option value="">No linked guest</option>' + guests.map(g=>`<option value="${htmlEscape(g.id)}">${htmlEscape(safe(g.name,''))} · ${htmlEscape(safe(g.email,''))}</option>`).join('');

    $('#manualOrderForm')?.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const form = new FormData(e.target);
      const payload = {
        guest_id: form.get('guest_id') || null,
        photographer_name: form.get('photographer_name') || 'Direct order',
        photographer_instagram: form.get('photographer_instagram') || null,
        order_number: form.get('order_number') || `ADM-${Date.now()}`,
        status: form.get('status') || 'pending',
        album_type: form.get('album_type') || null,
        album_size: form.get('album_size') || null,
        cover_material: form.get('cover_material') || null,
        cover_color: form.get('cover_color') || null,
        cover_text: form.get('cover_text') || null,
        font_choice: form.get('font_choice') || null,
        spreads: form.get('spreads') ? Number(form.get('spreads')) : null,
        parent_album_type: form.get('parent_album_type') || null,
        parent_album_qty: form.get('parent_album_qty') ? Number(form.get('parent_album_qty')) : null,
        has_presentation_box: form.get('has_presentation_box') === 'on',
        box_type: form.get('box_type') || null,
        total_price: form.get('total_price') ? Number(form.get('total_price')) : null,
        internal_notes: [form.get('source') ? `Source: ${form.get('source')}` : '', form.get('internal_notes') || ''].filter(Boolean).join(' | '),
        production_notes: form.get('production_notes') || null
      };
      const { error } = await getClient().from('orders').insert(payload);
      if(error){ showNotice('#newOrderMsg', error.message, 'error'); return; }
      showNotice('#newOrderMsg', 'Manual order created successfully.', 'success');
      e.target.reset();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const page = document.body.dataset.page;
    if(page==='admin-login') setupLoginPage();
    if(page==='admin-dashboard') setupDashboardPage();
    if(page==='admin-users') setupUsersPage();
    if(page==='admin-user-detail') setupUserDetailPage();
    if(page==='admin-orders') setupOrdersPage();
    if(page==='admin-analytics') setupAnalyticsPage();
    if(page==='admin-new-order') setupNewOrderPage();
  });
})();
