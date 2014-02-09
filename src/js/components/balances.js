
$('#createNewAddress').click(function() {
  if(WALLET.addresses.length >= MAX_ADDRESSES) { bootbox.alert("You already have the max number of addresses for a single wallet ("
    + MAX_ADDRESSES + "). Please create a new wallet for more."); return; }
  
  bootbox.dialog({
    message: "Enter the description you'd like to use for this new address:<br/><br/> \
     <input type='text' id='new_address_label' class='bootbox-input bootbox-input-text form-control'></input><br/><br/> \
     <b style='color:red'>Please NOTE that once you create a new address, you cannot delete it.</b>",
    title: "Create New Address",
    buttons: {
      success: {
        label: "Cancel",
        className: "btn-default",
        callback: function() {
          //modal will disappear
        }
      },
      create: {
        label: "Create Address",
        className: "btn-primary",
        callback: function() {
          var label = $('#new_address_label').val();
          
          if(!label) {
            return bootbox.alert("Label is blank. Please enter a description for this address and try again.");
          }
          if(label.length > 70) { //arbitrary
            return bootbox.alert("Label is too long. Please use a shorter label (< 70 characters).");
          }
          
          //generate new priv key and address via electrum
          var r = electrum_extend_chain(electrum_get_pubkey(WALLET.ELECTRUM_PRIV_KEY),
            WALLET.ELECTRUM_PRIV_KEY, WALLET.addresses().length /*-1 +1 = 0*/, false, true);
          //r = [addr.toString(), sec.toString(), newPub, newPriv]
          
          //set the description of this address
          $.jqlog.log("NEW address created: " + r[0]);
          WALLET.addKey(new Bitcoin.ECKey(r[1]), label);
          
          //update PREFS and push
          PREFERENCES['num_addresses_used'] += 1;
          PREFERENCES['address_aliases'][r[0]] = label;
          multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data) {
              //reload page to reflect the addition
              $('#content').load("xcp/pages/balances.html");
              //^ don't use loadURL here as it won't do a full reload and re-render the new widget
          });
        }
      },
    }
  });
});
