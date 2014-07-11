fondue-middleware
=================

Connect/Express middleware that automatically instruments all the JavaScript on your web site with [fondue](https://github.com/adobe-research/fondue), including files served as `application/javascript`, and script tags in files served as `text/html`.

```javascript
app.use(require('fondue-middleware')());
```

It passes options through to fondue:

```javascript
app.use(require('fondue-middleware')({ tracer_name: '__my_tracer' }));
```

Included Shell Scripts / Examples
---------------------------------

**fondue-server** serves the current directory with `express.static()` on http://localhost:3000/.

**fondue-proxy** starts a proxy server at http://localhost:8080/ that proxies whatever is running on http://localhost:3000/.

What do I do with this?
-----------------------

You can use [the fondue API](https://github.com/adobe-research/fondue#use) on the page site itself (in the browser) by accessing the global `__tracer` object. I use this technique and a second middleware to automatically embed a JavaScript debugger onto every page of a web site.

This does *not* make your page suddenly debuggable by [Theseus](https://github.com/adobe-research/theseus). But if you start a WebSocket server from the page then you could mimic [node-theseus's simple server](https://github.com/adobe-research/node-theseus/blob/master/node-theseus.js#L94) to get that going.
