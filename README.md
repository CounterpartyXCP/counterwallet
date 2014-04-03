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
