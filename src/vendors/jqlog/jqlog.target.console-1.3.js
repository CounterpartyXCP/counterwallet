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
