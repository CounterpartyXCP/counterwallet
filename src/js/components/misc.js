
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

function CreateSupportCaseViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.name = ko.observable('').extend({
    required: true,
    minLength: 3,
    maxLength: 75
  });
  self.email = ko.observable('').extend({
    required: true,
    email: true
  });
  self.problem = ko.observable('').extend({
    required: true,
    minLength: 20,
    maxLength: MAX_SUPPORT_CASE_PROBLEM_LEN
  });
  self.includeScreenshot = ko.observable(true);
  
  self.dispCharactersRemaining = ko.computed(function() {
    if(!self.problem() || self.problem().length > MAX_SUPPORT_CASE_PROBLEM_LEN) return '';
    return ' (<b>' + (MAX_SUPPORT_CASE_PROBLEM_LEN - self.problem().length) + '</b> characters remaining)';
  }, self);
    
  self.validationModel = ko.validatedObservable({
    name: self.name,
    email: self.email,
    problem: self.problem
  });

  self.resetForm = function() {
    self.name('');
    self.email('');
    self.problem('');
    self.includeScreenshot(true);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    $('#createSupportCaseModal form').submit();
  }
  
  self.sendSupportCase = function(screenshotData) {
    //make the call to the server, which will send out the email
    var caseInfo = {
      'name': self.name(),
      'from_email': self.email(),
      'problem': self.problem(),
      'screenshot': screenshotData,
      'addtl_info': JSON.stringify({
        'currentBlockID': WALLET.networkBlockHeight(),
        'currentMsgID': MESSAGE_FEED.lastMessageIndexReceived(),
        'useTestnet': USE_TESTNET,
        'devMode': IS_DEV,
        'walletID': WALLET.identifier(),
        'originURL': window.location.origin,
        'multiAPIList': cwURLs() ? cwURLs().join(', ') : 'UNKNOWN',
        'failoverIdx': MESSAGE_FEED.failoverCurrentIndex(),
        'browserEngine': $.layout.className,
        'resolution': screen.width + 'x' + screen.height,
        'userAgent': navigator.userAgent
      })
    };
    failoverAPI("create_support_case", caseInfo, function(data, endpoint) {
      bootbox.alert("Thank you, your information has been sent to our support team. You will receive further ticket information in your email.");
      trackEvent('Support', 'CaseCreated');
    });   
  }

  self.doAction = function() {
    self.hide(); //hide the dialog box now so that the screenshot shows the whole window
    if(self.includeScreenshot()) {
      //Take a screenshot
      html2canvas($("body").get(0), {
          "logging": true,
          "onrendered": function(canvas) {
              self.sendSupportCase(canvas.toDataURL("image/png"));
          }
      });    
    } else {
      self.sendSupportCase(null);
    }
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.shown(true);
    trackDialogShow('CreateSupportCase');
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
