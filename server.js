'use strict';

// Module imports
var express = require('express')
  , restify = require('restify')
  , http = require('http')
  , bodyParser = require('body-parser')
  , util = require('util')
  , queue = require('block-queue')
  , _ = require('lodash')
  , log = require('npmlog-ts')
  , dateFormat = require('dateformat')
;

log.stream = process.stdout;
log.timestamp = true;
log.level = 'verbose';

const DBHOST   = "https://new.local.apex.digitalpracticespain.com";
const SERVICE  = "/ords/pdb1/anki/event";
const LAP      = "/lap";
const SPEED    = "/speed";
const OFFTRACK = "/offtrack";
const DBLAP      = "/lap/:demozone";
const DBSPEED    = "/speed/:demozone";
const DBOFFTRACK = "/offtrack/:demozone";

// Instantiate classes & servers
var app    = express()
  , router = express.Router()
  , server = http.createServer(app)
  , dbClient = restify.createStringClient({
    url: DBHOST,
    rejectUnauthorized: false
  })
;

// Initializing QUEUE variables BEGIN
var q = undefined;
var queueConcurrency = 1;
// Initializing QUEUE variables END

// ************************************************************************
// Main code STARTS HERE !!
// ************************************************************************

// Main handlers registration - BEGIN
// Main error handler
process.on('uncaughtException', function (err) {
  log.error("","Uncaught Exception: " + err);
  log.error("","Uncaught Exception: " + err.stack);
});
// Detect CTRL-C
process.on('SIGINT', function() {
  log.error("","Caught interrupt signal");
  log.error("","Exiting gracefully");
  process.exit(2);
});
// Main handlers registration - END

// REST engine initial setup
const PORT = 9998;
const restURI = '/event';
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// REST stuff - BEGIN
router.post(LAP, function(req, res) {
//  log.info("","LAP: %j", req.body);
  var payload = req.body;
  _.each(payload, (element) => {
    var input = element.payload.data;
    var data = {
      deviceid: input.data_deviceid,
      datetime: dateFormat(new Date(input.data_eventtime / 1000000), 'GMT:dd-mmm-yy hh.MM.ss TT'),
      datetimestring: input.data_datetimestring,
      racestatus: input.data_racestatus,
      raceid: input.data_raceid,
      carid: input.data_carid,
      carname: input.data_carname,
      lap: input.data_lap,
      laptime: input.data_laptime
    };
    q.push({
      service: DBLAP.replace(':demozone', input.data_demozone),
      data: data
    });
  });
  res.send("OK");
});

router.post(SPEED, function(req, res) {
//  log.info("","SPEED: %j", req.body);
  var payload = req.body;
  _.each(payload, (element) => {
    var input = element.payload.data;
    var data = {
      deviceid: input.data_deviceid,
      datetime: dateFormat(new Date(input.data_eventtime / 1000000), 'GMT:dd-mmm-yy hh.MM.ss TT'),
      datetimestring: input.data_datetimestring,
      racestatus: input.data_racestatus,
      raceid: input.data_raceid,
      carid: input.data_carid,
      carname: input.data_carname,
      speed: input.data_speed,
      trackid: input.data_trackid,
      lap: input.data_lap
    };
    q.push({
      service: DBSPEED.replace(':demozone', input.data_demozone),
      data: data
    });
  });
  res.send("OK");
});

router.post(OFFTRACK, function(req, res) {
//  log.info("","OFFTRACK: %j", req.body);
  var payload = req.body;
  _.each(payload, (element) => {
    var input = element.payload.data;
    var data = {
      deviceid: input.data_deviceid,
      datetime: dateFormat(new Date(input.data_eventtime / 1000000), 'GMT:dd-mmm-yy hh.MM.ss TT'),
      datetimestring: input.data_datetimestring,
      racestatus: input.data_racestatus,
      raceid: input.data_raceid,
      carid: input.data_carid,
      carname: input.data_carname,
      lap: input.data_lap,
      message: input.data_message,
      lastknowntrack: input.data_lastknowntrack
    };
    q.push({
      service: DBOFFTRACK.replace(':demozone', input.data_demozone),
      data: data
    });
  });
  res.send("OK");
});

app.use(restURI, router);
// REST stuff - END

// Start QUEUE
q = queue(queueConcurrency, function(task, done) {
//  log.info("","Queueing call to %s with data: %j", DBHOST + SERVICE + task.service, task.data);
  insert(DBHOST + SERVICE + task.service, task.data);
  done(); // Let queue handle next task
});

server.listen(PORT, () => {
  _.each(router.stack, (r) => {
    // We take just the first element in router.stack.route.methods[] as we assume one HTTP VERB at most per URI
    log.info("","'" + _.keys(r.route.methods)[0].toUpperCase() + "' method available at https://localhost:" + PORT + restURI + r.route.path);
  });
});

function insert(URI, data) {
  dbClient.post(URI, data, (err, req, res, data) => {
    if (err) {
      // Error comes as a HTML page.I try to remove all HTML garbage and keep just the error message
      // Tried to use a regexp expression but didn't succeed :-(
      var start = '<span class="reason">';
      var end = '</span>';
      var s1 = err.message.substring(err.message.indexOf(start) + start.length);
      var s2 = s1.substring(0,s1.indexOf(end)).replace('\n', ' '); // Get rid of any newline in the error message
      log.info("","ERROR: %s", s2);
      log.info("","DATA: %j", data);
    } else {
//      log.info("","OK: %d", res.statusCode);
    }
  });
}
