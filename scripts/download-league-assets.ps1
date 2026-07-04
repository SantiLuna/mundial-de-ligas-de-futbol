param(
  [string]$OutputRoot = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$outDir = Join-Path $OutputRoot "assets\leagues"
$manifestPath = Join-Path $outDir "manifest.json"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$writeTestPath = Join-Path $outDir ".write-test"
try {
  Set-Content -LiteralPath $writeTestPath -Value "ok" -Encoding UTF8
  Remove-Item -LiteralPath $writeTestPath -Force
}
catch {
  Write-Error @"
Cannot write downloaded assets to:
$outDir

Error:
$($_.Exception.Message)

Try writing to a simple temporary path:
  .\scripts\download-league-assets.ps1 -OutputRoot C:\Temp\MundialLigaAssets

Then copy C:\Temp\MundialLigaAssets\assets\leagues back into this project.
"@
  exit 1
}

$logoSources = @(
  @{ Id = "premier-league"; Domain = "premierleague.com" },
  @{ Id = "laliga"; Domain = "laliga.com" },
  @{ Id = "serie-a"; Domain = "legaseriea.it" },
  @{ Id = "bundesliga"; Domain = "bundesliga.com" },
  @{ Id = "ligue-1"; Domain = "ligue1.com" },
  @{ Id = "brasileirao"; Domain = "brasileirao.com.br" },
  @{ Id = "primeira-liga"; Domain = "ligaportugal.pt" },
  @{ Id = "eredivisie"; Domain = "eredivisie.nl" },
  @{ Id = "liga-profesional-argentina"; Domain = "lpf.org.ar" },
  @{ Id = "saudi-pro-league"; Domain = "spl.com.sa" },
  @{ Id = "mls"; Domain = "mlssoccer.com" },
  @{ Id = "liga-mx"; Domain = "ligamx.net" },
  @{ Id = "super-lig"; Domain = "tff.org" },
  @{ Id = "belgian-pro-league"; Domain = "proleague.be" },
  @{ Id = "russian-premier-league"; Domain = "premierliga.ru" },
  @{ Id = "czech-first-league"; Domain = "fortunaliga.cz" },
  @{ Id = "super-league-greece"; Domain = "slgr.gr" },
  @{ Id = "danish-superliga"; Domain = "superliga.dk" },
  @{ Id = "scottish-premiership"; Domain = "spfl.co.uk" },
  @{ Id = "austrian-bundesliga"; Domain = "bundesliga.at" },
  @{ Id = "swiss-super-league"; Domain = "sfl.ch" },
  @{ Id = "serbian-superliga"; Domain = "superliga.rs" },
  @{ Id = "croatian-hnl"; Domain = "hnl.hr" },
  @{ Id = "ukrainian-premier-league"; Domain = "upl.ua" },
  @{ Id = "ekstraklasa"; Domain = "ekstraklasa.org" },
  @{ Id = "categoria-primera-a"; Domain = "dimayor.com.co" },
  @{ Id = "primera-paraguay"; Domain = "apf.org.py" },
  @{ Id = "ligapro-ecuador"; Domain = "ligapro.ec" },
  @{ Id = "egyptian-premier-league"; Domain = "egyptianproleague.com" },
  @{ Id = "j1-league"; Domain = "jleague.co" },
  @{ Id = "k-league-1"; Domain = "kleague.com" },
  @{ Id = "uae-pro-league"; Domain = "uaeproleague.ae" },
  @{ Id = "botola-pro"; Domain = "frmf.ma" },
  @{ Id = "romanian-superliga"; Domain = "superliga.ro" },
  @{ Id = "israeli-premier-league"; Domain = "football.co.il" },
  @{ Id = "eliteserien"; Domain = "eliteserien.no" },
  @{ Id = "allsvenskan"; Domain = "svenskfotboll.se" },
  @{ Id = "primera-chile"; Domain = "campeonatochileno.cl" },
  @{ Id = "primera-uruguay"; Domain = "auf.org.uy" },
  @{ Id = "liga-1-peru"; Domain = "liga1.pe" },
  @{ Id = "ligue-professionnelle-1-algeria"; Domain = "lnfp.dz" },
  @{ Id = "south-african-premiership"; Domain = "psl.co.za" },
  @{ Id = "tunisian-ligue-professionnelle"; Domain = "ftf.org.tn" },
  @{ Id = "cypriot-first-division"; Domain = "cfa.com.cy" },
  @{ Id = "a-league-men"; Domain = "aleagues.com.au" },
  @{ Id = "qatar-stars-league"; Domain = "qsl.qa" },
  @{ Id = "primera-costa-rica"; Domain = "unafut.com" },
  @{ Id = "chinese-super-league"; Domain = "thecsl.com" }
)

$results = @()

foreach ($source in $logoSources) {
  $id = $source.Id
  $domain = $source.Domain
  $fileName = "$id.png"
  $filePath = Join-Path $outDir $fileName
  $url = "https://www.google.com/s2/favicons?domain=$domain&sz=128"

  try {
    Invoke-WebRequest -Uri $url -OutFile $filePath -TimeoutSec 12 -UseBasicParsing | Out-Null
    $bytes = (Get-Item -LiteralPath $filePath).Length

    if ($bytes -lt 100) {
      throw "Downloaded file too small ($bytes bytes)"
    }

    $results += [ordered]@{
      leagueId = $id
      domain = $domain
      file = "assets/leagues/$fileName"
      source = "google-favicon"
      status = "downloaded"
      bytes = $bytes
    }

    Write-Host "OK  $id ($bytes bytes)"
  }
  catch {
    if (Test-Path -LiteralPath $filePath) {
      Remove-Item -LiteralPath $filePath -Force
    }

    $results += [ordered]@{
      leagueId = $id
      domain = $domain
      file = "assets/leagues/$fileName"
      source = "google-favicon"
      status = "failed"
      error = $_.Exception.Message
    }

    Write-Warning "ERR $id`: $($_.Exception.Message)"
  }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  source = "Google favicon service from official league domains"
  assets = $results
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$downloaded = @($results | Where-Object { $_.status -eq "downloaded" }).Count
$failed = @($results | Where-Object { $_.status -eq "failed" }).Count

Write-Host "Downloaded $downloaded/$($results.Count). Failed $failed."
