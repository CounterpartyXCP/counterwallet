/* Knockout bindings */
ko.bindingHandlers.isotope = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      //HACK: isotope is initialized in getBalances
     
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var $el = $(element),
            value = ko.utils.unwrapObservable(valueAccessor());

        if ($el.hasClass('isotope')) {
            $el.isotope('reLayout');
        } else {
            $el.isotope({
                itemSelector: value.itemSelector
            });
        }
    }
};

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
  //http://stackoverflow.com/a/11270500
  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    var $this = $(element);

    // Set the title attribute to the new value = timestamp
    $this.attr('title', value);

    // If timeago has already been applied to this node, don't reapply it -
    // since timeago isn't really flexible (it doesn't provide a public
    // remove() or refresh() method) we need to do everything by ourselves.
    if ($this.data('timeago')) {
      var datetime = $.timeago.datetime($this);
      var distance = (new Date().getTime() - datetime.getTime());
      var inWords = $.timeago.inWords(distance);

      // Update cache and displayed text..
      $this.data('timeago', { 'datetime': datetime });
      $this.text(inWords);
    } else {
      // timeago hasn't been applied to this node -> we should do that now
      $this.timeago();
    }
  }
};


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
    validator: function (val, otherVal) {
        try {
          Bitcoin.Address(val);
          return true;
        } catch (err) {
          return false;
        }
    },
    message: 'This field must be a valid bitcoin address.'
};
ko.validation.rules['isValidQtyForDivisibility'] = {
    validator: function (val, self) {
      if(!self.divisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The amount must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['isNotSameBitcoinAddress'] = {
    validator: function (val, self) {
      return val != self.address();
    },
    message: 'Destination address cannot be equal to the source address.'
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
    update: function(element) {
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