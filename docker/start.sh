#!/bin/bash

# Specify defaults (defaults are overridden if defined in the environment)
export REDIS_HOST=${REDIS_HOST:="redis"}
export REDIS_PORT=${REDIS_PORT:=6739}
export REDIS_DB=${REDIS_DB:=0}
export COUNTERBLOCK_HOST=${COUNTERBLOCK_HOST:="counterblock"}
export COUNTERBLOCK_PORT_MAINNET=${COUNTERBLOCK_PORT_MAINNET:=4100}
export COUNTERBLOCK_PORT_TESTNET=${COUNTERBLOCK_PORT_TESTNET:=14100}
export COUNTERBLOCK_PORT_MAINNET_FEED=${COUNTERBLOCK_PORT_MAINNET_FEED:=4101}
export COUNTERBLOCK_PORT_TESTNET_FEED=${COUNTERBLOCK_PORT_TESTNET_FEED:=14101}
export COUNTERBLOCK_PORT_MAINNET_CHAT=${COUNTERBLOCK_PORT_MAINNET_CHAT:=4102}
export COUNTERBLOCK_PORT_TESTNET_CHAT=${COUNTERBLOCK_PORT_TESTNET_CHAT:=14102}

VARS='$REDIS_HOST:$REDIS_PORT:$REDIS_DB:$COUNTERBLOCK_HOST:$COUNTERBLOCK_PORT_MAINNET:$COUNTERBLOCK_PORT_TESTNET:$COUNTERBLOCK_PORT_MAINNET_FEED:$COUNTERBLOCK_PORT_TESTNET_FEED:$COUNTERBLOCK_PORT_MAINNET_CHAT:$COUNTERBLOCK_PORT_TESTNET_CHAT'
envsubst "$VARS" < /counterwallet/docker/nginx/counterwallet.conf.template > /etc/nginx/sites-enabled/counterwallet.conf

nginx -g 'daemon off;'