import { groups, leagueFlags, leagueLogoCodes, leagues, tournamentConfig } from "./data.js";
import {
  buildKnockoutRounds,
  calculateStandings,
  createInitialState,
  generateBracket,
  getQualifiedTeams,
  isKnockoutMatchPlayed,
  isMatchPlayed,
  resetKnockoutResults,
  resetMatches,
  simulateKnockoutResults,
  simulateMatches,
  updateKnockoutScore,
  updateMatchScore
} from "./tournament.js?v=20260707-lineup-ux";
import { buildSquad } from "./squads.js";

const storageKey = "mundial-ligas-state-v2";
const lineupStorageKey = "mundial-ligas-custom-lineups-v1";
const formationLayouts = {
  "4-3-3": [4, 3, 3],
  "4-2-3-1": [4, 5, 1],
  "3-5-2": [3, 5, 2],
  "4-4-2": [4, 4, 2],
  "3-4-3": [3, 4, 3]
};
const app = document.querySelector("#app");
let state = loadState();
let customLineups = loadCustomLineups();
let logoAssetMap = new Map();
let selectedLeagueId = null;
let selectedLineupPick = null;

function render() {
  const standings = calculateStandings(state.matches);
  const selectedGroup = standings.find((group) => group.id === state.selectedGroupId) ?? standings[0];
  const landingGroup = standings[0];
  const qualified = getQualifiedTeams(standings);
  const bracket = generateBracket(qualified);
  const knockoutRounds = buildKnockoutRounds(bracket, state.knockoutResults);
  const playedMatches = state.matches.filter(isMatchPlayed).length;
  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId);
  const selectedSquad = selectedLeague ? applyCustomLineup(selectedLeague, buildSquad(selectedLeague)) : null;

  app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">${footballIcon()}</span>
        <strong>${tournamentConfig.name}</strong>
      </div>
      <nav class="tabs" aria-label="Secciones">
        <a href="#inicio">Inicio</a>
        <a href="#grupos">Fase de grupos</a>
        <a href="#simulacion">Simulacion</a>
        <a href="#clasificados">Clasificados</a>
        <a href="#bracket">Llaves</a>
        <a href="#ligas">Plantillas</a>
      </nav>
      <div class="season-select">${tournamentConfig.editionName}</div>
    </header>

    ${renderLandingHero(landingGroup, playedMatches, qualified.all.length)}
    ${renderJourneyGuide()}
    ${renderPublicNotice()}

    <main class="layout">
      <aside class="sidebar">
        <section class="quick-stats" aria-label="Resumen rapido">
          <div><strong>${leagues.length}</strong><span>ligas</span></div>
          <div><strong>${groups.length}</strong><span>grupos</span></div>
          <div><strong>${playedMatches}</strong><span>jugados</span></div>
        </section>

        <section>
          <h2>Grupos</h2>
          <div class="group-list">
            ${groups
              .map(
                (group) => `
                  <button class="group-button ${group.id === selectedGroup.id ? "active" : ""}" data-action="select-group" data-group-id="${group.id}">
                    ${groupIcon()} Grupo ${group.id}
                  </button>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="summary">
          <h2>Formato</h2>
          <dl>
            <div><dt>Fase inicial</dt><dd>${tournamentConfig.groupCount} grupos x ${tournamentConfig.teamsPerGroup}</dd></div>
            <div><dt>Clasifican</dt><dd>1°, 2° y ${tournamentConfig.bestThirds} mejores 3°</dd></div>
            <div><dt>Partidos grupo</dt><dd>${state.matches.length}</dd></div>
            <div><dt>Equipos en llaves</dt><dd>${qualified.all.length}</dd></div>
            <div><dt>Plantel futuro</dt><dd>${tournamentConfig.squadSize} jugadores</dd></div>
          </dl>
        </section>
      </aside>

      <section class="workspace">
        <div class="section-header">
          <div>
            <p class="section-label">Grupo seleccionado</p>
            <h1>Grupo ${selectedGroup.id}</h1>
          </div>
          <div class="actions">
            <button class="button secondary" data-action="reset-group">Reiniciar grupo</button>
            <button class="button secondary" data-action="simulate-group">Simular grupo</button>
            <button class="button primary" data-action="simulate-all">Simular torneo</button>
          </div>
        </div>

        <article class="panel" id="grupos">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Liga</th>
                  <th>Region</th>
                  <th>Nivel</th>
                  <th>Pts</th>
                  <th>PJ</th>
                  <th>PG</th>
                  <th>PE</th>
                  <th>PP</th>
                  <th>GF</th>
                  <th>GC</th>
                  <th>DG</th>
                </tr>
              </thead>
              <tbody>
                ${selectedGroup.rows.map(renderStandingRow).join("")}
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel" id="simulacion">
          <div class="panel-title">
            <h2>Partidos</h2>
            <span>${selectedGroup.matches.filter(isMatchPlayed).length} de ${selectedGroup.matches.length} finalizados</span>
          </div>
          <div class="fixtures">
            ${selectedGroup.matches.map(renderMatch).join("")}
          </div>
        </article>

        ${renderBracketSection(bracket, qualified, playedMatches, knockoutRounds)}

        <article class="panel" id="ligas">
          <div class="panel-title">
            <h2>Ligas y bombos</h2>
            <span>Ranking editable en futura version</span>
          </div>
          <div class="pots">
            ${[1, 2, 3, 4]
              .map(
                (pot) => `
                  <div class="pot">
                    <h3>Bombo ${pot}</h3>
                    ${leagues
                      .filter((league) => league.pot === pot)
                      .map((league) => `<span class="pot-item">${teamButton(league)} <strong>${league.level}</strong></span>`)
                      .join("")}
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      </section>

      <aside class="rightbar">
        <section class="panel compact" id="clasificados">
          <div class="panel-title">
            <h2>Clasificados</h2>
            <strong>${qualified.all.length}/32</strong>
          </div>
          <div class="qualified-counts">
            <div><span>1° y 2°</span><strong>${qualified.direct.length}</strong></div>
            <div><span>Mejores 3°</span><strong>${qualified.bestThirds.length}</strong></div>
          </div>
          <h3>Mejores terceros</h3>
          <ol class="thirds">
            ${qualified.bestThirds.map((team) => renderQualifiedTeam(team)).join("")}
          </ol>
        </section>

        <section class="panel compact" id="bracket-preview">
          <div class="panel-title">
            <h2>Llaves 32</h2>
            <span>Vista previa</span>
          </div>
          <div class="bracket">
            ${bracket.map(renderBracketMatch).join("")}
          </div>
        </section>
      </aside>
    </main>

    <footer class="statusbar">
      <span>Simulacion: <strong>${playedMatches === state.matches.length ? "Completa" : "Activa"}</strong></span>
      <span>Ultima simulacion: ${state.lastSimulationAt ?? "sin ejecutar"}</span>
      <span>Prototipo no oficial</span>
      <button class="link-button" data-action="reset-all">Reiniciar todo</button>
    </footer>

    ${selectedLeague && selectedSquad ? renderSquadPanel(selectedLeague, selectedSquad) : ""}
  `;
}

function renderLandingHero(group, playedMatches, qualifiedCount) {
  const upcomingMatches = state.matches.filter((match) => !isMatchPlayed(match)).slice(0, 2);
  return `
    <section class="landing-hero" id="inicio">
      <div class="hero-copy">
        <h1>Mundial de Ligas de Futbol</h1>
        <p class="hero-lead">La copa que enfrenta ligas, no clubes</p>
        <p class="hero-text">Explora 48 ligas, simula la fase de grupos y abre cada plantilla para ver titulares y suplentes.</p>
        <div class="hero-actions">
          <a class="button primary hero-cta" href="#grupos">${trophyIcon()} Entrar a fase de grupos</a>
          <a class="button secondary hero-cta" href="#ligas">${globeIcon()} Ver ligas</a>
        </div>
      </div>

      <aside class="hero-preview" aria-label="Vista previa del torneo">
        <div class="hero-preview-header">
          <h2>Fase de grupos</h2>
          <span>${playedMatches === state.matches.length ? "Completa" : "En curso"}</span>
        </div>
        <div class="hero-preview-grid">
          <div class="mini-standings">
            <h3>Grupo ${group.id}</h3>
            ${group.rows
              .slice(0, 4)
              .map(
                (row) => `
                  <div class="mini-standing-row">
                    <span>${row.position}</span>
                    ${teamButton(row.league)}
                    <strong>${row.points}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="mini-fixtures">
            <h3>Proximos partidos</h3>
            ${upcomingMatches.map(renderHeroMatch).join("")}
          </div>
        </div>
        <div class="hero-stats">
          <div><strong>${leagues.length}</strong><span>ligas</span></div>
          <div><strong>${groups.length}</strong><span>grupos</span></div>
          <div><strong>${qualifiedCount}</strong><span>clasificados</span></div>
          <div><strong>${playedMatches}</strong><span>jugados</span></div>
        </div>
      </aside>
    </section>
  `;
}

function renderHeroMatch(match) {
  const home = leagues.find((league) => league.id === match.homeLeagueId);
  const away = leagues.find((league) => league.id === match.awayLeagueId);
  return `
    <div class="hero-match">
      ${teamButton(home)}
      <span>vs</span>
      ${teamButton(away)}
    </div>
  `;
}

function renderJourneyGuide() {
  const steps = [
    ["1", "Revisar grupos", "Explora los grupos y conoce a las 48 ligas participantes.", groupIcon()],
    ["2", "Simular partidos", "Ejecuta resultados por grupo o simula el torneo completo.", playIcon()],
    ["3", "Ver clasificados", "Sigue directos y mejores terceros antes del cuadro final.", podiumIcon()],
    ["4", "Explorar llaves", "Consulta los cruces proyectados de la ronda de 32.", trophyIcon()],
    ["5", "Abrir plantillas", "Entra a cada liga para ver formacion titular y suplentes.", shirtIcon()]
  ];

  return `
    <section class="journey-guide" aria-label="Guia del torneo">
      <div class="journey-title">
        <h2>5 pasos para vivir la experiencia</h2>
        <p>La app te acompaña desde la fase de grupos hasta la lectura de cada plantilla.</p>
      </div>
      <div class="journey-steps">
        ${steps
          .map(
            ([number, title, text, icon]) => `
              <a class="journey-step" href="${journeyStepTarget(number)}">
                <span class="journey-icon">${icon}</span>
                <strong>${number}. ${title}</strong>
                <span>${text}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function journeyStepTarget(number) {
  const targets = {
    1: "#grupos",
    2: "#simulacion",
    3: "#clasificados",
    4: "#bracket",
    5: "#ligas"
  };
  return targets[number] ?? "#inicio";
}

function renderPublicNotice() {
  return `
    <section class="public-notice" aria-label="Aviso de proyecto no oficial">
      <strong>Prototipo no oficial.</strong>
      <span>No afiliado ni aprobado por organizaciones, ligas, clubes o jugadores. Logos, nombres y marcas pertenecen a sus titulares; resultados y plantillas son datos de simulacion.</span>
    </section>
  `;
}

function renderStandingRow(row) {
  const qualifiedClass = row.position <= tournamentConfig.promotedPerGroup ? "direct" : row.position === 3 ? "third" : "";
  return `
    <tr class="${qualifiedClass}">
      <td>${row.position}</td>
      <td>${teamButton(row.league)}</td>
      <td>${row.league.region}</td>
      <td>${row.league.level}</td>
      <td><strong>${row.points}</strong></td>
      <td>${row.played}</td>
      <td>${row.won}</td>
      <td>${row.drawn}</td>
      <td>${row.lost}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td class="${row.goalDifference >= 0 ? "positive" : "negative"}">${formatSigned(row.goalDifference)}</td>
    </tr>
  `;
}

function renderMatch(match) {
  const home = leagues.find((league) => league.id === match.homeLeagueId);
  const away = leagues.find((league) => league.id === match.awayLeagueId);
  const status = isMatchPlayed(match) ? "Finalizado" : "Pendiente";

  return `
    <div class="fixture ${isMatchPlayed(match) ? "played" : ""}">
      <span class="round">F${match.round}</span>
      <span class="club home">${teamButton(home)}</span>
      <input aria-label="Goles ${home.name}" inputmode="numeric" min="0" max="12" type="number" value="${match.homeGoals ?? ""}" data-action="score" data-match-id="${match.id}" data-side="home" />
      <span class="separator">:</span>
      <input aria-label="Goles ${away.name}" inputmode="numeric" min="0" max="12" type="number" value="${match.awayGoals ?? ""}" data-action="score" data-match-id="${match.id}" data-side="away" />
      <span class="club away">${teamButton(away)}</span>
      <button class="mini-button" data-action="simulate-match" data-match-id="${match.id}">${status}</button>
    </div>
  `;
}

function renderQualifiedTeam(team) {
  return `
    <li>
      <span class="group-tag">${team.groupId}</span>
      ${teamButton(team.league)}
      <em>${team.points} pts · ${formatSigned(team.goalDifference)}</em>
    </li>
  `;
}

function renderBracketSection(bracket, qualified, playedMatches, knockoutRounds) {
  const isComplete = playedMatches === state.matches.length;
  const projectedLabel = isComplete ? "Cuadro definido" : "Proyeccion en vivo";
  const bracketSlots = bracket.flatMap((match) => [match.home, match.away]).filter(Boolean).length;
  const playedKnockoutMatches = knockoutRounds.flat().filter(isKnockoutMatchPlayed).length;
  const champion = knockoutRounds.at(-1)?.[0]?.winner;

  return `
    <span class="section-anchor" id="llaves"></span>
    <article class="panel bracket-section" id="bracket">
      <div class="panel-title bracket-section-title">
        <div>
          <h2>Llaves de eliminacion directa</h2>
          <span>${projectedLabel}: ronda de 32 con cruces por ranking de clasificacion</span>
        </div>
        <div class="bracket-status">
          <strong>${champion ? champion.league.name : `${playedKnockoutMatches}/31`}</strong>
          <span>${champion ? "campeon simulado" : "partidos definidos"}</span>
        </div>
      </div>

      <div class="bracket-explainer">
        <div>
          <strong>${qualified.direct.length}</strong>
          <span>clasificados directos</span>
        </div>
        <div>
          <strong>${qualified.bestThirds.length}</strong>
          <span>mejores terceros</span>
        </div>
        <div>
          <strong>${bracket.length}</strong>
          <span>cruces iniciales</span>
        </div>
      </div>

      <div class="circular-bracket" aria-label="Camino circular de llaves">
        <div class="bracket-orbit orbit-r32" aria-hidden="true"></div>
        <div class="bracket-orbit orbit-r16" aria-hidden="true"></div>
        <div class="bracket-orbit orbit-qf" aria-hidden="true"></div>
        <div class="bracket-orbit orbit-sf" aria-hidden="true"></div>
        <div class="bracket-core">
          <span>Camino al titulo</span>
          <strong>Final</strong>
          <em>Campeon de ligas</em>
        </div>
        ${renderBracketPathLinks(bracket.length)}
        ${knockoutRounds[0].map((match, index) => renderCircularBracketMatch(match, index, bracket.length)).join("")}
        ${renderCircularPathNodes(bracket.length, knockoutRounds)}
      </div>

      ${renderKnockoutSimulator(knockoutRounds, bracketSlots)}
    </article>
  `;
}

function renderCircularBracketMatch(match, index, total) {
  const baseAngle = -90 + (360 / total) * index;
  const homePosition = pointToStyle(polarPoint(baseAngle - 4.2, 43));
  const awayPosition = pointToStyle(polarPoint(baseAngle + 4.2, 43));
  const matchPosition = pointToStyle(polarPoint(baseAngle, 34));

  return `
    ${renderCircularSeed(match.home, homePosition, "home")}
    ${renderCircularSeed(match.away, awayPosition, "away")}
    <div class="match-spoke" style="--x:${matchPosition.x};--y:${matchPosition.y};--angle:${baseAngle}deg">
      <span>${match.slot}</span>
    </div>
  `;
}

function renderCircularPathNodes(total, knockoutRounds) {
  const r16Nodes = Array.from({ length: total / 2 }, (_, index) =>
    renderPathNode("r16", index + 1, "O", -90 + (360 / total) * (index * 2 + 0.5), 29, knockoutRounds[1]?.[index])
  );
  const qfNodes = Array.from({ length: total / 4 }, (_, index) =>
    renderPathNode("qf", index + 1, "C", -90 + (360 / total) * (index * 4 + 1.5), 21, knockoutRounds[2]?.[index])
  );
  const sfNodes = Array.from({ length: total / 8 }, (_, index) =>
    renderPathNode("sf", index + 1, "S", -90 + (360 / total) * (index * 8 + 3.5), 13, knockoutRounds[3]?.[index])
  );

  return [...r16Nodes, ...qfNodes, ...sfNodes].join("");
}

function renderBracketPathLinks(total) {
  const matchAngles = Array.from({ length: total }, (_, index) => -90 + (360 / total) * index);
  const r16Angles = Array.from({ length: total / 2 }, (_, index) => -90 + (360 / total) * (index * 2 + 0.5));
  const qfAngles = Array.from({ length: total / 4 }, (_, index) => -90 + (360 / total) * (index * 4 + 1.5));
  const sfAngles = Array.from({ length: total / 8 }, (_, index) => -90 + (360 / total) * (index * 8 + 3.5));
  const finalPoint = { x: 50, y: 50 };

  const links = [
    ...renderOrbitConnections(matchAngles, 34, r16Angles, 29, "route-r32"),
    ...renderOrbitConnections(r16Angles, 29, qfAngles, 21, "route-r16"),
    ...renderOrbitConnections(qfAngles, 21, sfAngles, 13, "route-qf"),
    ...sfAngles.map((angle) => renderRouteLine(polarPoint(angle, 13), finalPoint, "route-sf route-radial"))
  ];

  return `
    <svg class="bracket-route-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      ${links.join("")}
    </svg>
  `;
}

function renderOrbitConnections(fromAngles, fromRadius, toAngles, toRadius, className) {
  return toAngles.flatMap((toAngle, index) => {
    const firstAngle = fromAngles[index * 2];
    const secondAngle = fromAngles[index * 2 + 1];
    const mergePoint = polarPoint(toAngle, fromRadius);
    const targetPoint = polarPoint(toAngle, toRadius);

    return [
      renderRouteArc(firstAngle, secondAngle, fromRadius, `${className} route-orbit`),
      renderRouteLine(mergePoint, targetPoint, `${className} route-radial`)
    ];
  });
}

function renderRouteArc(fromAngle, toAngle, radius, className) {
  const from = polarPoint(fromAngle, radius);
  const to = polarPoint(toAngle, radius);
  const sweep = normalizeAngle(toAngle - fromAngle) <= 180 ? 1 : 0;
  return `<path class="${className}" d="M ${from.x} ${from.y} A ${radius} ${radius} 0 0 ${sweep} ${to.x} ${to.y}" />`;
}

function renderRouteLine(from, to, className) {
  return `<line class="${className}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`;
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function renderCircularSeed(team, position, side) {
  if (!team) {
    return `
      <div class="circular-seed empty ${side}" style="--x:${position.x};--y:${position.y}">
        <span>PD</span>
      </div>
    `;
  }

  return `
    <button class="circular-seed ${side}" data-action="open-squad" data-league-id="${team.league.id}" style="--x:${position.x};--y:${position.y}" title="${team.seed}. ${team.league.name}">
      <span class="seed-rank">${team.seed}</span>
      ${leagueLogo(team.league)}
      ${leagueFlagBadge(team.league)}
      <span class="seed-name">${team.league.name}</span>
    </button>
  `;
}

function renderPathNode(phase, number, label, angle, radius, match) {
  const position = pointToStyle(polarPoint(angle, radius));
  const winner = match?.winner;
  return `
    <div class="path-node path-${phase} ${winner ? "resolved" : ""}" style="--x:${position.x};--y:${position.y};--angle:${angle}deg" title="${winner ? winner.league.name : `${label}${number}`}">
      ${winner ? leagueLogo(winner.league) : `<span>${label}${number}</span>`}
    </div>
  `;
}

function renderKnockoutSimulator(rounds, bracketSlots) {
  const isReady = bracketSlots === 32;
  const champion = rounds.at(-1)?.[0]?.winner;

  return `
    <section class="knockout-simulator" aria-label="Simulacion de llaves">
      <div class="knockout-toolbar">
        <div>
          <h3>Simulacion de llaves</h3>
          <span>${champion ? `Campeon: ${champion.league.name}` : "Carga resultados o simula fase por fase."}</span>
        </div>
        <div class="knockout-actions">
          <button class="button secondary" data-action="reset-knockout" ${isReady ? "" : "disabled"}>Reiniciar llaves</button>
          <button class="button secondary" data-action="simulate-knockout-next" ${isReady && !champion ? "" : "disabled"}>Simular siguiente fase</button>
          <button class="button primary" data-action="simulate-knockout-all" ${isReady && !champion ? "" : "disabled"}>Simular llaves</button>
        </div>
      </div>
      ${isReady ? rounds.map(renderKnockoutRound).join("") : `<p class="knockout-empty">Primero deben estar definidos los 32 clasificados.</p>`}
    </section>
  `;
}

function renderKnockoutRound(round) {
  return `
    <div class="knockout-round">
      <h4>${round[0]?.round ?? "Fase"}</h4>
      <div class="knockout-games">
        ${round.map(renderKnockoutGame).join("")}
      </div>
    </div>
  `;
}

function renderKnockoutGame(match) {
  const canPlay = Boolean(match.home && match.away);
  const status = match.winner ? "Finalizado" : canPlay ? "Simular" : "Pendiente";

  return `
    <div class="knockout-game ${match.winner ? "played" : ""} ${canPlay ? "" : "locked"}">
      <span class="round">${match.roundKey}${match.slot}</span>
      <span class="club home">${match.home ? teamButton(match.home.league) : "Por definir"}</span>
      <input aria-label="Goles ${match.home?.league.name ?? "local"}" inputmode="numeric" min="0" max="12" type="number" value="${match.result.homeGoals ?? ""}" data-action="knockout-score" data-match-id="${match.id}" data-side="home" ${canPlay ? "" : "disabled"} />
      <span class="separator">:</span>
      <input aria-label="Goles ${match.away?.league.name ?? "visitante"}" inputmode="numeric" min="0" max="12" type="number" value="${match.result.awayGoals ?? ""}" data-action="knockout-score" data-match-id="${match.id}" data-side="away" ${canPlay ? "" : "disabled"} />
      <span class="club away">${match.away ? teamButton(match.away.league) : "Por definir"}</span>
      <button class="mini-button" data-action="simulate-knockout-match" data-match-id="${match.id}" ${canPlay && !match.winner ? "" : "disabled"}>${status}</button>
    </div>
  `;
}

function polarPoint(angle, radius) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Number((50 + Math.cos(radians) * radius).toFixed(3)),
    y: Number((50 + Math.sin(radians) * radius).toFixed(3))
  };
}

function pointToStyle(point) {
  return {
    x: `${point.x}%`,
    y: `${point.y}%`
  };
}

function renderBracketMatch(match) {
  return `
    <div class="bracket-match">
      <span>${match.slot}</span>
      <div>
        ${renderSeed(match.home)}
        ${renderSeed(match.away)}
      </div>
    </div>
  `;
}

function renderSeed(team) {
  if (!team) return `<strong class="seed-team empty">Por definir</strong>`;
  return `
    <strong class="seed-team">
      ${teamButton(team.league, `${team.seed}.`)}
    </strong>
  `;
}

function renderSquadPanel(league, squad) {
  const selectedPlayer = selectedLineupPick?.leagueId === league.id
    ? [...squad.starters, ...squad.substitutes].find((player) => player.id === selectedLineupPick.playerId)
    : null;
  return `
    <div class="squad-overlay">
      <button class="squad-backdrop" data-action="close-squad" aria-label="Cerrar plantilla"></button>
      <aside class="squad-panel" role="dialog" aria-modal="true" aria-label="Plantilla de ${league.name}">
        <header class="squad-header">
          <div>
            <span class="squad-kicker">Plantilla de liga</span>
            <h2>${leagueLogo(league)} ${leagueFlagBadge(league)} ${league.name}</h2>
            <p>${league.region} · Nivel ${league.level} · Formacion ${squad.formation}</p>
          </div>
          <button class="icon-button" data-action="close-squad" aria-label="Cerrar">×</button>
        </header>

        <section class="squad-metrics" aria-label="Resumen de plantilla">
          <div><strong>${squad.totalPlayers}</strong><span>convocados</span></div>
          <div><strong>${squad.averageRating}</strong><span>media</span></div>
          <div><strong>${squad.starters.length}</strong><span>titulares</span></div>
          <div><strong>${squad.substitutes.length}</strong><span>suplentes</span></div>
        </section>

        <p class="squad-note">${squad.sourceNote}</p>

        <section class="lineup-editor" aria-label="Editor de formacion">
          <div class="lineup-controls">
            <label>
              <span>Esquema</span>
              <select data-action="change-formation" data-league-id="${league.id}">
                ${renderFormationOptions(squad.formation)}
              </select>
            </label>
            <button class="button secondary" data-action="reset-lineup" data-league-id="${league.id}" ${squad.hasCustomLineup ? "" : "disabled"}>Restaurar</button>
          </div>
          <p>${selectedPlayer ? `Seleccionado: ${selectedPlayer.name}. Elegi otro jugador para intercambiar.` : "Selecciona dos jugadores para intercambiar titular, suplente o posicion."}</p>
        </section>

        <section class="formation-board" aria-label="Formacion titular ${squad.formation}">
          ${renderFormationBoard(league, squad)}
        </section>

        <section class="squad-section">
          <div class="squad-section-title">
            <h3>XI titular</h3>
            <span>${squad.formation}</span>
          </div>
          <div class="player-list starters">
            ${squad.starters.map((player) => renderPlayerRow(league, player, player.id === squad.captainId, "Titular")).join("")}
          </div>
        </section>

        <section class="squad-section">
          <div class="squad-section-title">
            <h3>Suplentes</h3>
            <span>${squad.substitutes.length} jugadores</span>
          </div>
          <div class="player-list bench">
            ${squad.substitutes.map((player) => renderPlayerRow(league, player, false, "Suplente")).join("")}
          </div>
        </section>
      </aside>
    </div>
  `;
}

function renderFormationOptions(selectedFormation) {
  return Object.keys(formationLayouts)
    .map((formation) => `<option value="${formation}" ${formation === selectedFormation ? "selected" : ""}>${formation}</option>`)
    .join("");
}

function renderFormationBoard(league, squad) {
  return getFormationLines(squad.starters, squad.formation)
    .map(([label, players]) => renderFormationLine(league, label, players))
    .join("");
}

function renderFormationLine(league, label, players) {
  return `
    <div class="formation-line" aria-label="${label}">
      ${players
        .map(
          (player) => `
            <button class="pitch-player ${isSelectedLineupPlayer(league.id, player.id) ? "selected" : ""}" data-action="select-lineup-player" data-league-id="${league.id}" data-player-id="${player.id}" type="button">
              <strong>${player.shirtNumber}</strong>
              <span>${player.position} ${playerNationalityBadge(player)}</span>
              <em>${shortName(player.name)}</em>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderPlayerRow(league, player, isCaptain, squadRole) {
  return `
    <button class="player-row ${isSelectedLineupPlayer(league.id, player.id) ? "selected" : ""}" data-action="select-lineup-player" data-league-id="${league.id}" data-player-id="${player.id}" type="button">
      <span class="shirt-number">${player.shirtNumber}</span>
      <div>
        <strong>${playerNationalityBadge(player)} ${player.name}${isCaptain ? " (C)" : ""}</strong>
        <span>${squadRole} · ${player.role} · ${player.club}</span>
      </div>
      <em>${player.position}</em>
      <b>${player.rating}</b>
    </button>
  `;
}

function isSelectedLineupPlayer(leagueId, playerId) {
  return selectedLineupPick?.leagueId === leagueId && selectedLineupPick.playerId === playerId;
}

function playerNationalityBadge(player) {
  const nationality = player.nationality ?? { code: "N/A", country: "Sin definir", emoji: "🏳️" };
  return `
    <span class="player-flag" title="${nationality.country}" aria-label="${nationality.country}">
      ${countryFlagImage(nationality.code, nationality.emoji, "player-flag-image")}
    </span>
  `;
}

function teamButton(league, prefix = "") {
  return `
    <button class="team-link" data-action="open-squad" data-league-id="${league.id}">
      ${leagueLogo(league)}
      ${leagueFlagBadge(league)}
      <span>${prefix ? `${prefix} ` : ""}${league.name}</span>
    </button>
  `;
}

function leagueLogo(league) {
  const assetPath = logoAssetMap.get(league.id);
  const code = leagueLogoCodes[league.id] ?? makeLogoCode(league.name);
  const palette = logoPalette(league.name);
  const shape = Math.abs(hashCode(league.id)) % 3;

  return `
    <span class="league-logo" role="img" aria-label="Logo de ${league.name}" style="--logo-a:${palette[0]};--logo-b:${palette[1]}">
      ${
        assetPath
          ? `<img src="./${assetPath}" alt="" loading="lazy" onerror="this.remove();" />`
          : ""
      }
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        ${shape === 0 ? '<path class="logo-shape" d="M20 3 33 10v20l-13 7-13-7V10L20 3Z" />' : ""}
        ${shape === 1 ? '<circle class="logo-shape" cx="20" cy="20" r="16" />' : ""}
        ${shape === 2 ? '<path class="logo-shape" d="M8 7h24l-2 22-10 5-10-5L8 7Z" />' : ""}
        <path class="logo-cut" d="M20 9 28 14v12l-8 5-8-5V14l8-5Z" />
        <text x="20" y="${code.length > 2 ? 23 : 24}" text-anchor="middle">${code}</text>
      </svg>
    </span>
  `;
}

function leagueFlagBadge(league) {
  const flags = leagueFlags[league.id] ?? [{ emoji: "🏳️", twemoji: "1f3f3-fe0f" }];
  return `
    <span class="country-flag" title="${league.region}" aria-label="${league.region}">
      ${flags
        .map(
          (flag) => `<span class="emoji-flag">${emojiFlagImage(flag.emoji, "league-flag-image")}</span>`
        )
        .join("")}
    </span>
  `;
}

function countryFlagImage(countryCode, fallbackEmoji, className) {
  const flagCode = flagAssetCodeByCountryCode[countryCode] ?? countryCode.toLowerCase();
  return flagImage(flagCode, fallbackEmoji, className);
}

function emojiFlagImage(emoji, className) {
  const flagCode = flagAssetCodeFromEmoji(emoji);
  return flagCode ? flagImage(flagCode, emoji, className) : `<span aria-hidden="true">${emoji}</span>`;
}

function flagImage(flagCode, fallbackEmoji, className) {
  return `<img class="${className}" src="https://flagcdn.com/w40/${flagCode}.png" srcset="https://flagcdn.com/w80/${flagCode}.png 2x" alt="" aria-hidden="true" loading="lazy" onerror="this.replaceWith(document.createTextNode('${fallbackEmoji}'))" />`;
}

function flagAssetCodeFromEmoji(emoji) {
  const subdivisionCodes = {
    "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "gb-eng",
    "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "gb-sct",
    "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "gb-wls"
  };
  if (subdivisionCodes[emoji]) return subdivisionCodes[emoji];

  const codePoints = [...emoji].map((part) => part.codePointAt(0));
  const regionalIndicators = codePoints.filter((point) => point >= 0x1f1e6 && point <= 0x1f1ff);
  if (regionalIndicators.length !== 2) return null;

  return regionalIndicators
    .map((point) => String.fromCharCode(point - 0x1f1e6 + 97))
    .join("");
}

const flagAssetCodeByCountryCode = {
  ENG: "gb-eng",
  SCT: "gb-sct",
  WAL: "gb-wls"
};

function makeLogoCode(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function logoPalette(name) {
  const palettes = [
    ["#0a6d36", "#8fd05b"],
    ["#1f5f99", "#62b7df"],
    ["#9d2f2f", "#f0b45d"],
    ["#d59621", "#5d3e16"],
    ["#573c92", "#d9c7ff"],
    ["#2f6f73", "#8cd4cf"],
    ["#0f3d64", "#f2cf5b"],
    ["#7a1f46", "#f3a5c4"]
  ];

  return palettes[Math.abs(hashCode(name)) % palettes.length];
}

async function loadLogoManifest() {
  try {
    const response = await fetch("./assets/leagues/manifest.json", { cache: "no-store" });
    if (!response.ok) return;

    const manifest = await response.json();
    logoAssetMap = new Map(
      (manifest.assets ?? [])
        .filter((asset) => asset.status === "downloaded")
        .map((asset) => [asset.leagueId, asset.file])
    );

    if (logoAssetMap.size > 0) render();
  } catch {
    logoAssetMap = new Map();
  }
}

function footballIcon() {
  return `<svg viewBox="0 0 24 24" role="img" aria-label="Balon"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="m12 7 4 3-1.5 5h-5L8 10l4-3Z" fill="currentColor"/><path d="M4.8 10.2 8 10m8 0 3.2.2M9.5 15 7.7 19m6.8-4 1.8 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

function trophyIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h8v3c0 3-1.5 5-4 5S6 9 6 6V3Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M6 5H3.5c0 2 .8 3.4 2.7 4M14 5h2.5c0 2-.8 3.4-2.7 4M10 11v3M7 17h6M8 14h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
}

function globeIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h14M10 3c2 2 3 4.3 3 7s-1 5-3 7M10 3c-2 2-3 4.3-3 7s1 5 3 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

function groupIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="7" r="3"/><circle cx="13" cy="7" r="3"/><path d="M3 17c.5-3 2-5 4-5s3.5 2 4 5M9 17c.5-3 2-5 4-5s3.5 2 4 5"/></svg>`;
}

function playIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 6.8 13 10l-5 3.2V6.8Z" fill="currentColor"/></svg>`;
}

function podiumIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 17h4v-6H3v6ZM8 17h4V7H8v10ZM13 17h4v-8h-4v8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

function shirtIcon() {
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3 4 5 2.5 8l3 1.7V17h9V9.7l3-1.7L16 5l-3-2c-.6 1-1.6 1.5-3 1.5S7.6 4 7 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

function shortName(name) {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : name;
}

function hashCode(value) {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored?.matches?.length) {
      return {
        ...stored,
        knockoutResults: stored.knockoutResults ?? {}
      };
    }
  } catch {
    localStorage.removeItem(storageKey);
  }
  return createInitialState();
}

function loadCustomLineups() {
  try {
    const stored = JSON.parse(localStorage.getItem(lineupStorageKey));
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    localStorage.removeItem(lineupStorageKey);
    return {};
  }
}

function persistCustomLineups() {
  localStorage.setItem(lineupStorageKey, JSON.stringify(customLineups));
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function updateState(nextState) {
  state = nextState;
  persist();
  render();
}

function applyCustomLineup(league, squad) {
  const customLineup = customLineups[league.id];
  if (!customLineup) return { ...squad, hasCustomLineup: false };

  const allPlayers = [...squad.starters, ...squad.substitutes];
  const playersById = new Map(allPlayers.map((player) => [player.id, player]));
  const starterIds = normalizeLineupIds(customLineup.starters, squad.starters.map((player) => player.id), playersById, 11);
  const starterIdSet = new Set(starterIds);
  const preferredSubstituteIds = Array.isArray(customLineup.substitutes) ? customLineup.substitutes : [];
  const substituteIds = [
    ...preferredSubstituteIds.filter((playerId) => playersById.has(playerId) && !starterIdSet.has(playerId)),
    ...allPlayers.map((player) => player.id).filter((playerId) => !starterIdSet.has(playerId) && !preferredSubstituteIds.includes(playerId))
  ];
  const formation = formationLayouts[customLineup.formation] ? customLineup.formation : squad.formation;

  return {
    ...squad,
    formation,
    starters: starterIds.map((playerId) => playersById.get(playerId)),
    substitutes: substituteIds.map((playerId) => playersById.get(playerId)),
    hasCustomLineup: true
  };
}

function normalizeLineupIds(candidateIds, fallbackIds, playersById, expectedCount) {
  const validIds = [];
  const seenIds = new Set();
  const sourceIds = Array.isArray(candidateIds) && candidateIds.length ? candidateIds : fallbackIds;

  for (const playerId of sourceIds) {
    if (playersById.has(playerId) && !seenIds.has(playerId)) {
      validIds.push(playerId);
      seenIds.add(playerId);
    }
  }

  for (const playerId of fallbackIds) {
    if (validIds.length >= expectedCount) break;
    if (playersById.has(playerId) && !seenIds.has(playerId)) {
      validIds.push(playerId);
      seenIds.add(playerId);
    }
  }

  return validIds.slice(0, expectedCount);
}

function getLineupConfig(leagueId) {
  const league = leagues.find((item) => item.id === leagueId);
  if (!league) return null;

  const squad = applyCustomLineup(league, buildSquad(league));
  return {
    formation: squad.formation,
    starters: squad.starters.map((player) => player.id),
    substitutes: squad.substitutes.map((player) => player.id)
  };
}

function updateLineupConfig(leagueId, updater, options = {}) {
  const currentConfig = getLineupConfig(leagueId);
  if (!currentConfig) return;

  const nextConfig = updater({
    formation: currentConfig.formation,
    starters: [...currentConfig.starters],
    substitutes: [...currentConfig.substitutes]
  });

  customLineups = {
    ...customLineups,
    [leagueId]: nextConfig
  };
  persistCustomLineups();
  renderSquadUpdate(options);
}

function resetLineupConfig(leagueId, options = {}) {
  const { [leagueId]: _removed, ...rest } = customLineups;
  customLineups = rest;
  selectedLineupPick = selectedLineupPick?.leagueId === leagueId ? null : selectedLineupPick;
  persistCustomLineups();
  renderSquadUpdate(options);
}

function handleLineupPlayerSelection(leagueId, playerId) {
  if (selectedLineupPick?.leagueId === leagueId && selectedLineupPick.playerId !== playerId) {
    const firstPlayerId = selectedLineupPick.playerId;
    selectedLineupPick = null;
    swapLineupPlayers(leagueId, firstPlayerId, playerId);
    return;
  }

  selectedLineupPick =
    selectedLineupPick?.leagueId === leagueId && selectedLineupPick.playerId === playerId
      ? null
      : { leagueId, playerId };
  renderSquadUpdate({ preserveScroll: true });
}

function swapLineupPlayers(leagueId, firstPlayerId, secondPlayerId) {
  updateLineupConfig(leagueId, (config) => {
    const firstLocation = findLineupPlayer(config, firstPlayerId);
    const secondLocation = findLineupPlayer(config, secondPlayerId);
    if (!firstLocation || !secondLocation) return config;

    const firstList = config[firstLocation.listName];
    const secondList = config[secondLocation.listName];
    [firstList[firstLocation.index], secondList[secondLocation.index]] = [
      secondList[secondLocation.index],
      firstList[firstLocation.index]
    ];

    return config;
  }, { preserveScroll: true });
}

function renderSquadUpdate({ preserveScroll = false } = {}) {
  const panel = document.querySelector(".squad-panel");
  const scrollTop = preserveScroll ? panel?.scrollTop ?? 0 : null;
  render();

  if (preserveScroll) {
    const nextPanel = document.querySelector(".squad-panel");
    if (nextPanel) nextPanel.scrollTop = scrollTop;
  }
}

function findLineupPlayer(config, playerId) {
  for (const listName of ["starters", "substitutes"]) {
    const index = config[listName].indexOf(playerId);
    if (index >= 0) return { listName, index };
  }
  return null;
}

function getFormationLines(starters, formation) {
  const [defenderCount, midfielderCount, forwardCount] = formationLayouts[formation] ?? formationLayouts["4-3-3"];
  const goalkeeper = starters.slice(0, 1);
  const defenders = starters.slice(1, 1 + defenderCount);
  const midfielders = starters.slice(1 + defenderCount, 1 + defenderCount + midfielderCount);
  const forwards = starters.slice(1 + defenderCount + midfielderCount, 1 + defenderCount + midfielderCount + forwardCount);

  return [
    ["Ataque", forwards],
    ["Medio", midfielders],
    ["Defensa", defenders],
    ["Arquero", goalkeeper]
  ];
}

function getKnockoutRoundsForResults(results = state.knockoutResults) {
  const standings = calculateStandings(state.matches);
  const qualified = getQualifiedTeams(standings);
  const bracket = generateBracket(qualified);
  return buildKnockoutRounds(bracket, results);
}

function simulateKnockoutAll(results = state.knockoutResults) {
  let nextResults = { ...results };

  for (let step = 0; step < 5; step += 1) {
    const rounds = getKnockoutRoundsForResults(nextResults);
    const playableIds = new Set(
      rounds
        .flat()
        .filter((match) => match.home && match.away && !isKnockoutMatchPlayed(match))
        .map((match) => match.id)
    );
    if (playableIds.size === 0) break;

    nextResults = simulateKnockoutResults(rounds, nextResults, (match) => playableIds.has(match.id));
  }

  return nextResults;
}

function simulateNextKnockoutRound(results = state.knockoutResults) {
  const rounds = getKnockoutRoundsForResults(results);
  const nextRound = rounds.find((round) =>
    round.some((match) => match.home && match.away && !isKnockoutMatchPlayed(match))
  );
  if (!nextRound) return results;
  const roundKey = nextRound[0].roundKey;
  return simulateKnockoutResults(rounds, results, (match) => match.roundKey === roundKey);
}

function pruneKnockoutDependents(results, matchId) {
  const roundOrder = ["R32", "R16", "QF", "SF", "F"];
  const editedRoundIndex = roundOrder.findIndex((roundKey) => matchId.startsWith(`${roundKey}-`));
  if (editedRoundIndex < 0) return results;

  return Object.fromEntries(
    Object.entries(results).filter(([resultMatchId]) => {
      const resultRoundIndex = roundOrder.findIndex((roundKey) => resultMatchId.startsWith(`${roundKey}-`));
      return resultRoundIndex <= editedRoundIndex;
    })
  );
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "select-group") {
    updateState({ ...state, selectedGroupId: target.dataset.groupId });
  }

  if (action === "open-squad") {
    selectedLeagueId = target.dataset.leagueId;
    render();
  }

  if (action === "close-squad") {
    selectedLeagueId = null;
    selectedLineupPick = null;
    render();
  }

  if (action === "select-lineup-player") {
    handleLineupPlayerSelection(target.dataset.leagueId, target.dataset.playerId);
  }

  if (action === "reset-lineup") {
    resetLineupConfig(target.dataset.leagueId);
  }

  if (action === "simulate-group") {
    updateState({
      ...state,
      matches: simulateMatches(state.matches, (match) => match.groupId === state.selectedGroupId),
      knockoutResults: {},
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "simulate-all") {
    updateState({
      ...state,
      matches: simulateMatches(state.matches),
      knockoutResults: {},
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "simulate-match") {
    updateState({
      ...state,
      matches: simulateMatches(state.matches, (match) => match.id === target.dataset.matchId),
      knockoutResults: {},
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "reset-group") {
    updateState({
      ...state,
      matches: resetMatches(state.matches, (match) => match.groupId === state.selectedGroupId),
      knockoutResults: {}
    });
  }

  if (action === "simulate-knockout-match") {
    const rounds = getKnockoutRoundsForResults();
    updateState({
      ...state,
      knockoutResults: simulateKnockoutResults(rounds, state.knockoutResults, (match) => match.id === target.dataset.matchId),
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "simulate-knockout-next") {
    updateState({
      ...state,
      knockoutResults: simulateNextKnockoutRound(),
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "simulate-knockout-all") {
    updateState({
      ...state,
      knockoutResults: simulateKnockoutAll(),
      lastSimulationAt: new Date().toLocaleString("es-AR")
    });
  }

  if (action === "reset-knockout") {
    updateState({
      ...state,
      knockoutResults: resetKnockoutResults(state.knockoutResults)
    });
  }

  if (action === "reset-all") {
    updateState(createInitialState());
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!["score", "knockout-score"].includes(target.dataset.action)) return;

  if (target.dataset.action === "knockout-score") {
    const updatedResults = updateKnockoutScore(state.knockoutResults, target.dataset.matchId, target.dataset.side, target.value);
    updateState({
      ...state,
      knockoutResults: pruneKnockoutDependents(updatedResults, target.dataset.matchId)
    });
    return;
  }

  updateState({
    ...state,
    matches: updateMatchScore(state.matches, target.dataset.matchId, target.dataset.side, target.value),
    knockoutResults: {}
  });
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action !== "change-formation") return;

  updateLineupConfig(target.dataset.leagueId, (config) => ({
    ...config,
    formation: formationLayouts[target.value] ? target.value : config.formation
  }));
});

render();
loadLogoManifest();
