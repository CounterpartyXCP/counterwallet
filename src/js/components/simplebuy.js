
function SimpleBuyViewModel() {

  var self = this;
  
  self.machines = ko.observableArray([]);

  self.init = function() {
    failoverAPI('get_vennd_machine', [], self.prepareMachinesData);
  }

  self.prepareMachinesData = function(data) {
    self.machines([]);

    for (var m in data) {
      var attributes = []
      if (data.type == 'vending machine') {
        attributes.push({
          
        })
      }
    }

    self.machines(data);
  }
  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
