### v1.4.0 (Unreleased) ###
**Enhancements:**
* Added new DEx interface
* Added Armory Offline signing support
* Added page-level help for balances and exchanges (with more coming in the future, as necessary)

**Fixes:**
* Significant performance and reliability improvements (on the counterblockd side)
* Numerous minor fixes
* Minor UI tweaks

### v1.3.0 (~2014-07-13) ###
**Enhancements:**
* Added Rock-Paper-Scissors
* Added Zeroconf support (show pending balances for assets)
* Added IP-based blocking for betting, RPS and dividend issuance. We are currently blocking people
  with US-based IP addresses from using these features on counterwallet.co itself.

**Fixes:**
* Fixed issue with asset name validation (length checking was incorrect)
* Fixed issue with History page not showing balance history properly anymore
* Fixed up and improved stats page
* Numerous minor fixes

### v1.2.2 (~2014-06-25) ###
**Enhancements:**
* Check double connection to prevent double btcpay
* Cancel bet buttons

### v1.2.1 ###
**Enhancements:**
* Added wallet-level statistics and logging of wallet logins

**Fixes:**
* Broadcast feeds with enhanced feed info with a protocol prefix now are seen properly


### v1.2.0 ###
**Enhancements:**
* Added in binary option and CFD functionality
* Simplified menu layout

**Fixes:**
* numerous minor fixes

### v1.1.6 ###
**Enhancements:**
* Phrasing change: Dividends -> Distributions, Asset -> Token

**Fixes:**
* numerous minor fixes

### v1.1.5 ###
**Enhancements:**
* moved to using the bitcore library
    
**Fixes:**
* numerous minor fixes

### v1.1.4 ###
**Enhancements:**
* added stats page
    
**Fixes:**
* ignore dust with orders
* open orders in the open order box should decrease properly as they are matched
* moved to using VWAP over last 8 trades for the market price

### v1.1.0 ###
**Enhancements:**
* A restrictive content security policy (CSP) is in use, which GREATLY reduces the exposure and effectiveness of any cross site scripting (XSS) attacks. Inline script injection/eval is basically impossible now (unless it is a browser bug, or being done by an installed browser plugin). This required a code overhaul to support. More info: http://www.html5rocks.com/en/tutorials/security/content-security-policy/

**Fixes:**
* Tightened up XSS defenses numerous places
* Wallet passphrase generation algorithm improved (added entropy and removed fallback to the JS-based prng, which had issues)
* Numerous other security improvements
* Sweeping overhauled...should work much better now
* Many smaller bug fixes

### v1.0.0 ###
* MAINNET RELEASE
* numerous bug fixes

