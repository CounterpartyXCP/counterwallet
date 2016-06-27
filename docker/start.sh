#!/bin/bash

# If working from a bare source checkout, rebuild some things so that the site loads properly
if [ ! -d /counterwallet/build ]; then
    cd /counterwallet/src; bower --allow-root --config.interactive=false update
    cd /counterwallet; npm update
    grunt build --dontcheckdeps
fi
if [ ! -f /counterwallet/counterwallet.conf.json ]; then
    cp -a /counterwallet/counterwallet.conf.json.example /counterwallet/counterwallet.conf.json
fi
if [ ! -f /ssl_config/counterwallet.pem ]; then
    cp -a /etc/ssl/certs/ssl-cert-snakeoil.pem /ssl_config/counterwallet.pem
fi
if [ ! -f /ssl_config/counterwallet.key ]; then
    cp -a /etc/ssl/private/ssl-cert-snakeoil.key /ssl_config/counterwallet.key
fi

# Specify defaults (defaults are overridden if defined in the environment)
export REDIS_HOST=${REDIS_HOST:="redis"}
export REDIS_PORT=${REDIS_PORT:=6379}
export REDIS_DB=${REDIS_DB:=0}
export COUNTERBLOCK_HOST_MAINNET=${COUNTERBLOCK_HOST_MAINNET:="counterblock"}
export COUNTERBLOCK_HOST_TESTNET=${COUNTERBLOCK_HOST_TESTNET:="counterblock-testnet"}
export COUNTERBLOCK_PORT_MAINNET=${COUNTERBLOCK_PORT_MAINNET:=4100}
export COUNTERBLOCK_PORT_TESTNET=${COUNTERBLOCK_PORT_TESTNET:=14100}
export COUNTERBLOCK_PORT_MAINNET_FEED=${COUNTERBLOCK_PORT_MAINNET_FEED:=4101}
export COUNTERBLOCK_PORT_TESTNET_FEED=${COUNTERBLOCK_PORT_TESTNET_FEED:=14101}
export COUNTERBLOCK_PORT_MAINNET_CHAT=${COUNTERBLOCK_PORT_MAINNET_CHAT:=4102}
export COUNTERBLOCK_PORT_TESTNET_CHAT=${COUNTERBLOCK_PORT_TESTNET_CHAT:=14102}

VARS='$REDIS_HOST:$REDIS_PORT:$REDIS_DB:$COUNTERBLOCK_HOST_MAINNET:$COUNTERBLOCK_HOST_TESTNET:$COUNTERBLOCK_PORT_MAINNET:$COUNTERBLOCK_PORT_TESTNET:$COUNTERBLOCK_PORT_MAINNET_FEED:$COUNTERBLOCK_PORT_TESTNET_FEED:$COUNTERBLOCK_PORT_MAINNET_CHAT:$COUNTERBLOCK_PORT_TESTNET_CHAT'
envsubst "$VARS" < /counterwallet/docker/nginx/counterwallet.conf.template > /etc/nginx/sites-enabled/counterwallet.conf

# Launch utilizing the SIGTERM/SIGINT propagation pattern from
# http://veithen.github.io/2014/11/16/sigterm-propagation.html
trap 'kill -TERM $PID' TERM INT
nginx -g 'daemon off;' &
# ^ maybe simplify to just be "nginx" in the future 
PID=$!
wait $PID
trap - TERM INT
wait $PID
EXIT_STATUS=$?
