:root{
  --bg:#0f1318; --bg-soft:#151b23; --panel:#111821; --card:#141d27;
  --surface:#f7fafc; --text:#f2f6fc; --text-muted:#b9c4d1; --ink:#1f2937;
  --primary:#3b82f6; --primary-2:#2563eb; --accent:#22d3ee; --danger:#ff6b6b; --ok:#34d399;
  --border:rgba(255,255,255,.15); --shadow: 0 10px 28px rgba(0,0,0,.35); --radius:16px;
}
*{box-sizing:border-box} html,body{height:100%}
body{margin:0;background:linear-gradient(180deg,#10151b 0%, #0e1620 100%);color:var(--text);font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial}

/* Top nav */
.nav{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:rgba(255,255,255,.06);border-bottom:1px solid var(--border);backdrop-filter:blur(8px)}
.brand{display:flex;align-items:center;gap:10px;font-weight:600}
.brand .dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 12px var(--accent)}
.searchbar{display:flex;gap:8px;align-items:center}
.searchbar input{width:220px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:#0f1620;color:var(--text);outline:none}
.btn{border:none;padding:10px 14px;border-radius:12px;cursor:pointer;color:#fff}
.btn.primary{background:linear-gradient(135deg,var(--primary),var(--primary-2))}
.btn.ghost{background:transparent;border:1px solid var(--border);color:#e6eefb}
.btn.sm{padding:6px 10px;border-radius:10px;background:#112031}

/* Stage & Map */
.stage{position:relative;height:calc(100vh - 58px);width:100%}
#map{position:absolute;inset:12px 12px 86px 12px;border-radius:18px;border:1px solid rgba(255,255,255,.18);box-shadow:var(--shadow);overflow:hidden}

/* Filtros */
.pill.filters{position:absolute;top:24px;left:28px;right:28px;display:flex;flex-wrap:wrap;gap:8px 10px;background:rgba(255,255,255,.10);border:1px solid var(--border);border-radius:14px;padding:8px;box-shadow:var(--shadow);z-index:9999}
.pill.filters select{flex:1 1 160px;max-width:240px;padding:8px 10px;background:#111a25;border:1px solid rgba(255,255,255,.18);border-radius:10px;color:#e8f1ff}

/* KPIs */
.kpis{position:absolute;top:24px;right:28px;display:flex;gap:12px;z-index:500}
.card{background:linear-gradient(180deg,#122032,#0e1723);border:1px solid var(--border);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow);min-width:150px}
.card .k{color:var(--text-muted);font-size:12px}.card .v{font-size:20px;font-weight:700;letter-spacing:.2px}

/* Panel Listado */
.panel{position:absolute;top:110px;right:28px;bottom:98px;width:420px;z-index:520;background:rgba(15,22,32,.95);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);display:flex;flex-direction:column;overflow:hidden}
.panel-head,.panel-foot{padding:10px 12px;background:#0f1a28;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.panel-foot{border-top:1px solid var(--border);border-bottom:none;margin-top:auto}
.pager{display:flex;align-items:center;gap:8px}
.pager .sm{padding:6px 10px;border-radius:10px}
.table-wrap{overflow:auto;height:100%;background:#0e1723}
#grid{width:100%;border-collapse:collapse;font-size:13px}
#grid thead{position:sticky;top:0;background:#132237}
#grid th,#grid td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08)}
#grid tbody tr:hover{background:rgba(59,130,246,.12)}

/* HUD inferior */
.hud{position:absolute;left:50%;transform:translateX(-50%);bottom:24px;display:flex;gap:10px;z-index:540}
.chip{background:var(--surface);color:var(--ink);border:1px solid rgba(0,0,0,.08);padding:9px 12px;border-radius:14px;box-shadow:0 8px 18px rgba(0,0,0,.2)}

/* Transform Panel */
.transform-panel{position:absolute;left:28px;bottom:112px;width:520px;background:rgba(15,22,32,.96);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow);z-index:540;color:#e8f1ff;backdrop-filter:blur(6px)}
.tp-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#0f1a28;border-bottom:1px solid var(--border)}
.tp-actions{display:flex;gap:6px}
.tp-body{padding:10px 12px}
.tp-row{margin-bottom:10px}
.tp-row label{display:block;font-size:12px;color:var(--text-muted);margin-bottom:6px}
.tp-grid{display:grid;gap:8px}
.tp-grid.tp-2{grid-template-columns:1fr 1fr}
.tp-grid.tp-6{grid-template-columns:repeat(6,minmax(0,1fr))}
.tp-grid.tp-utm{grid-template-columns:90px 70px 1fr 1fr}
.transform-panel input,.transform-panel select{background:#111a25;border:1px solid rgba(255,255,255,.18);color:#e8f1ff;border-radius:10px;padding:8px 10px;outline:none;min-width:0}
.tp-hint small{color:#b9c4d1}

/* Leaflet placements */
.leaflet-top.leaflet-left{top:88px!important}
.leaflet-control-layers,.leaflet-control-zoom{z-index:5000}
.leaflet-bottom.leaflet-left{left:22px!important;bottom:22px!important}

/* Responsive */
@media (max-width:1100px){
  .panel{width:92vw;right:4vw;top:auto;height:46vh}
  .kpis{left:28px;right:auto;top:auto;bottom:112px}
  .pill.filters{top:16px;left:16px;right:16px;padding:8px;gap:6px 8px}
  .pill.filters select{flex:1 1 140px;max-width:200px}
  #map{inset:12px 12px 170px 12px}
  .transform-panel{left:16px;right:16px;width:auto;bottom:176px}
  .tp-grid.tp-6{grid-template-columns:repeat(3,1fr)}
  .tp-grid.tp-utm{grid-template-columns:1fr 1fr}
}
