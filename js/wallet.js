var WALLET = new function ()
{
  this.keys = [];
  this.balances = [0,0,0,0,0,0,0,0,0,0];
  
  // Methods
  this.textToBytes = function(text) {
    return Crypto.SHA256(text, { asBytes: true });
  };
  
  this.getKeys = function() {
    return this.keys;
  };
  
  this.getBalances = function() {
    return this.balances;
  }
  
  this.createBalanceFunction = function(i) {
      return function(text) { 
        WALLET.getBalances()[i] = parseInt(text);
        
        // TODO, disconnect GUI code from backend.
        $('#balance' + i).text(
          Bitcoin.Util.formatValue(WALLET.getBalances()[i]));           
      };
  }
  
  this.updateAllBalances = function() {
    
    var funcs = [];
    
    for(i = 0; i < this.getKeys().length; i++)
    {
      funcs[i] = this.createBalanceFunction(i);
      BLOCKCHAIN.retrieveBalance(this.getKeys()[i].getBitcoinAddress().toString(), funcs[i]); 
    }
  }
}
