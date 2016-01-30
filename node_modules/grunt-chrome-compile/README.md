# grunt-chrome-compile
> Package a google chrome extension.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-chrome-compile --save-dev
```

One the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-chrome-compile');
```

## The "chrome_compile" task

### Overview
In your project's Gruntfile, add a section named `chrome-extension` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  'chrome-extension': {
    options: {
		name: "demo-ext",
		version: "0.0.1",
		id: "00000000000000000000000000000000",
		updateUrl: "http://example.com/extension/111111/",
		chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		clean: true,
		certDir: 'cert',
		buildDir: 'build',
		resources: [
			"js/**",
			"images/**",
			"*.html"
		]
    }
  },
})
```
### Options

#### options.name
Type: `String`
Default value: `demo-ext`

The name of your google chrome extension

#### options.version
Type: `String`
Default value: `0.0.1`

Your extension's version number.

#### options.id
Type: `String`
Default value: `00000000000000000000000000000000`

The ID assigned by the Chrome Web Store

#### options.updateUrl
Type: `String`
Default value: ``

Optional url where your extension can be updated from outside of the Chrome Web Store

#### options.buildDir
Type: `String`
Default value: `build`

Relative location to your build directory. .zip, .crx, and updates.xml will be created here.

#### options.certDir
Type: `String`
Default value: `cert`

Relative location to your extension's certificate.

#### options.resources
Type: `array`

Project resources that should be packaged into the final .zip and .crx.

__Caution__: Make sure your cert files are not included here

#### options.chrome
Type: `String`
Default value: OSX Path

The path to your Google Chrome installation.
* OSX: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
* OSX Canary: /Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary
* Windows: C:\Users\user\AppData\Local\Google\Chrome\Application\chrome.exe 

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
0.2.1 Initial release!
