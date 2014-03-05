module.exports = function(grunt) {
    var fs = require('fs');
    var path = require('path');
    var crypto = require('crypto');
 
    /**
     * The 'md5' helper is a basic wrapper around crypto.createHash, with given
     * `algorithm` and `encoding`. Both are optional and defaults to `md5` and
     * `hex` values.
     */
    grunt.registerHelper('md5', function(filepath, algorithm, encoding) {
        algorithm = algorithm || 'md5';
        encoding = encoding || 'hex';
 
        var hash = crypto.createHash(algorithm);
        hash.update(grunt.file.read(filepath));
        grunt.log.verbose.write('Hashing ' + filepath + '...');
 
        return hash.digest(encoding);
    });
 
    /**
     * The 'md5:content' helper hashes string content directly
     */
    grunt.registerHelper('md5:content', function(content, algorithm, encoding) {
        content = content.toString();
        algorithm = algorithm || 'md5';
        encoding = encoding || 'hex';
 
        var hash = crypto.createHash(algorithm);
        hash.update(content);
 
        return hash.digest(encoding);
    });
};