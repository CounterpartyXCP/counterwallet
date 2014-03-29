module.exports = function (grunt) {

    var Crypto = require('cryptojs').Crypto
    var File = require('grunt-usemin/lib/file');
    var Uglify = require("uglify-js");

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        useminPrepare: {
            html: 'src/index.html',
            options: {
                dest: 'dist',
                root: 'src',
                flow: {
                    html: {
                        steps: {
                            'css' : ['cssmin'], 
                            'js': ['uglifyjs']
                        },
                        post: {}   
                    }                   
                }
            }
        },

        checksumdeps: {
            root: 'src/',
            html: {
                'index.html': {
                    "counterwallet-deps.js": true
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

    var generateHashes = function() {
        var hashes = {};
        var config = grunt.config('checksumdeps');  
        var root = "";
        if (config.root) {
            root = config.root;
        }
        for (var filename in config.html) {
            var file = new File(root+filename);
            file.blocks.forEach(function(block) {
                blockdest = block.dest.split("/").pop();
                if (config.html[filename][blockdest]) {
                    for (var b in block.src) {
                        grunt.log.writeln('generating hash: '+block.src[b]);
                        var path = root+block.src[b]
                        var content = grunt.file.read(path);                   
                        var ast = Uglify.parser.parse(content); // parse code and get the initial AST
                        ast = Uglify.uglify.ast_squeeze(ast); // get an AST with compression optimizations
                        content = Uglify.uglify.gen_code(ast); // compressed code here
                        var hash = Crypto.SHA256(content);
                        hashes[path] = hash;
                    }
                }
            });  
        } 
        return hashes;
    }

    grunt.registerTask('checkdeps', 'Check dependencies checksums', function() {
        currenthashes = generateHashes();
        savedhashes = grunt.file.readJSON("bowerchecksum.json");

        // We do not check if a file is missing
        for (filename in currenthashes) {
            currenthash = currenthashes[filename];
            if (!savedhashes[filename]) {
                grunt.fail.fatal("File not found in bowerchecksum.json: "+filename+". Please run 'grunt writechecksum'.");
            } else if (savedhashes[filename]!=currenthash) {
                grunt.fail.fatal("Invalid checksum: "+filename);
            } else {
                grunt.log.writeln("cheksum ok: "+filename);
            }
        }
    });

    grunt.registerTask('writechecksum', 'Generate dependencies checksums', function() {
        hashes = generateHashes();
        hashesjs = JSON.stringify(hashes, null, 4);
        grunt.log.writeln("generating bowerchecksum.json");
        grunt.file.write("bowerchecksum.json", hashesjs);
        
    });

    grunt.registerTask('default', ['checkdeps', 'useminPrepare', 'cssmin', 'uglify', 'copy', 'usemin']);
};
