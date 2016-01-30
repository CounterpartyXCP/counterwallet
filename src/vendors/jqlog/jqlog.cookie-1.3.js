/*
 * jqlog.cookie 1.3
 *
 * A plugin that overrides the default jqlog.enabled behaviour and persists the 
 * enabled flag to a cookie.  This means that logging can be left disabled on 
 * document ready to minimise the performance impact for users, and then turned 
 * on when required.  Using a cookie means that the flag can be set before 
 * viewing a page so that page load events can be logged.
 *
 * Copyright © 2009 Paul Bevis.
 *
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 *
 * http://code.google.com/p/jqlog/
 *
 * Depends on jquery.cookie.js.
 */ 
jQuery.jqlog.enabled = function enabled(enable) {
    var enabled = enable;
    if (enabled !== undefined) {
        // Save the new value in the cookie.
        jQuery.cookie("jqlogEnabled", enabled, { expires: 50 });
        this._enabled = enabled;
    }
    else {
        enabled = this._enabled;
        if (enabled === undefined) {
            // Get the value from the cookie.
            enabled = Boolean(jQuery.cookie("jqlogEnabled"));
            this._enabled = enabled;
        }
    }
    return enabled;
};

// Reset the enabled flag so we can tell if it has been set or not.
jQuery.jqlog._enabled = undefined; 
