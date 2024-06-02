---
title: Using multisig with Counterwallet
---

Counterparty and Counterwallet support a basic form of multisig. Here’s an example of the process involved with creating and sending to and from a multisig address. Currently, 1-of-2, 2-of-2, 1-of-3, 2-of-3 and 3-of-3 multisig are supported at the moment. 

In this example, we’ll use a **2-of-3** multisig. With our multisig support, you may send and receive Bitcoin or any Counterparty asset (including XCP) in Counterwallet.

## Creating a 2-of-3 multisig address:
* Create 3 separate Counterwallet accounts. (Each one will normally be owned by a separate person, although this is not a requirement.)
* Each new wallet will have 1 Bitcoin/Counterparty address by default. That will be utilized for the multisig
* Send some Bitcoin to each address in each of the 3 wallets
* For each address in each of the 3 wallets, send a very small amount (e.g. 0.0001) from them back to the sender address. This is necessary to broadcast each address' public key onto the blockchain, which Counterparty multisig currently requires to operate.
* In the first Counterwallet, click **Create New Address**, then choose **Create Multisig Address**
* On the dialog that appears, select 2-of-3 for **Type**, and enter the 3 addresses from the 3 separate Counterwallet accounts
* A multisig address entry will be created in that first Counterwallet account. Get that address by clicking on address area of the titlebar for it, and copying it. It will be in a format like: _2_1HrSbJR3fcjCDrp2mMJCzGrWR7jtYu4wq5_1Dzfoo4QmhMtHNthmC8hZBry3KPS9FUtgo_152f1muMCNa7goXYhYAQC61hxEgGacmncB_3_
* Send a bit of BTC (e.g .001, .005, etc) to this multisig address from another address in your Counterwallet. This will be necessary for sending things _from_ the multi-sig address

## To Receive BTC or a Counterparty asset to the multisig address:
* You can send to this address from another Counterwallet address just like you would with any other address, e.g. click **Send** for the appropriate asset in the appropriate sending address, paste in the full multisig address (as in above), and click **Send** again.

## To Send BTC or a Counterparty asset from the multisig address:
* Log into the Counterwallet for the first multisig signer (which will have the entry for the multisig address)
* For the multisig address, click Address Actions, click **Send** for the appropriate asset, and fill out the required info.
* A raw unsigned TX will be produced once the Send dialog’s **Send** button is clicked 
* On the 1st address that makes up that multisig (which, following this example, should be in that same Counterwallet account), click **Address Actions**, then click **Sign Transaction**
* Paste in the unsigned transaction and click **Sign**
* Copy the resultant text and send (email, etc) to the 2nd party
* The 2nd party will then do the same thing (sign the transaction in their Counterwallet account from their address that makes up 1 of the 3-of-3 multisig), except instead of clicking Sign, they will click **Sign and Broadcast**, as they will be the last signer.
* (**NOTE:** If you were doing this with a 3-of-3 multisig address, for instance, the 2nd party would instead just click **Sign** and then send to the 3rd party, who would do **Sign and Broadcast**. I.e. you will get as many signatures as you need, and the last party will sign and broadcast the transaction.)
* Upon clicking this, the fully signed multisig transaction is broadcast on the network and, once confirmed, the sent funds are disbursed.
