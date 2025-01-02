git pull
docker stop obs-tools && docker rm obs-tools
docker images -q obs-tools | xargs docker rmi
docker build -t obs-tools .
docker run -d --name obs-tools -p 3003:3000 -v /obs-tools/data:/usr/src/app/data -v /obs-tools/env:/usr/src/app/env -v /obs-tools/ssl:/usr/src/app/ssl obs-tools
