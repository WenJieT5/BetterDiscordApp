/* BetterDiscordApp Entry
 * Version: 3.0
 * Author: Jiiks | http://jiiks.net
 * Date: 27/08/2015 - 15:51
 * Last Update: 06/05/2016
 * https://github.com/Jiiks/BetterDiscordApp
 */

'use strict';

var _fs = require("fs");
var _vm = require("vm")
var _config = require("./config.json");
var _utils = require("./Utils");
var _utils2;
var _bdIpc = require('electron').ipcMain;
var _error = false;

var _eol = require('os').EOL;

var _mainWindow;

var _cfg = {};
var _extData = {};

var bdStorage = {};
var bdPluginStorage = {};

bdStorage.defaults = {
    data: {}
};

bdPluginStorage.defaults = {
    data: {}
};

function initStorage() {
	if (_fs.existsSync(_cfg.dataPath + "/bdStorage.json")) {
		_fs.renameSync(_cfg.dataPath + "/bdStorage.json", _cfg.dataPath + "/bdstorage.json");
	}
	
    if(!_fs.existsSync(_cfg.dataPath + "/bdstorage.json")) {
        bdStorage.data = bdStorage.defaults.data;
        _fs.writeFileSync(_cfg.dataPath + "/bdstorage.json", JSON.stringify(bdStorage, null, 4));
    } else {
        bdStorage.data = JSON.parse(_fs.readFileSync(_cfg.dataPath + "/bdstorage.json"));
    }
};


bdStorage.get = function(i, m, pn) {

    if (m) return bdStorage.data[i] || "";

    if (bdPluginStorage[pn] !== undefined) {
        return bdPluginStorage[pn][i] || undefined;
    }

    if (_fs.existsSync(_cfg.dataPath + "/plugins/" + pn + ".config.json")) {
        bdPluginStorage[pn] = JSON.parse(_fs.readFileSync(_cfg.dataPath + "/plugins/" + pn + ".config.json"));
        return bdPluginStorage[pn][i] || undefined;
    }

    return undefined;
};

bdStorage.set = function(i, v, m, pn) {
    if(m) {
        bdStorage.data[i] = v;
        _fs.writeFileSync(_cfg.dataPath + "/bdstorage.json", JSON.stringify(bdStorage.data, null, 4));
    } else {
        if(bdPluginStorage[pn] === undefined) bdPluginStorage[pn] = {};
        bdPluginStorage[pn][i] = v;
        _fs.writeFileSync(_cfg.dataPath + "/plugins/" + pn + ".config.json", JSON.stringify(bdPluginStorage[pn], null, 4));
    }
    return true;
};




function BetterDiscord(mainWindow) {
    _mainWindow = mainWindow;
    _cfg = _config.cfg;
    _cfg.version = _config.Core.Version;
    _cfg.os = process.platform;
    _utils2 = new _utils.Utils(mainWindow);
    hook();
    createAndCheckData();
}

function createAndCheckData() {
    getUtils().log("Checking data/cache");

    let linuxPath = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : process.env.HOME + '/.config';
    _cfg.dataPath = (_cfg.os == 'win32' ? process.env.APPDATA : _cfg.os == 'darwin' ? process.env.HOME + '/Library/Preferences' :  linuxPath) + '/BetterDiscord/';
    _cfg.userFile = _cfg.dataPath + 'user.json';

    try {
        getUtils().mkdirSync(_cfg.dataPath);

        if(_fs.existsSync(_cfg.userFile)) {
            _cfg.userCfg = JSON.parse(_fs.readFileSync(_cfg.userFile));
        }

        if(_cfg.userCfg.cache == null) {
            _cfg.userCfg.cache = new Date();
        } else {
            var currentDate = new Date();
            var cacheDate = new Date(_cfg.userCfg.cache);
            //Check if cache is expired
            if(Math.abs(currentDate.getDate() - cacheDate.getDate()) > _cfg.cache.days) {
                _cfg.userCfg.cache = currentDate;
            } else {
                _cfg.cache.expired = false;
            }
        }

        //Write new cache date if expired
        if(_cfg.cache.expired) {
            getUtils().log("Cache expired or null");
            _fs.writeFileSync(_cfg.userFile, JSON.stringify(_cfg.userCfg));
        }

        init();
    } catch(err) {
        getUtils().err(err);
        exit(err.message);
    }
}

