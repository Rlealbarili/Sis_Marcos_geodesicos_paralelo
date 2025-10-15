$body = Get-Content test-memorial-completo.json -Raw
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/salvar-memorial-completo" -Method POST -Body $body -ContentType "application/json"
$response | ConvertTo-Json -Depth 10
