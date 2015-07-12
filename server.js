var http = require('http');
var fs = require('fs');
var querystring = require('querystring');
var resources = require('./public/resources.js');
var PORT = 6969;
var CONTENT_MODIFICATION_DATE = "Sat, 29 Oct 1994 19:43:31 GMT"; //for testing if-modified-since functionality
// var CONTENT_TYPE_HTML = "text/html";
// var CONTENT_TYPE_CSS = "text/css";
var PUBLIC_DIRECTORY = "./public/";
var POST_URI = "/elements";
var HTML_SUFFIX = ".html";
var INDEX_FILENAME = "index";
var SUPPORTED_HTTP_METHODS = {

  GET: "GET",
  POST: "POST",
  HEAD: "HEAD"
};

function writeFileToResponse(response, uri) {

  fs.readFile(PUBLIC_DIRECTORY + uri, function (error, data) {

    if(error) {

      doError(response, error, 500);
    }

    response.write(data);
    response.end();
    console.log("served " + uri);
  });
};

function doError(response, error, statusCode) {

  response.statusCode = statusCode;

  if(error) {

    response.write(error);
  }

  response.end();
};

function do404(response) {

  var uri = "404.html";
  response.statusCode = 404;

  fs.exists(PUBLIC_DIRECTORY + uri, function(exists) {

    if(exists) {

      writeFileToResponse(response, uri);

    } else {

      response.end();
    }
  });
};

function doGET(request, response) {

  var uri = request.url;

  if(uri === "/") {

    uri = "index.html";
  }

  fs.exists(PUBLIC_DIRECTORY + uri, function(exists){

    if(exists){

      writeFileToResponse(response, uri);

    }else{

      do404(response);
    }
  });
};

function doPOST(request, response) {

  var uri = request.url;

  if(uri !== POST_URI) {

    doError(response, null, 400);
    return;
  }

  var requestBody = "";

  request.on('data', function(chunk){

    requestBody += chunk.toString();
  });

  request.on('end', function(){

    var postData = querystring.parse(requestBody);

    if(!isPostDataValid(postData)) {

      doError(response, null, 400);
      return;
    }
    var elementHTML = getElementHTML(postData);
    var indexHTML = getIndexHTML();

    console.log(indexHTML);

    indexHTML = parseIndex(postData, indexHTML);

    console.log(elementHTML);
    console.log(indexHTML);

    if(elementHTML && indexHTML) {

      // writeFileToFileSystem(postData.elementName, elementHTML, response);
      // writeFileToFileSystem(INDEX_FILENAME + HTML_SUFFIX, indexHTML, response);
      response.setHeader("Content-Type", "application/json");
      response.write('{"success" : true}');

    } else {

      doError(response, null, 500);
    }

    response.end();
  });
};

function writeFileToFileSystem(fileName, content, response) {

  fs.writeFile(PUBLIC_DIRECTORY + fileName + HTML_SUFFIX, content, function(error){

    if(error) {

      doError(response, error, 500);
    }
  });
};

function getIndexHTML() {

  var indexHTML = null;

  fs.exists(PUBLIC_DIRECTORY + INDEX_FILENAME + HTML_SUFFIX, function(exists) {

    if(exists) {

      fs.readFile(PUBLIC_DIRECTORY + INDEX_FILENAME + HTML_SUFFIX, 'utf8', function (error, text) {

        if(error) {

          doError(response, error, 500);
        }

        indexHTML = text;

        console.log(text);

        // return parseIndex(data, indexHTML);
        return indexHTML;
      });

    } else {

      do404(response);
    }
  });
};

function parseIndex(data, indexHTML) {

  var out = null;
  var h3Index1 = indexHTML.indexOf("<h3>");
  var h3Index2 = indexHTML.indexOf("</h3>");
  var foreString = indexHTML.substring(0, h3Index1 + 4);
  var backString = indexHTML. substring(h3Index2);
  var textString = indexHTML.substring(h3Index1 + 4, h3Index2);
  var areIndex = textString.lastIndexOf("are");
  var numberString = textString.substring(areIndex + 3);
  var parsedNumber = parseInt(numberString);

  out = foreString + "These are "+ (parsedNumber + 1) + backString;

  var liIndex = out.lastIndexOf("</li>");
  foreString = out.substring(0, liIndex + 5);
  backString = out.substring(liIndex + 5);

  out = foreString + '<li><a href="/' + data.elementName.toLowerCase() + HTML_SUFFIX + '">' + data.elementName +
        '</a></li>' + backString;

  console.log("INDEX : " + out);

  return out;
};

function getElementHTML(data) {

  return  "<!DOCTYPE html> <html lang='en'> <head> <meta charset='UTF-8'> <title>The Elements - " + data.elementName +
          "</title> <link rel='stylesheet' href='/css/styles.css'> </head> <body> <h1>" + data.elementName +
          "</h1> <h2>" + data.elementSymbol + "</h2> <h3>Atomic number " + data.elementAtomicNumber +
          "</h3> <p>"+ data.elementDescription + "</p> <p><a href="/">back</a></p> </body> </html>";
};

function isPostDataValid(data) {

  if( data.hasOwnProperty("elementName") &&
      data.hasOwnProperty("elementSymbol") &&
      data.hasOwnProperty("elementAtomicNumber") &&
      data.hasOwnProperty("elementDescription")) {

    return true;
  }

  return false;
};

function clientConnected(request, response) { //'request' listener

  if(!SUPPORTED_HTTP_METHODS.hasOwnProperty(request.method)) {

    doError(response, null, 405);
    return;
  }

  if(request.headers.hasOwnProperty("if-modified-since")) {

    if(Date.parse(request.headers["if-modified-since"]) > Date.parse(CONTENT_MODIFICATION_DATE)) {

      doError(response, null, 304);
      return;
    }
  }

  if(request.method === SUPPORTED_HTTP_METHODS.HEAD) {

    response.end();
  }

  if(request.method === SUPPORTED_HTTP_METHODS.GET) {

    doGET(request, response);
  }

  if(request.method === SUPPORTED_HTTP_METHODS.POST) {

    doPOST(request, response);
  }
};

var server = http.createServer(clientConnected);

server.listen(PORT,function() {

  console.log('server bound to ' + PORT);
});