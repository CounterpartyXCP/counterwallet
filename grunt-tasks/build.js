module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-contrib-copy');
    var Crypto = require('cryptojs').Crypto
    var File = require('grunt-usemin/lib/file');
    var Path = require('path');
    var CleanCSS = require('clean-css');
    var Uglify = require("uglify-js");

    var defaultOptions = {
        buildDir: 'build/',
        srcDir: 'src/',
        assetsHome: 'assets/',
        checkDeps: true,
        depsDir: 'vendors/',
        depsHashesFile: '.bowerhashes'
    }

    var generateHash = function(path) {
        grunt.log.writeln('generating hash: '+path);              
        var content = grunt.file.read(path);                         
        var ast = Uglify.parser.parse(content); // parse code and get the initial AST
        ast = Uglify.uglify.ast_squeeze(ast); // get an AST with compression optimizations
        content = Uglify.uglify.gen_code(ast); // compressed code here
        return Crypto.SHA256(content);
    }

    var generateHashes = function(fileList, config) {
        var hashes = {};
        fileList.forEach(function (fileObj) {         
            var files = grunt.file.expand({nonull: true}, fileObj.src);
            files.forEach(function (filename) {
                grunt.log.writeln('filename: '+filename);
                var file = new File(filename);
                file.blocks.forEach(function(block) {
                    if (block.type=='js') {
                        for (var b in block.src) {
                            var path = config.srcDir+block.src[b];
                            
                            if (path.indexOf(config.depsDir)==0) {
                                var hash = generateHash(path);
                                hashes[path] = hash;
                                grunt.log.writeln(hash);
                            }                  
                        }
                    }
                    
                });
            });
        });
        return hashes;
    }

    // prepare url from file in srcfiledir, to destfile
    // put asset in assets/ folder
    var processUrl = function(url, srcfiledir, destfile, config) {
        grunt.log.writeln("Original url: "+url);
        var newUrl = url;
        // procession only relatve urls
        if (/^\/|https:|http:|data:/i.test(url) === false) {
            var urlPath = Path.resolve(srcfiledir + '/' + url);

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

            var from = Path.dirname('/'+destfile);
            var to = '/'+newUrl;
            newUrl = Path.relative(from, to);
            grunt.log.writeln("New url: "+newUrl);

            var newUrlPath = Path.resolve(config.assetsDir+newFilename);
            grunt.log.writeln("Dest path: "+newUrlPath);

            // we move the file with the new name in dest folder
            if (!grunt.file.exists(newUrlPath) && grunt.file.exists(urlPath)) {
                grunt.file.copy(urlPath, newUrlPath);
            }
        }
        return newUrl;
    }

    // process all url(...) from css content
    var replaceCssUrl = function(content, srcfiledir, destfile, config) {
        return content.replace(/url\s*\(\s*(['"]?)([^"'\)]*)\1\s*\)/gi, function(match, location) {
            var url = match.replace(/\s/g, '').slice(4, -1).replace(/"|'/g, '');
            var newUrl = processUrl(url, srcfiledir, destfile, config);
            return 'url("'+newUrl+'")';
        });
    }

    var replaceHtmlUrl = function(content, srcfiledir, destfile, config) {
        return content.replace(/(src|href)=['"]([^"']+)["']/gi, function(match, location) {                   
            var urlParts = match.replace(/\s/g, '').replace(/"|'/g, '').split("=");
            var attr = urlParts.shift();
            var url = urlParts.join("=");
            var exclude = url.match(/(\.js)|(\.html)|(\.css)|(;)|(#)|$/gi)!="";
            if (!exclude) {
                // IMPORTANT: we consider all html files are in root dir (eg. /index.html).
                // html files in subfolders must be loaded with js from html file in root folder
                url = processUrl(url, srcfiledir, destfile, config);
            } 
            return attr+'="'+url+'"';
        });
    }

    var replaceJsUrl = function(content, srcfiledir, destfile, config) {
        return content.replace(/loadScript\(['"]([^"']+)["']/gi, function(match, location) {                 
            var urlParts = match.replace(/\s/g, '').replace(/"|'/g, '').split("(");
            var attr = urlParts.shift();
            var url = urlParts.join("(");
            // IMPORTANT: we consider that all loadScript are made from root dir (eg. /index.html)
            url = processUrl(url, srcfiledir, destfile, config);
            return attr+'("'+url+'"';
        });
    }

    var replaceBuildBlock = function(htmlcontent, block) {
        var packageJson = grunt.file.readJSON('package.json');
        var startBlock = block.raw[0];
        var endBlock = block.raw[block.raw.length-1];
        var bockStartPos = htmlcontent.indexOf(startBlock);
        var blockEndPos = htmlcontent.indexOf(endBlock, bockStartPos)+endBlock.length;
        var tag = '';
        var tagurl = block.dest+'?v='+packageJson.version;
        if (block.type=='css') {
            tag = '<link rel="stylesheet" type="text/css" href="'+tagurl+'">';
        } else if (block.type=='js') {
            tag = '<script src="'+tagurl+'"></script>';
        }
        return htmlcontent.substr(0, bockStartPos)+tag+htmlcontent.substr(blockEndPos);
    }

    var minifyContent = function(content, type) {
        if (type=='css') {
            content = new CleanCSS().minify(content);
        } else if (type=='js') {
            var ast = Uglify.parser.parse(content); // parse code and get the initial AST
            ast = Uglify.uglify.ast_squeeze(ast); // get an AST with compression optimizations
            content = Uglify.uglify.gen_code(ast);
        }
        return content;
    }

    var processFile = function(filepath, block, config) {
        var content = grunt.file.read(filepath);
        return processContent(content, filepath, block, config)
    }

    var processContent = function(content, filepath, block, config) {
        if (block.type=='css') {
            content = replaceCssUrl(content, Path.dirname(filepath), block.dest, config);
        } else if (block.type=='js') {
            content = replaceJsUrl(content, Path.dirname(filepath), block.dest, config);
        } else if (block.type=='html') {
            content = replaceHtmlUrl(content, Path.resolve(config.srcDir), "", config);
            content = replaceJsUrl(content, Path.resolve(config.srcDir), "", config);
            content = replaceCssUrl(content, Path.resolve(config.srcDir), "", config);
        }
        return content;
    }

    var cleanDirectory = function(path) {
        if (grunt.file.exists(path)) {
            grunt.file.delete(path);
        }
        grunt.file.mkdir(path);
    }

    var mergeContent = function(root, block, config) {
        var combinedcontent = "";
        for (var b in block.src) {
            grunt.log.writeln('preparing file: '+root+'/'+block.src[b]);
            var filepath = root+'/'+block.src[b];
            var content = processFile(filepath, block, config);
            combinedcontent += content+grunt.util.linefeed;
        }
        return minifyContent(combinedcontent, block.type);
    }

    var minifyApp = function(fileList, config) {

        fileList.forEach(function (fileObj) {         
            var files = grunt.file.expand({nonull: true}, fileObj.src);
            files.forEach(function (filename) {

                grunt.log.writeln('parse file: '+filename);
                
                var file = new File(filename);
                var root = Path.resolve(Path.dirname(filename));
                var htmlcontent = grunt.file.read(filename); 

                // blocks parsing
                file.blocks.forEach(function(block) {
                    var combinedcontent = mergeContent(root, block, config);
                    grunt.file.write(config.buildDir+block.dest, combinedcontent);
                    htmlcontent = replaceBuildBlock(htmlcontent, block);
                });

                // html parsing
                grunt.log.writeln('Dest path: '+fileObj.dest);
                htmlcontent = processContent(htmlcontent, "", {type: 'html'}, config)
                grunt.file.write(fileObj.dest, htmlcontent);               

            });
        });
    }

    grunt.registerMultiTask('checkdependencies', 'Check dependencies checksums', function() {     
        var config = this.options(defaultOptions);
        config.depsDir = config.srcDir+config.depsDir;
        var currenthashes = generateHashes(this.files, config);
        var savedhashes = grunt.file.readJSON(config.srcDir+config.depsHashesFile);

        // We do not check if a file is missing
        for (var filename in currenthashes) {
            var currenthash = currenthashes[filename];
            if (!savedhashes[filename]) {
                grunt.fail.fatal("File not found in "+config.depsHashesFile+": "+filename+". Please run 'grunt writechecksum'.");
            } else if (savedhashes[filename]!=currenthash) {
                grunt.fail.fatal("Invalid checksum: "+filename);
            } else {
                grunt.log.writeln("cheksum ok: "+filename);
            }
        }      
    });

    grunt.registerMultiTask('freezedependencies', 'Generate dependencies checksums', function() {
        var config = this.options(defaultOptions);
        config.depsDir = config.srcDir+config.depsDir;

        grunt.log.writeln("generating "+config.depsHashesFile);
        var hashes = generateHashes(this.files, config);
        var hashesjs = JSON.stringify(hashes, null, 4);
        grunt.file.write(config.srcDir+config.depsHashesFile, hashesjs);
        
    });

    grunt.registerTask('clean', 'Clean build diretcory', function() {
        var config = this.options(defaultOptions);
        
        grunt.log.writeln("Clean build diretcory: "+config.buildDir);
        cleanDirectory(config.buildDir);
    });

    grunt.registerMultiTask('minify', 'Put all css medias in assets folders, replace assets urls and merge <script> and <link> tags', function() {
        var config = this.options(defaultOptions);
        config.assetsDir =  config.buildDir+config.assetsHome;

        minifyApp(this.files, config);    
    });


    // this task populate others tasks config and run them
    grunt.registerMultiTask('build', 'Build app', function() {

        var config = this.options(defaultOptions);        

        if (this.target=='process') { 

            if (config.checkDeps && config.depsDir) {
                grunt.config.set('checkdependencies', {
                    options: config,
                    main: {
                        files: this.files
                    }
                });
                grunt.task.run('checkdependencies');
            }

            grunt.config.set('clean', {
                options: config
            });
            grunt.task.run('clean');

            grunt.config.set('minify', {
                options: config,
                main: {
                    files: this.files
                }
            });  
            grunt.task.run('minify');
        }

        if (this.target=='copy') { 

            grunt.config.set('copy', {
                main: {
                    files: this.files
                }
            });
            grunt.task.run('copy');

        }
        
    }); 

    // populate freezedependencies config with build config and run freezedependencies
    grunt.registerTask('freeze', 'Generate dependencies checksums', function() {
        var config = grunt.config.get('build');
        grunt.config.set('freezedependencies', {
            options: config.options,
            main: {
                files: config.process.files
            }
        });
        grunt.task.run('freezedependencies');
    });

}