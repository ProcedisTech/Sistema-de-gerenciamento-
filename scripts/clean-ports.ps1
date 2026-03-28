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
  foreach ($pid in $pids) {
    if ($pid -and $pid -ne 0) {
      $allPids += $pid
    }
  }
}

$allPids = $allPids | Select-Object -Unique

if (-not $allPids) {
  Write-Host "[clean-ports] Nenhum processo para finalizar."
  exit 0
}

foreach ($pid in $allPids) {
  try {
    $proc = Get-Process -Id $pid -ErrorAction Stop
    Stop-Process -Id $pid -Force -ErrorAction Stop
    Write-Host "[clean-ports] Finalizado PID $pid ($($proc.ProcessName))."
  }
  catch {
    Write-Host "[clean-ports] Nao foi possivel finalizar PID ${pid}: $($_.Exception.Message)"
  }
}

Write-Host "[clean-ports] Limpeza concluida."
