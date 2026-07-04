import { groups, leagues, tournamentConfig } from "./data.js";

const leagueMap = new Map(leagues.map((league) => [league.id, league]));

export function createInitialState() {
  return {
    selectedGroupId: groups[0].id,
    matches: generateGroupMatches(groups),
    knockoutResults: {},
    lastSimulationAt: null
  };
}

export function generateGroupMatches(groupSeeds) {
  const rounds = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]]
  ];

  return groupSeeds.flatMap((group) =>
    rounds.flatMap((round, roundIndex) =>
      round.map(([homeIndex, awayIndex], matchIndex) => ({
        id: `${group.id}-${roundIndex + 1}-${matchIndex + 1}`,
        groupId: group.id,
        round: roundIndex + 1,
        homeLeagueId: group.leagueIds[homeIndex],
        awayLeagueId: group.leagueIds[awayIndex],
        homeGoals: null,
        awayGoals: null
      }))
    )
  );
}

export function getLeague(leagueId) {
  return leagueMap.get(leagueId);
}

export function getGroupsWithLeagues() {
  return groups.map((group) => ({
    ...group,
    leagues: group.leagueIds.map(getLeague)
  }));
}

export function calculateStandings(matches) {
  return groups.map((group) => {
    const groupMatches = matches.filter((match) => match.groupId === group.id);
    const rows = group.leagueIds.map((leagueId) => createStandingRow(group.id, leagueId));

    for (const match of groupMatches) {
      if (!isMatchPlayed(match)) continue;
      const home = rows.find((row) => row.leagueId === match.homeLeagueId);
      const away = rows.find((row) => row.leagueId === match.awayLeagueId);
      applyResult(home, match.homeGoals, match.awayGoals);
      applyResult(away, match.awayGoals, match.homeGoals);
    }

    const rankedRows = rankRows(rows, groupMatches).map((row, index) => ({
      ...row,
      position: index + 1
    }));

    return {
      id: group.id,
      rows: rankedRows,
      matches: groupMatches
    };
  });
}

export function getQualifiedTeams(standings) {
  const direct = standings.flatMap((group) =>
    group.rows.slice(0, tournamentConfig.promotedPerGroup).map((row) => ({
      ...row,
      qualificationType: row.position === 1 ? "winner" : "runnerUp"
    }))
  );

  const thirds = standings
    .map((group) => ({ ...group.rows[2], qualificationType: "third" }))
    .sort(compareRowsForCrossGroup)
    .slice(0, tournamentConfig.bestThirds);

  return {
    direct,
    bestThirds: thirds,
    all: [...direct, ...thirds]
  };
}

export function generateBracket(qualifiedTeams) {
  const seeded = [
    ...qualifiedTeams.direct
      .filter((team) => team.qualificationType === "winner")
      .sort(compareRowsForCrossGroup),
    ...qualifiedTeams.direct
      .filter((team) => team.qualificationType === "runnerUp")
      .sort(compareRowsForCrossGroup),
    ...qualifiedTeams.bestThirds.sort(compareRowsForCrossGroup)
  ].map((team, index) => ({ ...team, seed: index + 1 }));

  const slotPairs = [
    [1, 32],
    [16, 17],
    [8, 25],
    [9, 24],
    [4, 29],
    [13, 20],
    [5, 28],
    [12, 21],
    [2, 31],
    [15, 18],
    [7, 26],
    [10, 23],
    [3, 30],
    [14, 19],
    [6, 27],
    [11, 22]
  ];

  return slotPairs.map(([homeSeed, awaySeed], index) => ({
    id: `R32-${index + 1}`,
    round: "Ronda de 32",
    slot: index + 1,
    home: seeded.find((team) => team.seed === homeSeed) ?? null,
    away: seeded.find((team) => team.seed === awaySeed) ?? null
  }));
}

export function buildKnockoutRounds(bracket, results = {}) {
  const firstRound = bracket.map((match) => hydrateKnockoutMatch(match, "R32", "Ronda de 32", results));
  const rounds = [firstRound];
  const roundDefs = [
    ["R16", "Octavos de final"],
    ["QF", "Cuartos de final"],
    ["SF", "Semifinales"],
    ["F", "Final"]
  ];

  for (const [roundKey, roundLabel] of roundDefs) {
    const previousRound = rounds.at(-1);
    const round = Array.from({ length: previousRound.length / 2 }, (_, index) =>
      hydrateKnockoutMatch(
        {
          id: `${roundKey}-${index + 1}`,
          round: roundLabel,
          slot: index + 1,
          home: previousRound[index * 2]?.winner ?? null,
          away: previousRound[index * 2 + 1]?.winner ?? null
        },
        roundKey,
        roundLabel,
        results
      )
    );
    rounds.push(round);
  }

  return rounds;
}

export function updateKnockoutScore(results, matchId, side, rawValue) {
  const parsed = rawValue === "" ? null : Number(rawValue);
  const value = Number.isFinite(parsed) && parsed >= 0 ? Math.min(12, Math.floor(parsed)) : null;
  const current = results[matchId] ?? { homeGoals: null, awayGoals: null };

  return {
    ...results,
    [matchId]: {
      ...current,
      [side === "home" ? "homeGoals" : "awayGoals"]: value
    }
  };
}