function init() {
    if(_cfg.branch == null) {
        _cfg.branch = _cfg.beta ? "beta" : "master";
    }

    if(_cfg.repo == null) {
        _cfg.repo = "Jiiks";
    }

    getUtils().log("Using repository: " + _cfg.repo + " and branch: " + _cfg.branch);

    getUtils().log("Getting latest hash");
    getUtils().attempt(getHash, 3, 0, "Failed to load hash", initUpdater, function() {
        exit("Failed to load hash after 3 attempts");
    });
    initStorage();
}


function getHash(callback) {
    getUtils().download("api.github.com", "/repos/" + _cfg.repo + "/BetterDiscordApp/commits/" + _cfg.branch, function(data) {
        try {
            _cfg.hash = JSON.parse(data).sha;
            getUtils().injectVar("_bdhash", _cfg.hash);
        }catch(err) {
            callback(false, err);
            return;
        }
        if(_cfg.hash == undefined) {
            callback(false, "_cfg.hash == undefined");
            return;
        }

        getUtils().log("Hash: " + _cfg.hash);

        callback(true);
    });
}

function initUpdater() {
    getUtils().log("Getting updater");
    getUtils().attempt(getUpdater, 3, 0, "Failed to load updater", waitForDom, function() {
        exit("Failed to load updater after 3 attempts.");
    });
}

function getUpdater(callback) {
    getUtils().download("raw.githubusercontent.com", "/" + _cfg.repo + "/BetterDiscordApp/" + _cfg.hash + "/data/updater.json", function(data) {
        try {
            _cfg.updater = JSON.parse(data);
        } catch(err) {
            callback(false, err);
            return;
        }

        if(_cfg.updater == undefined) {
            callback(false, "_cfg.updater == undefined");
            return;
        }

        if(_cfg.updater.LatestVersion == undefined) {
            callback(false, "_cfg.updater.LatestVersion == undefined");
            return;
        }

        if(_cfg.updater.CDN == undefined) {
            callback(false, "_cfg.updater.CDN == undefined");
            return;
        }

        getUtils().log("Latest Version: " + _cfg.updater.LatestVersion);
        getUtils().log("Using CDN: " + _cfg.updater.CDN);
        updateExtData();
        callback(true);
    });
}

function updateExtData() {
    getUtils().log("Updating ext data");

    _extData = {
        'load-jQueryCookie': {
            'type': 'javascript',
            'resource': 'jQueryCookie',
            'domain': 'cdnjs.cloudflare.com',
            'url': '//cdnjs.cloudflare.com/ajax/libs/jquery-cookie/1.4.1/jquery.cookie.min.js',
            'localurl': null,
            'message': 'load-mainCSS',
            'cacheable': false,
            'variable': null
        },
        'load-mainCSS': {
            'type': 'css',
            'resource': 'Main CSS',
            'domain': _cfg.updater.CDN,
            'url': '//' + _cfg.updater.CDN + '/' + _cfg.repo + '/BetterDiscordApp/' + _cfg.hash + '/css/main.min.css',
            'localurl': _cfg.localServer + '/BetterDiscordApp/css/main.css',
            'message': 'load-mainJS',
            'cacheable': false,
            'variable': null
        },
        'load-mainJS': {
            'type': 'javascript',
            'resource': 'Main JS',
            'domain': _cfg.updater.CDN,
            'url': '//' + _cfg.updater.CDN + '/' + _cfg.repo + '/BetterDiscordApp/' + _cfg.hash + '/js/main.min.js',
            'localurl': _cfg.localServer + '/BetterDiscordApp/js/main.js?v=1.1',
            'message': 'start-bd',
            'cacheable': false,
            'variable': null
        }
    };
}

function hook() {
    try {
        var webContents = getUtils().getWebContents();

        getUtils().log("Hooking dom-ready");
        webContents.on('dom-ready', domReady);

        webContents.on('did-finish-loading', function() {
            if(domReadyHooked) {
                return;
            }
            getUtils().log("Hooking did-finish-loading failsafe");
            domReady();
            getUtils().log("Hooked did-finish-loading failsafe");
        });

    }catch(err) {
        exit(err);
    }
}

function waitForDom() {
    if(!domReadyHooked) {
        setTimeout(waitForDom, 1000);
        return;
    }
    ipcHooked = true;
    load(false);
}

var domReadyHooked = false;
var ipcHooked = false;

