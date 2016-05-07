mca-js
======

Copyright (c) 2016 Jonathan Faulch

About
-----

mca-js is an [MCA](http://minecraft.gamepedia.com/Anvil_file_format) parser
written in JavaScript for [Node.js](https://nodejs.org).

Usage
-----

```javascript
var fs   = require('fs');
var mca  = require('mca-js');

var file = fs.readFileSync('r.0.0.mca');
var tag  = mca.getChunk(file, 0, 0);

console.log(JSON.stringify(tag.payload));
```

License
-------

mca-js is licensed under the MIT License.  See license.md.