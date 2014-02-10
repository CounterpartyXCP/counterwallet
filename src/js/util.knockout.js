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
      if(self.divisible() === false && numberHasDecimalPlace(parseFloat(val))) {
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
