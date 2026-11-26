// Unified self-contained offline HTML Atlas viewer for ALL Problem-Space & Solution-Space diagrams.
// Publication-grade visual ergonomics: Light/Dark theme switch, 3-level information density
// (Compact / Standard / Detailed), CJK-aware adaptive node sizing (zero ugly truncation),
// interactive Pan/Zoom/Fit-to-Screen SVG viewport, Spotlight neighbor highlighting,
// dedicated Sequence Diagram SVG renderer, Timeline-grouped sticky 2D Event Matrix,
// true 2D Stage x Release Story Map, nested Onion 5-Layer diagram, and 1-click SVG/Mermaid/CSV/CML export.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseStructuredDoc } from './yaml-parser.mjs';
import { auditSystemLineageV2 } from './system-lineage.mjs';
import { buildAtlasBundle, emitDiagramBundleFiles } from './diagrams.mjs';

const sha256Hex = buf => createHash('sha256').update(buf).digest('hex');

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

function sanitizeJsonForScript(obj) {
  return JSON.stringify(obj)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

function sanitizeLocalPathsDeep(value) {
  if (typeof value === 'string') {
    return value.replace(/\/Users\/[^\s"'<>]+/gu, '[local-path-redacted]');
  }
  if (Array.isArray(value)) return value.map(sanitizeLocalPathsDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeLocalPathsDeep(v);
    return out;
  }
  return value;
}

export function renderAtlasHtml(bundle) {
  const safeBundle = sanitizeLocalPathsDeep(bundle);
  const embeddedJson = sanitizeJsonForScript(safeBundle);
  const pageTitle = escapeHtml(safeBundle.title || 'co-arising 2.0 Architecture Atlas');

  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:;" />
<title>${pageTitle}</title>
<style>
  :root, [data-theme="light"] {
    --bg: #f4f6fb;
    --surface: #ffffff;
    --surface-2: #f8fafc;
    --canvas: #fcfdff;
    --canvas-dot: #e2e8f0;
    --border: #dfe6f2;
    --border-strong: #c5d1e6;
    --text: #0f172a;
    --text-2: #334155;
    --muted: #64748b;
    --accent: #2563eb;
    --accent-soft: #eff6ff;
    --problem: #059669;
    --problem-soft: #ecfdf5;
    --solution: #7c3aed;
    --solution-soft: #f5f3ff;
    --gold: #d97706;
    --gold-soft: #fffbeb;
    --danger: #dc2626;
    --danger-soft: #fef2f2;
    --orange: #ea580c;
    --orange-soft: #fff7ed;
    --teal: #0d9488;
    --teal-soft: #f0fdfa;
    --shadow-sm: 0 1px 2px rgba(15,23,42,.05);
    --shadow-md: 0 6px 20px rgba(15,23,42,.08);
    --code-bg: #0f172a;
    --code-fg: #e2e8f0;
    --svg-edge: #94a3b8;
    --svg-edge-hi: #2563eb;
    --svg-pill: #ffffff;
  }
  [data-theme="dark"] {
    --bg: #0b1020;
    --surface: #121a2f;
    --surface-2: #18233e;
    --canvas: #0d1426;
    --canvas-dot: #1e2d4d;
    --border: #253456;
    --border-strong: #374c7c;
    --text: #eef3fc;
    --text-2: #cbd5e1;
    --muted: #94a3b8;
    --accent: #60a5fa;
    --accent-soft: rgba(96,165,250,.15);
    --problem: #34d399;
    --problem-soft: rgba(52,211,153,.13);
    --solution: #a78bfa;
    --solution-soft: rgba(167,139,250,.14);
    --gold: #fbbf24;
    --gold-soft: rgba(251,191,36,.14);
    --danger: #f87171;
    --danger-soft: rgba(248,113,113,.14);
    --orange: #fb923c;
    --orange-soft: rgba(251,146,60,.14);
    --teal: #2dd4bf;
    --teal-soft: rgba(45,212,191,.13);
    --shadow-sm: 0 1px 3px rgba(0,0,0,.3);
    --shadow-md: 0 8px 24px rgba(0,0,0,.45);
    --code-bg: #080d1a;
    --code-fg: #dbeafe;
    --svg-edge: #64748b;
    --svg-edge-hi: #60a5fa;
    --svg-pill: #121a2f;
  }

  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
    font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .app { display: grid; grid-template-columns: 296px 1fr; height: 100vh; overflow: hidden; }
  .app.sidebar-collapsed { grid-template-columns: 0px 1fr; }
  .sidebar { background: var(--surface); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; transition: width .15s; }
  .brand { padding: 16px 16px 12px; border-bottom: 1px solid var(--border); }
  .brand h1 { font-size: 15px; font-weight: 700; margin: 0 0 8px; line-height: 1.35; letter-spacing: -.01em; }
  .brand .meta { display: flex; flex-wrap: wrap; gap: 6px; }

  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-2); white-space: nowrap; }
  .badge.problem { border-color: color-mix(in srgb, var(--problem) 40%, transparent); color: var(--problem); background: var(--problem-soft); }
  .badge.solution { border-color: color-mix(in srgb, var(--solution) 40%, transparent); color: var(--solution); background: var(--solution-soft); }
  .badge.gold { border-color: color-mix(in srgb, var(--gold) 45%, transparent); color: var(--gold); background: var(--gold-soft); }
  .badge.danger { border-color: color-mix(in srgb, var(--danger) 45%, transparent); color: var(--danger); background: var(--danger-soft); }
  .badge.accent { border-color: color-mix(in srgb, var(--accent) 45%, transparent); color: var(--accent); background: var(--accent-soft); }

  .filters { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .seg-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--surface-2); padding: 3px; border-radius: 10px; border: 1px solid var(--border); }
  .seg-btn { background: transparent; color: var(--muted); border: none; border-radius: 7px; padding: 5px 4px; font-size: 12px; cursor: pointer; font-weight: 600; transition: all .12s; }
  .seg-btn.active { background: var(--surface); color: var(--accent); box-shadow: var(--shadow-sm); }
  .search { width: 100%; padding: 8px 11px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text); font-size: 13px; outline: none; }
  .search:focus { border-color: var(--accent); background: var(--surface); }

  .nav-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 5px; }
  .nav-section { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; padding: 8px 8px 4px; }
  .nav-item { text-align: left; width: 100%; background: transparent; border: 1px solid transparent; border-radius: 10px; padding: 10px 12px; color: var(--text); cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: all .12s; }
  .nav-item:hover { background: var(--surface-2); border-color: var(--border); }
  .nav-item.active { background: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  .nav-item .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
  .nav-item .title { font-weight: 600; font-size: 13px; line-height: 1.35; }
  .nav-item .sum { font-size: 11.5px; color: var(--muted); line-height: 1.35; }

  .main { display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .topbar { padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--surface); display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; z-index: 10; }
  .topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .topbar h2 { margin: 0 0 2px; font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; letter-spacing: -.01em; }
  .topbar .sub { font-size: 12.5px; color: var(--muted); }
  .actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

  .btn { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all .12s; }
  .btn:hover { border-color: var(--accent); color: var(--accent); background: var(--surface); }
  .btn.primary { background: var(--accent); color: #ffffff; border-color: var(--accent); }
  .btn.primary:hover { opacity: .92; color: #ffffff; }
  .btn.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }

  .density-bar { display: inline-flex; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 2px; gap: 2px; }
  .density-btn { border: none; background: transparent; color: var(--muted); font-size: 11.5px; font-weight: 600; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
  .density-btn.active { background: var(--surface); color: var(--accent); box-shadow: var(--shadow-sm); }

  .workspace { flex: 1; display: flex; overflow: hidden; position: relative; }
  .content { flex: 1; overflow: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
  .drawer { width: 340px; background: var(--surface); border-left: 1px solid var(--border); padding: 16px; overflow-y: auto; display: none; flex-direction: column; gap: 12px; box-shadow: var(--shadow-md); z-index: 5; }
  .drawer.open { display: flex; }
  .drawer-hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
  .drawer-hdr h4 { margin: 0; font-size: 14px; font-weight: 700; }
  .kv { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; padding: 8px 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
  .kv .k { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }

  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; box-shadow: var(--shadow-sm); }
  .card-hdr { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .card h3 { margin: 0; font-size: 14.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; }

  /* Interactive Pan & Zoom SVG Viewport */
  .viewport-shell { position: relative; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background-color: var(--canvas); background-image: radial-gradient(var(--canvas-dot) 1px, transparent 1px); background-size: 18px 18px; }
  .viewport-toolbar { position: absolute; top: 10px; right: 10px; z-index: 4; display: flex; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 4px; box-shadow: var(--shadow-md); }
  .vp-btn { border: none; background: transparent; color: var(--text-2); font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
  .vp-btn:hover { background: var(--accent-soft); color: var(--accent); }
  .vp-scale { font-size: 11.5px; font-weight: 600; color: var(--muted); padding: 4px 6px; min-width: 44px; text-align: center; }
  .viewport-stage { width: 100%; height: 540px; overflow: hidden; cursor: grab; position: relative; user-select: none; }
  .viewport-stage.grabbing { cursor: grabbing; }
  .viewport-inner { transform-origin: 0 0; position: absolute; top: 0; left: 0; }
  .viewport-hint { position: absolute; bottom: 8px; left: 12px; font-size: 11px; color: var(--muted); background: color-mix(in srgb, var(--surface) 88%, transparent); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border); pointer-events: none; }

  svg.atlas-svg text { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif; }
  svg.atlas-svg .node-g { cursor: pointer; transition: opacity .15s; }
  svg.atlas-svg .edge-g { transition: opacity .15s; }
  svg.atlas-svg.spotlight .node-g.dim, svg.atlas-svg.spotlight .edge-g.dim { opacity: 0.18; }
  svg.atlas-svg .node-g:hover rect.node-box { filter: drop-shadow(0 4px 10px rgba(37,99,235,.22)); }

  /* EventStorming Timeline Board (zero weird empty Step cells!) */
  .es-board { display: flex; gap: 14px; overflow-x: auto; padding: 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--canvas); align-items: flex-start; }
  .es-phase { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
  .es-phase-hdr { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); }
  .es-phase-title { font-weight: 800; font-size: 13.5px; color: var(--accent); }
  .es-phase-cols { display: flex; gap: 10px; align-items: flex-start; }
  .es-col { display: flex; flex-direction: column; gap: 8px; min-width: 175px; }
  .density-compact .es-col { min-width: 148px; gap: 6px; }
  .es-col-tag { font-size: 11px; font-weight: 700; color: var(--muted); text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 2px 6px; }
  .es-arrow { align-self: center; color: var(--muted); font-size: 18px; font-weight: 700; padding: 0 2px; opacity: .55; }

  /* 2D Event Matrix (Aggregate / Role / Event Modeling) */
  .tl-filter-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .tl-chip { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); border-radius: 999px; padding: 4px 11px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .tl-chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .matrix-wrap { overflow: auto; max-height: 62vh; border: 1px solid var(--border); border-radius: 10px; background: var(--canvas); }
  table.matrix { border-collapse: separate; border-spacing: 6px; min-width: max-content; }
  table.matrix thead th { position: sticky; top: 0; z-index: 2; }
  table.matrix th.tl-band { background: var(--accent-soft); color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 8px; padding: 7px 12px; font-size: 13px; font-weight: 700; text-align: center; }
  table.matrix th.seq-hdr { top: 38px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; padding: 5px 8px; font-size: 11.5px; color: var(--muted); text-align: center; }
  table.matrix th.row-hdr { position: sticky; left: 0; z-index: 3; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; min-width: 68px; text-align: center; color: var(--muted); font-size: 11.5px; font-weight: 700; }
  table.matrix td { vertical-align: top; }
  .sticky {
    position: relative;
    background: linear-gradient(180deg, #ffb45c 0%, #ff9f43 100%);
    color: #241200;
    border: 1px solid #e67e22;
    border-radius: 3px 3px 12px 3px;
    padding: 10px 11px 11px;
    cursor: pointer;
    box-shadow: 0 3px 6px rgba(15,23,42,.13), 0 1px 2px rgba(15,23,42,.08), inset 0 8px 10px -8px rgba(255,255,255,.55);
    transition: transform .12s, box-shadow .12s;
    width: 158px;
    min-height: 82px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .sticky::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    width: 14px;
    height: 14px;
    background: linear-gradient(135deg, rgba(0,0,0,.11) 50%, transparent 50%);
    border-bottom-right-radius: 3px;
    pointer-events: none;
  }
  .density-compact .sticky { padding: 7px 9px 9px; width: 136px; min-height: 66px; }
  .density-detailed .sticky { width: 196px; min-height: 104px; }
  .sticky:hover { transform: translateY(-2px) rotate(-.4deg); box-shadow: 0 8px 16px rgba(15,23,42,.20); z-index: 3; }
  .sticky.pivotal {
    background: linear-gradient(180deg, #ff9f2e 0%, #f57c00 100%);
    border-color: #b45309;
    box-shadow: 0 4px 10px rgba(234,88,12,.32), inset 0 8px 10px -8px rgba(255,255,255,.5);
  }
  .sticky.sticky-cmd { background: linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%); border-color: #2563eb; color: #0b1e3d; }
  .sticky.sticky-rm { background: linear-gradient(180deg, #86efac 0%, #4ade80 100%); border-color: #16a34a; color: #052e16; }
  .sticky.sticky-pol { background: linear-gradient(180deg, #e9d5ff 0%, #c084fc 100%); border-color: #9333ea; color: #2e1065; }
  .sticky.match { box-shadow: 0 0 0 3px var(--accent), 0 6px 14px rgba(37,99,235,.32); }
  .sticky .ev-name { font-weight: 800; font-size: 12.5px; color: inherit; line-height: 1.28; word-break: break-word; }
  .density-compact .sticky .ev-name { font-size: 11.5px; }
  .sticky .ev-agg { font-size: 10.5px; font-weight: 700; color: rgba(36,18,0,.68); margin-top: 4px; }
  .sticky.sticky-cmd .ev-agg { color: rgba(11,30,61,.72); }
  .sticky.sticky-rm .ev-agg { color: rgba(5,46,22,.72); }
  .sticky.sticky-pol .ev-agg { color: rgba(46,16,101,.72); }
  .sticky .ev-meta { font-size: 10.5px; color: rgba(36,18,0,.84); margin-top: 6px; display: flex; flex-direction: column; gap: 2px; border-top: 1px dashed rgba(36,18,0,.22); padding-top: 4px; }
  .sticky .piv-tag { display: inline-block; font-size: 9.5px; font-weight: 800; background: #fffbeb; color: #b45309; padding: 1px 5px; border-radius: 4px; margin-bottom: 4px; align-self: flex-start; letter-spacing: .02em; }
  .empty-cell { height: 66px; border: 1px dashed var(--border); border-radius: 6px; opacity: .22; min-width: 110px; }
  .lifeline-span { height: 100%; min-height: 66px; min-width: 110px; display: flex; align-items: center; justify-content: center; position: relative; }
  .lifeline-span::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px dashed color-mix(in srgb, var(--orange) 55%, transparent); }
  .cell-track { display: flex; flex-direction: row; align-items: stretch; gap: 7px; flex-wrap: nowrap; }
  .seq-arrow { align-self: center; color: #ea580c; font-size: 14px; font-weight: 800; opacity: .85; flex-shrink: 0; }
  .row-rank { display: inline-block; font-size: 10px; font-weight: 700; color: var(--muted); background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; margin-right: 5px; }

  /* Hotspots — Brandolini Crimson / Pink Sticky Note */
  .hotspot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .hotspot { position: relative; background: linear-gradient(180deg, #fda4af 0%, #fb7185 100%); color: #4c0519; border: 1px solid #e11d48; border-radius: 3px 3px 12px 3px; padding: 12px 14px; box-shadow: 0 3px 7px rgba(225,29,72,.18); }
  .hotspot.resolved { background: linear-gradient(180deg, #d1fae5 0%, #a7f3d0 100%); color: #064e3b; border-color: #059669; box-shadow: 0 2px 6px rgba(5,150,105,.14); }

  /* True 2D Story Map (Backbone Stages x Release Swimlanes) */
  .smap-wrap { overflow-x: auto; }
  table.smap { border-collapse: separate; border-spacing: 8px; min-width: 100%; }
  table.smap th.stage-hdr { background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: 10px; padding: 10px 12px; text-align: left; vertical-align: top; min-width: 230px; }
  table.smap th.rel-hdr { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 10px; min-width: 84px; text-align: center; font-weight: 700; color: var(--solution); }
  table.smap td { vertical-align: top; background: var(--canvas); border: 1px dashed var(--border); border-radius: 10px; padding: 8px; min-width: 230px; }
  .story-card { background: var(--surface); border: 1px solid var(--border); border-left: 3.5px solid var(--accent); border-radius: 8px; padding: 9px 11px; margin-bottom: 8px; box-shadow: var(--shadow-sm); font-size: 12.5px; }
  .story-card:last-child { margin-bottom: 0; }

  /* Nested Onion 5-Layer Diagram */
  .onion-nest { display: flex; flex-direction: column; gap: 12px; }
  .onion-shell { border-radius: 14px; padding: 14px 16px; border: 2px solid var(--border); background: var(--surface-2); }
  .onion-shell.blue { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--accent-soft); }
  .onion-shell.purple { border-color: color-mix(in srgb, var(--solution) 55%, transparent); background: var(--solution-soft); }
  .onion-shell.emerald { border-color: color-mix(in srgb, var(--problem) 60%, transparent); background: var(--problem-soft); }
  .onion-shell.amber { border-color: color-mix(in srgb, var(--gold) 55%, transparent); background: var(--gold-soft); }
  .onion-title { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 13.5px; margin-bottom: 10px; }
  .pill-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
  .item-pill { background: var(--surface); border: 1px solid var(--border); border-radius: 9px; padding: 6px 11px; font-size: 12.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 7px; box-shadow: var(--shadow-sm); }

  /* Tables & Code */
  table.data { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.data th, table.data td { padding: 9px 11px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
  table.data th { color: var(--muted); font-weight: 700; background: var(--surface-2); font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; }
  pre.code { margin: 0; background: var(--code-bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.55; color: var(--code-fg); }

  /* Deployment BC Boxes */
  .bc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .bc-box { border: 2px dashed color-mix(in srgb, var(--solution) 65%, transparent); border-radius: 14px; padding: 14px; background: var(--solution-soft); }
  .sd-chip { background: var(--surface); border: 1px solid color-mix(in srgb, var(--problem) 55%, transparent); border-left: 4px solid var(--problem); border-radius: 9px; padding: 9px 12px; margin-top: 8px; font-weight: 700; font-size: 13px; box-shadow: var(--shadow-sm); }

  /* UseCase tabs */
  .uc-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .ext-box { margin-top: 12px; padding: 10px 12px; border-radius: 9px; background: var(--gold-soft); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); font-size: 12.5px; }

  .toast { position: fixed; bottom: 20px; right: 20px; background: var(--text); color: var(--surface); padding: 9px 16px; border-radius: 9px; font-weight: 600; font-size: 12.5px; opacity: 0; pointer-events: none; transition: opacity .2s; box-shadow: var(--shadow-md); z-index: 50; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="app" id="app-root">
  <aside class="sidebar">
    <div class="brand">
      <h1 id="atlas-title"></h1>
      <div class="meta" id="atlas-meta"></div>
    </div>
    <div class="filters">
      <div class="seg-group">
        <button class="seg-btn active" data-space="all">全部 (<span id="cnt-all">0</span>)</button>
        <button class="seg-btn" data-space="problem">真源 (<span id="cnt-prob">0</span>)</button>
        <button class="seg-btn" data-space="solution">解空间 (<span id="cnt-sol">0</span>)</button>
      </div>
      <input id="search-input" class="search" type="text" placeholder="搜索图谱、事件、聚合、字段..." />
    </div>
    <nav class="nav-list" id="nav-list"></nav>
  </aside>
  <main class="main">
    <header class="topbar">
      <div class="topbar-left">
        <button class="btn" id="toggle-sidebar" title="折叠/展开侧栏">☰</button>
        <div>
          <h2 id="view-title"></h2>
          <div class="sub" id="view-sub"></div>
        </div>
      </div>
      <div class="actions" id="view-actions"></div>
    </header>
    <div class="workspace">
      <section class="content" id="view-content"></section>
      <aside class="drawer" id="inspector-drawer"></aside>
    </div>
  </main>
</div>
<div class="toast" id="toast"></div>
<script id="atlas-data" type="application/json">${embeddedJson}</script>
<script>
(function() {
  const bundle = JSON.parse(document.getElementById('atlas-data').textContent);
  const firstDiagram = bundle.diagrams[0] || null;
  const autoDensity = (firstDiagram && firstDiagram.structured && firstDiagram.structured.matrix && firstDiagram.structured.matrix.stats.eventCount > 14)
    ? 'compact' : 'standard';

  const state = {
    theme: 'light',
    space: 'all',
    query: '',
    density: autoDensity,
    activeId: firstDiagram ? firstDiagram.id : null,
    activeTimeline: 'ALL',
    matrixAxis: 'aggregate',
    activeUseCaseIdx: 0,
    mode: 'visual',
    selected: null,
    spotlightNodeId: null,
    vp: { scale: 1, tx: 16, ty: 16 },
    lastSvg: null,
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const showToast = (msg) => {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  };

  const copyText = (text, label) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('已复制 ' + label));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      showToast('已复制 ' + label);
    }
  };

  const downloadFile = (filename, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  // Accurate CJK + ASCII pixel width estimation so text NEVER gets harshly clipped
  function measureTextPx(str, fontSize) {
    const fs = fontSize || 13;
    let w = 0;
    for (const ch of String(str || '')) {
      w += ch.charCodeAt(0) > 255 ? fs * 1.02 : fs * 0.62;
    }
    return Math.ceil(w);
  }

  function wrapLines(text, maxPx, fontSize, maxLines) {
    const s = String(text || '');
    if (measureTextPx(s, fontSize) <= maxPx) return [s];
    const lines = [];
    let cur = '';
    for (const ch of s) {
      if (measureTextPx(cur + ch, fontSize) > maxPx && cur.length > 0) {
        lines.push(cur);
        cur = ch;
        if (lines.length === (maxLines || 2) - 1) break;
      } else {
        cur += ch;
      }
    }
    const consumed = lines.join('').length + cur.length;
    if (consumed < s.length) {
      let tail = s.slice(lines.join('').length);
      while (tail.length > 1 && measureTextPx(tail + '…', fontSize) > maxPx) tail = tail.slice(0, -1);
      lines.push(tail + '…');
    } else if (cur) {
      lines.push(cur);
    }
    return lines;
  }

  // Alberto Brandolini EventStorming canonical color palette (Event=Orange, Command=Blue, Aggregate=Yellow, ReadModel=Green, Policy=Lilac, Role=BrightYellow, Hotspot=Red/Pink)
  const PALETTE_LIGHT = {
    actor: ['#fef08a', '#ca8a04', '#422006'],
    role: ['#fef08a', '#ca8a04', '#422006'],
    command: ['#bfdbfe', '#2563eb', '#1e3a8a'],
    aggregate: ['#fef3c7', '#d97706', '#78350f'],
    event: ['#ffedd5', '#ea580c', '#7c2d12'],
    state: ['#ecfdf5', '#059669', '#064e3b'],
    readModel: ['#bbf7d0', '#16a34a', '#14532d'],
    materializedView: ['#dcfce7', '#15803d', '#14532d'],
    pipeline: ['#f3e8ff', '#9333ea', '#581c87'],
    saga: ['#e9d5ff', '#9333ea', '#581c87'],
    deadline: ['#fecdd3', '#e11d48', '#881337'],
    operation: ['#dbeafe', '#2563eb', '#1e3a8a'],
    pdp: ['#fbcfe8', '#db2777', '#831843'],
    core: ['#d1fae5', '#059669', '#064e3b'],
    supporting: ['#dbeafe', '#2563eb', '#1e3a8a'],
    generic: ['#f1f5f9', '#64748b', '#334155'],
  };
  const PALETTE_DARK = {
    actor: ['#172a4a', '#60a5fa', '#dbeafe'],
    role: ['#172a4a', '#60a5fa', '#dbeafe'],
    command: ['#142c47', '#38bdf8', '#e0f2fe'],
    aggregate: ['#2e2612', '#fbbf24', '#fef3c7'],
    event: ['#352013', '#fb923c', '#ffedd5'],
    state: ['#102e26', '#34d399', '#d1fae5'],
    readModel: ['#102e2c', '#2dd4bf', '#ccfbf1'],
    materializedView: ['#251c42', '#a78bfa', '#ede9fe'],
    pipeline: ['#271b40', '#c084fc', '#f3e8ff'],
    saga: ['#33193b', '#e879f9', '#fae8ff'],
    deadline: ['#38181f', '#f87171', '#fee2e2'],
    operation: ['#182b47', '#60a5fa', '#dbeafe'],
    pdp: ['#361830', '#f472b6', '#fce7f3'],
    core: ['#112d23', '#34d399', '#d1fae5'],
    supporting: ['#172947', '#60a5fa', '#dbeafe'],
    generic: ['#1e2536', '#94a3b8', '#e2e8f0'],
  };

  function getPalette(group) {
    const map = state.theme === 'dark' ? PALETTE_DARK : PALETTE_LIGHT;
    return map[group] || (state.theme === 'dark' ? ['#18233e', '#60a5fa', '#eef3fc'] : ['#f8fafc', '#2563eb', '#0f172a']);
  }

  // Build adaptive layered SVG with barycenter crossing reduction, pill edge labels, and spotlight support
  function buildAdaptiveFlowSvg(nodes, edges) {
    if (!nodes || nodes.length === 0) {
      return { svg: '', width: 640, height: 200 };
    }
    const idMap = new Map(nodes.map(n => [n.id, n]));
    const inDeg = new Map(nodes.map(n => [n.id, 0]));
    const adj = new Map(nodes.map(n => [n.id, []]));
    const parents = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges || []) {
      if (!idMap.has(e.from) || !idMap.has(e.to)) continue;
      adj.get(e.from).push(e.to);
      parents.get(e.to).push(e.from);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    }

    // Topological layering
    const layerOf = new Map();
    const q = [];
    for (const n of nodes) {
      if ((inDeg.get(n.id) || 0) === 0) { layerOf.set(n.id, 0); q.push(n.id); }
    }
    if (q.length === 0) { layerOf.set(nodes[0].id, 0); q.push(nodes[0].id); }
    let guard = 0;
    while (q.length > 0 && guard < nodes.length * 8) {
      guard += 1;
      const u = q.shift();
      const lu = layerOf.get(u) || 0;
      for (const v of adj.get(u) || []) {
        const nextL = Math.min(lu + 1, 9);
        if (!layerOf.has(v) || layerOf.get(v) < nextL) {
          layerOf.set(v, nextL);
          q.push(v);
        }
      }
    }
    for (const n of nodes) if (!layerOf.has(n.id)) layerOf.set(n.id, 0);

    const cols = new Map();
    for (const n of nodes) {
      const l = layerOf.get(n.id);
      if (!cols.has(l)) cols.set(l, []);
      cols.get(l).push(n);
    }
    const sortedCols = [...cols.keys()].sort((a, b) => a - b);

    // Simple barycenter pass to reduce edge crossings
    const rowIdx = new Map();
    sortedCols.forEach((ck) => {
      const list = cols.get(ck);
      list.forEach((n, idx) => rowIdx.set(n.id, idx));
    });
    for (let ci = 1; ci < sortedCols.length; ci += 1) {
      const list = cols.get(sortedCols[ci]);
      list.sort((a, b) => {
        const pa = parents.get(a.id) || [];
        const pb = parents.get(b.id) || [];
        const avgA = pa.length ? pa.reduce((s, p) => s + (rowIdx.get(p) || 0), 0) / pa.length : 0;
        const avgB = pb.length ? pb.reduce((s, p) => s + (rowIdx.get(p) || 0), 0) / pb.length : 0;
        return avgA - avgB;
      });
      list.forEach((n, idx) => rowIdx.set(n.id, idx));
    }

    // Density-aware typography & sizing
    const fontSize = state.density === 'compact' ? 12 : (state.density === 'detailed' ? 13.5 : 13);
    const maxNodeTextW = state.density === 'compact' ? 168 : (state.density === 'detailed' ? 250 : 210);
    const colGap = state.density === 'compact' ? 76 : (state.density === 'detailed' ? 115 : 96);
    const rowGap = state.density === 'compact' ? 16 : (state.density === 'detailed' ? 26 : 20);
    const padX = 32, padY = 28;

    const dims = new Map();
    const colWidths = new Map();
    for (const ck of sortedCols) {
      let maxW = 156;
      for (const n of cols.get(ck)) {
        const labelLines = wrapLines(n.label, maxNodeTextW, fontSize, 2);
        const detailLines = (state.density === 'detailed' && n.detail)
          ? wrapLines(n.detail, maxNodeTextW, 11, 2) : [];
        const textW = Math.max(
          measureTextPx((n.group || '').toUpperCase() + (n.sensitivity ? ' · ' + n.sensitivity.toUpperCase() : ''), 10.5),
          ...labelLines.map(l => measureTextPx(l, fontSize)),
          ...detailLines.map(l => measureTextPx(l, 11))
        );
        const w = Math.max(156, Math.min(maxNodeTextW + 30, textW + 28));
        const h = 28 + labelLines.length * (fontSize + 4) + (detailLines.length ? detailLines.length * 15 + 6 : 6);
        dims.set(n.id, { w, h, labelLines, detailLines });
        if (w > maxW) maxW = w;
      }
      colWidths.set(ck, maxW);
    }

    const pos = new Map();
    let curX = padX;
    let maxH = 220;
    for (const ck of sortedCols) {
      const cw = colWidths.get(ck);
      let curY = padY;
      for (const n of cols.get(ck)) {
        const d = dims.get(n.id);
        pos.set(n.id, { x: curX, y: curY, w: cw, h: d.h });
        curY += d.h + rowGap;
      }
      if (curY + padY > maxH) maxH = curY + padY;
      curX += cw + colGap;
    }
    const width = Math.max(680, curX - colGap + padX);
    const height = Math.max(240, maxH);

    // Spotlight neighbor set
    const spot = state.spotlightNodeId;
    const spotSet = new Set();
    if (spot) {
      spotSet.add(spot);
      for (const e of edges || []) {
        if (e.from === spot) spotSet.add(e.to);
        if (e.to === spot) spotSet.add(e.from);
      }
    }

    const edgeColor = state.theme === 'dark' ? '#64748b' : '#94a3b8';
    const edgeHi = state.theme === 'dark' ? '#60a5fa' : '#2563eb';
    const pillFill = state.theme === 'dark' ? '#121a2f' : '#ffffff';
    const pillStroke = state.theme === 'dark' ? '#334155' : '#cbd5e1';
    const pillText = state.theme === 'dark' ? '#cbd5e1' : '#475569';

    const parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" class="atlas-svg' + (spot ? ' spotlight' : '') + '" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
      '<defs>',
      '<marker id="arr-n" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1.2 L 10 5 L 0 8.8 z" fill="' + edgeColor + '"/></marker>',
      '<marker id="arr-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1.2 L 10 5 L 0 8.8 z" fill="' + edgeHi + '"/></marker>',
      '</defs>',
    ];

    // Edges first
    for (const e of edges || []) {
      const p1 = pos.get(e.from), p2 = pos.get(e.to);
      if (!p1 || !p2) continue;
      const isHi = spot && (e.from === spot || e.to === spot);
      const dimCls = spot && !isHi ? ' dim' : '';
      const x1 = p1.x + p1.w, y1 = p1.y + p1.h / 2;
      const x2 = p2.x, y2 = p2.y + p2.h / 2;
      const dx = Math.max(36, Math.abs(x2 - x1) * 0.48);
      const path = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + dx) + ' ' + y1 + ', ' + (x2 - dx) + ' ' + y2 + ', ' + x2 + ' ' + y2;
      parts.push('<g class="edge-g' + dimCls + '">');
      parts.push('<path d="' + path + '" fill="none" stroke="' + (isHi ? edgeHi : edgeColor) + '" stroke-width="' + (isHi ? 2.2 : 1.5) + '" marker-end="url(#' + (isHi ? 'arr-hi' : 'arr-n') + ')"/>');
      if (e.label && (state.density !== 'compact' || isHi)) {
        const lbl = e.label.length > 28 ? e.label.slice(0, 27) + '…' : e.label;
        const lw = measureTextPx(lbl, 10.5) + 12;
        const lx = (x1 + x2) / 2, ly = (y1 + y2) / 2;
        parts.push('<rect x="' + (lx - lw / 2) + '" y="' + (ly - 9) + '" width="' + lw + '" height="18" rx="9" fill="' + pillFill + '" stroke="' + (isHi ? edgeHi : pillStroke) + '" stroke-width="1"/>');
        parts.push('<text x="' + lx + '" y="' + (ly + 3.5) + '" text-anchor="middle" fill="' + (isHi ? edgeHi : pillText) + '" font-size="10.5" font-weight="600">' + esc(lbl) + '</text>');
      }
      parts.push('</g>');
    }

    // Nodes on top
    for (const n of nodes) {
      const p = pos.get(n.id);
      const d = dims.get(n.id);
      const pal = getPalette(n.group);
      const isPii = n.sensitivity === 'pii' || n.sensitivity === 'secret';
      const stroke = isPii ? '#dc2626' : pal[1];
      const match = state.query && (n.label + ' ' + (n.detail || '')).toLowerCase().includes(state.query.toLowerCase());
      const dimCls = spot && !spotSet.has(n.id) ? ' dim' : '';
      parts.push('<g class="node-g' + dimCls + '" data-node-id="' + esc(n.id) + '">');
      parts.push('<rect class="node-box" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="10" fill="' + pal[0] + '" stroke="' + (match || spot === n.id ? edgeHi : stroke) + '" stroke-width="' + (match || spot === n.id ? 2.6 : 1.5) + '"/>');
      parts.push('<rect x="' + p.x + '" y="' + p.y + '" width="4.5" height="' + p.h + '" rx="2" fill="' + stroke + '"/>');
      parts.push('<text x="' + (p.x + 14) + '" y="' + (p.y + 17) + '" fill="' + pal[1] + '" font-size="10.5" font-weight="700">' + esc((n.group || '').toUpperCase()) + (n.sensitivity ? ' · 🔒 ' + esc(n.sensitivity.toUpperCase()) : '') + '</text>');
      d.labelLines.forEach((line, li) => {
        parts.push('<text x="' + (p.x + 14) + '" y="' + (p.y + 34 + li * (fontSize + 4)) + '" fill="' + pal[2] + '" font-size="' + fontSize + '" font-weight="700">' + esc(line) + '</text>');
      });
      if (d.detailLines.length > 0) {
        const baseY = p.y + 34 + d.labelLines.length * (fontSize + 4) + 3;
        d.detailLines.forEach((dl, di) => {
          parts.push('<text x="' + (p.x + 14) + '" y="' + (baseY + di * 15) + '" fill="' + pillText + '" font-size="11">' + esc(dl) + '</text>');
        });
      }
      parts.push('</g>');
    }
    parts.push('</svg>');
    return { svg: parts.join(''), width, height };
  }

  // Dedicated high-clarity native SVG Sequence Diagram renderer for Use Cases!
  function buildSequenceSvg(uc) {
    const participants = [];
    const pSet = new Set();
    const addP = (id, label, group) => {
      if (pSet.has(id)) return;
      pSet.add(id);
      participants.push({ id, label, group });
    };
    if (uc.actor) addP('actor:' + uc.actor, uc.actor, 'actor');
    const messages = [];
    let stepNum = 1;
    for (const st of uc.steps || []) {
      const fromName = st.actor || uc.actor || 'System';
      const fromId = 'actor:' + fromName;
      addP(fromId, fromName, 'actor');
      if (st.readsView) {
        const vid = 'rm:' + st.readsView;
        addP(vid, 'View: ' + st.readsView, 'readModel');
        messages.push({ num: stepNum++, from: fromId, to: vid, label: 'query ' + st.readsView, style: 'query' });
      }
      let toId, toLabel, toGroup;
      if (st.aggregate) { toId = 'agg:' + st.aggregate; toLabel = st.aggregate; toGroup = 'aggregate'; }
      else if (st.pipeline) { toId = 'pl:' + st.pipeline; toLabel = 'Pipeline: ' + st.pipeline; toGroup = 'pipeline'; }
      else { toId = 'app:App'; toLabel = 'Application'; toGroup = 'operation'; }
      addP(toId, toLabel, toGroup);
      const callText = [st.port, st.command].filter(Boolean).join(' → ') || st.intent || st.id;
      messages.push({ num: stepNum++, from: fromId, to: toId, label: callText, style: 'call' });
      for (const ev of st.emissions || []) {
        messages.push({ num: stepNum++, from: toId, to: fromId, label: 'emit ' + ev, style: 'event' });
        for (const v of st.updatesViews || []) {
          const vid = 'rm:' + v;
          addP(vid, 'View: ' + v, 'readModel');
          messages.push({ num: stepNum++, from: toId, to: vid, label: 'project ' + ev, style: 'project' });
        }
      }
    }
    if (participants.length === 0) return { svg: '', width: 640, height: 220 };

    const colW = Math.max(190, Math.min(240, Math.max(...participants.map(p => measureTextPx(p.label, 13) + 46))));
    const padX = 36, padY = 24, boxH = 44, msgGap = 54;
    const width = Math.max(680, padX * 2 + participants.length * colW);
    const lifelineTop = padY + boxH;
    const lifelineBottom = lifelineTop + 36 + messages.length * msgGap + 24;
    const height = lifelineBottom + 24;
    const xOf = new Map(participants.map((p, i) => [p.id, padX + i * colW + colW / 2]));

    const lineCol = state.theme === 'dark' ? '#334155' : '#cbd5e1';
    const pillFill = state.theme === 'dark' ? '#121a2f' : '#ffffff';
    const colorsByStyle = {
      call: state.theme === 'dark' ? '#60a5fa' : '#2563eb',
      event: state.theme === 'dark' ? '#fb923c' : '#ea580c',
      project: state.theme === 'dark' ? '#2dd4bf' : '#0d9488',
      query: state.theme === 'dark' ? '#a78bfa' : '#7c3aed',
    };

    const parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" class="atlas-svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
      '<defs>',
      ...Object.entries(colorsByStyle).map(([k, c]) => '<marker id="seq-' + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1.2 L 10 5 L 0 8.8 z" fill="' + c + '"/></marker>'),
      '</defs>',
    ];

    // Participant boxes + lifelines
    for (const p of participants) {
      const cx = xOf.get(p.id);
      const pal = getPalette(p.group);
      const bw = Math.min(colW - 18, Math.max(128, measureTextPx(p.label, 13) + 28));
      parts.push('<line x1="' + cx + '" y1="' + lifelineTop + '" x2="' + cx + '" y2="' + lifelineBottom + '" stroke="' + lineCol + '" stroke-width="1.5" stroke-dasharray="5 4"/>');
      parts.push('<rect x="' + (cx - bw / 2) + '" y="' + padY + '" width="' + bw + '" height="' + boxH + '" rx="9" fill="' + pal[0] + '" stroke="' + pal[1] + '" stroke-width="1.6"/>');
      parts.push('<text x="' + cx + '" y="' + (padY + 27) + '" text-anchor="middle" fill="' + pal[2] + '" font-size="13" font-weight="700">' + esc(p.label) + '</text>');
    }

    // Messages
    messages.forEach((m, idx) => {
      const y = lifelineTop + 42 + idx * msgGap;
      const x1 = xOf.get(m.from), x2 = xOf.get(m.to);
      const col = colorsByStyle[m.style] || colorsByStyle.call;
      const dashed = m.style === 'event' || m.style === 'query' ? ' stroke-dasharray="6 4"' : '';
      parts.push('<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="' + col + '" stroke-width="2"' + dashed + ' marker-end="url(#seq-' + m.style + ')"/>');
      const txt = m.num + '. ' + m.label;
      const tw = measureTextPx(txt, 12) + 18;
      const mx = (x1 + x2) / 2;
      parts.push('<rect x="' + (mx - tw / 2) + '" y="' + (y - 24) + '" width="' + tw + '" height="20" rx="10" fill="' + pillFill + '" stroke="' + col + '" stroke-width="1"/>');
      parts.push('<text x="' + mx + '" y="' + (y - 10) + '" text-anchor="middle" fill="' + col + '" font-size="12" font-weight="600">' + esc(txt) + '</text>');
    });

    parts.push('</svg>');
    return { svg: parts.join(''), width, height };
  }

  function wrapInViewport(svgPack, idSuffix) {
    state.lastSvg = svgPack.svg;
    return '<div class="viewport-shell" data-vp-w="' + svgPack.width + '" data-vp-h="' + svgPack.height + '" id="vp-' + idSuffix + '">' +
      '<div class="viewport-toolbar">' +
        '<button class="vp-btn" data-vp-act="fit" title="自动适配一屏">适配一屏</button>' +
        '<button class="vp-btn" data-vp-act="one" title="100% 原始清晰度">1:1</button>' +
        '<button class="vp-btn" data-vp-act="out">−</button>' +
        '<span class="vp-scale" id="vp-scale-label">100%</span>' +
        '<button class="vp-btn" data-vp-act="in">+</button>' +
        '<button class="vp-btn" data-vp-act="dl-svg" title="导出矢量 SVG（可贴 PPT/PRD 永不糊）">导出 SVG</button>' +
      '</div>' +
      '<div class="viewport-stage"><div class="viewport-inner">' + svgPack.svg + '</div></div>' +
      '<div class="viewport-hint">滚轮缩放 · 拖拽平移 · 点击节点高亮上下游链路</div>' +
    '</div>';
  }

  function attachViewportControls(container, diagramId) {
    const shell = container.querySelector('.viewport-shell');
    if (!shell) return;
    const stage = shell.querySelector('.viewport-stage');
    const inner = shell.querySelector('.viewport-inner');
    const label = shell.querySelector('#vp-scale-label');
    const svgW = Number(shell.getAttribute('data-vp-w') || 800);
    const svgH = Number(shell.getAttribute('data-vp-h') || 400);

    const apply = () => {
      inner.style.transform = 'translate(' + state.vp.tx + 'px, ' + state.vp.ty + 'px) scale(' + state.vp.scale + ')';
      if (label) label.textContent = Math.round(state.vp.scale * 100) + '%';
    };
    const fitToScreen = () => {
      const rect = stage.getBoundingClientRect();
      const pad = 28;
      const sx = (rect.width - pad * 2) / Math.max(1, svgW);
      const sy = (rect.height - pad * 2) / Math.max(1, svgH);
      const s = Math.min(1.08, Math.max(0.32, Math.min(sx, sy)));
      state.vp.scale = s;
      state.vp.tx = Math.max(16, (rect.width - svgW * s) / 2);
      state.vp.ty = Math.max(16, (rect.height - svgH * s) / 2);
      apply();
    };

    fitToScreen();

    shell.querySelectorAll('[data-vp-act]').forEach(btn => {
      btn.onclick = () => {
        const act = btn.getAttribute('data-vp-act');
        if (act === 'fit') fitToScreen();
        else if (act === 'one') { state.vp.scale = 1; state.vp.tx = 20; state.vp.ty = 20; apply(); }
        else if (act === 'in') { state.vp.scale = Math.min(2.5, state.vp.scale * 1.18); apply(); }
        else if (act === 'out') { state.vp.scale = Math.max(0.25, state.vp.scale / 1.18); apply(); }
        else if (act === 'dl-svg' && state.lastSvg) downloadFile(diagramId + '.svg', state.lastSvg, 'image/svg+xml;charset=utf-8');
      };
    });

    stage.onwheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      state.vp.scale = Math.min(2.5, Math.max(0.25, state.vp.scale * factor));
      apply();
    };
    let dragging = false, sx = 0, sy = 0;
    stage.onmousedown = (e) => {
      if (e.target.closest('.node-g')) return;
      dragging = true; sx = e.clientX - state.vp.tx; sy = e.clientY - state.vp.ty;
      stage.classList.add('grabbing');
    };
    window.onmousemove = (e) => {
      if (!dragging) return;
      state.vp.tx = e.clientX - sx; state.vp.ty = e.clientY - sy;
      apply();
    };
    window.onmouseup = () => { dragging = false; stage.classList.remove('grabbing'); };
  }

  function renderDrawer() {
    const drawer = document.getElementById('inspector-drawer');
    if (!state.selected) {
      drawer.classList.remove('open');
      drawer.innerHTML = '';
      return;
    }
    drawer.classList.add('open');
    let body = '';
    if (state.selected.kind === 'event-cell') {
      const c = state.selected.cell;
      body += '<div class="drawer-hdr"><h4>' + (c.pivotal ? '★ ' : '') + esc(c.event) + '</h4><button class="btn" id="close-drawer">✕</button></div>';
      body += '<div class="kv"><span class="k">坐标与阶段</span><span>Timeline: <b>' + esc(c.timeline) + '</b> · Seq ' + c.sequence + ' · Step ' + c.step + '</span></div>';
      if (c.aggregate) body += '<div class="kv"><span class="k">归属聚合</span><span><b>' + esc(c.aggregate) + '</b></span></div>';
      if (c.description) body += '<div class="kv"><span class="k">业务语义</span><span>' + esc(c.description) + '</span></div>';
      if ((c.producerCommands || []).length) body += '<div class="kv"><span class="k">产生命令 (Commands)</span><span>' + esc(c.producerCommands.join(', ')) + '</span></div>';
      if ((c.consumerReadModels || []).length) body += '<div class="kv"><span class="k">驱动读模型 (ReadModels)</span><span>' + esc(c.consumerReadModels.join(', ')) + '</span></div>';
      if ((c.consumerPolicies || []).length) body += '<div class="kv"><span class="k">下游策略/Saga</span><span>' + esc(c.consumerPolicies.join(', ')) + '</span></div>';
      if ((c.piiFields || []).length) body += '<div class="kv"><span class="k">隐私敏感字段</span><span style="color:var(--danger)">🔒 ' + esc(c.piiFields.join(', ')) + '</span></div>';
      if (c.sourcePath) body += '<div class="kv"><span class="k">真源文件路径</span><code>' + esc(c.sourcePath) + '</code></div>';
    } else if (state.selected.kind === 'graph-node') {
      const n = state.selected.node;
      body += '<div class="drawer-hdr"><h4>' + esc(n.label) + '</h4><button class="btn" id="close-drawer">✕</button></div>';
      body += '<div class="kv"><span class="k">类型</span><span><span class="badge accent">' + esc(n.group) + '</span>' + (n.sensitivity ? ' <span class="badge danger">🔒 ' + esc(n.sensitivity) + '</span>' : '') + '</span></div>';
      if (n.detail) body += '<div class="kv"><span class="k">字段与详情</span><span>' + esc(n.detail) + '</span></div>';
      body += '<button class="btn" id="clear-spot">清除聚光灯高亮</button>';
    }
    drawer.innerHTML = body;
    const closeBtn = drawer.querySelector('#close-drawer');
    if (closeBtn) closeBtn.onclick = () => { state.selected = null; state.spotlightNodeId = null; renderMain(); };
    const clearBtn = drawer.querySelector('#clear-spot');
    if (clearBtn) clearBtn.onclick = () => { state.selected = null; state.spotlightNodeId = null; renderMain(); };
  }

  function renderEventMatrixVisual(d) {
    const m = d.structured.matrix;
    const q = state.query.toLowerCase();
    const tlNames = (m.timelines || []).map(t => t.name);
    const cols = (m.columns || []).filter(c => state.activeTimeline === 'ALL' || c.timelines.includes(state.activeTimeline));

    // Group adjacent columns sharing the same timeline into merged phase banners
    const bands = [];
    for (const c of cols) {
      const last = bands[bands.length - 1];
      if (last && last.timeline === c.timeline) last.span += 1;
      else bands.push({ timeline: c.timeline, span: 1 });
    }

    const renderStickyCard = (cell) => {
      const isMatch = q && (cell.event + ' ' + (cell.aggregate || '') + ' ' + cell.timeline + ' ' + cell.description).toLowerCase().includes(q);
      const cls = 'sticky' + (cell.pivotal ? ' pivotal' : '') + (isMatch ? ' match' : '');
      let card = '<div class="' + cls + '" data-ev-key="' + esc(cell.sequence + ':' + cell.step + ':' + cell.event) + '"><div>';
      if (cell.pivotal) card += '<div class="piv-tag">★ PIVOTAL</div>';
      card += '<div class="ev-name">' + esc(cell.event) + '</div>';
      if (state.density !== 'compact') {
        const metaLines = [];
        if ((cell.producerCommands || []).length) metaLines.push('← ' + esc(cell.producerCommands.join(', ')));
        if ((cell.consumerReadModels || []).length) metaLines.push('→ RM: ' + esc(cell.consumerReadModels.join(', ')));
        if ((cell.consumerPolicies || []).length) metaLines.push('⚡ ' + esc(cell.consumerPolicies.join(', ')));
        if ((cell.piiFields || []).length) metaLines.push('🔒 ' + esc(cell.piiFields.join(', ')));
        if (state.density === 'detailed' && cell.description) metaLines.push(esc(cell.description));
        if (metaLines.length) card += '<div class="ev-meta">' + metaLines.map(l => '<span>' + l + '</span>').join('') + '</div>';
      }
      card += '</div>';
      if (cell.aggregate) card += '<div class="ev-agg">' + esc(cell.aggregate) + ((cell.actors || []).length ? ' · ' + esc(cell.actors.join('/')) : '') + '</div>';
      card += '</div>';
      return card;
    };

    const axisOptions = [
      ['aggregate', 'Event Matrix (空间/状态 × 时间)'],
      ['board', '阶段便利贴墙 (Event Board)'],
      ['role', '角色泳道 (Role × 阶段)'],
      ['event-modeling', 'Event Modeling 4层'],
    ];
    let html = '<div class="card density-' + state.density + '"><div class="card-hdr"><h3>Event Matrix（同空间/状态同行 · 按首事件出现先后自上而下瀑布排序）</h3>';
    html += '<div class="density-bar">';
    for (const [val, lbl] of axisOptions) {
      html += '<button class="density-btn' + (state.matrixAxis === val ? ' active' : '') + '" data-axis="' + val + '">' + lbl + '</button>';
    }
    html += '</div></div>';
    html += '<div class="tl-filter-bar"><button class="tl-chip' + (state.activeTimeline === 'ALL' ? ' active' : '') + '" data-tl="ALL">全部阶段 (' + tlNames.length + ')</button>';
    for (const tn of tlNames) {
      html += '<button class="tl-chip' + (state.activeTimeline === tn ? ' active' : '') + '" data-tl="' + esc(tn) + '">' + esc(tn) + '</button>';
    }
    html += '</div>';

    const visibleTimelines = (m.timelines || []).filter(tl => state.activeTimeline === 'ALL' || tl.name === state.activeTimeline);
    const visibleCells = (col) => col.cells.filter(c => state.activeTimeline === 'ALL' || c.timeline === state.activeTimeline);

    if (state.matrixAxis === 'aggregate') {
      // Canonical Brandolini Event Matrix:
      // - Top header row 1: Merged Stage / Timeline Phase banners (colspan over chronological columns)
      // - Top header row 2: Global chronological time columns (Seq) so DIFFERENT spaces in the SAME stage
      //   stagger cleanly from left to right (e.g. User at Seq 0, Tenant at Seq 1, Workgroup at Seq 2..3!)
      // - Y-axis rows: Space / State / Aggregate ordered by earliest event occurrence (top-left -> bottom-right diagonal!)
      // - Within any (Space, TimeCol) cell, sequential events flow horizontally left-to-right with arrows.
      const lanes = (m.spaceLanes && m.spaceLanes.length)
        ? m.spaceLanes.filter(l => l.events.some(e => state.activeTimeline === 'ALL' || e.timeline === state.activeTimeline))
        : [...new Set(visibleTimelines.flatMap(tl => tl.events.map(c => c.aggregate || '(Unassigned)')))].map((name, rank) => ({
          rank, name, events: visibleTimelines.flatMap(tl => tl.events.filter(c => (c.aggregate || '(Unassigned)') === name)),
        }));
      html += '<div class="matrix-wrap"><table class="matrix"><thead>';
      html += '<tr><th class="row-hdr" rowspan="2" style="text-align:left;padding:7px 10px;min-width:136px">空间 / 状态 \\\\ 时间</th>';
      bands.forEach((b, bi) => {
        html += '<th class="tl-band" colspan="' + b.span + '">' + (bi + 1) + '. ' + esc(b.timeline) + '</th>';
      });
      html += '</tr><tr>';
      cols.forEach((col, ci) => {
        html += '<th class="seq-hdr">T' + (ci + 1) + ' (Seq ' + col.sequence + ')' + (col.hasPivotal ? ' ★' : '') + '</th>';
      });
      html += '</tr></thead><tbody>';
      lanes.forEach((lane, lIdx) => {
        const activeCols = cols.map((col, ci) => col.cells.some(c => (c.aggregate || c.space || c.timeline || 'Default') === lane.name) ? ci : -1).filter(i => i >= 0);
        const firstCol = activeCols.length ? activeCols[0] : -1;
        const lastCol = activeCols.length ? activeCols[activeCols.length - 1] : -1;
        html += '<tr><th class="row-hdr" style="text-align:left;padding:7px 10px;color:var(--text)"><span class="row-rank">' + (lIdx + 1) + '</span>' + esc(lane.name) + '</th>';
        cols.forEach((col, ci) => {
          const matches = col.cells.filter(c => (c.aggregate || c.space || c.timeline || 'Default') === lane.name);
          if (matches.length > 0) {
            html += '<td><div class="cell-track">' + matches.map(renderStickyCard).join('<span class="seq-arrow">→</span>') + '</div></td>';
          } else if (ci > firstCol && ci < lastCol) {
            html += '<td><div class="lifeline-span" title="' + esc(lane.name) + ' 跨时间列生命周期延续"></div></td>';
          } else {
            html += '<td><div class="empty-cell"></div></td>';
          }
        });
        html += '</tr>';
      });
      html += '</tbody></table></div></div>';
    } else if (state.matrixAxis === 'board') {
      // Natural EventStorming Sticky Board: Phase containers -> chronological columns -> stacked cards
      html += '<div class="es-board">';
      visibleTimelines.forEach((tl, ti) => {
        if (ti > 0) html += '<div class="es-arrow">→</div>';
        const tlCols = cols.filter(c => c.timeline === tl.name);
        html += '<div class="es-phase"><div class="es-phase-hdr"><span class="es-phase-title">' + (ti + 1) + '. ' + esc(tl.name) + '</span><span class="badge">' + tl.events.length + ' 事件</span></div>';
        html += '<div class="es-phase-cols">';
        tlCols.forEach((col, ci) => {
          html += '<div class="es-col">';
          if (tlCols.length > 1) html += '<div class="es-col-tag">#' + (ci + 1) + (col.hasPivotal ? ' ★' : '') + '</div>';
          for (const cell of col.cells) html += renderStickyCard(cell);
          html += '</div>';
        });
        html += '</div></div>';
      });
      html += '</div></div>';
    } else if (state.matrixAxis === 'role') {
      // True 2D Role x Time Matrix: Columns = Business Timeline Phases, Rows = Roles / Actors
      const roles = [...new Set(visibleTimelines.flatMap(tl => tl.events.flatMap(c => (c.actors && c.actors.length ? c.actors : ['System / Unassigned']))))];
      html += '<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="row-hdr">Role \\\\ 阶段</th>';
      for (const tl of visibleTimelines) {
        html += '<th class="tl-band">' + esc(tl.name) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (const roleName of roles) {
        html += '<tr><th class="row-hdr">' + esc(roleName) + '</th>';
        for (const tl of visibleTimelines) {
          const matches = tl.events.filter(c => {
            const list = c.actors && c.actors.length ? c.actors : ['System / Unassigned'];
            return list.includes(roleName);
          });
          html += '<td>' + (matches.length ? '<div class="cell-track">' + matches.map(renderStickyCard).join('<span class="seq-arrow">→</span>') + '</div>' : '<div class="empty-cell"></div>') + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    } else {
      // Event Modeling 4-Lane Blueprint: UI/ReadModels -> Commands -> Events -> Policies/Sagas
      html += '<div class="matrix-wrap"><table class="matrix"><thead><tr><th class="row-hdr" rowspan="2">Layer \\\\ Seq</th>';
      for (const b of bands) html += '<th class="tl-band" colspan="' + b.span + '">' + esc(b.timeline) + '</th>';
      html += '</tr><tr>';
      for (const col of cols) html += '<th class="seq-hdr">Seq ' + col.sequence + (col.hasPivotal ? ' ★' : '') + '</th>';
      html += '</tr></thead><tbody>';
      const emRows = [
        ['1. Views / ReadModels', (list) => [...new Set(list.flatMap(c => c.consumerReadModels || []))].map(rm => '<div class="sticky sticky-rm"><div class="ev-name">' + esc(rm) + '</div><div class="ev-agg">ReadModel</div></div>').join('')],
        ['2. Commands (Actors)', (list) => [...new Set(list.flatMap(c => (c.producerCommands || []).map(cmd => cmd + ((c.actors || []).length ? ' [' + c.actors.join('/') + ']' : ''))))].map(cmd => '<div class="sticky sticky-cmd"><div class="ev-name">' + esc(cmd) + '</div><div class="ev-agg">Command</div></div>').join('')],
        ['3. Domain Events', (list) => list.map(renderStickyCard).join('<span class="seq-arrow">→</span>')],
        ['4. Policies / Sagas', (list) => [...new Set(list.flatMap(c => c.consumerPolicies || []))].map(pol => '<div class="sticky sticky-pol"><div class="ev-name">' + esc(pol) + '</div><div class="ev-agg">Policy / Saga</div></div>').join('')],
      ];
      for (const [rowLabel, renderFn] of emRows) {
        html += '<tr><th class="row-hdr">' + esc(rowLabel) + '</th>';
        for (const col of cols) {
          const rendered = renderFn(visibleCells(col));
          html += '<td>' + (rendered ? '<div class="cell-track">' + rendered + '</div>' : '<div class="empty-cell"></div>') + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }

    if ((m.hotspots || []).length > 0) {
      html += '<div class="card"><div class="card-hdr"><h3>热点问题与领域裁决台账 (Hotspots · ' + m.hotspots.length + ')</h3></div><div class="hotspot-grid">';
      for (const hs of m.hotspots) {
        html += '<div class="hotspot ' + (hs.status === 'resolved' ? 'resolved' : '') + '">';
        html += '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px"><b>' + esc(hs.question) + '</b><span class="badge ' + (hs.status === 'resolved' ? 'problem' : 'danger') + '">' + esc(hs.status) + '</span></div>';
        if ((hs.linkedEvents || []).length) html += '<div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">关联事件: ' + esc(hs.linkedEvents.join(', ')) + '</div>';
        if (hs.resolution) html += '<div style="font-size:12.5px;line-height:1.45">' + esc(hs.resolution) + '</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    return html;
  }

  function renderStoryMapVisual(d) {
    const s = d.structured;
    if (!s.journeys || s.journeys.length === 0) {
      return '<div class="card">暂无 Journey 声明，请先在真源补充 <code>journeys:</code> 或 <code>eventFlow:</code>。</div>';
    }
    let html = '';
    for (const j of s.journeys) {
      const rels = s.releases && s.releases.length ? s.releases : ['R1'];
      html += '<div class="card"><div class="card-hdr"><h3>' + esc(j.name) + ' <span class="badge problem">Persona: ' + esc(j.persona) + '</span></h3><span style="font-size:12.5px;color:var(--muted)">' + esc(j.goal || '') + '</span></div>';
      html += '<div class="smap-wrap"><table class="smap"><thead><tr><th class="rel-hdr">Release \\\\ Stage</th>';
      for (const st of j.stages) {
        html += '<th class="stage-hdr"><div style="font-weight:700;font-size:13.5px;color:var(--text)">' + esc(st.name) + '</div>';
        html += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">';
        if (st.channel) html += '<span class="badge accent">' + esc(st.channel) + '</span>';
        if (st.emotionScore != null) html += '<span class="badge gold">体验 ' + st.emotionScore + '/5</span>';
        html += '</div>';
        if ((st.painPoints || []).length) html += '<div style="font-size:11.5px;color:var(--danger);margin-top:6px">痛点: ' + esc(st.painPoints.join('; ')) + '</div>';
        html += '</th>';
      }
      html += '</tr></thead><tbody>';
      for (const rel of rels) {
        html += '<tr><th class="rel-hdr">' + esc(rel) + '</th>';
        for (const st of j.stages) {
          const storiesInRel = (st.stories || []).filter(x => (x.release || st.release || 'R1') === rel);
          html += '<td>';
          for (const story of storiesInRel) {
            html += '<div class="story-card"><b>' + esc(story.name) + '</b><div style="color:var(--muted);margin-top:4px">' + esc(story.goal) + '</div></div>';
          }
          if (rel === (st.release || rels[0])) {
            if ((st.useCases || []).length) html += '<div style="font-size:11.5px;color:var(--teal);margin-top:4px">UC: ' + esc(st.useCases.join(', ')) + '</div>';
            if ((st.screens || []).length) html += '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">Screens: ' + esc(st.screens.join(', ')) + '</div>';
          }
          html += '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div></div>';
    }
    return html;
  }

  function renderUseCasesVisual(d) {
    const ucs = d.structured.useCases || [];
    if (ucs.length === 0) {
      return '<div class="card"><h3>端到端用例</h3>' + wrapInViewport(buildAdaptiveFlowSvg(d.structured.nodes, d.structured.edges), d.id) + '</div>';
    }
    const idx = Math.min(state.activeUseCaseIdx, ucs.length - 1);
    const activeUc = ucs[idx];
    let html = '<div class="card"><div class="card-hdr"><h3>原生矢量时序图 · ' + esc(activeUc.name) + '</h3>';
    if (ucs.length > 1) {
      html += '<div class="uc-tabs">';
      ucs.forEach((u, i) => {
        html += '<button class="tl-chip' + (i === idx ? ' active' : '') + '" data-uc-idx="' + i + '">' + esc(u.name) + '</button>';
      });
      html += '</div>';
    }
    html += '</div>';
    if (activeUc.intent) html += '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">' + esc(activeUc.intent) + '</div>';
    html += wrapInViewport(buildSequenceSvg(activeUc), 'uc-' + idx);
    if ((activeUc.extensions || []).length > 0) {
      html += '<div class="ext-box"><b>异常与扩展分支：</b><ul style="margin:6px 0 0 18px;padding:0">';
      for (const ext of activeUc.extensions) {
        html += '<li><b>When</b> ' + esc(ext.condition) + ' → ' + esc(ext.behavior) + '</li>';
      }
      html += '</ul></div>';
    }
    html += '</div>';
    return html;
  }

  function renderOnionVisual(d) {
    const layers = d.structured.layers || [];
    const renderItems = (items) => {
      if (!items || !items.length) return '<span style="color:var(--muted);font-size:12px">（无声明项）</span>';
      return items.map(it => '<div class="item-pill"><span>' + esc(it.label) + '</span><span class="badge">' + esc(it.badge) + '</span></div>').join('');
    };
    const [ifL, appL, domL, infL] = layers;
    let html = '<div class="card"><div class="card-hdr"><h3>洋葱五层嵌套架构图（所有依赖严格指向纯领域内核 · DIP）</h3></div><div class="onion-nest">';
    if (ifL) {
      html += '<div class="onion-shell blue"><div class="onion-title"><span>4. ' + esc(ifL.name) + '</span><span class="badge accent">外层入站边界</span></div><div class="pill-wrap">' + renderItems(ifL.items) + '</div>';
      if (appL) {
        html += '<div class="onion-shell purple" style="margin-top:12px"><div class="onion-title"><span>3. ' + esc(appL.name) + '</span><span class="badge solution">应用编排 + Port 契约</span></div><div class="pill-wrap">' + renderItems(appL.items) + '</div>';
        if (domL) {
          html += '<div class="onion-shell emerald" style="margin-top:12px"><div class="onion-title"><span>1–2. ' + esc(domL.name) + '</span><span class="badge problem">零 IO · Z3 数学验证内核</span></div><div class="pill-wrap">' + renderItems(domL.items) + '</div></div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    if (infL) {
      html += '<div class="onion-shell amber"><div class="onion-title"><span>5. ' + esc(infL.name) + '</span><span class="badge gold">实现 Application 出站端口 & ReadSide 物化（DIP）</span></div><div class="pill-wrap">' + renderItems(infL.items) + '</div></div>';
    }
    html += '</div></div>';
    return html;
  }

  function renderAuthzVisual(d) {
    let html = '<div class="card"><div class="card-hdr"><h3>入站权限边界拓扑图</h3></div>' + wrapInViewport(buildAdaptiveFlowSvg(d.structured.nodes, d.structured.edges), d.id) + '</div>';
    html += '<div class="card"><div class="card-hdr"><h3>Authz PEP/PDP 契约明细</h3></div><table class="data"><thead><tr><th>Operation</th><th>Caller</th><th>Mode</th><th>Action</th><th>Scope</th><th>Roles / Policy</th></tr></thead><tbody>';
    for (const r of d.structured.rows || []) {
      const rp = r.mode === 'external-pdp' ? ('PDP: ' + (r.policyRef || '—')) : ((r.allowedRoles || []).join(', ') || '—');
      html += '<tr><td><code>' + esc(r.operation) + '</code></td><td>' + esc(r.callerKind || '—') + '</td><td><span class="badge solution">' + esc(r.mode || 'undeclared') + '</span></td><td><code>' + esc(r.action || '—') + '</code></td><td>' + esc(r.scope || '—') + '</td><td>' + esc(rp) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
  }

  function renderTestingVisual(d) {
    const t = d.structured.testing;
    if (!t || !t.layers) {
      return '<div class="card"><h3>分层测试策略</h3><p style="color:var(--muted)">当前未配置 <code>bindings/*-testing.yaml</code>，默认启用 v2 Z3 SMT + 锁定 BDD Oracles + 洋葱 DIP 审计。</p></div>';
    }
    let html = '<div class="card"><div class="card-hdr"><h3>四层测试金字塔与并行 TDD 隔离</h3><span class="badge problem">Worktree Isolation: ' + esc(t.parallelTdd.workspaceMode) + ' · ' + esc(t.parallelTdd.mergeStrategy) + '</span></div>';
    html += '<table class="data"><thead><tr><th>Layer</th><th>Harness</th><th>Min Line %</th><th>Min Branch %</th><th>Governance & Doubles</th></tr></thead><tbody>';
    html += '<tr><td><b>1. Domain（纯领域）</b></td><td><span class="badge problem">' + esc(t.layers.domain.harness) + '</span></td><td><b>' + esc(t.layers.domain.minLineCoverage ?? '—') + '%</b></td><td>' + esc(t.layers.domain.minBranchCoverage ?? '—') + '</td><td>ruleHits=' + t.layers.domain.requireAllRuleHits + ', mutationGate=' + t.layers.domain.mutationGate + '</td></tr>';
    const dbl = (t.layers.application.doubles || []).map(x => x.port + ':' + x.strategy).join(', ') || 'constructor-di';
    html += '<tr><td><b>2. Application（应用编排）</b></td><td><span class="badge solution">' + esc(t.layers.application.harness) + '</span></td><td><b>' + esc(t.layers.application.minLineCoverage ?? '—') + '%</b></td><td>' + esc(t.layers.application.minBranchCoverage ?? '—') + '</td><td>' + esc(dbl) + '</td></tr>';
    html += '<tr><td><b>3. Interfaces（接口鉴权）</b></td><td><span class="badge accent">' + esc(t.layers.interfaces.harness) + '</span></td><td>—</td><td>—</td><td>verifyAuthzMatrix=' + t.layers.interfaces.verifyAuthzMatrix + '</td></tr>';
    html += '<tr><td><b>4. Infrastructure（基础设施）</b></td><td><span class="badge gold">' + esc(t.layers.infrastructure.harness) + '</span></td><td>—</td><td>—</td><td>requireTck=' + t.layers.infrastructure.requireTck + '</td></tr>';
    html += '</tbody></table></div>';
    return html;
  }

  function renderDeploymentVisual(d) {
    const s = d.structured;
    let html = '<div class="card"><div class="card-hdr"><h3>' + esc(s.style) + '</h3><span class="badge solution">可演进解决方案空间部署拓扑</span></div><div class="bc-grid">';
    for (const bc of s.boundedContexts || []) {
      html += '<div class="bc-box"><div style="font-weight:700;font-size:14px;color:var(--solution)">BC: ' + esc(bc.name) + '</div><div style="font-size:11.5px;color:var(--muted);margin-bottom:6px">Deployable Unit: ' + esc(bc.deployableUnit) + '</div>';
      for (const sd of bc.subdomains || []) html += '<div class="sd-chip">Subdomain: ' + esc(sd) + '</div>';
      html += '</div>';
    }
    html += '</div></div>';
    if ((s.integrations || []).length > 0) {
      html += '<div class="card"><div class="card-hdr"><h3>跨子域集成边界（同进程 Same-BC vs 跨服务 Cross-BC）</h3></div><table class="data"><thead><tr><th>ID</th><th>Upstream</th><th>Downstream</th><th>Relation</th><th>Boundary</th></tr></thead><tbody>';
      for (const it of s.integrations) {
        html += '<tr><td><code>' + esc(it.id) + '</code></td><td>' + esc(it.fromSubdomain + '.' + it.fromEvent) + '</td><td>' + esc(it.toSubdomain + '.' + it.toTarget) + '</td><td>' + esc(it.relation) + '</td><td><span class="badge ' + (it.boundary === 'same-bc' ? 'problem' : 'gold') + '">' + esc(it.boundary) + '</span></td></tr>';
      }
      html += '</tbody></table></div>';
    }
    return html;
  }

  function renderFlowVisual(d) {
    let html = '<div class="card"><div class="card-hdr"><h3>高清矢量拓扑图（自动防重叠排版 · 点击任意节点聚焦上下游）</h3></div>';
    html += wrapInViewport(buildAdaptiveFlowSvg(d.structured.nodes, d.structured.edges), d.id);
    html += '</div>';
    if (d.id === 'field-lineage' && d.structured.compliance) {
      const c = d.structured.compliance;
      html += '<div class="card"><div class="card-hdr"><h3>法律合规与隐私策略 (Compliance)</h3></div><div style="display:flex;gap:8px;flex-wrap:wrap">';
      html += '<span class="badge">行业: ' + esc(c.industry || '—') + '</span>';
      html += '<span class="badge">数据驻留: ' + esc(c.dataResidency || '—') + '</span>';
      html += '<span class="badge ' + (c.erasureRequired ? 'danger' : 'problem') + '">要求删除权: ' + Boolean(c.erasureRequired) + '</span>';
      html += '<span class="badge gold">PII 策略: ' + esc(c.piiStrategy || '—') + '</span></div></div>';
    }
    if (d.id === 'field-lineage' && (d.structured.waivers || []).length > 0) {
      html += '<div class="card"><div class="card-hdr"><h3>显式字段血缘豁免台账 (Waivers)</h3></div><table class="data"><thead><tr><th>Target</th><th>Kind</th><th>Reason</th><th>Note</th></tr></thead><tbody>';
      for (const w of d.structured.waivers) {
        html += '<tr><td><code>' + esc(w.target) + '</code></td><td>' + esc(w.kind) + '</td><td><span class="badge gold">' + esc(w.reason) + '</span></td><td>' + esc(w.note || '—') + '</td></tr>';
      }
      html += '</tbody></table></div>';
    }
    if (d.id === 'readside-topology' && (d.structured.materializedViews || []).length > 0) {
      html += '<div class="card"><div class="card-hdr"><h3>物理物化视图明细</h3></div><table class="data"><thead><tr><th>MV</th><th>Mode</th><th>Storage</th><th>Serves ReadModels</th><th>Derived Columns</th></tr></thead><tbody>';
      for (const mv of d.structured.materializedViews) {
        html += '<tr><td><code>' + esc(mv.name) + '</code></td><td><span class="badge solution">' + esc(mv.refreshMode || 'stream') + '</span></td><td>' + esc(mv.storage) + '</td><td>' + esc((mv.servesReadModels || []).join(', ')) + '</td><td><code>' + esc((mv.derivedColumns || []).map(c => c.name + ':' + c.type).join(', ')) + '</code></td></tr>';
      }
      html += '</tbody></table></div>';
    }
    return html;
  }

  function renderMain() {
    const d = bundle.diagrams.find(x => x.id === state.activeId) || bundle.diagrams[0];
    if (!d) return;
    document.getElementById('view-title').innerHTML = esc(d.title) + ' <span class="badge ' + esc(d.space) + '">' + (d.space === 'problem' ? '问题空间 · 真源' : '解决方案空间 · 架构') + '</span>';
    document.getElementById('view-sub').textContent = d.subtitle + ' · ' + d.summary;

    const actions = document.getElementById('view-actions');
    actions.innerHTML = '';

    // 3-level Information Density switcher
    const dBar = document.createElement('div');
    dBar.className = 'density-bar';
    [['compact', '紧凑一屏'], ['standard', '标准'], ['detailed', '详尽']].forEach(([val, lbl]) => {
      const b = document.createElement('button');
      b.className = 'density-btn' + (state.density === val ? ' active' : '');
      b.textContent = lbl;
      b.onclick = () => { state.density = val; renderMain(); };
      dBar.appendChild(b);
    });
    actions.appendChild(dBar);

    const mkBtn = (text, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (cls || '');
      b.textContent = text;
      b.onclick = fn;
      actions.appendChild(b);
    };
    mkBtn(state.theme === 'light' ? '🌙 深色' : '☀ 纸面浅色', '', () => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', state.theme);
      renderMain();
    });
    mkBtn(state.mode === 'visual' ? 'Mermaid / 源码' : '返回图形视图', 'primary', () => {
      state.mode = state.mode === 'visual' ? 'source' : 'visual';
      renderMain();
    });
    if (d.mermaid) mkBtn('复制 Mermaid', '', () => copyText(d.mermaid, 'Mermaid'));
    if (d.yamlSnippet) mkBtn('复制 eventFlow YAML', '', () => copyText(d.yamlSnippet, 'eventFlow YAML'));
    if (d.csv) mkBtn('导出 CSV', '', () => downloadFile('story-map.csv', d.csv, 'text/csv;charset=utf-8'));
    if (d.cml) mkBtn('导出 .cml', '', () => downloadFile('domain-map.cml', d.cml));

    const content = document.getElementById('view-content');
    if (state.mode === 'source') {
      let srcHtml = '<div class="card"><div class="card-hdr"><h3>Mermaid Source (<code>' + esc(d.id) + '.mmd</code>)</h3></div><pre class="code">' + esc(d.mermaid || '') + '</pre></div>';
      if (d.yamlSnippet) srcHtml += '<div class="card"><div class="card-hdr"><h3>v2 <code>eventFlow:</code> YAML 迁移片段</h3></div><pre class="code">' + esc(d.yamlSnippet) + '</pre></div>';
      if (d.cml) srcHtml += '<div class="card"><div class="card-hdr"><h3>ContextMapper DSL (<code>domain-map.cml</code>)</h3></div><pre class="code">' + esc(d.cml) + '</pre></div>';
      if (d.csv) srcHtml += '<div class="card"><div class="card-hdr"><h3>Story Map CSV (<code>story-map.csv</code>)</h3></div><pre class="code">' + esc(d.csv) + '</pre></div>';
      content.innerHTML = srcHtml;
      renderDrawer();
      return;
    }

    const kind = d.structured && d.structured.kind;
    if (kind === 'event-matrix') content.innerHTML = renderEventMatrixVisual(d);
    else if (kind === 'story-map') content.innerHTML = renderStoryMapVisual(d);
    else if (d.id === 'use-cases') content.innerHTML = renderUseCasesVisual(d);
    else if (kind === 'onion-layers') content.innerHTML = renderOnionVisual(d);
    else if (kind === 'authz-matrix') content.innerHTML = renderAuthzVisual(d);
    else if (kind === 'testing-strategy') content.innerHTML = renderTestingVisual(d);
    else if (kind === 'deployment-topology') content.innerHTML = renderDeploymentVisual(d);
    else content.innerHTML = renderFlowVisual(d);

    attachViewportControls(content, d.id);

    content.querySelectorAll('[data-tl]').forEach(btn => {
      btn.onclick = () => { state.activeTimeline = btn.getAttribute('data-tl'); renderMain(); };
    });
    content.querySelectorAll('[data-axis]').forEach(btn => {
      btn.onclick = () => { state.matrixAxis = btn.getAttribute('data-axis'); renderMain(); };
    });
    content.querySelectorAll('[data-uc-idx]').forEach(btn => {
      btn.onclick = () => { state.activeUseCaseIdx = Number(btn.getAttribute('data-uc-idx')); renderMain(); };
    });
    content.querySelectorAll('[data-ev-key]').forEach(el => {
      el.onclick = () => {
        const key = el.getAttribute('data-ev-key');
        const cell = d.structured.matrix.cells.find(c => (c.sequence + ':' + c.step + ':' + c.event) === key);
        if (cell) { state.selected = { kind: 'event-cell', cell }; renderDrawer(); }
      };
    });
    content.querySelectorAll('[data-node-id]').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const nid = el.getAttribute('data-node-id');
        const node = (d.structured.nodes || []).find(n => n.id === nid);
        if (node) {
          state.spotlightNodeId = state.spotlightNodeId === nid ? null : nid;
          state.selected = state.spotlightNodeId ? { kind: 'graph-node', node } : null;
          renderMain();
        }
      };
    });

    renderDrawer();
  }

  function renderNav() {
    const q = state.query.toLowerCase();
    const list = document.getElementById('nav-list');
    list.innerHTML = '';
    const filtered = bundle.diagrams.filter(d => {
      if (state.space !== 'all' && d.space !== state.space) return false;
      if (!q) return true;
      return (d.title + ' ' + d.subtitle + ' ' + d.summary + ' ' + (d.mermaid || '')).toLowerCase().includes(q);
    });
    if (filtered.length > 0 && !filtered.some(d => d.id === state.activeId)) {
      state.activeId = filtered[0].id;
    }
    const groups = [
      ['problem', '问题空间 · 真源图谱'],
      ['solution', '解决方案空间 · 架构与绑定'],
    ];
    for (const [sp, heading] of groups) {
      const items = filtered.filter(d => d.space === sp);
      if (items.length === 0) continue;
      const hdr = document.createElement('div');
      hdr.className = 'nav-section';
      hdr.textContent = heading;
      list.appendChild(hdr);
      for (const d of items) {
        const btn = document.createElement('button');
        btn.className = 'nav-item' + (d.id === state.activeId ? ' active' : '');
        btn.innerHTML = '<div class="top"><span class="title">' + esc(d.title) + '</span></div><div class="sum">' + esc(d.summary) + '</div>';
        btn.onclick = () => {
          state.activeId = d.id;
          state.selected = null;
          state.spotlightNodeId = null;
          state.activeTimeline = 'ALL';
          renderNav();
          renderMain();
        };
        list.appendChild(btn);
      }
    }
  }

  document.getElementById('atlas-title').textContent = bundle.title;
  document.getElementById('atlas-meta').innerHTML =
    '<span class="badge problem">问题空间 ' + bundle.meta.problemDiagramCount + '</span>' +
    '<span class="badge solution">解空间 ' + bundle.meta.solutionDiagramCount + '</span>' +
    (bundle.meta.canonicalSha256 ? '<span class="badge">sha:' + esc(bundle.meta.canonicalSha256.slice(0, 10)) + '</span>' : '');
  document.getElementById('cnt-all').textContent = bundle.meta.totalDiagramCount;
  document.getElementById('cnt-prob').textContent = bundle.meta.problemDiagramCount;
  document.getElementById('cnt-sol').textContent = bundle.meta.solutionDiagramCount;

  document.getElementById('toggle-sidebar').onclick = () => {
    document.getElementById('app-root').classList.toggle('sidebar-collapsed');
    setTimeout(renderMain, 180);
  };
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.space = btn.getAttribute('data-space');
      renderNav();
      renderMain();
    };
  });
  document.getElementById('search-input').oninput = (e) => {
    state.query = e.target.value;
    renderNav();
    renderMain();
  };

  renderNav();
  renderMain();
})();
</script>
</body>
</html>
`;
}

/**
 * Generates the unified offline Atlas HTML viewer (and optional diagram bundle directory).
 */
export function exportAtlasV2({
  canonicalFile = null,
  canonicalFiles = null,
  domainMapFile = null,
  v1TreeDir = null,
  ingestJsonPath = null,
  outFile,
  outDir = null,
  title = null,
} = {}) {
  if (!outFile) throw new Error('atlas-v2 requires --out <atlas.html>');
  const canonicals = [];
  if (Array.isArray(canonicalFiles) && canonicalFiles.length > 0) {
    for (const f of canonicalFiles) canonicals.push(JSON.parse(readFileSync(resolve(f), 'utf8')));
  } else if (canonicalFile) {
    canonicals.push(JSON.parse(readFileSync(resolve(canonicalFile), 'utf8')));
  }

  let domainMap = null;
  let systemLineage = null;
  if (domainMapFile) {
    const dmPath = resolve(domainMapFile);
    domainMap = parseStructuredDoc(readFileSync(dmPath, 'utf8'), dmPath);
  }
  if (canonicals.length > 0 && (canonicals.length > 1 || domainMapFile)) {
    systemLineage = auditSystemLineageV2({
      canonicals,
      domainMapPath: domainMapFile ? resolve(domainMapFile) : null,
      dbFile: ':memory:',
    });
  }

  const bundle = buildAtlasBundle({
    canonicals: canonicals.length > 0 ? canonicals : null,
    systemLineage,
    domainMap,
    v1TreeDir,
    ingestJsonPath,
    title,
  });

  const html = renderAtlasHtml(bundle);
  if (/\/Users\//u.test(html)) {
    throw new Error('V2_ATLAS_PATH_LEAK: refusing to emit atlas HTML containing a local home path');
  }

  const absOut = resolve(outFile);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, html, 'utf8');

  const emittedFiles = outDir ? emitDiagramBundleFiles(bundle, outDir) : [];

  return {
    schemaVersion: 'co-arising.atlas-v2/v1',
    outFile: absOut,
    bytes: Buffer.byteLength(html, 'utf8'),
    kb: Number((Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)),
    htmlSha256: sha256Hex(Buffer.from(html, 'utf8')),
    meta: bundle.meta,
    diagrams: bundle.diagrams.map(d => ({ id: d.id, space: d.space, title: d.title, summary: d.summary })),
    emittedFiles,
  };
}
