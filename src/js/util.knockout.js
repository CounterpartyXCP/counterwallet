
ko.subscribable.fn.trimmed = function() {
    return ko.computed({
        read: function() {
            return typeof this() == "string" ? this().trim() : this();
        },
        write: function(value) {
            this(typeof value == "string" ? value.trim() : value);
            if(typeof value == "string") this.valueHasMutated();
        },
        owner: this
    });
};

//http://stackoverflow.com/a/18184016
ko.subscribable.fn.subscribeChanged = function (callback) {
    var oldValue;
    this.subscribe(function (_oldValue) {
        oldValue = _oldValue;
    }, this, 'beforeChange');

    this.subscribe(function (newValue) {
        callback(newValue, oldValue);
    });
};

/* Knockout bindings */
ko.bindingHandlers.showModal = {
  init: function (element, valueAccessor) {
  },
  update: function (element, valueAccessor) {
    var value = valueAccessor();
    if (ko.utils.unwrapObservable(value)) {
      $(element).modal('show');
                          // this is to focus input field inside dialog
      $("input", element).focus();
    }
    else {
      $(element).modal('hide');
    }
  }
};

ko.bindingHandlers.timeago = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = valueAccessor();
        var valueUnwrapped = ko.unwrap(value);
        element.title = moment(valueUnwrapped).toISOString();
        $(element).timeago();
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var value = valueAccessor();
        var valueUnwrapped = ko.unwrap(value);
        element.title = moment(valueUnwrapped).toISOString();
        $(element).timeago('update', element.title);
    }
}

ko.bindingHandlers.datetimepicker = {
  init: function(element, valueAccessor, allBindingsAccessor) {
    //initialize datepicker with some optional options
    var options = allBindingsAccessor().datepickerOptions || {};
    $(element).datetimepicker(options);

    //when a user changes the date, update the view model
    ko.utils.registerEventHandler(element, "change.dp", function(event) {
       var value = valueAccessor();
       if (ko.isObservable(value) && event.date) {
         value(event.date.toDate());
       }                
    });
  },
  update: function(element, valueAccessor)   {
    var widget = $(element).data("DateTimePicker");
     //when the view model is updated, update the widget
    if (widget) {
      var date = ko.utils.unwrapObservable(valueAccessor());
      if (date) {
          widget.setDate(date);
      }
    }
  }
};

  
/* 
 * Shared knockout Validation custom rules
 */
ko.validation.rules['isValidBitcoinAddress'] = {
    validator: function (val, self) {
        try {
          var address = new Bitcoin.Address(val);
          return address.version == (USE_TESTNET ? Bitcoin.network.testnet.addressVersion : Bitcoin.network.mainnet.addressVersion);
        } catch (err) {
          return false;
        }
    },
    message: USE_TESTNET ? 'This field must be a valid TESTNET Bitcoin address.' : 'This field must be a valid Bitcoin address.'
};
ko.validation.rules['isValidBitcoinAddressIfSpecified'] = {
    validator: function (val, self) {
        try {
          if(!val) return true; //the "if specified" part of the name :)
          var address = new Bitcoin.Address(val);
          return address.version == (USE_TESTNET ? Bitcoin.network.testnet.addressVersion : Bitcoin.network.mainnet.addressVersion);
        } catch (err) {
          return false;
        }
    },
    message: USE_TESTNET ? 'This field must be a valid TESTNET Bitcoin address.' : 'This field must be a valid Bitcoin address.'
};
ko.validation.rules['isValidQtyForDivisibility'] = {
    validator: function (val, self) {
      if(!self.divisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The quantity entered must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['isNotSameBitcoinAddress'] = {
    validator: function (val, self) {
      return val != self.address();
    },
    message: 'Destination address cannot be equal to the source address.'
};
ko.validation.rules['isValidPositiveQuantity'] = {
    validator: function (val, self) {
      return val.toString().match(/^[0-9]*\.?[0-9]{0,8}$/) && parseFloat(val) > 0;
    },
    message: 'Must be a valid quantity (positive num with max 8 decimal places)'
};
ko.validation.registerExtenders();


//Bootstrap 3 button toggle group handler: http://stackoverflow.com/a/20080917 (with FIX)
ko.bindingHandlers.btnGroupChecked = {
  init: function (element, valueAccessor, allBindingsAccessor,
  viewModel, bindingContext) {
    var value = valueAccessor();
    var newValueAccessor = function () {
        return {
            change: function () {
              if($(element).is(":disabled")) return;
              value(element.value);
            }
        }
    };
    ko.bindingHandlers.event.init(element, newValueAccessor,
    allBindingsAccessor, viewModel, bindingContext);
  },
  update: function (element, valueAccessor, allBindingsAccessor,
  viewModel, bindingContext) {
    if ($(element).val() == ko.unwrap(valueAccessor()) && !$(element).is(":disabled") ) {
      //$(element).closest('.btn').button('toggle');
      $(element).addClass('active');
    } else {
      $(element).removeClass('active');
    }
  }
}

ko.bindingHandlers.select2 = {
  //From https://github.com/ivaynberg/select2/wiki/Knockout.js-Integration
  init: function(element, valueAccessor, allBindingsAccessor) {
      var obj = valueAccessor(),
          allBindings = allBindingsAccessor(),
          lookupKey = allBindings.lookupKey;
      $(element).select2(obj);
      if (lookupKey) {
          var value = ko.utils.unwrapObservable(allBindings.value);
          $(element).select2('data', ko.utils.arrayFirst(obj.data.results, function(item) {
              return item[lookupKey] === value;
          }));
      }

      ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
          $(element).select2('destroy');
      });
  },
  update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
    //if(!allBindingsAccessor().options.length) $(element).select2("val", "");
    $(element).trigger('change');
  }
};

ko.bindingHandlers.sparkline = {
  update: function (element, valueAccessor, allBindingsAccessor, viewModel)
  {
    var value = ko.utils.unwrapObservable(valueAccessor());
    var options = allBindingsAccessor().sparklineOptions || {};
    $(element).sparkline(value, options);
  }
};

ko.bindingHandlers.fadeVisible = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).fadeIn() : $(element).fadeOut();
    }
};

ko.bindingHandlers.fadeVisibleInOnly = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).fadeIn() : $(element).hide();
    }
};

/*ko.bindingHandlers.fadeVisibleInOnlyKeepLayout = {
    init: function(element, valueAccessor) {
        // Initially set the element to be instantly visible/hidden depending on the value
        var value = valueAccessor();
        $(element).toggle(ko.unwrap(value)); // Use "unwrapObservable" so we can handle values that may or may not be observable
    },
    update: function(element, valueAccessor) {
        // Whenever the value subsequently changes, slowly fade the element in or out
        var value = valueAccessor();
        ko.unwrap(value) ? $(element).animate({opacity:1}) : $(element).show().css({opacity:0});
        //ko.unwrap(value) ? $(element).animate({opacity:100}) : $(element).show().animate({opacity:0});
    }
};*/

ko.bindingHandlers.fadeInText = {
    'update': function(element, valueAccessor) {
        $(element).hide();
        ko.bindingHandlers.text.update(element, valueAccessor);
        $(element).fadeIn('slow');
    }
};