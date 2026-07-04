import { leagues } from "../src/data.js";
import { buildSquad } from "../src/squads.js";

const strict = process.argv.includes("--strict");
const rows = leagues.map((league) => {
  const squad = buildSquad(league);
  const players = [...squad.starters, ...squad.substitutes];
  return {
    leagueId: league.id,
    leagueName: league.name,
    explicit: players.filter((player) => player.nationality?.isExplicit).length,
    inferred: players.filter((player) => !player.nationality?.isExplicit).length,
    missing: players.filter((player) => !player.nationality?.code).length
  };
});

const totals = rows.reduce(
  (acc, row) => ({
    explicit: acc.explicit + row.explicit,
    inferred: acc.inferred + row.inferred,
    missing: acc.missing + row.missing
  }),
  { explicit: 0, inferred: 0, missing: 0 }
);

console.table(rows);
console.log(totals);

if (strict && (totals.inferred > 0 || totals.missing > 0)) {
  process.exitCode = 1;
}
