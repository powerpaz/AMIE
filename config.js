// config.js — robust fallback for static hosting (GitHub Pages)
// Tries Vite env; if not available, keeps existing globals or uses empty strings.
(function(){
  let env = {};
  try { env = (import.meta && import.meta.env) ? import.meta.env : {}; } catch(e){ env = {}; }
  window.SUPABASE_URL = (env.VITE_SUPABASE_URL || window.SUPABASE_URL || "");
  window.SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "");
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.warn("⚠️ Supabase credentials not configured. Using CSV fallback.");
  }
})();