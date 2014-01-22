function fetchData(url, onSuccess, onError, postdata, useYQL, dataType, _url_n) {
  if(typeof(postdata)==='undefined') postdata = null;
  if(typeof(useYQL)==='undefined') useYQL = false;
  if(typeof(dataType)==='undefined') dataType = null;
  if(typeof(_url_n)==='undefined') _url_n = 0;

  if (useYQL) {
      // Some cross-domain magic (to bypass Access-Control-Allow-Origin)
      var q = 'select * from html where url="'+url+'"';
      if (postdata) {
          q = 'use "http://brainwallet.github.com/js/htmlpost.xml" as htmlpost; ';
          q += 'select * from htmlpost where url="' + url + '" ';
          q += 'and postdata="' + postdata + '" and xpath="//p"';
      }
      url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(q);
  }
  
  //if passed a list of urls for url, then keep trying until we find one that works
  var u = url;
  if (url instanceof Array) {
    u = url[_url_n];
  }
  
  $.ajax({
      type: (useYQL || !postdata) ? "GET" : "POST",
      data: (useYQL || !postdata) ? "" : postdata,
      dataType: dataType, 
      url: url,
      success: function(res) {
          onSuccess(useYQL ? $(res).find('results').text() : res.responseText);
      },
      error:function (xhr, opt, err) {
          if (url instanceof Array) {
            if(url.length <= url_n + 1) {
              //no more urls to hit...finally call error callback (if there is one)
              if (onError)
                onError(err);
            } else {
              //try the next URL
              return fetchData(url, onSuccess, onError, postdata, useYQL, _url_n + 1);
            }
          }
      }
  });
}

function makeJSONAPICall(dest, method, params, onSuccess, onError) {
  if(dest != "counterwalletd" && dest != "counterpartyd") { alert("Invalid dest!"); }
  var urls = counterpartyd_api_urls;
  if(dest == "counterwalletd") { urls = counterwalletd_api_urls; }
  if(typeof(onError)==='undefined') onError = alertModal; //just default to popping up a modal with the error for now...
  //make JSON API call to counterwalletd
  fetchData(urls, onSuccess, onError,
    {"method": method, "params": params}, false, "json")
}


function makeQRCode(addr) {
  var qr = qrcode(3, 'M');
  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  qr.addData(addr);
  qr.make();
  return qr.createImgTag(4);
}