function domReady() {
    getUtils().log("Hooked dom-ready");
    domReadyHooked = true;
    if(ipcHooked) {
        load(true);
    }
}

function load(reload) {
    getUtils().log(reload ? "Reloading" : "Loading");
    getUtils().execJs("var betterDiscordIPC = require('electron').ipcRenderer;");
    if(!reload) {
        if(_cfg.updater.LatestVersion > _cfg.version) {
            getUtils().alert("Update Available", "An update for BetterDiscord is available ("+_cfg.updater.LatestVersion+")! <a href='https://betterdiscord.net' target='_blank'>BetterDiscord.net</a>");
        }
        getUtils().log("Hooking ipc async");
        _bdIpc.on('asynchronous-message', function(event, arg) { ipcAsyncMessage(event, arg); });
        _bdIpc.on('synchronous-message', function(event, arg) { ipcSyncMessage(event, arg); });
        getUtils().log("Hooked ipc async");
    }
    initLoaders();
}

function initLoaders() {
    try {
        getUtils().mkdirSync(_cfg.dataPath);
        getUtils().mkdirSync(_cfg.dataPath + "plugins/");
        getUtils().mkdirSync(_cfg.dataPath + "themes/");
        getUtils().execJs('var themesupport2 = true');

        loadPlugins();
        loadThemes();
        loadApp();
    }catch(err) {
        exit(err);
    }
}

function loadPlugins() {
    var pluginPath = _cfg.dataPath + "plugins/";
    _fs.readdir(pluginPath, function(err, files) {
        if(err) {
            getUtils().log(err);
            getUtils().alert(err);
            return;
        }

        var pluginErrors = [];

        getUtils().injectVarRaw("bdplugins", "{}");
        getUtils().injectVarRaw("bdpluginErrors", "[]");

        files.forEach(function(fileName) {
            if (!_fs.statSync(pluginPath + fileName).isFile() || fileName.endsWith(".config.json")) return;
            if(!fileName.endsWith(".plugin.js")) {
                getUtils().log("Invalid plugin detected: " + fileName);
                return;
            }

            var plugin = _fs.readFileSync(pluginPath + fileName, 'utf8');
            var meta = plugin.split(_eol)[0];

            if (meta.indexOf('META') < 0) {
                getUtils().warn('Plugin META not found in file: ' + fileName);
                pluginErrors.push({name: null, file: fileName, reason: "META not found.", error: null});
                return;
            }

            var pluginVar = meta.substring(meta.lastIndexOf('//META') + 6, meta.lastIndexOf('*//'));
            var parse;
            try { parse = JSON.parse(pluginVar); }
            catch(err) {
                getUtils().warn("Failed to parse plugin META in file: " + fileName + "("+err+")");
				pluginErrors.push({name: null, file: fileName, reason: "META could not be parsed.", error: {message: err.message, stack: err.stack}});
                return;
            }

            if(parse["name"] == undefined) {
                getUtils().warn("Undefined plugin name in file: " + fileName);
                pluginErrors.push({name: null, file: fileName, reason: "No name defined.", error: null});
                return;
            }

            getUtils().log("Loading plugin: " + parse["name"]);

            try { new _vm.Script(plugin, {displayErrors: true}); }
            catch(err) {
                pluginErrors.push({name: parse["name"], file: fileName, reason: "Plugin could not be compiled.", error: {message: err.message, stack: err.stack}});
                getUtils().execJs(`bdplugins["${parse["name"]}"] = {"plugin": {
                                        start: () => {},
                                        load: () => {},
                                        getName: () => {return "${parse["name"]}";},
                                        getAuthor: () => {return "???";},
                                        getDescription: () => {return "This plugin was unable to be loaded. Check the author's page for updates.";},
                                        getVersion: () => {return "???";}
                                    },
                                    "name": "${parse["name"]}",
                                    "filename": "${fileName}",
                                    "source": "${parse["source"] ? parse["source"] : ""}",
                                    "website": "${parse["website"] ? parse["website"] : ""}"
                                };`);
                return;
            }
        
            getUtils().execJs(plugin);

            try {new _vm.Script(`new ${parse["name"]}();`, {displayErrors: true});}
            catch(err) {
                pluginErrors.push({name: parse["name"], file: fileName, reason: "Plugin could not be constructed", error: {message: err.message, stack: err.stack}});
                getUtils().execJs(`bdplugins["${parse["name"]}"] = {"plugin": {
                                        start: () => {},
                                        load: () => {},
                                        getName: () => {return "${parse["name"]}";},
                                        getAuthor: () => {return "???";},
                                        getDescription: () => {return "This plugin was unable to be loaded. Check the author's page for updates.";},
                                        getVersion: () => {return "???";}
                                    },
                                    "name": "${parse["name"]}",
                                    "filename": "${fileName}",
                                    "source": "${parse["source"] ? parse["source"] : ""}",
                                    "website": "${parse["website"] ? parse["website"] : ""}"
                                };`);
                return;
            }

            getUtils().execJs(`(function() {
                                    try {
                                        var plugin = new ${parse["name"]}();
                                        bdplugins[plugin.getName()] = {"plugin": plugin, "name": "${parse["name"]}", "filename": "${fileName}", "source": "${parse["source"] ? parse["source"] : ""}", "website": "${parse["website"] ? parse["website"] : ""}" };
                                    }
                                    catch (e) {
                                        bdpluginErrors.push({name: "${parse["name"]}", file: "${fileName}", reason: "Plugin could not be constructed.", error: {message: e.message, stack: e.stack}})
                                        bdplugins["${parse["name"]}"] = {"plugin": {
                                                start: () => {},
                                                load: () => {},
                                                getName: () => {return "${parse["name"]}";},
                                                getAuthor: () => {return "???";},
                                                getDescription: () => {return "This plugin was unable to be loaded. Check the author's page for updates.";},
                                                getVersion: () => {return "???";}
                                            },
                                            "name": "${parse["name"]}",
                                            "filename": "${fileName}",
                                            "source": "${parse["source"] ? parse["source"] : ""}",
                                            "website": "${parse["website"] ? parse["website"] : ""}"
                                        };
                                    }
                                })();`)
        });

        for (var i = 0; i < pluginErrors.length; i++) {
            getUtils().execJs(`bdpluginErrors.push(${JSON.stringify(pluginErrors[i])});`);
        }

    });
}

