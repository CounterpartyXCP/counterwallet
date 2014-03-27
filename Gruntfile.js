module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        deploydir: 'dist/',
        useminPrepare: {
            html: 'src/index.html',
            options: {
                dest: 'dist',
                root: 'src',
                flow: {
                    html: {
                        steps: {
                            'css' : ['concat', 'cssmin'], 
                            'js': ['concat', 'uglifyjs']
                        },
                        post: {}   
                    }                   
                }
            }
        },

        copy: {
            main: {
                files: [
                    {src: 'src/index.html', dest: 'dist/index.html'},
                    {src: 'src/robots.txt', dest: 'dist/robots.txt'},
                    {src: 'src/pages/*', dest: 'dist/pages/'}
                ]
            }
        },

        usemin: {
            html: 'dist/index.html'
        }
    });
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('default', ['useminPrepare', 'concat', 'cssmin', 'uglify', 'copy', 'usemin']);
};
