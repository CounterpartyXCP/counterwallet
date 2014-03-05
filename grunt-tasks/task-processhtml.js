module.exports = function(grunt) {
    var fs = require('fs');
    var path = require('path');
    var linefeed = grunt.utils.linefeed;
    var deploydir = grunt.config.get('deploydir');
 
    /**
     * Register the 'processhtml' task
     *
     * This task accepts files and steps through them to find a comment pattern
     * that wraps a set of 'script' or 'link' elements. It replaces those
     * elements within an indivudal comment block with a single element
     * referencing a file into which they are all concatenated.
     */
    grunt.registerMultiTask('processhtml', 'Replaces and concatenates scripts / stylesheets in special HTML comment blocks', function() {
 
        var name = this.target;
        var data = this.data;
        var files = grunt.file.expand(data);
 
        files.map(grunt.file.read).forEach(function(content, i) {
            var p = files[i];
 
            grunt.log.subhead('processhtml - ' + p);
 
            // make sure to convert back into utf8, `file.read` when used as a
            // forEach handler will take additional arguments, and thus trigger the
            // raw buffer read
            content = content.toString();
 
            // Replace and concatenate blocks of CSS/JS in HTML files
            if (!!grunt.task._helpers['processhtml:compressblocks']) {
                content = grunt.helper('processhtml:compressblocks', content);
            }
 
            // Minify the HTML files that were processed
            if (!!grunt.task._helpers['minify:html']) {
                content = grunt.helper('minify:html', content);
            }
 
            // Write the new HTML content to disk in the deploy directory
            grunt.file.write(deploydir + p, content);
            grunt.log.writeln('File "' + deploydir + p + '" created.');
        });
    });
 
 
    /**
     * Process files with the blocks and compress the files within them.
     */
    grunt.registerHelper('processhtml:compressblocks', function(content) {
        var blocks = getBlocks(content);
 
        // Handle blocks
        blocks.forEach(function(el) {
            var block = el.raw.join(linefeed);
            var src = el.src;
            var type = el.type;
            var dest = el.dest;
 
            // Concatenate the source files
            var combined = grunt.helper('concat', src, { separator: '' });
            // Minify the concatenated files
            var minified = grunt.helper('minify', type, combined, {});
            // Hash the compressed files
            var filehash = grunt.helper('md5:content', minified).slice(0,8);
            // Create a new versioned filepath for the destination file
            var filepath = dest.replace(new RegExp('(.' + type + ')'), '.' + filehash + '$1');
            // Write the concatenated, minified, and versioned file to the deploy directory
            grunt.file.write(deploydir + filepath, minified);
 
            // Fail task if errors were logged.
            if (this.errorCount) { return false; }
 
            // Otherwise, print a success message.
            grunt.log.writeln('File "' + filepath + '" created.');
 
            // Update the content to reference the concatenated and versioned files
            content = grunt.helper('usemin', type, content, block, filepath);
        });
 
        return content;
    });
};
 
/**
 * TODO: convert to grunt helper
 *
 * Returns an array of all the directives for the given html. Results is
 * of the following form:
 *
 * [{
 *   type: 'css',
 *   dest: 'css/site.css',
 *   src: [ 'css/normalize.css', 'css/main.css' ],
 *   raw: [ '    <!-- build:css css/site.css -->',
            '    <link rel="stylesheet" href="css/normalize.css">'
 *          '    <link rel="stylesheet" href="css/main.css">'
 *          '    <!-- endbuild -->' ]
 * },
 * {
 *    type: 'js',
 *    dest: 'js/site.js',
 *    src: [ 'js/plugins.js', 'js/main.js' ],
 *    raw: [ '    <!-- build:js js/site.js -->',
 *           '    <script src="js/plugins.js">'
 *           '    <script src="js/main.js">'
 *           '    <!-- endbuild -->' ]
 * }]
 */
function getBlocks(body) {
    // Start build pattern
    // <!-- build:[type] destination -->
    // TODO: use better regex for dest match
    var regexBuildStart = /<!--\s*build:(\w+)\s*(.+)\s*-->/;
    // End build pattern
    // <!-- endbuild -->
    var regexBuildEnd = /<!--\s*endbuild\s*-->/;
    var regexComment = /<!--(.*)-->/;
    // Match single or double quotes
    var regexSrc = /src=['"]([^"']+)["']/;
    var regexHref = /href=['"]([^"']+)["']/;
 
    var lines = body.replace(/\r\n/g, '\n').split(/\n/);
    var isBlock = false;
    var sections = [];
    var src;
    var raw;
    var i = 0;
 
    lines.forEach(function(line) {
        var buildParams = line.match(regexBuildStart);
        var isBuild = regexBuildStart.test(line);
        var isBuildEnd = regexBuildEnd.test(line);
        var isComment = regexComment.test(line);
 
        if (isBuild) {
            isBlock = true;
            sections[i] = {};
            sections[i].type = buildParams[1].trim();
            sections[i].dest = buildParams[2].trim();
            sections[i].src = src = [];
            sections[i].raw = raw = [];
            i++;
        }
 
        if (isBlock && raw && src) {
            raw.push(line);
 
            if (!isComment) {
                if (regexSrc.test(line)) {
                    src.push(line.match(regexSrc)[1]);
                }
                if (regexHref.test(line)) {
                    src.push(line.match(regexHref)[1]);
                }
            }
 
            if (isBuildEnd) {
                isBlock = false;
            }
        }
    });
 
    return sections;
}