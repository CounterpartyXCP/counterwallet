Counterwallet
================

Online Webwallet for [Counterparty](http://www.counterparty.co).

Originally based off of [Carbonwallet](http://www.carbonwallet.com) (however more than 90% of the original code has been removed or rewritten).

Website (mainnet): https://counterwallet.co
Website (testnet): https://testnet.counterwallet.co

Features:

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
- Internet Explorer 11+ (IE9 and IE10 NOT supported)
- Safari 7+
- Opera 15+

**Mobile**

- IOS Safari 7+
- Android Browser 4.4+
- Chrome for Android 33+
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



Licence
-------------------

http://opensource.org/licenses/CDDL-1.0
