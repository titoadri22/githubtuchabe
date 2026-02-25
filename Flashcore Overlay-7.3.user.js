// ==UserScript==
// @name         Flashcore Overlay
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Ventana Picture-in-Picture flotante con diseño Flashscore
// @author       TuNombre
// @match        https://www.flashscore.es/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    .fc-overlay-btn {
      position: absolute; right: 10px; bottom: 10px; width: 28px; height: 28px;
      border-radius: 50%; background-color: #f96; color: white; border: none;
      cursor: pointer; font-size: 14px; font-weight: bold; display: flex;
      align-items: center; justify-content: center; z-index: 10000;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }
    .fc-overlay-btn:hover { background-color: #e8550a; }
  `);

  const leaguePipWindows   = new Map();
  const leaguePipIntervals = new Map();
  const leagueMatchElements = new Map();

  // ---------- Helpers ----------
  function getLeagueIdentifier(leagueHeader) {
    if (!leagueHeader) return null;
    const t = leagueHeader.querySelector('.headerLeague__title-text');
    const c = leagueHeader.querySelector('.headerLeague__category-text');
    if (t && c) return `${c.textContent.trim()}:${t.textContent.trim()}`;
    return (leagueHeader.textContent || '').trim() || null;
  }

  function getLeagueLabel(leagueHeader) {
    if (!leagueHeader) return 'Flashscore';
    const t = leagueHeader.querySelector('.headerLeague__title-text');
    const c = leagueHeader.querySelector('.headerLeague__category-text');
    if (t && c) return `${c.textContent.trim()} · ${t.textContent.trim()}`;
    return (leagueHeader.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Flashscore';
  }

  function normalizeTeamName(name) {
    return name.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  function getTeamIdsFromMatch(matchElement) {
    const matchLink = matchElement.querySelector('.eventRowLink');
    if (!matchLink || !matchLink.href) return null;
    const parts = matchLink.href.split('/');
    const segs  = parts.filter(p => p && p.includes('-') && p.length > 5);
    if (segs.length < 2) return null;
    const extract = seg => {
      const idx = seg.lastIndexOf('-');
      return idx === -1 ? null : { name: seg.substring(0, idx), id: seg.substring(idx + 1) };
    };
    const team1 = extract(segs[segs.length - 2]);
    const team2 = extract(segs[segs.length - 1].split('?')[0]);
    if (!team1 || !team2) return null;
    return { team1, team2 };
  }

  function findTeamId(matchElement, teamName) {
    const ids = getTeamIdsFromMatch(matchElement);
    if (!ids) return null;
    const norm   = normalizeTeamName(teamName);
    const common = ['de','del','la','los','las','el','fc','cf','ud','cd'];
    const words  = norm.split('-').filter(w => w.length > 2 && !common.includes(w));
    const count  = name => words.filter(w => name.includes(w)).length;
    const m1 = count(ids.team1.name), m2 = count(ids.team2.name);
    if (m1 > m2 && m1 > 0) return { id: ids.team1.id, urlName: ids.team1.name };
    if (m2 > m1 && m2 > 0) return { id: ids.team2.id, urlName: ids.team2.name };
    if (ids.team1.name === norm) return { id: ids.team1.id, urlName: ids.team1.name };
    if (ids.team2.name === norm) return { id: ids.team2.id, urlName: ids.team2.name };
    return null;
  }

  function getMatchData(matchElement) {
    const get = sel => { const el = matchElement.querySelector(sel); return el ? el.textContent.trim() : ''; };
    const getLogo = sel => { const el = matchElement.querySelector(sel); return el ? (el.src || '') : ''; };
    return {
      stage:     get('.event__stage'),
      homeTeam:  get('.event__participant--home') || get('.event__homeParticipant'),
      awayTeam:  get('.event__participant--away') || get('.event__awayParticipant'),
      scoreHome: get('.event__score--home'),
      scoreAway: get('.event__score--away'),
      partHome:  get('.event__part--home'),
      partAway:  get('.event__part--away'),
      logoHome:  getLogo('.event__logo--home img') || getLogo('.event__logo--home'),
      logoAway:  getLogo('.event__logo--away img') || getLogo('.event__logo--away'),
    };
  }

  // ---------- PiP CSS (diseño Flashscore) ----------
  const PIP_STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #1a1a1a;
      color: #e5e5e5;
      font-family: 'Inter', 'Roboto', Arial, sans-serif;
      font-size: 12px;
      overflow: hidden;
    }

    /* ── Header ── */
    #pip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      background: #111;
      border-bottom: 2px solid #f96;
    }
    #pip-logo {
      font-size: 13px;
      font-weight: 700;
      color: #f96;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    #pip-title {
      flex: 1;
      font-size: 11px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #pip-live-badge {
      background: #c0392b;
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity: 1; }
      50%      { opacity: 0.5; }
    }
    #pip-close {
      background: none;
      border: 1px solid #333;
      color: #888;
      width: 22px; height: 22px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s;
      flex-shrink: 0;
    }
    #pip-close:hover { background: #c0392b; border-color: #c0392b; color: #fff; }

    /* ── Scroll container ── */
    #pip-content {
      overflow-y: auto;
      max-height: calc(100vh - 38px);
    }
    #pip-content::-webkit-scrollbar { width: 4px; }
    #pip-content::-webkit-scrollbar-track { background: #111; }
    #pip-content::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

    /* ── Fila de partido ── */
    .pip-row {
      display: grid;
      grid-template-columns: 34px 1fr 56px;
      align-items: center;
      padding: 6px 10px;
      border-bottom: 1px solid #222;
      gap: 6px;
      transition: background .15s;
      cursor: default;
    }
    .pip-row:last-child { border-bottom: none; }
    .pip-row:hover { background: #212121; }

    /* Minuto */
    .pip-time {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #f95;
      line-height: 1.4;
    }
    .pip-time.finished { color: #666; font-weight: 400; }

    /* Equipos */
    .pip-teams { overflow: hidden; }
    .pip-team-row {
      display: flex;
      align-items: center;
      gap: 5px;
      height: 22px;
    }
    .pip-logo {
      width: 16px; height: 16px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .pip-logo-placeholder {
      width: 16px; height: 16px;
      background: #2a2a2a;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .pip-name {
      font-size: 12px;
      color: #e5e5e5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
    }
    .pip-name.clickable { cursor: pointer; }
    .pip-name.clickable:hover { color: #f96; text-decoration: underline; }
    .pip-name.winner { color: #fff; font-weight: 700; }

    /* Marcador */
    .pip-scores {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .pip-score-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      height: 22px;
    }
    .pip-score-val {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      min-width: 18px;
      text-align: center;
      line-height: 1;
    }
    .pip-score-sep {
      font-size: 12px;
      color: #555;
      line-height: 1;
    }
    .pip-part-val {
      font-size: 10px;
      color: #555;
      min-width: 12px;
      text-align: center;
    }

    /* Sin partidos */
    .pip-empty {
      padding: 20px;
      text-align: center;
      color: #555;
      font-size: 12px;
    }
  `;

  // ---------- Construir filas ----------
  function buildPipRows(pipDoc, matchElements) {
    const container = pipDoc.getElementById('pip-content');
    if (!container) return;
    container.innerHTML = '';

    if (!matchElements.length) {
      const empty = pipDoc.createElement('div');
      empty.className = 'pip-empty';
      empty.textContent = 'Sin partidos';
      container.appendChild(empty);
      return;
    }

    matchElements.forEach((matchEl, idx) => {
      const d = getMatchData(matchEl);
      const homeData = findTeamId(matchEl, d.homeTeam);
      const awayData = findTeamId(matchEl, d.awayTeam);

      const isFinished = d.stage.toLowerCase().includes('fin') || d.stage === 'FT' || d.stage === 'AP';
      const homeWins = !isFinished ? false : parseInt(d.scoreHome) > parseInt(d.scoreAway);
      const awayWins = !isFinished ? false : parseInt(d.scoreAway) > parseInt(d.scoreHome);

      const row = pipDoc.createElement('div');
      row.className = 'pip-row';
      row.dataset.idx = idx;

      // — Minuto —
      const timeDiv = pipDoc.createElement('div');
      timeDiv.className = 'pip-time' + (isFinished ? ' finished' : '');
      timeDiv.innerHTML = d.stage.replace("'", `<span style="font-size:9px;color:#f95">'</span>`);

      // — Equipos —
      const teamsDiv = pipDoc.createElement('div');
      teamsDiv.className = 'pip-teams';

      const makeTeamRow = (name, logo, url, isWinner) => {
        const row = pipDoc.createElement('div');
        row.className = 'pip-team-row';

        // Logo
        if (logo) {
          const img = pipDoc.createElement('img');
          img.className = 'pip-logo';
          img.src = logo;
          img.onerror = () => { img.style.display = 'none'; };
          row.appendChild(img);
        } else {
          const ph = pipDoc.createElement('div');
          ph.className = 'pip-logo-placeholder';
          row.appendChild(ph);
        }

        // Nombre
        const nameEl = pipDoc.createElement('span');
        nameEl.className = 'pip-name' + (url ? ' clickable' : '') + (isWinner ? ' winner' : '');
        nameEl.textContent = name;
        if (url) nameEl.addEventListener('click', () => window.open(url, '_blank'));
        row.appendChild(nameEl);
        return row;
      };

      teamsDiv.appendChild(makeTeamRow(
        d.homeTeam,
        d.logoHome,
        homeData ? `https://www.flashscore.es/equipo/${homeData.urlName}/${homeData.id}/` : '',
        homeWins
      ));
      teamsDiv.appendChild(makeTeamRow(
        d.awayTeam,
        d.logoAway,
        awayData ? `https://www.flashscore.es/equipo/${awayData.urlName}/${awayData.id}/` : '',
        awayWins
      ));

      // — Marcador —
      const scoresDiv = pipDoc.createElement('div');
      scoresDiv.className = 'pip-scores';

      const makeScoreRow = (score, part) => {
        const r = pipDoc.createElement('div');
        r.className = 'pip-score-row';
        const val = pipDoc.createElement('span');
        val.className = 'pip-score-val';
        val.textContent = score || '-';
        r.appendChild(val);
        if (part) {
          const p = pipDoc.createElement('span');
          p.className = 'pip-part-val';
          p.textContent = `(${part})`;
          r.appendChild(p);
        }
        return r;
      };

      scoresDiv.appendChild(makeScoreRow(d.scoreHome, d.partHome));
      scoresDiv.appendChild(makeScoreRow(d.scoreAway, d.partAway));

      row.appendChild(timeDiv);
      row.appendChild(teamsDiv);
      row.appendChild(scoresDiv);
      container.appendChild(row);
    });
  }

  function updatePipScores(pipDoc, matchElements) {
    matchElements.forEach((matchEl, idx) => {
      const d   = getMatchData(matchEl);
      const row = pipDoc.querySelector(`.pip-row[data-idx="${idx}"]`);
      if (!row) return;

      const timeEl = row.querySelector('.pip-time');
      if (timeEl) timeEl.textContent = d.stage;

      const vals = row.querySelectorAll('.pip-score-val');
      if (vals[0]) vals[0].textContent = d.scoreHome || '-';
      if (vals[1]) vals[1].textContent = d.scoreAway || '-';

      const parts = row.querySelectorAll('.pip-part-val');
      if (parts[0] && d.partHome) parts[0].textContent = `(${d.partHome})`;
      if (parts[1] && d.partAway) parts[1].textContent = `(${d.partAway})`;

      // Ganador en negrita
      const names = row.querySelectorAll('.pip-name');
      const sh = parseInt(d.scoreHome), sa = parseInt(d.scoreAway);
      const fin = d.stage.toLowerCase().includes('fin') || d.stage === 'FT' || d.stage === 'AP';
      if (fin && !isNaN(sh) && !isNaN(sa)) {
        if (names[0]) names[0].classList.toggle('winner', sh > sa);
        if (names[1]) names[1].classList.toggle('winner', sa > sh);
      }
    });
  }

  // ---------- Abrir PiP ----------
  async function openOrUpdatePip(leagueId, label, matchElements) {
    if (leaguePipWindows.has(leagueId)) {
      const w = leaguePipWindows.get(leagueId);
      if (!w.closed) { buildPipRows(w.document, matchElements); return; }
    }

    if (!window.documentPictureInPicture) {
      alert('Tu navegador no soporta Picture-in-Picture para HTML.\nUsa Chrome 116+ o Edge 116+.');
      return;
    }

    let pipWin;
    try {
      pipWin = await window.documentPictureInPicture.requestWindow({ width: 400, height: 320 });
    } catch (err) {
      alert('No se pudo abrir la ventana flotante:\n' + err.message);
      return;
    }

    // Inyectar estilos
    const style = pipWin.document.createElement('style');
    style.textContent = PIP_STYLES;
    pipWin.document.head.appendChild(style);

    // Favicon
    const favicon = pipWin.document.createElement('link');
    favicon.rel = 'icon';
    favicon.href = 'https://www.flashscore.es/favicon.ico';
    pipWin.document.head.appendChild(favicon);

    // Header
    const header = pipWin.document.createElement('div');
    header.id = 'pip-header';

    const logo = pipWin.document.createElement('div');
    logo.id = 'pip-logo';
    logo.textContent = '⚽ Flash';

    const titleEl = pipWin.document.createElement('div');
    titleEl.id = 'pip-title';
    titleEl.textContent = label;

    const badge = pipWin.document.createElement('div');
    badge.id = 'pip-live-badge';
    badge.textContent = 'EN VIVO';

    const closeBtn = pipWin.document.createElement('button');
    closeBtn.id = 'pip-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Cerrar';
    closeBtn.addEventListener('click', () => pipWin.close());

    header.appendChild(logo);
    header.appendChild(titleEl);
    header.appendChild(badge);
    header.appendChild(closeBtn);
    pipWin.document.body.appendChild(header);

    // Contenido
    const content = pipWin.document.createElement('div');
    content.id = 'pip-content';
    pipWin.document.body.appendChild(content);

    leaguePipWindows.set(leagueId, pipWin);
    buildPipRows(pipWin.document, matchElements);

    // Actualizar cada 5s
    const interval = setInterval(() => {
      if (!pipWin || pipWin.closed) { clearInterval(interval); return; }
      updatePipScores(pipWin.document, matchElements);
    }, 5000);
    leaguePipIntervals.set(leagueId, interval);

    pipWin.addEventListener('pagehide', () => {
      clearInterval(interval);
      leaguePipWindows.delete(leagueId);
      leaguePipIntervals.delete(leagueId);
      leagueMatchElements.delete(leagueId);
    });
  }

  // ---------- Botón ⬚ por partido ----------
  function createOverlayButton(matchElement) {
    if (matchElement.querySelector('.fc-overlay-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'fc-overlay-btn';
    btn.textContent = '⬚';
    btn.title = 'Abrir ventana flotante';

    btn.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();

      const leagueContainer = matchElement.closest('.leagues--live') || matchElement.closest('.event');
      let leagueHeader = null;
      if (leagueContainer) leagueHeader = leagueContainer.querySelector('.headerLeague__body');
      const leagueId = getLeagueIdentifier(leagueHeader) || `fc_${Date.now()}`;
      const label    = getLeagueLabel(leagueHeader);

      if (!leagueMatchElements.has(leagueId)) leagueMatchElements.set(leagueId, []);
      const list = leagueMatchElements.get(leagueId);
      if (!list.includes(matchElement)) list.push(matchElement);

      openOrUpdatePip(leagueId, label, list);
    });

    matchElement.style.position = 'relative';
    matchElement.appendChild(btn);
  }

  // ---------- Escaneo DOM ----------
  function addButtonsToAllMatches() {
    document.querySelectorAll('.event__match:not(.fc-processed)').forEach(match => {
      match.classList.add('fc-processed');
      createOverlayButton(match);
    });
  }

  function handleExpandableSections() {
    document.querySelectorAll('[data-testid="wcl-accordionButton"]').forEach(btn => {
      if (!btn.hasAttribute('data-fc-listener')) {
        btn.setAttribute('data-fc-listener', 'true');
        btn.addEventListener('click', () => setTimeout(addButtonsToAllMatches, 500));
      }
    });
  }

  const observer = new MutationObserver(mutations => {
    let check = false;
    mutations.forEach(m => {
      if (m.addedNodes && m.addedNodes.length) {
        check = true;
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList && node.classList.contains('event__match')) {
            node.classList.add('fc-processed');
            createOverlayButton(node);
          }
        });
      }
    });
    if (check) setTimeout(addButtonsToAllMatches, 100);
    handleExpandableSections();
  });

  function init() {
    addButtonsToAllMatches();
    handleExpandableSections();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(addButtonsToAllMatches, 2000);
})();


