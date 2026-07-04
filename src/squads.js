import { realSquads } from "./realSquads.js";

const startingShape = [
  ["GK", "Arquero"],
  ["RB", "Lateral derecho"],
  ["CB", "Central"],
  ["CB", "Central"],
  ["LB", "Lateral izquierdo"],
  ["DM", "Mediocentro"],
  ["CM", "Interior"],
  ["AM", "Enganche"],
  ["RW", "Extremo derecho"],
  ["ST", "Delantero centro"],
  ["LW", "Extremo izquierdo"]
];

const benchShape = [
  ["GK", "Arquero"],
  ["CB", "Central"],
  ["FB", "Lateral"],
  ["DM", "Mediocentro"],
  ["CM", "Interior"],
  ["AM", "Volante ofensivo"],
  ["W", "Extremo"],
  ["ST", "Delantero"],
  ["GK", "Arquero"],
  ["CB", "Central"],
  ["FB", "Lateral"],
  ["CM", "Mediocampista"],
  ["W", "Extremo"],
  ["ST", "Delantero"],
  ["UT", "Polifuncional"]
];

const firstNames = [
  "Mateo",
  "Lucas",
  "Nicolas",
  "Santiago",
  "Thiago",
  "Gabriel",
  "Rafael",
  "Leon",
  "Martin",
  "Diego",
  "Emil",
  "Noah",
  "Ivan",
  "Tomas",
  "Adrian",
  "Bruno",
  "Julian",
  "Marco",
  "Leo",
  "Alex"
];

const lastNames = [
  "Silva",
  "Garcia",
  "Molina",
  "Costa",
  "Rossi",
  "Kovac",
  "Santos",
  "Nakamura",
  "Pereira",
  "Jensen",
  "Smith",
  "Hernandez",
  "Popescu",
  "Ivanov",
  "Benali",
  "Kim",
  "Araujo",
  "Novak",
  "Moreno",
  "Diallo"
];

export function buildSquad(league) {
  const realSquad = realSquads[league.id];
  if (realSquad) {
    return buildRealSquad(league, realSquad);
  }

  const seed = Math.abs(hashCode(league.id));
  const starterRatingBase = Math.max(55, league.level - 3);
  const benchRatingBase = Math.max(50, league.level - 10);

  const starters = startingShape.map(([position, role], index) =>
    createPlayer(league, seed, index, position, role, starterRatingBase, true)
  );

  const substitutes = benchShape.map(([position, role], index) =>
    createPlayer(league, seed, index + starters.length, position, role, benchRatingBase, false)
  );

  return {
    leagueId: league.id,
    formation: "4-3-3",
    starters,
    substitutes,
    captainId: starters[5].id,
    sourceNote: "Plantilla semilla generada para prototipo. Pendiente de carga real.",
    totalPlayers: starters.length + substitutes.length,
    averageRating: Math.round(
      [...starters, ...substitutes].reduce((sum, player) => sum + player.rating, 0) /
        (starters.length + substitutes.length)
    )
  };
}

function buildRealSquad(league, realSquad) {
  const starters = realSquad.players.filter((player) => player.isStarter);
  const substitutes = realSquad.players.filter((player) => !player.isStarter);

  return {
    leagueId: league.id,
    formation: realSquad.formation,
    starters,
    substitutes,
    captainId: realSquad.captainId,
    sourceNote: realSquad.sourceNote,
    totalPlayers: realSquad.players.length,
    averageRating: Math.round(
      realSquad.players.reduce((sum, player) => sum + player.rating, 0) / realSquad.players.length
    )
  };
}

function createPlayer(league, seed, index, position, role, ratingBase, isStarter) {
  const firstName = firstNames[(seed + index * 3) % firstNames.length];
  const lastName = lastNames[(seed + index * 5) % lastNames.length];
  const rating = Math.min(99, ratingBase + ((seed + index * 7) % 8) - (isStarter ? 0 : 2));
  const shirtNumber = isStarter ? preferredStarterNumber(position, index) : index + 12;

  return {
    id: `${league.id}-p${index + 1}`,
    name: `${firstName} ${lastName}`,
    shirtNumber,
    position,
    role,
    rating,
    club: sampleClubName(league, index),
    isStarter
  };
}

function preferredStarterNumber(position, index) {
  const numbersByPosition = {
    GK: 1,
    RB: 2,
    CB: index === 2 ? 4 : 5,
    LB: 3,
    DM: 6,
    CM: 8,
    AM: 10,
    RW: 7,
    ST: 9,
    LW: 11
  };

  return numbersByPosition[position] ?? index + 1;
}

function sampleClubName(league, index) {
  const regionKey = league.region.split(" ")[0];
  const suffixes = ["FC", "United", "Sporting", "City", "Athletic", "Racing"];
  return `${regionKey} ${suffixes[index % suffixes.length]}`;
}

function hashCode(value) {
  return [...value].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}
