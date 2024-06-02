---
title: Counterwallet FAQ
---


## What is Counterwallet?

**Counterwallet is an open-source web wallet for Bitcoin (BTC) and [Counterparty](https://github.com/CounterpartyXCP/) (XCP), the world’s first protocol for decentralized financial tools. It is built using Javascript, Bitcoin libraries and Counterparty software.**

* Counterwallet handles transaction signing locally, which means your passphrase and private keys never leave your browser. 

* Additional security features such as m-of-n (max 3) multi-signature addresses, watch-only, and [Armory](counterwallet-tutorials/create-armory-addresses.md) addresses are also natively supported.

* All trades and actions made with Counterwallet use a secure automatic escrow system within the Bitcoin blockchain, which means that unlike centralized exchanges, _no middleman is ever required_.

## What are some of Counterwallet's features?

-  Supports BTC, XCP and all Counterparty assets
-  Create and manage new assets (tokens) on the Bitcoin blockchain
-  Distribute profits to asset holders using BTC, XCP, or any other
   Counterparty token (asset)
-  Broadcast data feeds to the Bitcoin network
-  Trade XCP for any Counterparty asset (peer-to-peer)
-  Access P2P assets with no middleman, and no counterparty risk
-  Monitor the Counterparty network statistics
-  Strong privacy - no registration required; you can run your own
   Counterwallet
-  Multilingual (English, Chinese, Russian and other languages) -
   [become a translator!](https://www.transifex.com/organization/counterparty/dashboard/counterwallet)
-  Deterministic hierarchical wallet
-  Supports desktop and mobile browsers
-  Client-side authentication/encryption
-  Cold storage support (with Armory)
-  Multi-sig support (up to 3-of-3)
-  Watch-only addresses

## Where can I access it?

Counterwallet (CW) hosted by the Counterparty project is available at [Counterwallet.io](https://counterwallet.io/). However, because Counterwallet source code is [open source](https://github.com/CounterpartyXCP/counterwallet/), anyone can host and alter their own instance of Counterwallet. Those instances, however, are not under control of Counterparty.io, so it is up to the user to assess reliability and trustworthiness of the host. 

## What is an Asset/Token/Coin? How can I store them?

Assets (also known as tokens or coins) are user-created currencies that are stored inside the Bitcoin blockchain using Counterparty technology. Anyone can create their own. 

All Counterwallet addresses are regular Bitcoin addresses. You can store BTC, XCP, and user created assets on any Counterwallet address. In fact, you can store any of these currencies on any regular Bitcoin address as well, provided that you have access to the private key of that address.

(Altcoins that have their own blockchain, which is seperate from the Bitcoin blockchain, are not supported.)

## I want to trade a certain asset, is it legitimate?

Assets/tokens are issued on the Bitcoin blockchain directly. This means that anyone with access to the internet is able to create and trade tokens freely without restrictions. There is no way to block Bitcoin addresses and transactions, which means that there is also no way to limit any Counterparty activity. We recommend significant due diligence and research before trading. Counterwallet does not filter any assets. Please check the official website of whatever asset/token you are planning to trade, and make sure to verify that it is legitimate. 

## Is Counterwallet down?

Counterparty health status monitor is available [here](http://platform.counterparty.io/). Should the server you're connecting to be unresponsive or time out, you can try to directly access another of servers listed at [counterwallet.io](https://counterwallet.io/). It is also possible that Counterwallet is being updated or dealing with a blockchain reorganization.

## Counterwallet is offline. Can I still access my funds?

Yes, and your orders and assets are still there*. You can mathematically generate your public and private keys using your passphrase. Since the addresses are generated on the fly using JavaScript, it is possible to do this in your own browser (even offline). You can use [this tool](https://blockscan.com/tool_generatekey). 

* The Counterparty Distributed Exchange is actually part of the Bitcoin blockchain. This means that Bitcoin itself would have to be shut down entirely in order for it to go offline.

## How does Counterwallet make profit?

It doesn't! Counterwallet development is a public service to the Counterparty and Bitcoin community. If you would like to contribute, you can click the donate button within Counterwallet itself. Or you can fork [the code](https://github.com/CounterpartyXCP/counterwallet/) and contribute that way.

## Can I try Counterwallet on testnet?

Yes, you can test Counterwallet by using a testnet instance located at [testnet.counterwallet.io](https://testnet.counterwallet.io/). Once you log on, get some testnet Counterparty tokens from the faucet as explained on the welcome page.

## Can I use Counterwallet with Armory?

Sure.

Add an address in an offline armory wallet, [here's how](https://bitcoinarmory.com/about/using-our-wallet/)
to your Counterwallet, and do something with the address (like send some XCP from that address), which will produce the armory unsigned transaction text. Copy it to a USB key, take it to your offline computer running Armory (which has the private keys), sign it on that computer via the Armory GUI, and then broadcast the signed transaction back in Counterwallet.

This will make use of assets owned in this address very secure... Basically Armory will act as cold storage of Counterparty assets, with almost the usability of a hot wallet.

## I logged in and my address is different, and I have no balance! Help!

In rare circumstances an address can disappear from the view. You can add another address from the Counterwallet user interface and in all likelihood the address will reappear. Otherwise you can use [this tool](https://blockscan.com/tool_generatekey) to obtain the private key for the missing address and then use the import feature in Counterwallet to import its assets to another address in your Counterwallet.

## I sent BTC to Counterwallet, why doesn't it show up?

It either was not sent, or it has not arrived. To check for BTC transactions, use a Bitcoin blockchain explorer (e.g. blockchain.info) and to check for XCP and other Counterparty-based tokens, use xchain.io or coindaddy.io.
    
## Why do I need small amounts of Bitcoin to do things in Counterwallet?

Counterparty builds directly on top of the Bitcoin network, and every Counterparty transaction is a Bitcoin transaction as well. This means that Counterparty transactions are the same as as Bitcoin transactions, with some information attached. 

Because of this, Counterparty transactions must pay a small BTC fee to the Bitcoin miners for each transaction sent. Beyond being a sign of our commitment to the health of the Bitcoin network, this allows Counterparty transactions to be given a high priority and be confirmed quickly.

If speed of confirmation is not as important to you as the fee amount paid, note that it is possible to have lower fees in Counterparty, especially involving bulk sends. This functionality will also be coming to Counterwallet as well.

## Does Counterwallet support two-factor authentication?

Currently, no. But you can create multi-signature addresses to better protect your assets.

## What else do I need to know?

- All encryption is handled client-side. Neither your passphrase nor any of your private information ever leaves your browser. This also means that there is no password recovery, so make sure you do not lose your passphrase.

- Because Counterwallet does not store your credentials, it has no access to your information. However it is important to use a reputable Counterwallet provider.

- Because of the US government regulations, betting functionality is limited to non-US-based client IP addresses by default. This is not a limitation of the protocol itself. Please ensure that the use-case you are aiming for is legal within your jurisdiction, and seek professional legal advice when starting a project.

## Can I run my own Counterwallet server?

Yes, although that requires a full bitcoin node and some technical knowledge. Please refer to [this page](../advanced/federated-node/getting-started.md) for details on how to setup a Counterparty Federated Node. If you are starting from scratch, it may take several days to download and index the bitcoin blockchain.

## I want to translate Counterwallet to my language

Translations are hosted at [Transifex](https://www.transifex.com/organization/counterparty/dashboard/counterwallet). Open an account (or login with Github) and contribute as a translator or reviewer. We appreciate any contributions.
