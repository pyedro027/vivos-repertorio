// Configure suas variáveis no ambiente de deploy (Vercel) e local em arquivo .env.
// Em ambiente estático, você pode injetar no HTML via <script> definindo window.SUPABASE_URL / window.SUPABASE_ANON_KEY.
(function initSupabaseClient() {
  const config = {
    url: window.SUPABASE_URL || "",
    anonKey: window.SUPABASE_ANON_KEY || ""
  };

  if (!config.url || !config.anonKey) {
    console.warn("Supabase não configurado. Defina window.SUPABASE_URL e window.SUPABASE_ANON_KEY.");
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: false }
  });
})();
