$ErrorActionPreference = "Stop"

# Configuration
$runtimeHealthUrl = if ($env:ARCHESTRA_RUNTIME_HEALTH_URL) { $env:ARCHESTRA_RUNTIME_HEALTH_URL } else { "http://localhost:9000/health" }
$runtimeUiUrl = if ($env:ARCHESTRA_UI_URL) { $env:ARCHESTRA_UI_URL } else { "http://localhost:3000" }
$nextPort = if ($env:NEXTJS_PORT) { $env:NEXTJS_PORT } else { 3001 }
$mcpPort = if ($env:MCP_AGGREGATOR_PORT) { $env:MCP_AGGREGATOR_PORT } else { 8010 }

# Get script directory for relative paths
$scriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
$projectRoot = $scriptDir

function Stop-PortProcess {
    param([int]$Port)
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listeners) {
        $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "SentinelGrid Auto-Launch" -ForegroundColor Green
Write-Host "=" * 60

Write-Host "[1/4] Clearing stale listeners (ports $nextPort, $mcpPort)..."
Stop-PortProcess -Port $nextPort
Stop-PortProcess -Port 8001
Stop-PortProcess -Port 8002
Stop-PortProcess -Port 8003
Write-Host "✓ Ports cleared"

Write-Host "[2/4] Starting MCP servers (power/hydro/sewage on 8001-8003)..."
$python = & where.exe python.exe 2>$null | Select-Object -First 1
if (-not $python) {
    Write-Error "Python not found in PATH. Install Python 3.11+ or activate .venv"
}

Push-Location "$projectRoot\archestra-mcp-poc"
$mcpProc = Start-Process -FilePath $python -ArgumentList "-m", "start_mcps_http" -WindowStyle Minimized -PassThru
Write-Host "✓ MCP servers starting (PID: $($mcpProc.Id))"
Pop-Location

Write-Host "[3/4] Starting Control Center on port $nextPort..."
Push-Location "$projectRoot\control-center"

$next = & npm.cmd bin next 2>$null
if (-not $next) {
    Write-Error "Node.js not found or npm packages not installed. Run: cd control-center && npm install"
}

$feProc = Start-Process `
    -FilePath ($next -replace "\\","/") `
    -ArgumentList "dev", "--turbo", "-p", $nextPort `
    -WindowStyle Minimized `
    -PassThru
Write-Host "✓ Control Center starting on http://localhost:$nextPort (PID: $($feProc.Id))"
Pop-Location

Start-Sleep -Seconds 3

Write-Host "[4/4] Health checks..."
$feCode = curl.exe -s -o NUL -w "%{http_code}" "http://localhost:$nextPort/" 2>$null
$mcpCode = curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:$mcpPort/healthz" 2>$null
$runtimeCode = curl.exe -s -o NUL -w "%{http_code}" $runtimeHealthUrl 2>$null
$uiCode = curl.exe -s -o NUL -w "%{http_code}" $runtimeUiUrl 2>$null

Write-Host ""
Write-Host "Service Status:" -ForegroundColor Yellow
Write-Host "  Control Center (port $nextPort): $(if($feCode -eq '200') { '✓ Ready' } else { "✗ HTTP $feCode" })"
Write-Host "  MCP Servers (port $mcpPort): $(if($mcpCode -eq '200') { '✓ Ready' } else { "⏳ Starting..." })"
Write-Host "  Archestra Runtime: $(if($runtimeCode -eq '200') { '✓ Ready' } else { '✗ Not reachable at ' + $runtimeHealthUrl })"
Write-Host "  Archestra Chat UI: $(if($uiCode -eq '200') { '✓ Ready' } else { '? Not reachable at ' + $runtimeUiUrl })"

Write-Host ""
Write-Host "🚀 SentinelGrid ready! Open http://localhost:$nextPort in your browser"
Write-Host ""
Write-Host "Press Ctrl+C to stop all services"
Write-Host ""

try {
    # Wait for termination
    while ($true) {
        Start-Sleep -Seconds 5
        if ($feProc.HasExited) { Write-Warning "Control Center process exited" }
        if ($mcpProc.HasExited) { Write-Warning "MCP process exited" }
    }
}
catch {
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Stop-Process -Id $feProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $mcpProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Services stopped"
}

if ($uiCode -eq "000") {
    Write-Warning "Archestra UI is not reachable at $runtimeUiUrl. Open-chat flow may fail until UI is started."
} else {
    Write-Host "archestra ui: $uiCode ($runtimeUiUrl)"
}

if ($runtimeCode -ne "200") {
    Write-Warning "If runs stall with 'No new messages for 40 seconds', increase Archestra runtime/proxy stream timeout to >= 300s."
}

Write-Host "Startup complete."
