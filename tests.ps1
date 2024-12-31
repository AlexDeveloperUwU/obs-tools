# Guarda este script como twitch_events.ps1 y ejecútalo con PowerShell

Write-Host "Iniciando eventos de Twitch..."

twitch event trigger channel.follow --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscribe --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscription.gift --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscription.message --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket
Start-Sleep -Seconds 6

Write-Host "Todos los eventos han sido activados."
