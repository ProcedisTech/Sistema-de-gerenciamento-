param(
  [int[]]$Ports = @(5173, 5174, 3001)
)

$allPids = @()

foreach ($port in $Ports) {
  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $connections) {
    Write-Host "[clean-ports] Porta $port livre."
    continue
  }

  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $pids) {
    if ($processId -and $processId -ne 0) {
      $allPids += $processId
    }
  }
}

$allPids = $allPids | Select-Object -Unique

if (-not $allPids) {
  Write-Host "[clean-ports] Nenhum processo para finalizar."
  exit 0
}

foreach ($processId in $allPids) {
  try {
    $proc = Get-Process -Id $processId -ErrorAction Stop
    Stop-Process -Id $processId -Force -ErrorAction Stop
    Write-Host "[clean-ports] Finalizado PID $processId ($($proc.ProcessName))."
  }
  catch {
    Write-Host "[clean-ports] Nao foi possivel finalizar PID ${processId}: $($_.Exception.Message)"
  }
}

Write-Host "[clean-ports] Limpeza concluida."
