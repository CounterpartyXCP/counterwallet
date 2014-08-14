module.exports = function (grunt) {

    var buildDir = 'build/';

    var config = {
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
            ejs: {
              html: {
                options: require("./options"),
                src: ["src/**/*.html.ejs"],
                dest: ".",
                expand: true,
                ext: ".html"
              },
              js: {
                options: require("./options"),
                src: ["src/**/*.js.ejs"],
                dest: ".",
                expand: true,
                ext: ".js"
              }
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
        },

        watch: {
            ejs: {
                files: ["src/**/*.ejs", "options.json"],
                tasks: ["build:ejs"]
            }
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
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['build']);
};
