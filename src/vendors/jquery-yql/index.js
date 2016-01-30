/**
 * @preserve jQuery Plugin: Query YQL - version 0.4.1
 *
 * LICENSE: http://hail2u.mit-license.org/2009
 */

/*jslint indent: 2, browser: true */
/*global jQuery, $ */

(function ($) {
  "use strict";

  $.queryYQL = function (statement, type, envUrl, callback) {
    if ($.isFunction(type)) {
      callback = type;
      type     = "json";
    } else if (!type.match(/(json|xml)/)) {
      callback = envUrl;
      envUrl   = type;
      type     = "json";
    } else if ($.isFunction(envUrl)) {
      callback = envUrl;
      envUrl   = undefined;
    }

    var scheme = (document.location.protocol === "https:" ? "https" : "http"),
      url = scheme + "://query.yahooapis.com/v1/public/yql?callback=?",
      data = {
        format: type,
        q:      statement
      };

    if (envUrl === "all") {
      envUrl = scheme + "://datatables.org/alltables.env";
    }

    if (envUrl) {
      data.env = envUrl;
    }

    return $.get(url, data, callback, "json");
  };
}(jQuery));
