(() => {
  const API_BASE = 'https://api.jolpi.ca/ergast/f1';
  const REFRESH_INTERVAL = 5 * 60 * 1000;
  const REQUEST_TIMEOUT = 12_000;
  const CACHE_KEYS = {
    schedule: 'f1-race-results:schedule:v1',
    results: 'f1-race-results:results:v1',
  };
  const locale = 'es-AR';

  const elements = {
    season: document.getElementById('season-label'),
    seasonArt: document.getElementById('season-art'),
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
    scheduleStatus: document.getElementById('schedule-status'),
    resultsStatus: document.getElementById('results-status'),
    connectionStatus: document.getElementById('connection-status'),
    connectionLabel: document.getElementById('connection-label'),
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

  function localDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function formatTimestamp(timestamp) {
    return formatDate(new Date(timestamp), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

  function readCache(key, isValid) {
    try {
      const cached = JSON.parse(window.localStorage.getItem(key) || 'null');
      return cached && isValid(cached.data) ? cached : null;
    } catch (error) {
      console.warn('No se pudo leer la caché local de F1:', error);
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
      return true;
    } catch (error) {
      console.warn('No se pudo guardar la caché local de F1:', error);
      return false;
    }
  }

  function isRaceListResponse(data) {
    return Array.isArray(data?.MRData?.RaceTable?.Races);
  }

  function setSectionStatus(element, state, message) {
    element.dataset.state = state;
    element.textContent = message;
  }

  function setConnectionStatus() {
    const states = [elements.scheduleStatus.dataset.state, elements.resultsStatus.dataset.state];
    const hasFreshData = states.includes('fresh');
    const hasOutdatedOrMissingData = states.includes('stale') || states.includes('error');
    if ((hasFreshData && hasOutdatedOrMissingData) || (states.includes('stale') && states.includes('error'))) {
      elements.connectionStatus.dataset.state = 'partial';
      elements.connectionLabel.textContent = 'DATOS PARCIALMENTE ACTUALIZADOS';
    } else if (states.includes('stale')) {
      elements.connectionStatus.dataset.state = 'stale';
      elements.connectionLabel.textContent = 'MOSTRANDO DATOS GUARDADOS';
    } else if (states.includes('error')) {
      elements.connectionStatus.dataset.state = 'error';
      elements.connectionLabel.textContent = 'DATOS NO DISPONIBLES';
    } else if (states.every(state => state === 'fresh')) {
      elements.connectionStatus.dataset.state = 'fresh';
      elements.connectionLabel.textContent = 'DATOS ACTUALIZADOS';
    } else {
      elements.connectionStatus.dataset.state = 'loading';
      elements.connectionLabel.textContent = 'ACTUALIZANDO DATOS';
    }
  }

  function showScheduleUnavailable() {
    elements.nextRound.replaceChildren(document.createTextNode('—'));
    const roundLabel = document.createElement('span');
    roundLabel.textContent = 'RONDA';
    elements.nextRound.append(roundLabel);
    elements.nextSeason.textContent = 'CAMPEONATO MUNDIAL DE FÓRMULA 1';
    elements.nextName.textContent = 'Calendario no disponible';
    elements.nextLocation.textContent = 'No pudimos cargar la próxima carrera.';
    elements.nextDate.textContent = '—';
    elements.nextTime.textContent = '';
    elements.nextCircuit.textContent = 'Intentá actualizar dentro de unos minutos.';
    elements.countdown.textContent = 'SIN DATOS';
  }

  function showNoNextRace() {
    elements.nextRound.replaceChildren(document.createTextNode('—'));
    const roundLabel = document.createElement('span');
    roundLabel.textContent = 'RONDA';
    elements.nextRound.append(roundLabel);
    elements.nextSeason.textContent = 'CALENDARIO DE FÓRMULA 1';
    elements.nextName.textContent = 'No hay próxima carrera publicada';
    elements.nextLocation.textContent = 'El calendario todavía no anuncia otra fecha.';
    elements.nextDate.textContent = '—';
    elements.nextTime.textContent = '';
    elements.nextCircuit.textContent = 'Volvé a consultar más adelante.';
    elements.countdown.textContent = 'CALENDARIO F1';
  }

  function showNextRace(race) {
    if (!race) {
      showScheduleUnavailable();
      return;
    }

    const date = raceDate(race);
    const round = race.round ? Number(race.round) : null;
    elements.nextRound.replaceChildren(document.createTextNode(round ? String(round).padStart(2, '0') : '—'));
    const roundLabel = document.createElement('span');
    roundLabel.textContent = 'RONDA';
    elements.nextRound.append(roundLabel);

    elements.nextSeason.textContent = `${race.season || 'F1'} · CAMPEONATO MUNDIAL`;
    elements.nextName.textContent = race.raceName || 'Próxima carrera';
    elements.nextLocation.textContent = [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(', ') || 'Ubicación por confirmar';
    elements.nextCircuit.textContent = race.Circuit?.circuitName || 'Circuito por confirmar';

    if (race.season) {
      elements.season.textContent = `TEMPORADA ${race.season}`;
      elements.seasonArt.textContent = `FORMULA 1 · ${race.season}`;
    }

    if (!date) {
      elements.nextDate.textContent = 'Fecha por confirmar';
      elements.nextTime.textContent = '';
      elements.countdown.textContent = 'CALENDARIO F1';
      return;
    }

    elements.nextDate.textContent = formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    elements.nextTime.textContent = race.time
      ? `HORARIO LOCAL · ${formatDate(date, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}`
      : 'Horario por confirmar';

    const raceDay = localDateKey(date);
    const today = localDateKey(new Date());
    if (raceDay === today) {
      elements.countdown.textContent = 'HOY';
    } else if (raceDay > today) {
      const raceMidnight = Date.parse(`${raceDay}T00:00:00Z`);
      const todayMidnight = Date.parse(`${today}T00:00:00Z`);
      const days = Math.round((raceMidnight - todayMidnight) / 86_400_000);
      elements.countdown.textContent = days === 1 ? 'MAÑANA' : `EN ${days} DÍAS`;
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

  function addTeamCell(row, constructor) {
    const name = constructor?.name || 'Equipo no disponible';
    row.append(resultCell(name, `team-cell ${teamClass(name)}`));
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
      row.append(resultCell(result.positionText || result.position || '—', 'position-cell'));

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

      addTeamCell(row, result.Constructor);
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
    const dateText = date ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    elements.lastDetail.textContent = [race.Circuit?.Location?.country, dateText].filter(Boolean).join(' · ');
  }

  function showScheduleData(data) {
    const races = data?.MRData?.RaceTable?.Races;
    if (races?.[0]) showNextRace(races[0]);
    else showNoNextRace();
    const season = races?.[0]?.season;
    if (season) {
      elements.season.textContent = `TEMPORADA ${season}`;
      elements.seasonArt.textContent = `FORMULA 1 · ${season}`;
    }
  }

  function showResultsData(data) {
    const race = data?.MRData?.RaceTable?.Races?.[0] || null;
    showLastRace(race);
    showResults(race);
  }

  function applyScheduleOutcome(outcome) {
    if (outcome.status === 'fulfilled' && isRaceListResponse(outcome.value)) {
      writeCache(CACHE_KEYS.schedule, outcome.value);
      showScheduleData(outcome.value);
      setSectionStatus(elements.scheduleStatus, 'fresh', `Calendario actualizado · ${formatTimestamp(Date.now())}`);
      return;
    }

    const cached = readCache(CACHE_KEYS.schedule, isRaceListResponse);
    if (cached) {
      showScheduleData(cached.data);
      setSectionStatus(elements.scheduleStatus, 'stale', `Mostrando calendario guardado · actualizado ${formatTimestamp(cached.savedAt)}`);
      return;
    }

    showScheduleData(null);
    const timedOut = outcome.reason?.name === 'AbortError';
    setSectionStatus(elements.scheduleStatus, 'error', timedOut ? 'El calendario tardó demasiado y no hay datos guardados.' : 'No se pudo cargar el calendario y no hay datos guardados.');
  }

  function applyResultsOutcome(outcome) {
    if (outcome.status === 'fulfilled' && isRaceListResponse(outcome.value)) {
      writeCache(CACHE_KEYS.results, outcome.value);
      showResultsData(outcome.value);
      setSectionStatus(elements.resultsStatus, 'fresh', `Resultados actualizados · ${formatTimestamp(Date.now())}`);
      return;
    }

    const cached = readCache(CACHE_KEYS.results, isRaceListResponse);
    if (cached) {
      showResultsData(cached.data);
      setSectionStatus(elements.resultsStatus, 'stale', `Mostrando resultados guardados · actualizados ${formatTimestamp(cached.savedAt)}`);
      return;
    }

    showLastRace(null);
    showResults(null);
    const timedOut = outcome.reason?.name === 'AbortError';
    setSectionStatus(elements.resultsStatus, 'error', timedOut ? 'Los resultados tardaron demasiado y no hay datos guardados.' : 'No se pudieron cargar los resultados y no hay datos guardados.');
  }

  async function refreshData({ quiet = false } = {}) {
    if (requestInProgress) return;
    requestInProgress = true;
    elements.refreshButton.disabled = true;
    elements.refreshButton.classList.add('is-loading');
    if (!quiet) {
      setSectionStatus(elements.scheduleStatus, 'loading', 'Actualizando calendario...');
      setSectionStatus(elements.resultsStatus, 'loading', 'Actualizando resultados...');
      setConnectionStatus();
    }

    const outcomes = await Promise.allSettled([
      fetchJson(`${API_BASE}/current/next.json`),
      fetchJson(`${API_BASE}/current/last/results.json`),
    ]);
    applyScheduleOutcome(outcomes[0]);
    applyResultsOutcome(outcomes[1]);
    setConnectionStatus();

    requestInProgress = false;
    elements.refreshButton.disabled = false;
    elements.refreshButton.classList.remove('is-loading');
  }

  elements.refreshButton.addEventListener('click', () => refreshData());
  refreshData();
  window.setInterval(() => refreshData({ quiet: true }), REFRESH_INTERVAL);
})();
