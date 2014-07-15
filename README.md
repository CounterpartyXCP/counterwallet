Counterwallet
================

Online Webwallet for [Counterparty](http://www.counterparty.co).

Originally based off of [Carbonwallet](http://www.carbonwallet.com) (however virtually all the original code has been removed or rewritten).


Production Systems
-------------------

* Mainnet: **[counterwallet.co](https://www.counterwallet.co/)**
* Testnet: **[testnet.counterwallet.co](https://testnet.counterwallet.co/)**


Features
----------

- Deterministic wallet addresses (BIP 32-based)
- Supports the majority of Counterparty functionality
- Fully-AJAX driven
- Anonymous
- Runs in the browser, with keys created in memory


Browser Support
-------------------

**Desktop**

- Chrome 23+ (Preferred)
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

Setting up your own Counterwallet Server
-----------------------------------------

See [this link](https://github.com/CounterpartyXCP/counterpartyd_build/blob/master/docs/SettingUpAFederatedNode.rst) for more info.


Licence
-------------------

http://opensource.org/licenses/CDDL-1.0