### v0.9.5 ###
**Enhancements:**
* implemented asset description json and asset pictures, yay (see https://wiki.counterparty.co/w/Enhanced_Asset_Info_in_Counterwallet)
* added 7 sample moving average to price charts
* show # characters remaining when typing asset description
* we now wait 6 blocks on an order match before doing a BTCpay (we do this for protection against a reorg making an order match disappear)
    
**Fixes:**
* open trades show properly in non-BTC pairs (thanks rotalumis for pointing this out)
* debugging info now shows block number and last message ID properly, as well as backend API URL list
* go off of tx_hash instead of tx_index where it matters, as tx_index can change between updates
* fixed bug in order fee_required/fee_provided dispay (was showing the full amount instead of the remaining amount)
* when overriding the market rate, clear the text box when switching between "as unit price" and "as quantity" (thanks rotalumis)
* refactored feed_ objects in several areas
* on testnet burn dialog, if BTC balance is less than possible burn amount, show that as max amount possible to burn instead (thanks to phantom for finding)
* price charts group action on an hourly basis, instead of on a per block basis (which made the concept of using ohlc candlesticks not very useful in many cases)
* Added verbage in when making a trade with an overridden unit price that tells you how much it will cost in total (this was missing)
* TopAssets/Portfolio: 24h volume and 7d market volume was off.... it is now calucated on regular basis (at least once a day) for all assets with trading data
* use anonymous knockout validation rules where possible
* empty XCP balance should show as '0' instead of '??'
* if a user is banned from chat, they shouldn't be able to /msg others
* tweaks and fixes to work with newest counterpartyd changes (e.g. working with new 'open' order status)
* we now filter out negative fee_required_remaining and fee_provided_remaining value items
    
### v0.9.4 ###
**Enhancements:**
* when wanting to do a trade where BTC we will purchased (i.e. a btcpay is required), show the online status of counterwallet users (as available) with trades appearing that offer to sell BTC. this is important because BTCpays must complete in a certain (shortish) period of time, and trading with a user that is marked online has a higher percentage chance of fully going through. online status is tracked by the server in an anonymous fashion (i.e. using the walletID identifier). Note that this change does not work with old trade (it will only work with trades that are made *after* this update is put into place)
* added /online command to chat, which will tell you if the user you specify is online or not (e.g. type "/online cityglut" to see if cityglut currently has counterwallet running).
* added /msg command to chat for private messaging between handles...e.g. /msg halfcab yo wazzup

**Fixes:**
* chat div is properly scrolled to the bottom when displaying
* market cap point calculation tweaked to not get multiple calculations per block, and to calculate market cap off the last trade for a given asset in a given block
* fixed an issue with manual BTCpays not working (due to a reference to an invalid variable name)
* options dialog did not properly display Auto BTC Pay and Auto Prime settings
* MessageFeed logic encapsulated and better structured
* fixed a bug with open order amounts showing incorrectly (thanks rotalumis)
* orders (view prices) page had a few bugs that were fixed
* clean whitespace on entered passphrases (thanks canton)

### v0.9.3 ###
**Enhancements:**
* Added "View Prices" screen, which allows you to view the market for a specific asset pair without having to pretend like you want to do a buy/sell

**Fixes:**
* fixed market cap 7d graph on the leaderboard table and portfolio table
* attempted fix for open orders properly updating, especially with orders where BTC is involved
* fixed: if balance was exceeded on buysell tab 2 when entering a overridden unit price, you could move on to the 3rd tab. added a validator to prevent this
* fixed: if on tab 2 on the buysell page, and open orders are in the open orders table, and you go back to tab 1, and select a different buy asset, an assertion error would be thrown.
* login page should be scrollable now, and additional css tweaks to make it display better on mobile devices and tablets
* hopefully fixed a bug where if counterparty/coutnerwalletd were in the process of processng a block at the same time a client made a request, it would log the client out (saying that the server is not caught up to the blockchain)...this check is more tolerant now

### v0.9.2 ###
**Enhancements:**
* added the ASSET LEADERBOARD functionality, which shows the top 100 counterparty assets (that have actual trade data)* asset market info is now pre-compiled (i.e. calculated and stored) every 10 minutes, due to the addition of the asset leaderboard* added notification pane messages for bets and broadcasts
* servers store chat history now in database, and added get_chat_history() call. 
* because of the above, chat history persists between server restarts (so you still get the newest line even if the counterwalletd service needs to be restarted)
* fixed up and enhanced the Asset Portfolio page

**Fixes:**
* modified address creation button to be more clear (people were missing the create watch address option as it was a combo button)
* buy/sell: order book display changed to percentages based adaptive display instead of absolute fee based (i.e. works as it should now :) 
* chat handle completion on tab is now case insensitive
* choosing your handle when starting a chat for the first time now will tell you if the handle is in use or not
* fixes for nginx "crash" situation, fix correctly closing unused sockets in counterwalletd in one or two places
* address sweeping was borked. fixed.
* chat was totally clearing history after 200 lines when it should have just been removing the first 5 lines
* 0.9.2.1: bug fix for counterwalletd not properly rebuilding its app_config collection if the cwd DB version went up

### v0.9.1 ###
**Enhancements:**
* added tab name completion on the chat box (pretty neat)
* added up/down arrow history in the chatbox (pretty neat as well)
* using $.jqlog.debug() for most messages (so they will go away once we get on mainnet for everyone but developers)
* the system automatically bolds any chat lines with your handle mentioned in them
* added the ability to click on an open order and auto populate the buy info in the buy/sell page (idea from Adam Levine, thanks!)
* added versioning - version is shown on the options page

**Fixes:**
* fix for regression with last release that broke asset issuance (asset issuance should work again now)
* buy/sell: fixed the super annoying blank addresses in dropdown bug
* fixed: when overriding market rate it says "there is currently insufficent data"...it should only say that if there is indeed insufficient data
* fixed On buysell page: buy/sel quanntity left sometimes shows scientific notation
* fixed issue with order panes appearing after awhile while on the first step of buy/sell wizard (iif you went back to that from the second step)
* buy/sell: fixed text "flashing" issue when loading 2nd step
* buy/sell: fixed issue with duplicate open orders displaying
* fix for when transferring a locked asset, the locked setting not being correctly maintained (it would show up in the new address as a non-locked asset)
* fixed issue with BTC sends between two addresses in the same wallet not removing pending (cloud) icon from the destination address once confirmed
