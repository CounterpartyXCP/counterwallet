# Check if local memcached server can answer this request
default_type text/html;

set_sha1 $body_digest $request_body;
set $redis_key ":1:data_$scheme://$host$request_uri::$body_digest";

# take out the '_' query string param that jquery puts into its ajax requests if cache == false
if ($redis_key ~ (.*)(\?|&)_=[0-9]+(.*)) {
  set $redis_key $1$3;
}     

add_header    X-CW-Cached  hit;
add_header    X-CW-Cache-Key  $redis_key;

redis_pass cache_server;