function loadThemes() {
    var themePath = _cfg.dataPath + "themes/";
    _fs.readdir(themePath, function(err, files) {
        if(err) {
            getUtils().log(err);
            getUtils().alert(err);
            return;
        }

        var themeErrors = [];  

        getUtils().injectVarRaw("bdthemes", "{}");

        files.forEach(function(fileName) {
            if (!_fs.statSync(themePath + fileName).isFile()) return;
            if(!fileName.endsWith(".theme.css")) {
                getUtils().log("Invalid theme detected " + fileName);
                return;
            }
            var theme = _fs.readFileSync(themePath + fileName, 'utf8');
            var split = theme.split("\n");
            var meta = split[0];
            if(meta.indexOf('META') < 0) {
                getUtils().warn("Theme META not found in file: " + fileName);
                themeErrors.push({name: null, file: fileName, reason: "META not found.", error: null});
                return;
            }
            var themeVar = meta.substring(meta.lastIndexOf('//META') + 6, meta.lastIndexOf('*//'));
            var themeInfo;
            try {
                themeInfo = JSON.parse(themeVar);
            }
            catch(err) {
                getUtils().warn("Failed to parse theme META in file: " + fileName + "("+err+")");
                themeErrors.push({name: null, file: fileName, reason: "META could not be parsed.", error: {message: err.message, stack: err.stack}});
                return;
            }
            
            if(themeInfo['name'] == undefined) {
                getUtils().warn("Missing theme name in file: " + fileName);
                themeErrors.push({name: null, file: fileName, reason: "No name defined.", error: null});
                return;
            }
            if(themeInfo['author'] == undefined) {
                themeInfo['author'] = "Unknown";
                getUtils().warn("Missing author name in file: " + fileName);
            }
            if(themeInfo['description'] == undefined) {
                themeInfo['description'] = "No Description";
                getUtils().warn("Missing description in file: " + fileName);
            }
            if(themeInfo['version'] == undefined) {
                themeInfo['version'] = "Unknown";
                getUtils().warn("Missing version in file: " + fileName);
            }

            getUtils().log("Loading theme: " + themeInfo['name']);
            split.splice(0, 1);
            theme = split.join("\n");
            theme = theme.replace(/(\r\n|\n|\r)/gm, '');

            getUtils().execJs(`(function() {
                                    bdthemes["${themeInfo['name']}"] = {
                                        name: "${themeInfo['name']}",
                                        css: "${escape(theme)}",
                                        description: "${themeInfo['description']}",
                                        author:"${themeInfo['author']}",
                                        version:"${themeInfo['version']}",
                                        "source": "${themeInfo["source"] ? themeInfo["source"] : ""}",
                                        "website": "${themeInfo["website"] ? themeInfo["website"] : ""}"
                                    } 
                                })();`);
        });
        getUtils().injectVarRaw("bdthemeErrors", JSON.stringify(themeErrors));
    });
}

