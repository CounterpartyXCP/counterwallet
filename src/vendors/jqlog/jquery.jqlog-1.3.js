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
/*
 * jqlog.levels 1.3
 *
 * A logging level plugin for jqlog.
 *
 * Copyright © 2009 Paul Bevis.
 *
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * http://code.google.com/p/jqlog/
 */ 
jQuery.extend(jQuery.jqlog, {

    // Private level exclusion value.
    _level: null,
    
    /*
    Defines the logging levels available.
    */
    levels: {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    },
    
    /*
    Gets or sets the level exclusion value.  Default is null (no exclusion is applied).
    */
    level: function(level) {
        if (level !== undefined) {
            this._level = level;
        }
        return this._level;
    },     
 
    /*
    Determines if a log entry will be excluded from being logged.

    Parameters:
       entry  -   The object to be logged.

    Usage: 
       $.jqlog.isExcluded(entry);
    */
    isExcluded: function(entry) {
        var excluded = false;
        if(this._level && entry.level !== undefined) {
            excluded = this._level > entry.level;
        }
        return excluded;
    },

    /*
    Logs an infomation object with all registered log targets.

    Parameters:
       object  -   The information object to be logged.
       options -   Logging options passed to log targets

    Options:
       level   -   Logging level.  Default value is 1 (info).

    Usage: 
       $.jqlog.info("Information");
    */
    info: function(object, options) { 
        var settings = jQuery.extend({
            level: this.levels.info
        }, options);
        this.log(object, settings);
    },
            
    /*
    Logs a warning object with all registered log targets.

    Parameters:
       object  -   The wanring object to be logged.
       options -   Logging options passed to log targets

    Options:
       level   -   Logging level.  Default value is 2 (warning).

    Usage: 
       $.jqlog.warn("Warning");
    */         
    warn: function(object, options) {    
        var settings = jQuery.extend({
            level: this.levels.warn
        }, options);
        this.log(object, settings);
    },

    /*
    Logs an error object with all registered log targets.

    Parameters:
       object  -   The error object to be logged.
       options -   Logging options passed to log targets

    Options:
       level   -   Logging level.  Default value is 3 (error).

    Usage: 
       $.jqlog.error("Error");
    */         
    error: function(object, options) {    
        var settings = jQuery.extend({
            level: this.levels.error
        }, options);
        this.log(object, settings);
    }
});

// Extend the log entry defaults object to include a default log level.
jQuery.jqlog.entryDefaults.level = jQuery.jqlog.levels.debug;
/*
 * jqlog.console 1.3
 *
 * A log target for the jqlog framework that uses the console object.
 *
 * Copyright © 2009 Paul Bevis.
 *
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * http://code.google.com/p/jqlog/
 */ 
jQuery.jqlog.targets.console = jQuery.extend({}, jQuery.jqlog.targetDefaults, {

    /*
    Target name.
    */
    name: "console",        
    
    /* 
    Target version.
    */
    version: "1.3",
    
    /*
    Logs a entry to the console if available.
    
    Parameters:
       entry -   The entry to log.
    */        
    log: function log(entry) {
        
        var msg = entry.format();
        
        // Check for the browser console object...                
        if (window.console) {
            switch(entry.level) {
                case jQuery.jqlog.levels.info:
                    console.info(msg);
                    break;
                case jQuery.jqlog.levels.warn:
                    console.warn(msg);
                    break;
                case jQuery.jqlog.levels.error:
                    console.error(msg);
                    break;
                default:
                    console.log(msg);
            }
        }
        // Check for firebug lite...
        else if (window.firebug) {
            switch(entry.level) {
                case jQuery.jqlog.levels.info:
                    firebug.d.console.info(msg);
                    break;
                case jQuery.jqlog.levels.warn:
                    firebug.d.console.warn(msg);
                    break;
                case jQuery.jqlog.levels.error:
                    firebug.d.console.error(msg);
                    break;
                default:
                    firebug.d.console.log(msg);
            }
        }
    }
});
