var fs     = require('fs');
var xml2js = require('xml2js');
var ig     = require('imagemagick');
var colors = require('colors');
var _      = require('underscore');
var Q      = require('q');

/**
 * Check which platforms are added to the project and return their splashscreen names and sized
 *
 * @param  {String} projectName
 * @return {Promise} resolves with an array of platforms
 */
var getPlatforms = function (projectName) {
    var deferred = Q.defer();
    var platforms = [];
    platforms.push({
        name : 'ios',
        // TODO: use async fs.exists
        isAdded : fs.existsSync('platforms/ios'),
        splashPaths : 'platforms/ios/' + projectName + '/Resources/splash/',
        splashes : [
            { name : 'Default~iphone-test.png',            size : { w: 320,  h: 480  }  },
            { name : 'Default@2x~iphone-test.png',         size : { w: 640,  h: 960  }  },
            { name : 'Default-Portrait~ipad-test.png',     size : { w: 768,  h: 1024 }  },
            { name : 'Default-Portrait@2x~ipad-test.png',  size : { w: 1536, h: 2048 }  },
            { name : 'Default-Landscape~ipad-test.png',    size : { w: 1024, h: 768  }  },
            { name : 'Default-Landscape@2x~ipad-test.png', size : { w: 2048, h: 1536 }  },
            { name : 'Default-568h@2x~iphone-test.png',    size : { w: 640,  h: 1136 }  }
        ]
    });
    platforms.push({
        name : 'android',
        splashPaths : 'platforms/android/res/',
        isAdded : fs.existsSync('platforms/android'),
        splashes : [
            { name : 'drawable-land-hdpi/screen-test.png',   size : { w: 800, h: 480  } },
            { name : 'drawable-land-ldpi/screen-test.png',   size : { w: 320, h: 200  } },
            { name : 'drawable-land-mdpi/screen-test.png',   size : { w: 480, h: 320  } },
            { name : 'drawable-land-xhdpi/screen-test.png',  size : { w: 1280, h: 720 } },
            { name : 'drawable-port-hdpi/screen-test.png',   size : { w: 480, h: 800  } },
            { name : 'drawable-port-ldpi/screen-test.png',   size : { w: 200, h: 320  } },
            { name : 'drawable-port-mdpi/screen-test.png',   size : { w: 320, h: 480  } },
            { name : 'drawable-port-xhdpi/screen-test.png',  size : { w: 720, h: 1280 } }
        ]
    });
    // TODO: add all platforms
    deferred.resolve(platforms);
    return deferred.promise;
};


/**
 * @var {Object} settings - names of the confix file and of the splashscreen image
 * TODO: add option to get these values as CLI params
 */
var settings = {};
settings.CONFIG_FILE = 'config.xml';
settings.SPLASH_FILE   = 'splash.png';

/**
 * @var {Object} console utils
 */
var display = {};
display.success = function (str) {
    str = '✓  '.green + str;
    console.log('  ' + str);
};
display.error = function (str) {
    str = '✗  '.red + str;
    console.log('  ' + str);
};
display.header = function (str) {
    console.log('');
    console.log(' ' + str.cyan.underline);
    console.log('');
};

/**
 * read the config file and get the project name
 *
 * @return {Promise} resolves to a string - the project's name
 */
var getProjectName = function () {
    var deferred = Q.defer();
    var parser = new xml2js.Parser();
    data = fs.readFile(settings.CONFIG_FILE, function (err, data) {
        if (err) {
            deferred.reject(err);
        }
        parser.parseString(data, function (err, result) {
            if (err) {
                deferred.reject(err);
            }
            var projectName = result.widget.name[0];
            deferred.resolve(projectName);
        });
    });
    return deferred.promise;
};

/**
 * Resizes and creates a new splashscreen in the platform's folder.
 *
 * @param  {Object} platform
 * @param  {Object} splash
 * @return {Promise}
 */
