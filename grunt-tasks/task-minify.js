module.exports = function(grunt) {
    /**
     * minify:* is used to minify static content
     */
    grunt.registerHelper('minify', function(type, content, options) {
        return grunt.helper('minify:' + type, content, options);
    });
 
    grunt.registerHelper('minify:js', function(content, options) {
        return grunt.helper('uglify', content, options);
    });
 
    grunt.registerHelper('minify:css', function(content, options) {
        return grunt.helper('clean-css', content, options);
    });
 
    grunt.registerHelper('minify:html', function(content, options) {
        return grunt.helper('html-minifier', content, options);
    });
};