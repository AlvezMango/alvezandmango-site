(function(){
  const ADMIN_EMAILS = ['demo@alvezmango.com'];

  function showMessage(text, isError){
    const el = document.getElementById('loginMsg');
    if(!el) return;
    el.className = 'notice';
    el.style.background = isError ? '#f8e8e8' : '#f4ede4';
    el.style.borderColor = isError ? '#e1b9b9' : '#e4d7c7';
    el.textContent = text;
  }

  function getConfig(){
    return {
      url: window.SUPABASE_URL || window.supabaseUrl || null,
      key: window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || window.supabaseKey || null
    };
  }

  function getClient(){
    if(window.amSupabase) return window.amSupabase;
    const cfg = getConfig();
    const api = window.supabase || window.supabaseJs;
    if(!api || typeof api.createClient !== 'function') throw new Error('Supabase library missing.');
    if(!cfg.url || !cfg.key) throw new Error('Supabase config missing in /supabase.js');
    window.amSupabase = api.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
    return window.amSupabase;
  }

  async function pingSupabase(){
    const cfg = getConfig();
    if(!cfg.url || !cfg.key) return { ok:false, message:'Supabase config missing in /supabase.js' };
    try{
      const res = await fetch(cfg.url.replace(/\/$/, '') + '/auth/v1/settings', {
        method: 'GET',
        headers: { apikey: cfg.key }
      });
      if(!res.ok){
        return { ok:false, message:`Supabase reachable but returned ${res.status}. Check URL/key.` };
      }
      return { ok:true };
    }catch(err){
      return { ok:false, message:'Cannot reach Supabase. Usually this means the URL is wrong, the key is wrong, or the project is paused.' };
    }
  }

  function saveCurrentUser(user){
    localStorage.setItem('am_current_user', JSON.stringify(user));
  }

  async function loadPhotographerProfile(client, email){
    const { data, error } = await client
      .from('photographers')
      .select('*')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    return data;
  }

  async function handleLogin(event){
    event.preventDefault();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;

    try{
      btn.disabled = true;
      showMessage('Signing in...', false);

      const health = await pingSupabase();
      if(!health.ok){
        showMessage(health.message, true);
        return;
      }

      const client = getClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if(error) throw error;
      if(!data || !data.user) throw new Error('Login succeeded but no user was returned.');

      let profile = null;
      try{
        profile = await loadPhotographerProfile(client, email);
      }catch(profileErr){
        throw new Error('Logged in, but could not read the photographers table: ' + profileErr.message);
      }

      if(profile && String(profile.status || '').replaceAll('"','').toLowerCase() === 'pending'){
        await client.auth.signOut();
        showMessage('Your account is pending approval.', true);
        return;
      }

      const role = ADMIN_EMAILS.includes(email) || (profile && String(profile.status || '').toLowerCase() === 'admin') ? 'admin' : 'photographer';
      saveCurrentUser({
        id: data.user.id,
        email,
        role,
        approved: !profile || String(profile.status || '').replaceAll('"','').toLowerCase() !== 'pending',
        photographerName: profile?.name || data.user.user_metadata?.name || email,
        studioName: profile?.company_name || profile?.name || 'Photographer',
        website: profile?.website || '',
        instagram: profile?.instagram || '',
        city: profile?.city || '',
        country: profile?.country || ''
      });

      window.location.href = 'dashboard.html';
    }catch(err){
      const msg = String(err && err.message || err);
      if(msg === 'Failed to fetch'){
        showMessage('Cannot reach Supabase. Check SUPABASE_URL, SUPABASE_ANON_KEY, and make sure the project is active.', true);
      } else if(/invalid login credentials/i.test(msg)){
        showMessage('Wrong email or password.', true);
      } else {
        showMessage(msg, true);
      }
    }finally{
      btn.disabled = false;
    }
  }

  async function handleForgotPassword(event){
    event.preventDefault();
    const email = (document.getElementById('loginEmail').value || '').trim();
    if(!email){
      showMessage('Enter your email first, then click Forgot password.', true);
      return;
    }
    try{
      const client = getClient();
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if(error) throw error;
      showMessage('Password reset email sent.', false);
    }catch(err){
      showMessage(err.message || 'Could not send password reset email.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', async function(){
    const fillDemo = document.getElementById('fillDemo');
    if(fillDemo){
      fillDemo.addEventListener('click', function(){
        document.getElementById('loginEmail').value = 'demo@alvezmango.com';
        document.getElementById('loginPassword').value = 'demo123';
      });
    }
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('forgotPasswordLink')?.addEventListener('click', handleForgotPassword);

    const health = await pingSupabase();
    if(!health.ok){
      showMessage(health.message, true);
    }
  });
})();
