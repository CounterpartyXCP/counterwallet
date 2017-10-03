#!/bin/bash

# runs a local nginx server that proxies requests to a remote counterwallet instance


if ! [ -x "$(command -v envsubst)" ]; then
  echo 'Error: envsubst is not installed.' >&2
  exit 1
fi

if ! [ -x "$(command -v nginx)" ]; then
  echo 'Error: nginx is not installed.' >&2
  exit 1
fi


# make local log file directories
mkdir -p var/log var/run

# set sane defaults for environment vars
export DEV_REMOTE_PROTOCOL=${DEV_REMOTE_PROTOCOL:=https}
export DEV_REMOTE_HOST=${DEV_REMOTE_HOST:=wallet.counterwallet.io}
export DEV_REMOTE_PORT=${DEV_REMOTE_PORT:=443}
export DEV_CODE_PATH=${DEV_CODE_PATH:="../"}
export DEV_PORT=${DEV_PORT:=8080}

# 
VARS='$DEV_PORT:$DEV_REMOTE_HOST:$DEV_REMOTE_PORT:$DEV_CODE_PATH'
envsubst "$VARS" < ./etc/includes/counterwallet.conf.template > ./etc/includes/counterwallet.conf

# start nginx
nginx -g 'daemon off;' -p ${PWD} -c etc/nginx.conf

