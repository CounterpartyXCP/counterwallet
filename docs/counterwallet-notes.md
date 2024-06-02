---
title: Counterwallet notes
---

## More on multiple Counterwallet servers

For the time being, the Counterparty team itself operates the primary Counterwallet platform at `counterwallet.io`. However, as Counterwallet is open source software, it is possible to host your own site with Counterwallet site (for your personal use, or as an offering to others), or to even host your own Counterwallet servers to use with your own Counterparty wallet implementation. The Counterparty team supports and encourages this kind of activity (as long as the servers are secure), as it aids with increasing decentralization.
        
Also note that due to the nature of Counterwallet being a deterministic wallet, users using one Counterwallet platform (i.e. the official one, for instance) have the flexibility to start using a different Counterwallet platform instead at any time, and as funds (i.e. private keys) are not stored on the server in any fashion, they will be able to see their funds on either. (Note that the only thing that will not migrate are saved preferences, such as address aliases, the theme setting, etc.)

## Counterwallet MultiAPI specifics

Counterwallet utilizes a sort of a "poor man's load balancing/failover" implementation called multiAPI (and implemented
[here](https://github.com/CounterpartyXCP/counterwallet/blob/master/src/js/util.api.js)). multiAPI can operate in a number of fashions.

### multiAPIFailover for Read API (``get_``) Operations

*multiAPIFailover* functionality is currently used for all read API operations. In this model, the first Federated Node
on the shuffled list is called for the data, and if it returns an error or the request times out, the second one on the
list is called, and so on. The result of the first server to successfully return are used.

Here, a "hacked" server could be modified to return bogus data. As (until being discovered) the server would be in the
shuffled list, some clients may end up consulting it. However, as this functionality is essentially for data queries only,
the worse case result is that a Counterwallet client is shown incorrect/modified data which leads to misinformed actions
on the user's behalf. Moreover, the option always exists to move all read-queries to use multiAPIConsensus in the future should the need arise.

### multiAPIConsensus for Action/Write (``create_``) Operations

Based on this multiAPI capability, the wallet itself consults more than one of these Federated Nodes via consensus especially
for all ``create_``-type operations. For example, if you send XCP, `counterparty-server` on each server is still composing and sending
back the unsigned raw transaction, but for data security, it compares the results returned from all servers, and will 
only sign and broadcast (both client-side) if all the results match). This is known as *multiAPIConsensus*.

The ultimate goal here is to have a federated net of semi-trusted backend servers not tied to any one country, provider, network or
operator/admin. Through requiring consensus on the unsigned transactions returned for all ``create_`` operations, 'semi-trust'
on a single server basis leads to an overall trustworthy network. Worst case, if backend server is hacked and owned
(and the `counterparty-server` code modified), then you may get some invalid read results, but it won't be rewriting your XCP send
destination address, for example. The attackers would have to hack the code on every single server in the same exact
way, undetected, to do that.

Moreover, the Counterwallet web client contains basic transaction validation code that will check that any unsigned Bitcoin
transaction returned from a Counterblock Federated Node contains expected inputs and outputs. This provides further
protection against potential attacks.

multiAPIConsensus actually helps discover any potential "hacked" servers as well, since a returned consensus set with
a divergent result will be rejected by the client, and thus trigger an examination of the root cause by the team.

### multiAPINewest for Redundant storage

In the same way, these multiple servers are used to provide redundant storage of client-side preferences, to ensure we
have no single point of failure. In the case of the stored preferences for instance, when retrieved on login, the data from all servers
is taken in, and the newest result is used. This *multiAPINewest* functionality effectively makes a query across all available
Federated Nodes, and chooses the newest result (based on a "last updated"-type timestamp).

Note that with this, a "hacked" server could be modified to always return the latest timestamp, so that its results
were used. However, wallet preferences (and other data stored via this functionality) is non-sensitive, and thus user's
funds would not be at risk before the hacked server could be discovered and removed.
