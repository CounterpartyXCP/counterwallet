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
