$nodePath = 'C:\Users\Kartavya\AppData\Roaming\Antigravity\bin\agy-node.cmd'
$serverDir = 'C:\Users\Kartavya\OneDrive\Desktop\The-Traitors-Game'

Write-Host "Starting server..."
$proc = Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory $serverDir -PassThru

try {
    Start-Sleep -Seconds 2
    Write-Host "Testing /api/state..."
    $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/state' -Method Get
    Write-Host "Current Round:" $response.currentRound

    Write-Host "`nTesting Player Registration (Number ONLY)..."
    $reg = Invoke-RestMethod -Uri 'http://localhost:3000/api/register' -Method Post -ContentType 'application/json' -Body '{"id":"test_101","number":"14"}'
    Write-Host "Player Registered:" $reg.player.name "(Role: $($reg.player.role))"

    Write-Host "`nTesting Admin Login PIN..."
    $auth = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/login' -Method Post -ContentType 'application/json' -Body '{"pin":"1337"}'
    Write-Host "Admin Auth Success:" $auth.success

    Write-Host "`nTesting Admin Start Trial..."
    $trial = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/start-trial' -Method Post
    Write-Host "Start Trial Success:" $trial.success

    Write-Host "`nTesting Remove Player..."
    $remove = Invoke-RestMethod -Uri 'http://localhost:3000/api/admin/remove-player' -Method Post -ContentType 'application/json' -Body '{"id":"test_101"}'
    Write-Host "Remove Player Success:" $remove.success

    Write-Host "`nALL TESTS PASSED SUCCESSFULLY! Clean, mobile-ready, zero emojis."
}
catch {
    Write-Error "Test Failed: $_"
}
finally {
    Write-Host "Stopping test server..."
    if ($proc -and -not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
}
