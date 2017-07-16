'use strict';

var unirest = require('unirest');
// load URI.js
var URI = require('urijs');

module.exports.github2rundeck = (event, context, callback) => {
  const rundeckHostname = process.env.RUNDECK_HOSTNAME;
  const rundeckPort = process.env.RUNDECK_PORT;
  const rundeckAuthTocken = process.env.RUNDECK_AUTH_TOKEN;
  const rundeckPingJobUUID = process.env.RUNDECK_JOB_UUID_PING;

  if (event.headers['X-GitHub-Event'] == 'ping') {
    console.log("Github ping event.");

    var parsedQuery = parseQueryStringParameters(event);

    // Call the Rundeck ping job.
    const rundeckUrl = rundeckHostname + ':' + rundeckPort + '/api/18/job/' + rundeckPingJobUUID + '/run';
    unirest.post(rundeckUrl)
      .headers({'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Rundeck-Auth-Token': rundeckAuthTocken})
      .send({ 'options': JSON.stringify(parsedQuery.passkeys), })
      .strictSSL(false)
      .end(function (response) {
        // Construct the response to the ping request from the rundeck call
        // response.
        const callbackResponse = {
          statusCode: response.statusCode,
          body: JSON.stringify({
            message: response.statusMessage,
            input: event,
          }),
        }

        callback(null, callbackResponse);
      });
  }
  else {
    // required:
    // rundeckjobid: The rundeck job to run.
    // rundeckauthtoken: rundeck authentication token.
    //
    // passkey%keyname%:%altname% pass the %keyname% as an option with the
    // rundeck call. Potentially renaming it to %altname%.
    //
    // checkkey%keyname% (make sure the value of keyname matches the expected).

    var parsedQuery = parseQueryStringParameters(event);

    // Make sure the job uuid is available.
    if (!parsedQuery.rundeckJobUUID || !parsedQuery.checkHeaders || !parsedQuery.checkKeys) {
      const response = {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing target Rundeck Job ID or failed headers or body keys checks.",
          input: event,
        }),
      }
      callback(null, response);
      return;
    }

    const rundeckUrl = rundeckHostname + ':' + rundeckPort + '/api/18/job/' + parsedQuery.rundeckJobUUID + '/run';
    unirest.post(rundeckUrl)
      .headers({'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Rundeck-Auth-Token': rundeckAuthTocken})
      .send({ 'options': JSON.stringify(parsedQuery.passkeys), })
      .strictSSL(false)
      .end(function (response) {
        // Construct the response to the ping request from the rundeck call
        // response.
        const callbackResponse = {
          statusCode: response.statusCode,
          body: JSON.stringify({
            message: response.statusMessage,
            input: event,
          }),
        }

        callback(null, callbackResponse);
      });
  }

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // callback(null, { message: 'Go Serverless v1.0! Your function executed successfully!', event });
};

function parseQueryStringParameters(event) {
  const queryStringParameters = event.queryStringParameters;
  const eventHeaders = event.headers;
  const eventBody = JSON.parse(event.body);

  var rundeckJobUUID;
  var checkheaders = new Object();
  var checkkeys = new Object();
  var passkeys = new Object();

  // Parse the query String and fill the allocated objects.
  for (var prop in queryStringParameters) {
    if (/^rundeckjobid$/.test(prop)) {
      rundeckJobUUID = queryStringParameters[prop];
    }
    else if (/^checkheader*/.test(prop)){
      checkheaders[prop.replace(/^checkheader*/, '')] = queryStringParameters[prop];
    }
    else if (/^checkkey*/.test(prop)){
      checkkeys[prop.replace(/^checkkey*/, '')] = queryStringParameters[prop];
    }
    else if (/^passkey*/.test(prop)){
      passkeys[prop.replace(/^passkey*/, '')] = queryStringParameters[prop];
    }
  }

  var isCheckHeaders = true;
  var isCheckKeys = true;
  var curatedPasskeys = new Object();

  // Check for the headers values.
  for (var checkheader in checkheaders) {
    if (event.headers[checkheader.replace(/^checkheader*/, '')] != checkheaders[checkheader]) {
      isCheckHeaders = false;
      console.log('Header value for key ' +
        checkheader.replace(/^checkheader*/, '') +
        ' did not match the expected value of ' +
        checkheaders[checkheader] + '.');
    }
  }

  // Check for the body values.
  for (var checkkey in checkkeys) {
    var curatedKeyName = checkkey.replace(/^checkkey*/, '');
    if (eventBody[curatedKeyName] != checkkeys[checkkey]) {
      isCheckKeys = false;
      console.log('Body value for key ' +
        curatedKeyName +
        ' did not match the expected value of ' +
        checkkeys[checkkey] + '.');
    }
  }

  // Get the keys to pass from the hook body.
  for (var passkey in passkeys) {
    var curatedPassKey = passkey.replace(/^passkey*/, '');
    if (eventBody[curatedPassKey]) {
      curatedPasskeys[curatedPassKey] = eventBody[curatedPassKey];
    }
    else {
      console.log('key ' + curatedPassKey + ' not found and cannot be passed.');
    }
  }

  return {
    'rundeckJobUUID': rundeckJobUUID,
    'checkHeaders': isCheckHeaders,
    'checkKeys': isCheckKeys,
    'passkeys': curatedPasskeys,
  };
}
