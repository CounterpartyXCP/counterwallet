module.exports = function (grunt) {

    var buildDir = 'build/';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        build: {
            options: {
                buildDir: buildDir,
                srcDir: 'src/',
                assetsHome: 'assets/',
                checkDeps: true,
                depsDir: 'vendors/',
                /*cdn: {
                    hosts: {
                        'css': ['https://css1.counterwallet.dev', 'https://css2.counterwallet.dev'],
                        'js': ['https://js1.counterwallet.dev', 'https://js2.counterwallet.dev'],
                        'assets': ['https://assets1.counterwallet.dev', 'https://assets2.counterwallet.dev']
                    }
                }*/
            },
            process: {
                files: [
                    {cwd: 'src/', src: 'index.html', dest: buildDir, expand: true},
                    {cwd: 'src/pages/', src: '*.html', dest: buildDir+'pages/', expand: true}
                ]
            },
            copy: {
                files: [
                    {src: 'src/robots.txt', dest: buildDir+'robots.txt'},
                    {cwd: 'src/assets/', src: '*', dest: buildDir+'assets/', expand: true}
                ]
            }
        }
    });

    grunt.loadTasks('grunt-tasks');

    grunt.registerTask('default', ['build']);
};
