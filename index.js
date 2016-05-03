'use strict';

var path = require('path');
var fs = require('fs');

var Importer = require('./importer');

// config
const CONFIG_FILENAME = 'config.json';
var fileConfig = fs.readFile(CONFIG_FILENAME, function(err, data) {
	if (err) {
    console.log('Error loading config: ' + err);
  }
  else {
    var config = JSON.parse(data);

    // import
    var importer = new Importer(config);
    importer.import();
  }
});