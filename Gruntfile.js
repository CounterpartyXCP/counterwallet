module.exports = function (grunt) {

    var buildDir = 'build/';

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        checksumdeps: {
            root: 'src/',
            html: {
                'index.html': {
                    "counterwallet-deps-min.js": true
                }
            }
        },

        genassetsfolder: {
            options: {
                buildDir: buildDir,
                assetsHome: '/assets/',
            },
            html: 'src/index.html'
        },

        copy: {
            main: {
                files: [
                    {src: 'src/robots.txt', dest: buildDir+'robots.txt'},
                    {cwd: 'src/pages/', src: '**', dest: buildDir+'pages/', expand: true, flatten: true}
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('checkdeps');

    var Crypto = require('cryptojs').Crypto
    var File = require('grunt-usemin/lib/file');
    var Path = require('path');
    var CleanCSS = require('clean-css');
    var Uglify = require("uglify-js");

    var processUrl = function(url, filedir, config) {
        grunt.log.writeln("Original url: "+url);
        var newUrl = url;
        // procession only relatve urls
        if (/^\/|https:|http:|data:/i.test(url) === false) {
            var urlPath = Path.resolve(filedir + '/' + url);

            // extract query string
            var urlPathParts = urlPath.split("?");
            var params;
            if (urlPathParts.length>1) {
                params = urlPathParts.pop();
            }
            urlPath = urlPathParts.shift();

            // extract anchors
            var urlPathParts = urlPath.split("#");
            var anchor;
            if (urlPathParts.length>1) {
                anchor = urlPathParts.pop();
            }
            urlPath = urlPathParts.shift();    

            grunt.log.writeln("Source path: "+urlPath);                               

            var ext = urlPath.split(".").pop();
            // TODO: 12 chars seems enough, but check collisions for cleanliness
            var newFilename = Crypto.SHA256(urlPath).substr(0,12)+"."+ext;
            
            newUrl = config.assetsHome+newFilename;
            if (params) {
                newUrl += "?"+params;
            }
            if (anchor) {
                newUrl += "#"+anchor;
            }
            grunt.log.writeln("New url: "+newUrl);

            var newUrlPath = Path.resolve(config.assetsDir+newFilename);
            grunt.log.writeln("Dest path: "+newUrlPath);

            // we move the file with the new name in dest folder
            if (!grunt.file.exists(newUrlPath)) {
                grunt.file.copy(urlPath, newUrlPath);
            }
        }
        return newUrl;
    }

    grunt.registerMultiTask('genassetsfolder', 'Put all css medias in assets folders', function() {
        var config = this.options();
        var root = "";
        if (config.root) {
            root = config.root;
        }
        config.assetsDir =  config.buildDir+config.assetsHome;
        
        if (grunt.file.exists(config.assetsDir)) {
            grunt.file.delete(config.assetsDir);
        }
        grunt.file.mkdir(config.assetsDir);

        this.files.forEach(function (fileObj) {
            
            var files = grunt.file.expand({nonull: true}, fileObj.src);
            files.forEach(function (filename) {

                grunt.log.writeln('filename: '+filename);

                // blocks parsing
                var file = new File(filename);
                var filedir = Path.resolve(Path.dirname(filename));
                var htmlcontent = grunt.file.read(filename); 

                file.blocks.forEach(function(block) {

                    if (block.type=="css") {

                        var combinedcss = "";
                        for (var b in block.src) {

                            grunt.log.writeln('preparing css: '+block.src[b]);
                            
                            var filepath = filedir+'/'+block.src[b];
                            var cssfiledir = Path.dirname(filepath);
                            var content = grunt.file.read(filepath);

                            if (content) {

                                var newcontent = content.replace(/url\s*\(\s*(['"]?)([^"'\)]*)\1\s*\)/gi, function(match, location) {

                                    var url = match.replace(/\s/g, '').slice(4, -1).replace(/"|'/g, '');
                                    var newUrl = processUrl(url, cssfiledir, config);
                                    return 'url("'+newUrl+'")';

                                });
                                combinedcss += newcontent+grunt.util.linefeed;
                            }

                        }
                        //combinedcss = new CleanCSS().minify(combinedcss);
                        grunt.file.write(config.buildDir+block.dest, combinedcss);

                        // replacing all link tags by one
                        startBlock = block.raw[0];
                        endBlock = block.raw[block.raw.length-1];
                        bockStartPos = htmlcontent.indexOf(startBlock);
                        blockEndPos = htmlcontent.indexOf(endBlock, bockStartPos)+endBlock.length;
                        cssTag = '<link rel="stylesheet" type="text/css" href="'+block.dest+'">';
                        htmlcontent = htmlcontent.substr(0, bockStartPos)+cssTag+htmlcontent.substr(blockEndPos);

                    } else if (block.type=="js") {

                        var combinedjs = "";
                        for (var b in block.src) {
                            grunt.log.writeln('preparing js: '+block.src[b]);
                            var filepath = filedir+'/'+block.src[b];
                            var content = grunt.file.read(filepath);
                            combinedjs += content+"\n";
                        }
                        var ast = Uglify.parser.parse(combinedjs); // parse code and get the initial AST
                        ast = Uglify.uglify.ast_squeeze(ast); // get an AST with compression optimizations
                        combinedjs = Uglify.uglify.gen_code(ast);
                        grunt.file.write(config.buildDir+block.dest, combinedjs);

                        // replacing all script tags by one
                        startBlock = block.raw[0];
                        endBlock = block.raw[block.raw.length-1];
                        bockStartPos = htmlcontent.indexOf(startBlock);
                        blockEndPos = htmlcontent.indexOf(endBlock, bockStartPos)+endBlock.length;
                        jsTag = '<script src="'+block.dest+'"></script>';
                        htmlcontent = htmlcontent.substr(0, bockStartPos)+jsTag+htmlcontent.substr(blockEndPos);
                    }
                });

                // html parsing          
                var newhtmlcontent = htmlcontent.replace(/(src|href)=['"]([^"']+)["']/gi, function(match, location) {
                    
                    var urlParts = match.replace(/\s/g, '').replace(/"|'/g, '').split("=");
                    var attr = urlParts.shift();
                    var url = urlParts.join("=");
                    var exclude = url.match(/(\.js)|(\.html)|(\.css)|(;)|(#)|$/gi)!="";
                    if (!exclude) {
                        url = processUrl(url, filedir, config);
                    } 
                    return attr+'="'+url+'"';

                });
                var destpath = config.buildDir+filename.split("/").pop();
                grunt.file.write(destpath, newhtmlcontent);
                


            });

        });

    });

    //TODO: put dist in config
    grunt.registerTask('cleandist', 'Delete all files in build directory', function() {
        if (grunt.file.exists(buildDir)) {
            grunt.file.delete(buildDir);
        }
        grunt.file.mkdir(buildDir);
    });

    grunt.registerTask('build', ['checkdeps', 'cleandist', 'genassetsfolder', 'copy']);
    grunt.registerTask('default', ['build']);
};
