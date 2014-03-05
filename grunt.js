module.exports = function(grunt) {
    // Grunt utilities
    var config = grunt.config;
    var utils = grunt.utils;
 
    // Deploy directory
    var deploydir = '_deploy/';
 
    // Grunt configuration
    config.init({
        // final build output
        deploydir: deploydir,
 
        processhtml: {
            files: ['src/pages/*.html']
        }
    });
 
    grunt.loadTasks('./grunt-tasks/');
 
    grunt.registerTask('build', 'processhtml');
};