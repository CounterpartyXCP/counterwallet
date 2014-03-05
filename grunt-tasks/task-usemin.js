module.exports = function(grunt) {
    /**
     * usemin and usemin:* are used to replace the blocks in HTML
     */
    grunt.registerHelper('usemin', function(type, content, block, dest) {
        var indent = (block.split(grunt.utils.linefeed)[0].match(/^\s*/) || [])[0];
        if (type === 'css') {
            return content.replace(block, indent + '<link rel="stylesheet" href="' + dest + '">');
        }
        if (type === 'js') {
            return content.replace(block, indent + '<script src="' + dest + '"></script>');
        }
        return false;
    });
};