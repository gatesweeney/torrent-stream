/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 891:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



var EventEmitter = (__nccwpck_require__(361).EventEmitter);

var Core = function() {
  EventEmitter.call(this);

  var parts;

  this.getParts = function() {
    return parts;
  };

  this.on('setup', function () {
    parts = {};
  });

  this.on('part', function (part) {
    parts[part.name] = part.clean;
  });
};

Core.prototype = Object.create(EventEmitter.prototype);
Core.prototype.constructor = EventEmitter;

Core.prototype.exec = function(name) {
  this.emit('setup', {
    name: name
  });
  this.emit('start');
  this.emit('end');

  return this.getParts();
};

module.exports = new Core();


/***/ }),

/***/ 210:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {



__nccwpck_require__(466);
__nccwpck_require__(715);
__nccwpck_require__(392);

module.exports = function(name) {
  return (__nccwpck_require__(891).exec)(name);
};


/***/ }),

/***/ 466:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) => {



var core = __nccwpck_require__(891);

/**
 * Pattern should contain either none or two capturing groups.
 * In case of two groups - 1st is raw, 2nd is clean.
 */
var patterns = {
  season: /([Ss]?([0-9]{1,2}))[Eex]/,
  episode: /([Eex]([0-9]{2})(?:[^0-9]|$))/,
  year: /([\[\(]?((?:19[0-9]|20[01])[0-9])[\]\)]?)/,
  resolution: /(([0-9]{3,4}p))[^M]/,
  quality: /(?:PPV\.)?[HP]DTV|(?:HD)?CAM|B[rR]Rip|TS|(?:PPV )?WEB-?DL(?: DVDRip)?|H[dD]Rip|DVDRip|DVDRiP|DVDRIP|CamRip|W[EB]B[rR]ip|[Bb]lu[Rr]ay|DvDScr|hdtv/,
  codec: /xvid|x264|h\.?264/i,
  audio: /MP3|DD5\.?1|Dual[\- ]Audio|LiNE|DTS|AAC(?:\.?2\.0)?|AC3(?:\.5\.1)?/,
  group: /(- ?([^-]+(?:-={[^-]+-?$)?))$/,
  region: /R[0-9]/,
  extended: /EXTENDED/,
  hardcoded: /HC/,
  proper: /PROPER/,
  repack: /REPACK/,
  container: /MKV|AVI/,
  widescreen: /WS/,
  website: /^(\[ ?([^\]]+?) ?\])/,
  language: /rus\.eng/,
  garbage: /1400Mb|3rd Nov| ((Rip))/
};
var types = {
  season: 'integer',
  episode: 'integer',
  year: 'integer',
  extended: 'boolean',
  hardcoded: 'boolean',
  proper: 'boolean',
  repack: 'boolean',
  widescreen: 'boolean'
};
var torrent;

core.on('setup', function (data) {
  torrent = data;
});

core.on('start', function() {
  var key, match, index, clean, part;

  for(key in patterns) {
    if(patterns.hasOwnProperty(key)) {
      if(!(match = torrent.name.match(patterns[key]))) {
        continue;
      }

      index = {
        raw:   match[1] ? 1 : 0,
        clean: match[1] ? 2 : 0
      };

      if(types[key] && types[key] === 'boolean') {
        clean = true;
      }
      else {
        clean = match[index.clean];

        if(types[key] && types[key] === 'integer') {
          clean = parseInt(clean, 10);
        }
      }

      if(key === 'group') {
        if(clean.match(patterns.codec) || clean.match(patterns.quality)) {
          continue;
        }

        if(clean.match(/[^ ]+ [^ ]+ .+/)) {
          key = 'episodeName';
        }
      }

      part = {
        name: key,
        match: match,
        raw: match[index.raw],
        clean: clean
      };

      if(key === 'episode') {
        core.emit('map', torrent.name.replace(part.raw, '{episode}'));
      }

      core.emit('part', part);
    }
  }

  core.emit('common');
});

core.on('late', function (part) {
  if(part.name === 'group') {
    core.emit('part', part);
  }
  else if(part.name === 'episodeName') {
    part.clean = part.clean.replace(/[\._]/g, ' ');
    part.clean = part.clean.replace(/_+$/, '').trim();
    core.emit('part', part);
  }
});


/***/ }),

/***/ 392:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) => {



var core = __nccwpck_require__(891);

var torrent, raw, groupRaw;
var escapeRegex = function(string) {
  return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
};

core.on('setup', function (data) {
  torrent = data;
  raw = torrent.name;
  groupRaw = '';
});

core.on('part', function (part) {
  if(part.name === 'excess') {
    return;
  }
  else if(part.name === 'group') {
    groupRaw = part.raw;
  }

  // remove known parts from the excess
  raw = raw.replace(part.raw, '');
});

core.on('map', function (map) {
  torrent.map = map;
});

core.on('end', function () {
  var clean, groupPattern, episodeNamePattern;

  // clean up excess
  clean = raw.replace(/(^[-\. ]+)|([-\. ]+$)/g, '');
  clean = clean.replace(/[\(\)\/]/g, ' ');
  clean = clean.split(/\.\.+| +/).filter(Boolean);

  if(clean.length !== 0) {
    groupPattern = escapeRegex(clean[clean.length - 1] + groupRaw) + '$';

    if(torrent.name.match(new RegExp(groupPattern))) {
      core.emit('late', {
        name: 'group',
        clean: clean.pop() + groupRaw
      });
    }

    if(torrent.map && clean[0]) {
      episodeNamePattern = '{episode}' + escapeRegex(clean[0].replace(/_+$/, ''));

      if(torrent.map.match(new RegExp(episodeNamePattern))) {
        core.emit('late', {
          name: 'episodeName',
          clean: clean.shift()
        });
      }
    }
  }

  if(clean.length !== 0) {
    core.emit('part', {
      name: 'excess',
      raw: raw,
      clean: clean.length === 1 ? clean[0] : clean
    });
  }
});


/***/ }),

/***/ 715:
/***/ ((__unused_webpack_module, __unused_webpack_exports, __nccwpck_require__) => {



var core = __nccwpck_require__(891);

__nccwpck_require__(466);

var torrent, start, end, raw;

core.on('setup', function (data) {
  torrent = data;
  start = 0;
  end = undefined;
  raw = undefined;
});

core.on('part', function (part) {
  if(!part.match) {
    return;
  }

  if(part.match.index === 0) {
    start = part.match[0].length;

    return;
  }

  if(!end || part.match.index < end) {
    end = part.match.index;
  }
});

core.on('common', function () {
  var raw = end ? torrent.name.substr(start, end - start).split('(')[0] : torrent.name;
  var clean = raw;

  // clean up title
  clean = raw.replace(/^ -/, '');

  if(clean.indexOf(' ') === -1 && clean.indexOf('.') !== -1) {
    clean = clean.replace(/\./g, ' ');
  }

  clean = clean.replace(/_/g, ' ');
  clean = clean.replace(/([\(_]|- )$/, '').trim();

  core.emit('part', {
    name: 'title',
    raw: raw,
    clean: clean
  });
});


/***/ }),

/***/ 361:
/***/ ((module) => {

module.exports = require("events");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(210);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;