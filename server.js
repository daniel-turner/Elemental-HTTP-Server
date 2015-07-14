var http = require('http');
var fs = require('fs');
var querystring = require('querystring');
// var resources = require('./public/resources.js');
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
  PUT: "PUT",
  DELETE: "DELETE",
  HEAD: "HEAD"
};

/**
 * Reads file at the given uri and returns the content to the given callback
 * @param  {[type]}   uri      [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function writeFileToResponse(uri, callback) {

  fs.exists(PUBLIC_DIRECTORY + uri, function(exists) {

    if(exists) {

      fs.readFile(PUBLIC_DIRECTORY + uri, function (error, data) {

        if(error) {

          callback({status: 500, message: error.message }, error.message);

        } else {

          callback(null, data);
          console.log("served " + uri);
        }
      });

    } else {

      callback({ status: 404, message: "resource does not exist"}, "resource does not exist");
    }
  });


};

function writeFileToFileSystem(fileName, content, callback) {

  fs.writeFile(PUBLIC_DIRECTORY + fileName + HTML_SUFFIX, content, function(error){

    if(error) {

      doError(error, 500, callback);
      return;
    }
  });
};


function doError(error, statusCode, callback) {

  callback(statusCode, error);
};

function do404(callback) {

  var uri = "404.html";

  writeFileToResponse(uri, function(error, data) {

    callback(404, data);
  });
};

function doGET(request, callback) {

  var uri = request.url.toLowerCase();

  if(uri === "/") {

    uri = "index.html";
  }

  fs.exists(PUBLIC_DIRECTORY + uri, function(exists) {

    if(exists){

      // writeFileToResponse(response, uri);
      writeFileToResponse(uri, function(error, data) {

        if(error) {

          callback(error.status, error.message);

        } else {

          callback(200, data);
        }
      });

    }else{

      do404(callback);
    }
  });
};

function doPOST(request, callback) {

  var uri = request.url.toLowerCase();

  if(uri !== POST_URI) {

    doError("Incorrect URI for POST.", 400, callback);
    return;
  }

  var requestBody = "";

  request.on('data', function(chunk){

    requestBody += chunk.toString();
  });

  request.on('end', function(){

    var postData = querystring.parse(requestBody);

    if(!isPostPutDataValid(postData)) {

      doError("Invalid data submitted to POST.", 400, callback);
      return;
    }

    fs.exists(PUBLIC_DIRECTORY + postData.elementName.toLowerCase() + HTML_SUFFIX, function(exists) {

      if(exists) {

        doError("Please use PUT to update an existing resource", 403, callback);
        return;

      } else {

        httpPOSTPrepareContent(postData, callback);
      }
    });
  });
};

function doPUT(request, response) {

  var requestBody = "";

  request.on('data', function(chunk) {

    requestBody += chunk.toString();
  });

  request.on('end', function() {

    var putData = querystring.parse(requestBody);

    if(!isPostPutDataValid(putData)) {

      doError(response, "Invalid data submitted to PUT.", 400);
      return;
    }

    httpPUTPrepareContent(putData, response);
  });
};

function doDELETE(request, callback) {

  var uri = request.url.toLowerCase() + HTML_SUFFIX;

  if(uri === "/" || uri === "index.html") {

    doError("Cannot delete index.html", 403, callback);
    return;
  }

  httpDELETEExecute(uri, callback);
};

function httpPOSTPrepareContent(postData, callback) {

  fs.exists(PUBLIC_DIRECTORY + INDEX_FILENAME + HTML_SUFFIX, function(exists) {

    if(exists) {

      fs.readFile(PUBLIC_DIRECTORY + INDEX_FILENAME + HTML_SUFFIX, 'utf8', function (error, indexHTML) {

        if(error) {

          doError(error, 500, callback);
        }

        var elementHTML = getElementHTML(postData);
        indexHTML = addToIndexHTML(postData, indexHTML);

        httpPOSTExecute(postData, indexHTML, elementHTML, callback);
      });

    } else {

      do404(callback);
    }
  });
};

function httpPUTPrepareContent(putData, callback) {

  var uri = putData.elementName.toLowerCase();
  var elementHTML = null;

  fs.exists(PUBLIC_DIRECTORY + uri + HTML_SUFFIX, function(exists) {

    if(exists) {

      elementHTML = getElementHTML(putData);
      httpPUTExecute(putData, elementHTML, callback);

    } else {

      doError('{ "error" : "resource does not exist" }', 500, callback);
      return;
    }
  })
};

function httpPOSTExecute(postData, indexHTML, elementHTML, callback) {

  if(elementHTML && indexHTML) {

    writeFileToFileSystem(postData.elementName.toLowerCase(), elementHTML, callback);
    writeFileToFileSystem(INDEX_FILENAME, indexHTML, callback);
    callback(200, JSON.stringify({ "success": true }));

  } else {

    doError(null, 500, callback);
    return;
  }
};

function httpPUTExecute(putData, elementHTML, callback) {

  if(elementHTML) {

    writeFileToFileSystem(putData.elementName.toLowerCase(), elementHTML, callback);

    callback(200, JSON.stringify({ "success": true }));

  } else {

    doError(null, 500, callback);
    return;
  }
};

function httpDELETEExecute(uri, callback) {

  fs.exists(PUBLIC_DIRECTORY + uri, function(exists){

    if(exists) {

      fs.unlink(PUBLIC_DIRECTORY + uri, function(error) {

        if(error) {

          doError("Server could not delete file", 500, callback);
          return;

        } else {

          var indexPath = PUBLIC_DIRECTORY + INDEX_FILENAME + HTML_SUFFIX;

          fs.exists(indexPath, function(exists) {

            if(exists) {

              fs.readFile(indexPath, 'utf8', function (error, indexHTML) {

                if(error) {

                  doError(error, 500, callback);
                  return;
                }

                indexHTML = removeFromIndexHTML(uri, indexHTML);

                if(indexHTML) {

                  writeFileToFileSystem(INDEX_FILENAME, indexHTML, callback);

                } else {

                  doError("Could not write to index", 500, callback);
                  return;
                }

                callback(200, JSON.stringify({ "success": true }));
              });

            } else {

              doError("Could not update index.html", 500, callback);
              return;
            }
          });
        }
      });

    }else{

      doError("resource does not exist", 500, callback);
      return;
    }
  });
};

function getElementHTML(data) {

  return  "<!DOCTYPE html> <html lang='en'> <head> <meta charset='UTF-8'> <title>The Elements - " + data.elementName +
          "</title> <link rel='stylesheet' href='/css/styles.css'> </head> <body> <h1>" + data.elementName +
          "</h1> <h2>" + data.elementSymbol + "</h2> <h3>Atomic number " + data.elementAtomicNumber +
          "</h3> <p>"+ data.elementDescription + '</p> <p><a href="/">back</a></p> </body> </html>';
};

function addToIndexHTML(postData, indexHTML) {

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

  out = foreString + '<li><a href="/' + postData.elementName.toLowerCase() + HTML_SUFFIX + '">' + postData.elementName +
        '</a></li>' + backString;

  return out;
};

function removeFromIndexHTML(uri, indexHTML) {

  var out = null;
  var h3Index1 = indexHTML.indexOf("<h3>");
  var h3Index2 = indexHTML.indexOf("</h3>");
  var foreString = indexHTML.substring(0, h3Index1 + 4);
  var backString = indexHTML. substring(h3Index2);
  var textString = indexHTML.substring(h3Index1 + 4, h3Index2);
  var areIndex = textString.lastIndexOf("are");
  var numberString = textString.substring(areIndex + 3);
  var parsedNumber = parseInt(numberString);

  out = foreString + "These are "+ (parsedNumber - 1) + backString;

  var uriIndex = out.indexOf(uri);
  foreString = out.substring(0, uriIndex);
  backString = out.substring(uriIndex);
  var foreLIIndex = foreString.lastIndexOf("<li>");
  var backLIIndex = backString.indexOf("</li>");
  out = foreString.substring(0, foreLIIndex) + backString.substring(backLIIndex + 5);

  return out;
};

function isPostPutDataValid(data) {

  return (data.hasOwnProperty("elementName") &&
          data.hasOwnProperty("elementSymbol") &&
          data.hasOwnProperty("elementAtomicNumber") &&
          data.hasOwnProperty("elementDescription"));
};

function clientConnected(request, response) { //'request' listener

  function respond(status, body) {

    response.statusCode = status;
    response.end(body);
  }

  if(!SUPPORTED_HTTP_METHODS.hasOwnProperty(request.method)) {

    doError(null, 405, respond);
    return;
  }

  if(request.headers.hasOwnProperty("if-modified-since")) {

    if(Date.parse(request.headers["if-modified-since"]) > Date.parse(CONTENT_MODIFICATION_DATE)) {

      doError(null, 304, respond);
      return;
    }
  }

  switch(request.method) {

    case SUPPORTED_HTTP_METHODS.HEAD:

      response.end();
      break;

    case SUPPORTED_HTTP_METHODS.GET:

      doGET(request, respond);
      break;

    case SUPPORTED_HTTP_METHODS.POST:

      doPOST(request, respond);
      break;

    case SUPPORTED_HTTP_METHODS.PUT:

      doPUT(request, respond);
      break;

    case SUPPORTED_HTTP_METHODS.DELETE:

      doDELETE(request, respond);
      break;

    default:

      doError("Could not identify HTTP method", 400, respond);
  };
};

var server = http.createServer(clientConnected);

  server.listen(PORT,function() {

    console.log('server bound to ' + PORT);
});