/*
 * grunt-chrome-compile
 * https://github.com/scarrillo/grunt-chrome-compile
 *
 * Copyright (c) 2013 scarrillo
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('chrome-extension', 'Package a google chrome extension', function() {
		grunt.config.requires('chrome-extension.options.name');
		grunt.config.requires('chrome-extension.options.version');
		grunt.config.requires('chrome-extension.options.id');
		grunt.config.requires('chrome-extension.options.version');
		grunt.config.requires('chrome-extension.options.chrome');

		// Merge task-specific and/or target-specific options with these defaults.
		var options = this.options({
			buildDir: 'build',
			certDir: 'cert',
			resources: [
				"js/**",
				"images/**",
				"*.html"
			],
			extension: {
				path: '',
				cert: '',
				updateUrl: '',
				zip: ''
			}
		});

		options.extension.path = options.buildDir +'/'+ options.name +'/';
		options.extension.cert = options.certDir +'/'+ options.name +'.pem';
		options.extension.updateUrl = options.updateUrl + options.name +'.crx';
		options.extension.zip = options.buildDir +'/'+ options.name +'.zip';

		grunt.log.writeln('chrome-extension: '+options.name+':'+options.version);
		grunt.log.writeln('\tchrome: '+options.chrome);
		grunt.log.writeln('\tpath: '+options.extension.path);
		grunt.log.writeln('\tcert: '+options.extension.cert);
		grunt.log.writeln('\tupdate path: '+options.extension.updateUrl);
		grunt.log.writeln('\tcws zip: '+options.extension.zip);

		grunt.option('extensionOptions', options);
		grunt.task.run(
			'chrome-extension-copy',
			'chrome-extension-manifest',
			'chrome-extension-compress',
			'chrome-extension-compile',
			'chrome-extension-clean'
		);
	});

	grunt.registerTask('chrome-extension-copy', 'copy extension resources to a build folder', function() {
		var options = grunt.option('extensionOptions');

		if(grunt.file.exists(options.extension.path)) {
			grunt.file.delete(options.extension.path);
		}
		grunt.file.mkdir(options.extension.path);
		grunt.config.set('copy.extension', { files: [
			{expand: true, cwd: '.', src: options.resources, dest: options.extension.path},
			{flatten:true, expand: true, cwd: '.', src: options.extension.cert, dest: options.extension.path,
				rename: function(dest) {//, matchedSrcPath, options
					return dest + 'key.pem';
				}
			}
		]});
		grunt.task.run('copy:extension');
	});

	grunt.registerTask('chrome-extension-compress', 'compress build folder into a zip for the chrome web store', function() {
		var options = grunt.option('extensionOptions');

		grunt.config.set('compress.extension', {
			options: { archive: options.extension.zip },
			files: [
				// dest == the folder name within the zip. explicit here, but equivilant to passing empty string 
				{expand: true, cwd: options.extension.path,  src: ['**/*'], dest: options.name }
			]
		});
		grunt.task.run('compress:extension');
	});

	grunt.registerTask('chrome-extension-compile', 'compile a crx using google chrome', function() {
		var options = grunt.option('extensionOptions');

		var certPath = options.extension.path + 'key.pem';
		if(grunt.file.exists(certPath)) {
			// remove cert, before compiling crx. It's only required by the chrome web store in the zip
			grunt.file.delete(certPath);
		}

		var done = this.async();
		var chromeOptions = {
			cmd: options.chrome,
			args: [
				'--pack-extension='+ options.extension.path,
				'--pack-extension-key='+ options.extension.cert,
				'--no-message-box'
			]
		};
		//chromeOptions = {cmd: 'ls', args:['-ltra', chrome]};
		grunt.util.spawn(chromeOptions, function(error, result, code) {
			if(error && code !== 0) {
				//console.dir(result);
				grunt.log.write(result.stdout+' ').error();
			} else {
				grunt.log.write(result+' ').ok();
			}
			done(true);
		});
	});

	grunt.registerTask('chrome-extension-manifest', 'update configuration files with extension information', function() {
		var options = grunt.option('extensionOptions');

		grunt.config.set('concat.extension', {
			options: {
				//banner: '// concat job',
				process: function(src, filepath) {
					/*
					return '// Source: ' + filepath + '\n' +
						src.replace(/##VERSION##/g, '##FOUND##');
					*/
					src = src.replace(/##ID##/g, options.id);
					src = src.replace(/##VERSION##/g, options.version);
					src = src.replace(/##CODEBASE##/g, options.extension.updateUrl);
					return src;
				}
			},
			files: [
				{ src: ['manifest.json'], dest: options.extension.path + 'manifest.json' },
				{ src: ['updates.xml'], dest: options.buildDir + '/updates.xml' }
			]
		});
		grunt.task.run('concat:extension');
	});

	grunt.registerTask('chrome-extension-clean', 'clean the build folder', function() {
		var options = grunt.option('extensionOptions');

		var cleanPath = options.extension.path;
		if(options.clean && grunt.file.exists(cleanPath)) {
			grunt.file.delete(cleanPath);
		}
	});
};
