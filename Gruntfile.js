module.exports = function (grunt) {

    var buildDir = 'build/';

    var config = {
        pkg: grunt.file.readJSON('package.json'),

        build: {
            options: {
                buildDir: buildDir,
                srcDir: 'src/',
                assetsHome: 'assets/',
                checkDeps: process.argv.indexOf('--dontcheckdeps') === -1,
                minify: process.argv.indexOf('--dontminify') === -1,
                depsDir: 'vendors/'
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
                    {cwd: 'src/pages/', src: '*.html', dest: buildDir+'pages/', expand: true},
                    {cwd: 'src/locales/en', src: '*.json', dest: buildDir+'locales/en', expand: true}
                ]
            },
            copy: {
                files: [
                    {src: 'src/robots.txt', dest: buildDir+'robots.txt'},
                    {cwd: 'src/assets/', src: '*', dest: buildDir+'assets/', expand: true}
                ]
            }
        },
        transifex: {
            languages: ['fr', 'de', 'da', 'zh_CN', 'zh_TW', 'fi', 'tr', 'it', 'ja', 'es', 'ru', 'cs']
        }
    }
    /*config['chrome-extension'] = {
        options: {
            name: "counterwallet",
            version: pkg.version,
            id: "00000000000000000000000000000000",
            //updateUrl: "http://example.com/extension/111111/",
            chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            clean: true,
            certDir: '.',
            buildDir: '.',
            resources: [
                "build/**"
            ]
        }
    }*/
    
    grunt.initConfig(config);

    grunt.loadTasks('grunt-tasks');

    grunt.registerTask('default', ['build']);
};
