[![Build Status Travis](https://travis-ci.org/CounterpartyXCP/counterwallet.svg?branch=develop)](https://travis-ci.org/CounterpartyXCP/counterwallet)
[![Build Status Circle](https://circleci.com/gh/CounterpartyXCP/counterwallet.svg?&style=shield)](https://circleci.com/gh/CounterpartyXCP/counterwallet)
[![Slack Status](http://slack.counterparty.io/badge.svg)](http://slack.counterparty.io)

Counterwallet
================

Online Webwallet for [Counterparty](http://www.counterparty.io).

Originally based off of [Carbonwallet](http://www.carbonwallet.com) (however virtually all the original code has been removed or rewritten).


Production Systems
-------------------

* Main page: **[counterwallet.io](https://counterwallet.io/)**
* Primary server -- Mainnet: **[wallet.counterwallet.io](https://wallet.counterwallet.io/)**
* Primary server -- Testnet: **[wallet-testnet.counterwallet.io](https://wallet-testnet.counterwallet.io/)**


Features
----------

- Deterministic wallet addresses (BIP 32-based)
- Supports the majority of Counterparty functionality
- Fully-AJAX driven
- Anonymous
- Runs in the browser, with keys created in memory
- Multi-sig

Browser Support
-------------------

**Desktop**

- Chrome 23+ (preferred browser)
- Firefox 25+
- Safari 7+
- Opera 15+

Notably, Internet Explorer is **not** supported, due to its lack of full Content-Security-Policy support (even with IE 11).

**Mobile**

- IOS Safari 7+
- Android Browser 4.4+
- Chrome for Android 33+
- Chrome for iOS 35+
- Firefox for Android 26+


Build Instructions
-------------------

### Before running the build system:
```
sudo npm install -g grunt-cli bower
```

### To build:
```
cd src; bower install; cd ..
npm install
```

### To (re)build the static (i.e. minified) site:
```
grunt build
```

### To regenerate dependencies hash file (```src/.bowerhashes```):
```
grunt freeze
```

### To enable localizations (optional):
1. Create an account on [Transifex](https://www.transifex.com/)
2. In your home directory, create a file named `.transifex` and put your Transifex username and password into it in this format: `user:password`
3. Run `grunt build` to download translations
4. Add the languages you want to support to `AVAILABLE_LANGUAGES` in **counterwallet.conf.json** - you can use **counterwallet.conf.json.example** as a template. The template file contains **only** the setting relevant to languages and does not replace the rest of variables required in that file (refer to Federeated Node documentation for additional details about `counterwallet.conf`).

Setting up your own Counterwallet Server
-----------------------------------------

See [this link](http://counterparty.io/docs/federated_node/) for more info.

Development
-----------

### Local Dev Env
The easiest way to develop locally;

 - `sudo npm install -g serve`
 - open a seperate terminal and `cd build/` and run `serve`
 - add `"https://wallet.counterwallet.io"` to your `servers` in `counterwallet.conf.json`
 - use the following to build: `grunt build --dontcheckdeps --dontminify && cp counterwallet.conf.json build/`
    - the `--dontcheckdeps` speeds up the process and avoids having to do `grunt freeze` everytime you make a change to a dependency during development
    - the `--dontminify` makes your debugging life a bit easier
    - the `cp` is neccesary because grunt keeps clearing the `build` folder
 - visit `http://localhost:3000` (or you can specify a different port for `serve` if you like)
 
 - **extra**; if you want to test your local version on another device (or let another person test something) use https://ngrok.com to setup a tunnel to your local env
 
### Note concerning `npm install`
`npm install` triggers a `prepublish` which is configured to do `grunt build` 
and will bork if you haven't done a `grunt freeze` after making changes to dependencies.
You can use `npm update` to circumvent this during development.

### Running tests in browser
You can run tests in your browser by doing the above steps and;
 - open a seperate terminal and [from the root of the project, not from `build/` run `serve -p 3001` (different port)
 - visit `http://localhost:3001/test/test.html`

### Running tests from CLI (using phantomjs headless browser)
 - `npm test`


Licence
-------------------

http://opensource.org/licenses/CDDL-1.0

