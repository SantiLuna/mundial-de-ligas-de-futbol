import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outDir = join("assets", "leagues");
const manifestPath = join(outDir, "manifest.json");

const logoSources = [
  ["premier-league", "premierleague.com"],
  ["laliga", "laliga.com"],
  ["serie-a", "legaseriea.it"],
  ["bundesliga", "bundesliga.com"],
  ["ligue-1", "ligue1.com"],
  ["brasileirao", "brasileirao.com.br"],
  ["primeira-liga", "ligaportugal.pt"],
  ["eredivisie", "eredivisie.nl"],
  ["liga-profesional-argentina", "lpf.org.ar"],
  ["saudi-pro-league", "spl.com.sa"],
  ["mls", "mlssoccer.com"],
  ["liga-mx", "ligamx.net"],
  ["super-lig", "tff.org"],
  ["belgian-pro-league", "proleague.be"],
  ["russian-premier-league", "premierliga.ru"],
  ["czech-first-league", "fortunaliga.cz"],
  ["super-league-greece", "slgr.gr"],
  ["danish-superliga", "superliga.dk"],
  ["scottish-premiership", "spfl.co.uk"],
  ["austrian-bundesliga", "bundesliga.at"],
  ["swiss-super-league", "sfl.ch"],
  ["serbian-superliga", "superliga.rs"],
  ["croatian-hnl", "hnl.hr"],
  ["ukrainian-premier-league", "upl.ua"],
  ["ekstraklasa", "ekstraklasa.org"],
  ["categoria-primera-a", "dimayor.com.co"],
  ["primera-paraguay", "apf.org.py"],
  ["ligapro-ecuador", "ligapro.ec"],
  ["egyptian-premier-league", "egyptianproleague.com"],
  ["j1-league", "jleague.co"],
  ["k-league-1", "kleague.com"],
  ["uae-pro-league", "uaeproleague.ae"],
  ["botola-pro", "frmf.ma"],
  ["romanian-superliga", "superliga.ro"],
  ["israeli-premier-league", "football.co.il"],
  ["eliteserien", "eliteserien.no"],
  ["allsvenskan", "svenskfotboll.se"],
  ["primera-chile", "campeonatochileno.cl"],
  ["primera-uruguay", "auf.org.uy"],
  ["liga-1-peru", "liga1.pe"],
  ["ligue-professionnelle-1-algeria", "lnfp.dz"],
  ["south-african-premiership", "psl.co.za"],
  ["tunisian-ligue-professionnelle", "ftf.org.tn"],
  ["cypriot-first-division", "cfa.com.cy"],
  ["a-league-men", "aleagues.com.au"],
  ["qatar-stars-league", "qsl.qa"],
  ["primera-costa-rica", "unafut.com"],
  ["chinese-super-league", "thecsl.com"]
];

await mkdir(outDir, { recursive: true });

try {
  const writeTestPath = join(outDir, ".write-test");
  await writeFile(writeTestPath, "ok");
  await rm(writeTestPath, { force: true });
} catch (error) {
  console.error(
    [
      "Cannot write downloaded assets from Node in this workspace.",
      `Directory: ${outDir}`,
      `Error: ${error.message}`,
      "On Windows, use the PowerShell downloader instead:",
      "  .\\scripts\\download-league-assets.ps1"
    ].join("\n")
  );
  process.exit(1);
}

const results = [];
const concurrency = 8;

for (let index = 0; index < logoSources.length; index += concurrency) {
  const batch = logoSources.slice(index, index + concurrency);
  const batchResults = await Promise.all(batch.map(downloadLogo));
  results.push(...batchResults);
}

await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "Google favicon service from official league domains",
      assets: results
    },
    null,
    2
  )}\n`,
  "utf8"
);

const downloaded = results.filter((result) => result.status === "downloaded").length;
const failed = results.filter((result) => result.status === "failed").length;
console.log(`Downloaded ${downloaded}/${results.length}. Failed ${failed}.`);

async function downloadLogo([leagueId, domain]) {
  const candidates = [
    {
      source: "google-favicon",
      fileName: `${leagueId}.png`,
      url: `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    },
    {
      source: "duckduckgo-icon",
      fileName: `${leagueId}.ico`,
      url: `https://icons.duckduckgo.com/ip3/${domain}.ico`
    }
  ];

  const errors = [];

  for (const candidate of candidates) {
    try {
      await mkdir(outDir, { recursive: true });
      const outputPath = join(outDir, candidate.fileName);
      const bytes = await download(candidate.url, outputPath);

      if (bytes < 100) {
        throw new Error(`Downloaded file too small (${bytes} bytes)`);
      }

      const result = {
        leagueId,
        domain,
        file: `assets/leagues/${candidate.fileName}`,
        source: candidate.source,
        status: "downloaded",
        bytes
      };

      console.log(`OK  ${leagueId} (${bytes} bytes, ${candidate.source})`);
      return result;
    } catch (error) {
      errors.push(`${candidate.source}: ${error.message}`);
    }
  }

  const result = {
      leagueId,
      domain,
      file: `assets/leagues/${leagueId}.png`,
      status: "failed",
      error: errors.join(" | ")
  };

  console.warn(`ERR ${leagueId}: ${result.error}`);
  return result;
}

async function download(url, outputPath) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
    headers: {
      "User-Agent": "Mozilla/5.0 MundialDeLigasAssetDownloader/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);
  return buffer.byteLength;
}