function loadApp() {
    getUtils().injectVar('bdVersion', _cfg.version);
    getUtils().injectVar('bdCdn', _cfg.CDN);

    getUtils().log("Loading Resource (jQuery)", 0, 100);
    getUtils().injectJavaScriptSync("//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min.js", "load-jQueryCookie");
}

function ipcSyncMessage(event, arg) {
    if(typeof(arg) === "object") {
        switch(arg.arg) {
            case "storage":
                if(arg.cmd == "get") {
                    event.returnValue = bdStorage.get(arg.var, true);
                }
                if(arg.cmd == "set") {
                    bdStorage.set(arg.var, arg.data, true);
                    event.returnValue = "saved";
                }
            break;
            case "pluginstorage":
                if(arg.cmd == "get") {
                    event.returnValue = bdStorage.get(arg.var, false, arg.pn) || null;
                }
                if(arg.cmd == "set") {
                    bdStorage.set(arg.var, arg.data, false, arg.pn);
                    event.returnValue = "saved";
                }
            break;
        }
    }
}

function ipcAsyncMessage(event, arg) {
    if(typeof(arg) === "object") {
        switch(arg.arg) {
            case "opendir":
                if(arg.path == "plugindir") {
                    getUtils().openDir(_cfg.dataPath + "/plugins");
                    break;
                }
                if(arg.path == "themedir") {
                    getUtils().openDir(_cfg.dataPath + "/themes");
                    break;
                }
                if(arg.path == "datadir") {
                    getUtils().openDir(_cfg.dataPath);
                    break;
                }
                getUtils().openDir(arg.path);
            break;
            case "storage":
                if(arg.cmd == "set") {
                    bdStorage.set(arg.var, arg.data);
                    break;
                }
                if(arg.cmd == "get") {
                    var get = bdStorage.get(arg.var);
                    event.sender.send('asynchronous-reply', get);
                    break;
                }
            break;
        }
        return;
    }

    if(_extData.hasOwnProperty(arg)) {
        loadExtData(_extData[arg]);
    }

    if(arg == "start-bd") {
        getUtils().log("Starting Up", 100, 100);
        getUtils().execJs(`var mainCore; var startBda = function() { mainCore = new Core(${JSON.stringify(_cfg)}); mainCore.init(); }; startBda();`);
        getUtils().saveLogs(_cfg.dataPath);
    }
}

var loadCounter = 0;
function loadExtData(extData) {

    loadCounter++;

    getUtils().log("Loading Resource (" + extData.resource + ")", loadCounter / Object.keys(_extData).length * 100, 100);
    
    var url = (_cfg.local && extData.localurl != null) ? extData.localurl : extData.url;

    try {
        switch(extData.type) {
            case 'javascript':
                getUtils().injectJavaScriptSync(url, extData.message);
                break;
            case 'css':
                getUtils().injectStylesheetSync(url, extData.message);
                break;
            case 'json':
                getUtils().download(extData.domain, extData.url, function(data) {
                    getUtils().injectVar(extData.variable, data);
                    getUtils().sendIcpAsync(extData.message);
                });
                break;
        }
    }
    catch(err) {
        getUtils().warn(err);
        getUtils().alert("Something went wrong :( Attempting to run.", err);
        getUtils().sendIcpAsync(extData.message);
    }
}

function testJSON(extData, data) {
    getUtils().log("Validating " + extData.resource);
    try {
        var json = JSON.parse(data);
        getUtils().log(extData.resource + " is valid");
        return true;
    }catch(err) {
        getUtils().warn(extData.resource + " is invalid");
        return false;
    }
    return false;
}

function getUtils() {
    return _utils2;
}

function exit(reason) {
    _error = true;
    getUtils().log("Exiting. Reason: " + reason);
    getUtils().saveLogs(_cfg.dataPath);
    getUtils().alert("Something went wrong :(", reason);
}

BetterDiscord.prototype.init = function() {}//Compatibility

exports.BetterDiscord = BetterDiscord;