export function simulateKnockoutResults(rounds, results = {}, predicate = () => true) {
  const nextResults = { ...results };

  for (const round of rounds) {
    for (const match of round) {
      if (!predicate(match) || !match.home || !match.away || isKnockoutMatchPlayed(match)) continue;
      nextResults[match.id] = simulateKnockoutMatch(match);
    }
  }

  return nextResults;
}

export function resetKnockoutResults(results = {}, predicate = () => true) {
  return Object.fromEntries(
    Object.entries(results).filter(([matchId]) => !predicate({ id: matchId }))
  );
}

export function isKnockoutMatchPlayed(match) {
  return (
    Number.isInteger(match.result?.homeGoals) &&
    Number.isInteger(match.result?.awayGoals) &&
    match.result.homeGoals !== match.result.awayGoals
  );
}

export function simulateMatch(match) {
  const home = getLeague(match.homeLeagueId);
  const away = getLeague(match.awayLeagueId);
  const expectedHome = 1.2 + (home.level - away.level) / 28 + Math.random() * 1.4;
  const expectedAway = 1.05 + (away.level - home.level) / 31 + Math.random() * 1.3;

  return {
    ...match,
    homeGoals: clampGoals(Math.round(expectedHome)),
    awayGoals: clampGoals(Math.round(expectedAway))
  };
}

function simulateKnockoutMatch(match) {
  const homeLevel = match.home.league.level;
  const awayLevel = match.away.league.level;
  const expectedHome = 1.15 + (homeLevel - awayLevel) / 27 + Math.random() * 1.7;
  const expectedAway = 1.05 + (awayLevel - homeLevel) / 29 + Math.random() * 1.7;
  let homeGoals = clampGoals(Math.round(expectedHome));
  let awayGoals = clampGoals(Math.round(expectedAway));

  if (homeGoals === awayGoals) {
    if (homeLevel > awayLevel || (homeLevel === awayLevel && (match.home.seed ?? 99) < (match.away.seed ?? 99))) {
      homeGoals += 1;
    } else {
      awayGoals += 1;
    }
  }

  return { homeGoals, awayGoals };
}

export function simulateMatches(matches, predicate = () => true) {
  return matches.map((match) => {
    if (!predicate(match) || isMatchPlayed(match)) return match;
    return simulateMatch(match);
  });
}

export function resetMatches(matches, predicate = () => true) {
  return matches.map((match) =>
    predicate(match)
      ? { ...match, homeGoals: null, awayGoals: null }
      : match
  );
}

export function updateMatchScore(matches, matchId, side, rawValue) {
  const parsed = rawValue === "" ? null : Number(rawValue);
  const value = Number.isFinite(parsed) && parsed >= 0 ? Math.min(12, Math.floor(parsed)) : null;

  return matches.map((match) =>
    match.id === matchId
      ? { ...match, [side === "home" ? "homeGoals" : "awayGoals"]: value }
      : match
  );
}

export function isMatchPlayed(match) {
  return Number.isInteger(match.homeGoals) && Number.isInteger(match.awayGoals);
}

function createStandingRow(groupId, leagueId) {
  const league = getLeague(leagueId);
  return {
    groupId,
    leagueId,
    league,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0
  };
}

function applyResult(row, goalsFor, goalsAgainst) {
  row.played += 1;
  row.goalsFor += goalsFor;
  row.goalsAgainst += goalsAgainst;
  row.goalDifference = row.goalsFor - row.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    row.won += 1;
    row.points += 3;
  } else if (goalsFor === goalsAgainst) {
    row.drawn += 1;
    row.points += 1;
  } else {
    row.lost += 1;
  }
}

function rankRows(rows, matches) {
  return [...rows].sort((a, b) => compareRows(a, b, matches));
}

function compareRows(a, b, matches) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    compareHeadToHead(a, b, matches) ||
    b.league.level - a.league.level ||
    a.league.name.localeCompare(b.league.name)
  );
}

function compareRowsForCrossGroup(a, b) {
  return (
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    b.league.level - a.league.level ||
    a.groupId.localeCompare(b.groupId)
  );
}

function compareHeadToHead(a, b, matches) {
  const direct = matches.find((match) =>
    isMatchPlayed(match) &&
    [match.homeLeagueId, match.awayLeagueId].includes(a.leagueId) &&
    [match.homeLeagueId, match.awayLeagueId].includes(b.leagueId)
  );

  if (!direct) return 0;

  const aGoals = direct.homeLeagueId === a.leagueId ? direct.homeGoals : direct.awayGoals;
  const bGoals = direct.homeLeagueId === b.leagueId ? direct.homeGoals : direct.awayGoals;
  return bGoals - aGoals;
}

function clampGoals(value) {
  return Math.max(0, Math.min(8, value));
}

function hydrateKnockoutMatch(match, roundKey, roundLabel, results) {
  const result = results[match.id] ?? { homeGoals: null, awayGoals: null };
  return {
    ...match,
    roundKey,
    round: roundLabel,
    result,
    winner: getKnockoutWinner(match, result)
  };
}

function getKnockoutWinner(match, result) {
  if (!match.home || !match.away) return null;
  if (!Number.isInteger(result.homeGoals) || !Number.isInteger(result.awayGoals)) return null;
  if (result.homeGoals === result.awayGoals) return null;
  return result.homeGoals > result.awayGoals ? match.home : match.away;
}