var generateSplash= function (platform, splash) {
    var deferred = Q.defer();
    var constraint;
    var max;
    if (splash.size.h > splash.size.w) {
      constraint = 'height';
      max = splash.size.h;
    } else {
      constraint = 'width';
      max = splash.size.w;
    }
    var options = {
      srcPath: settings.SPLASH_FILE,
      dstPath: platform.splashPaths + splash.name,
      quality: 1,
      format: 'png'
    };
    options[constraint] = max;
    ig.resize(options , function(err, stdout, stderr){
      if (err) {
          deferred.reject(err);
      } else {
          deferred.resolve();
          display.success(splash.name + ' created');
      }
    });
    return deferred.promise;
};

/**
 * Generates splashscreens based on the platform object
 *
 * @param  {Object} platform
 * @return {Promise}
 */
var generateSplashForPlatform = function (platform) {
    var deferred = Q.defer();
    display.header('Generating splashscreens for ' + platform.name);
    var all = [];
    var splashes = platform.splashes;
    splashes.forEach(function (splash) {
        all.push(generateSplash(platform, splash));
    });
    Q.all(all).then(function () {
        deferred.resolve();
    }).catch(function (err) {
        console.log(err);
    });
    return deferred.promise;
};

/**
 * Goes over all the platforms and triggers splashscreen generation
 *
 * @param  {Array} platforms
 * @return {Promise}
 */
var generateSplashes = function (platforms) {
    var deferred = Q.defer();
    var sequence = Q();
    var all = [];
    _(platforms).where({ isAdded : true }).forEach(function (platform) {
        sequence = sequence.then(function () {
            return generateSplashForPlatform(platform);
        });
        all.push(sequence);
    });
    Q.all(all).then(function () {
        deferred.resolve();
    });
    return deferred.promise;
};

/**
 * Checks if at least one platform was added to the project
 *
 * @return {Promise} resolves if at least one platform was found, rejects otherwise
 */
var atLeastOnePlatformFound = function () {
    var deferred = Q.defer();
    getPlatforms().then(function (platforms) {
        var activePlatforms = _(platforms).where({ isAdded : true });
        if (activePlatforms.length > 0) {
            display.success('platforms found: ' + _(activePlatforms).pluck('name').join(', '));
            deferred.resolve();
        } else {
            display.error('No cordova platforms found. Make sure you are in the root folder of your Cordova project and add platforms with \'cordova platform add\'');
            deferred.reject();
        }
    });
    return deferred.promise;
};

/**
 * Checks if a valid splashscreen file exists
 *
 * @return {Promise} resolves if exists, rejects otherwise
 */
var validSplashExists = function () {
    var deferred = Q.defer();
    fs.exists(settings.SPLASH_FILE, function (exists) {
        if (exists) {
            display.success(settings.SPLASH_FILE + ' exists');
            deferred.resolve();
        } else {
            display.error(settings.SPLASH_FILE + ' does not exist in the root folder');
            deferred.reject();
        }
    });
    return deferred.promise;
};

/**
 * Checks if a config.xml file exists
 *
 * @return {Promise} resolves if exists, rejects otherwise
 */
var configFileExists = function () {
    var deferred = Q.defer();
    fs.exists(settings.CONFIG_FILE, function (exists) {
        if (exists) {
            display.success(settings.CONFIG_FILE + ' exists');
            deferred.resolve();
        } else {
            display.error('cordova\'s ' + settings.CONFIG_FILE + ' does not exist in the root folder');
            deferred.reject();
        }
    });
    return deferred.promise;
};

display.header('Checking Project & Splashscreens');

atLeastOnePlatformFound()
    .then(validSplashExists)
    .then(configFileExists)
    .then(getProjectName)
    .then(getPlatforms)
    .then(generateSplashes)
    .catch(function (err) {
        if (err) {
            console.log(err);
        }
    }).then(function () {
        console.log('');
    });
