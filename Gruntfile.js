module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        deploydir: 'dist/',
        useminPrepare: {
            html: 'src/pages/index.html',
            options: {
                dest: 'dist',
                root: 'src',
                flow: {
                    html: {
                        steps: {'css' : ['concat', 'cssmin']},
                        post: {}   
                    }                   
                }
            }
        },

        copy: {
            main: {
                files: [
                    {src: 'src/pages/index.html', dest: 'dist/index.html'},
                    {src: 'src/robots.txt', dest: 'dist/robots.txt'},
                    {src: 'src/pages/*', dest: 'dist/pages/'}
                ]
            }
        },

        usemin: {
            html: 'dist/index.html'
        }
    });
    grunt.loadNpmTasks('grunt-usemin')
    grunt.loadNpmTasks('grunt-contrib-concat')
    grunt.loadNpmTasks('grunt-contrib-cssmin')
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.registerTask('default', ['useminPrepare', 'concat', 'cssmin', 'copy', 'usemin']);
};

/*module.exports = function(grunt) {
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
};*/
