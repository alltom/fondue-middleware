/*
 * Copyright (c) 2013 Massachusetts Institute of Technology, Adobe Systems
 * Incorporated, and other contributors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

var fondue = require("fondue");
var crypto = require("crypto");

var cache = {}; // digest -> string

function mergeInto(options, defaultOptions) {
	for (var key in options) {
		if (options[key] !== undefined) {
			defaultOptions[key] = options[key];
		}
	}
	return defaultOptions;
}

function instrument(src, fondueOptions) {
	var md5 = crypto.createHash("md5");
	md5.update(JSON.stringify(fondueOptions) + "||" + src);
	var digest = md5.digest("hex");
	if (digest in cache) {
	    return cache[digest];
	} else {
	    return cache[digest] = fondue.instrument(src, fondueOptions);
	}
}

function processJavaScript(src, fondueOptions) {
	return instrument(src, fondueOptions);
}

function processHTML(src, fondueOptions) {
	var scriptLocs = [];
	var scriptBeginRegexp = /<\s*script[^>]*>/ig;
	var scriptEndRegexp = /<\s*\/\s*script/i;
	var lastScriptEnd = 0;

	var match;
	while (match = scriptBeginRegexp.exec(src)) {
		var scriptBegin = match.index + match[0].length;
		if (scriptBegin < lastScriptEnd) {
			continue;
		}
		var endMatch = scriptEndRegexp.exec(src.slice(scriptBegin));
		if (endMatch) {
			var scriptEnd = scriptBegin + endMatch.index;
			scriptLocs.push({ start: scriptBegin, end: scriptEnd });
			lastScriptEnd = scriptEnd;
		}
	}

	// process the scripts in reverse order
	for (var i = scriptLocs.length - 1; i >= 0; i--) {
		var loc = scriptLocs[i];
		var script = src.slice(loc.start, loc.end);
		var prefix = src.slice(0, loc.start).replace(/[^\n]/g, " "); // padding it out so line numbers make sense
		src = src.slice(0, loc.start) + instrument(prefix + script, fondueOptions) + src.slice(loc.end);
	}

	src = "<script>\n" + fondue.instrumentationPrefix(fondueOptions) + "\n</script>\n" + src;

	return src;
}

module.exports = function (options) {
	options = options || {};

	return function(req, res, next){
		var written = [];
		var write = res.write, end = res.end;

		res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

		res.write = function(chunk) {
			written.push(chunk);
		};

		res.end = function(chunk) {
			if (chunk) this.write.apply(this, arguments);

			var type = res.getHeader("Content-Type");
			var fondueOptions = mergeInto(options, { path: unescape(req.url), include_prefix: false });

			if (/application\/javascript/.test(type)) {
				var src = Buffer.concat(written).toString();
				src = processJavaScript(src, fondueOptions);
				written = [src];
				res.removeHeader("Content-Length");
			} else if (/text\/html/.test(type)) {
				var src = Buffer.concat(written).toString();
				src = processHTML(src, fondueOptions);
				written = [src];
				res.removeHeader("Content-Length");
			}

			written.forEach(function (c) {
				write.call(res, c)
			});

			return end.call(res);
		};

		next();
	};
};
