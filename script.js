(() => {
  const API_BASE = 'https://api.jolpi.ca/ergast/f1';
  const REFRESH_INTERVAL = 5 * 60 * 1000;
  const REQUEST_TIMEOUT = 12_000;
  const locale = 'es-AR';

  const elements = {
    season: document.getElementById('season-label'),
    nextRound: document.getElementById('next-race-round'),
    nextSeason: document.getElementById('next-race-season'),
    nextName: document.getElementById('next-race-name'),
    nextLocation: document.getElementById('next-race-location'),
    nextDate: document.getElementById('next-race-date'),
    nextTime: document.getElementById('next-race-time'),
    nextCircuit: document.getElementById('next-race-circuit'),
    countdown: document.getElementById('next-race-countdown'),
    lastName: document.getElementById('last-race-name'),
    lastDetail: document.getElementById('last-race-detail'),
    resultsBody: document.getElementById('results-body'),
    dataStatus: document.getElementById('data-status'),
    refreshButton: document.getElementById('refresh-button'),
  };

  let requestInProgress = false;

  function formatDate(date, options) {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  function raceDate(race) {
    if (!race?.date) return null;
    const date = new Date(`${race.date}T${race.time || '00:00:00Z'}`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`La API respondió con el código ${response.status}.`);
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function showNextRace(race) {
    const date = raceDate(race);
    const round = race?.round ? Number(race.round) : null;
    elements.nextRound.replaceChildren(document.createTextNode(round ? String(round).padStart(2, '0') : '—'));
    const roundLabel = document.createElement('span');
    roundLabel.textContent = 'RONDA';
    elements.nextRound.append(roundLabel);

    elements.nextSeason.textContent = `${race.season || 'F1'} · CAMPEONATO MUNDIAL`;
    elements.nextName.textContent = race.raceName || 'Próxima carrera';
    elements.nextLocation.textContent = [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(', ') || 'Ubicación por confirmar';
    elements.nextCircuit.textContent = race.Circuit?.circuitName || 'Circuito por confirmar';

    if (!date) {
      elements.nextDate.textContent = 'Fecha por confirmar';
      elements.nextTime.textContent = '';
      elements.countdown.textContent = 'CALENDARIO F1';
      return;
    }

    elements.nextDate.textContent = formatDate(date, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase();
    elements.nextTime.textContent = race.time
      ? `HORARIO DE INICIO · ${formatDate(date, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`
      : 'Horario por confirmar';

    const remaining = date.getTime() - Date.now();
    if (remaining > 0) {
      const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
      elements.countdown.textContent = days === 1 ? 'MAÑANA' : `EN ${days} DÍAS`;
    } else if (date.toDateString() === new Date().toDateString()) {
      elements.countdown.textContent = 'HOY';
    } else {
      elements.countdown.textContent = 'FECHA PASADA';
    }
  }

  function resultCell(value, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value ?? '—';
    return cell;
  }

  function teamClass(name) {
    const normalized = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return normalized ? `team-${normalized}` : '';
  }

  function showResults(race) {
    const results = race?.Results;
    elements.resultsBody.replaceChildren();

    if (!Array.isArray(results) || results.length === 0) {
      const row = document.createElement('tr');
      const cell = resultCell('Todavía no hay resultados publicados para esta carrera.', 'table-message');
      cell.colSpan = 6;
      row.append(cell);
      elements.resultsBody.append(row);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const result of results) {
      const row = document.createElement('tr');
      const position = result.positionText || result.position || '—';
      row.append(resultCell(position, 'position-cell'));

      const driver = document.createElement('td');
      driver.className = 'driver-cell';
      const code = document.createElement('span');
      code.className = 'driver-code';
      code.textContent = result.Driver?.code || result.Driver?.permanentNumber || '—';
      const name = document.createElement('span');
      name.className = 'driver-name';
      name.textContent = [result.Driver?.givenName, result.Driver?.familyName].filter(Boolean).join(' ') || 'Piloto no disponible';
      driver.append(code, name);
      row.append(driver);

      const constructor = result.Constructor?.name || '—';
      row.append(resultCell(constructor, `team-cell ${teamClass(constructor)}`));
      row.append(resultCell(result.laps ?? '—'));
      row.append(resultCell(result.Time?.time || result.status || '—', 'time-cell'));
      row.append(resultCell(result.points ?? '0', 'points-cell'));
      fragment.append(row);
    }
    elements.resultsBody.append(fragment);
  }

  function showLastRace(race) {
    if (!race) {
      elements.lastName.textContent = 'No hay carrera anterior disponible';
      elements.lastDetail.textContent = '';
      return;
    }
    elements.lastName.textContent = race.raceName || 'Última carrera';
    const date = raceDate(race);
    const dateText = date ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    elements.lastDetail.textContent = [race.Circuit?.Location?.country, dateText].filter(Boolean).join(' · ');
  }

  async function refreshData({ quiet = false } = {}) {
    if (requestInProgress) return;
    requestInProgress = true;
    elements.refreshButton.disabled = true;
    elements.refreshButton.classList.add('is-loading');
    if (!quiet) elements.dataStatus.textContent = 'Actualizando calendario y resultados…';

    try {
      const [scheduleData, resultsData] = await Promise.all([
        fetchJson(`${API_BASE}/current/next.json`),
        fetchJson(`${API_BASE}/current/last/results.json`),
      ]);
      const nextRace = scheduleData?.MRData?.RaceTable?.Races?.[0];
      const lastRace = resultsData?.MRData?.RaceTable?.Races?.[0];

      if (nextRace) showNextRace(nextRace);
      else {
        elements.nextName.textContent = 'No hay próximas carreras publicadas';
        elements.nextLocation.textContent = 'El calendario todavía no está disponible.';
        elements.nextDate.textContent = '—';
        elements.nextTime.textContent = '';
      }

      showLastRace(lastRace);
      showResults(lastRace);
      const season = nextRace?.season || lastRace?.season;
      if (season) elements.season.textContent = `TEMPORADA ${season}`;
      elements.dataStatus.textContent = `Datos actualizados: ${formatDate(new Date(), { hour: '2-digit', minute: '2-digit' })} · Fuente: Jolpica F1`;
    } catch (error) {
      console.error('No se pudieron actualizar los datos de Fórmula 1:', error);
      const message = error.name === 'AbortError'
        ? 'La consulta tardó demasiado. Revisá tu conexión e intentá de nuevo.'
        : 'No se pudieron cargar los datos. Revisá tu conexión e intentá de nuevo.';
      elements.dataStatus.textContent = message;
      if (!elements.resultsBody.children.length || elements.resultsBody.querySelector('.table-message')) {
        elements.resultsBody.replaceChildren();
        const row = document.createElement('tr');
        const cell = resultCell(message, 'table-message');
        cell.colSpan = 6;
        row.append(cell);
        elements.resultsBody.append(row);
      }
    } finally {
      requestInProgress = false;
      elements.refreshButton.disabled = false;
      elements.refreshButton.classList.remove('is-loading');
    }
  }

  elements.refreshButton.addEventListener('click', () => refreshData());
  refreshData();
  window.setInterval(() => refreshData({ quiet: true }), REFRESH_INTERVAL);
})();
