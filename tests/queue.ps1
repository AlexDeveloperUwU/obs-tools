Write-Host "Iniciando eventos de Twitch..."

twitch event trigger channel.follow --transport=websocket

twitch event trigger channel.subscribe --transport=websocket

twitch event trigger channel.subscription.gift --transport=websocket

twitch event trigger channel.subscribe -g 141981764 --transport=websocket

twitch event trigger channel.subscription.message --transport=websocket

twitch event trigger channel.cheer --transport=websocket

twitch event trigger channel.cheer --transport=websocket -C 50

twitch event trigger channel.cheer --transport=websocket -C 500

twitch event trigger channel.cheer --transport=websocket -C 1500

twitch event trigger channel.cheer --transport=websocket -C 6000

twitch event trigger channel.cheer --transport=websocket -C 11000

Write-Host "Todos los eventos han sido enviados."
