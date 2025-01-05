# Este script envía eventos de Twitch al websocket de Twitch CLI, pero con un pequeño delay entre cada uno de ellos.

Write-Host "Iniciando eventos de Twitch..."

twitch event trigger channel.follow --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscribe --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscription.gift --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscribe -g 141981764 --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.subscription.message --transport=websocket
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket -C 50
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket -C 500
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket -C 1500
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket -C 6000
Start-Sleep -Seconds 6

twitch event trigger channel.cheer --transport=websocket -C 11000
Start-Sleep -Seconds 6

Write-Host "Todos los eventos han sido enviados."
