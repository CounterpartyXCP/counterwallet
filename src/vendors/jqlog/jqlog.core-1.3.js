/*
 * jQuery.jqlog 1.3
 *
 * A logging framework plugin for jQuery.
 *
 * Copyright © 2009 Paul Bevis.
 *
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * http://code.google.com/p/jqlog/
 */ 

// Create the jqlog namespace.
jQuery.jqlog = {
    
    // Private enabled flag.
    _enabled: false,
    
    version: "1.3",

    /*
    Stores the currently registered log targets.  All log target objects must implement a 
    log target function that accepts a log entry object.
    */
    targets: [],
    
    /*
    Default log entry structure.
    */
    entryDefaults: {
        timestamp: null,
        message: "",
        format: function() {
            var msg = this.message;
            if (typeof this.message != "object") {
                msg = "[" + this.timestamp.getDate() + "/" + (this.timestamp.getMonth() + 1) + "/" + this.timestamp.getFullYear() + " " + this.timestamp.getHours() + ":" + this.timestamp.getMinutes() + ":" + this.timestamp.getSeconds() + "." + this.timestamp.getMilliseconds() + "] " + this.message.toString();
            }
            return msg;
        }
    },
    
    /*
    Default target structure.
    */
    targetDefaults: {
        name: "",
        log: function(entry) {}
    },    
    
    /*
    Indicates whether or not logging is enabled.  Default is false.
    */
    enabled: function(enable) {
        if (enable !== undefined) {
            this._enabled = enable;
        }
        return this._enabled;
    },    
    
    /*
    Logs an object with all registered log targets.
    
    Parameters:
       object  -   The object to be logged.
       options -   Logging options passed to log targets
    
    Options:
       level   -   Logging level.  Default value is "debug".
    
    Usage: 
       $.jqlog.log("Message");
    */
    log: function(object, options) {
    
        if (this.enabled()) {
        
            var t, target, entry = jQuery.extend({}, this.entryDefaults, {
                timestamp: new Date(),
                message: object
            }, options);          
            
            if (!this.isExcluded(entry)) {
                // Log the entry with each of the registered targets.
                for(t in this.targets) {
                    if (this.targets.hasOwnProperty(t)) {
                        target = this.targets[t];
                        if (target.log) {
                            try {
                                target.log(entry);
                            } 
                            catch(err) {
                                // Ignore any errors and carry on logging!
                            }
                        }
                    }
                }
            }
        }
    },
    
    /*
    Determines if a log entry will be excluded from being logged.
    
    Parameters:
       entry  -   The object to be logged.
    
    Usage: 
       $.jqlog.isExcluded(entry);
    */
    isExcluded: function(entry) {
        return false;
    }
};

/*
Logs a DOM object with all registered log targets.

Parameters:
   options -   Logging options passed to log targets

Options:
   level   -   Logging level.  Default value is "debug".

Usage: 
   $("div").log();
*/
jQuery.fn.log = function(options) {
    return this.each(function() { jQuery.jqlog.log(this, options); });
};
