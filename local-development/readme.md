Local Counterwallet Development Instructions
============================================

Introduction
-------------------------------

To develop on counterwallet locally, this folder contains configuration for a local nginx server that can proxy requests to a remote counterwallet instance.

You may use your own remote counterwallet server or the public counterwallet server at wallet.counterwallet.io.


Usage
-------------------------------


### Requirements

- a local copy of nginx
- A mime.types file at /etc/nginx/mime.types.  On home nginx with Mac, do `sudo ln -s /usr/local/etc/nginx/mime.types /etc/nginx/mime.types`
- `envsubst`. On mac do `brew install gettype && ln -s /usr/local/Cellar/gettext/0.19.8.1/bin/envsubst /usr/local/bin/envsubst`

### Start the Script

Basic Usage:
```
cd development
./run-dev-server.sh
```

To customize the remote counterwallet host:
```
cd development
DEV_REMOTE_HOST="my.other-server.io" ./run-dev-server.sh
```

### Visit the application

Visit http://127.0.0.1:8080/?testnet=1 in your web browser.  You can also use http://127.0.0.1:8080/src/?testnet=1 for the unminified sources when making changes.

To change the port 8080 to another part, start the script with:
```
cd development
DEV_PORT="18888" ./run-dev-server.sh
```


Limitations
-------------------------------

- This works for testnet only


Important: Use For Development Only
-------------------------------

Use this for development only, as the local requests are not sent securely by default.
