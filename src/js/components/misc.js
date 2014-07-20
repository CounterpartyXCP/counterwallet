
function SupportModalViewModel() {
  var self = this;
  
  self.shown = ko.observable(false);
  self.type = ko.observable(null);
  
  self.show = function(type) {
    assert(['general', 'balancesPage', 'exchangePage'].indexOf(type) !== -1, "Unknown support modal type");
    self.type(type);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
