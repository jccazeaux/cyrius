var url = require('url');
var http = require('http');

/**
 * Cyrius node Module
 * Cyrius helps you to create a fast et and light REST application
 */
var Cyrius = function() {
	var server = initServer();
	var resources = {};
	/**
	 * Declares the ressources for the GET method
	 * @function {public void} get
	 * @param {String} route
 	 */
	server.get = function(route, handler) {
		addRoute("GET", route, handler);
	};

	/**
	 * Add a route
	 * @function {private voir} addRoute
	 * @param {String} method
	 * @param {String} route
	 * @param {Function} handler
	 */
	function addRoute(method, route, handler) {
		if (!CyriusUtils.checkResourceDeclareParameters(route, handler)) {
			console.error("Impossible d'ajouter la resource: le handler doit \u00eatre renseign\u00e9");
			return;
		}
		resources[method] = resources[method] || [];
		resources[method].push({"route":route, "handler": handler});
		console.log(method + " route declared: " + JSON.stringify({"route":route, "handler": handler}));
	}

	/**
	 * Déclare les ressources traitées par ce serveur en POST
	 */
	server.post = function(route, handler) {
		addRoute("POST", route, handler);
	};
	/**
	 * Creates the server
	 * @function {private void} initServer
	 */
	function initServer() {
		var server = http.createServer(function (req, res) {
			var handle = null;
			var response = HttpUtils.wrapResponse(res);
			var request = HttpUtils.wrapRequest(req);
			try {
				console.log(url.parse(req.url).pathname);
				var path = url.parse(req.url).pathname;
				var resource = resolveResource(path, req.method);
				if (resource) {
					if (req.method === "GET") {
						handle = resource.resource.handler;
						handle(request, response, resource.params);
					} else if (req.method === "POST") {
						handle = resource.resource.handler;
						HttpUtils.handlePost(request, response, resource.params, handle);				
					}
				} else {
					response.notFound(res, "Not found");
				}
			} catch(e) {
				console.log("Exception: " + e.stack);
				response.send(e.message, e.codeErreur);
			}
		});
		return server;
	};



	/**
	 * Retrieves the resource for the given path
	 * @param {String} path path to resolve
	 * @param {String} method HTTP method called
	 * @return {Object} Resource resolved
	 * @... {Object} resource
	 * @... {Object} params route params
	 */
	function resolveResource(path, method) {
		if (resources[method]) {
			return searchResourceIn(resources[method], path);
		}
		return null;
	};
	/**
	 * Search the resource that respond to the path
	 * @param {Object} Resources object
	 * @param {String} path path to parse
	 * @return {Object} Resource resolved
	 * @... {Object} resource
	 * @... {Object} params route params
	 */
	function searchResourceIn(resources, path) {
		for (resource in resources) {
			var params = CyriusUtils.parsePathWithPattern(path, resources[resource].route);
			if (params) {
				console.log("Resource résolvée: " + JSON.stringify(resources[resource]));
				console.log("params: " + JSON.stringify(params));
				return {"resource": resources[resource], "params": params};
			}
		}
		return null;
	};


	return server;

};



/**
 * Some Utilities
 * @namespace CyriusUtils
 */
var CyriusUtils = {

	/**
	 * Tries to guess the contentType
	 * @function {public String} guessContentType
	 * @return {String} contentType guessed
	 */
	guessContentType: function(content) {
		try {
			JSON.parse(content);
			return "application/json";
		} catch (ex) {
		}
		if (content.indexOf("<html>") != -1 && content.indexOf("</html>") != -1) {
			return ("text/html");
		} else {
			return "";
		}
		
	},

	/**
	 * Parses the path with the pattern. The pattern is a route. If the path matches the pattern, the method returns the params
	 * @param {String} path path asked
	 * @param {String} pattern route pattern
	 * @return {Object} false if it doesn't math, JSON object with the route params if it matches
	 */
	parsePathWithPattern: function(path, pattern) {
		var params = {};
		var match = true;
		var pathSplit = path.split("/");
		// If last element is empty, we splice it because it's useless for us
		if (!pathSplit[pathSplit.length - 1] || pathSplit[pathSplit.length - 1] === "") {
			pathSplit.splice(pathSplit.length - 1, 1);
		}
		var patternSplit = pattern.split("/");
		// first easy test, if the lenghts are not equals, that doesn't match
		if (patternSplit.length > pathSplit.length) {
			return false;
		}
		// IndexPath is the courant index during iteration of pathSplit. It's usefull to get the remaining path
		// with a substring
		var indexPath = 0;
		for(i in pathSplit) {
			if (patternSplit.length > i) {
				if (pathSplit[i] === patternSplit[i]) {
					// nothing to do, we continue
				} else if (patternSplit[i].indexOf(":") == 0) {
					params[patternSplit[i].substring(1)] = pathSplit[i];
				} else if (patternSplit[i].indexOf("*") == 0) {
					params[patternSplit[i].substring(1)] = path.substring(indexPath);
					break;
				} else {
					match = false;
					break;
				}
			} else {
				match = false;
				break;
			}
			indexPath += pathSplit[i].length + 1;
		}
		if (match) {
			return params;
		} else {
			return false;
		}
	},
	
	/**
	 * Checks if parameters are OK
	 * @function {public boolean} checkResourceDeclareParameters
	 * @param {String} route route added
	 */
	checkResourceDeclareParameters: function(route, handler) {
		if (!route || route === "") {
			console.log("Route not added : route is empty");
			return false;
		}
		if (!handler) {
			console.log("Route not added : handler is null");
			return false;
		}
		return true;

	}
}

/**
 * HTTP utilities
 * @namespace HttpUtils
 */
var HttpUtils = {
	/**
	 * Handled the POST. It parses the body then delegates to the handler
	 * @param {Request} req request
	 * @param {Respons} res response
	 * @param {Object} params route params
	 * @param {Function} handler pour le POST
	 */
	handlePost: function(req, res, params, handler) {
	    var requestBody = '';
    	req.on('data', function(data) {
  			requestBody += data;
  			if(requestBody.length > 1e7) {
				res.writeHead(413, "Request Entity Too Large", {'Content-Type': 'text/html'});
 				res.end('<!doctype html><html><head><title>413</title></head><body>413: Request Entity Too Large</body></html>');
			}
		});
		req.on('end', function() {
			try {
				handler(req, res, params, requestBody);
			} catch(e) {
				console.error("Exception: " + e.stack);
				res.end(e.message);
			}
		});
	},

	/**
	 * Wraps the nodeJS request
	 * @function {public Object} wrapRequest
	 * @return {Object} request wrapped
	 */
	wrapRequest: function(req) {
		return req;
	}, 

	/**
	 * Wraps the nodeJS response
	 * @function {public Object} wrapResponse
	 * @return {Object} response wrapped
	 */
	wrapResponse: function(res) {
		for (fn in ResponseWrappers) {
			res[fn] = ResponseWrappers[fn];
		}
		return res;
	}
}

/**
 * This object contains the wrapper methods for the reponse
 * @namespace ResponseWrappers
 */
var ResponseWrappers = {
	/**
	 * Sends a OK (status code 200)
	 * @param {Response} res response
	 * @param {String} content Body Content
	 * @param {String} contentType if specified, specifies the contentType. Else tries to guess it
	 */
	ok: function(res, content, contentType) {
		if (contentType) {
			res.writeHead(200, "", {'Content-Type': contentType});
		} else {
			res.writeHead(200, "", {'Content-Type': CyriusUtils.guessContentType(content)});
		}
		res.end(content);

	},
	/**
	 * Sends a bad request (status code 400)
	 * @param {Response} res response
	 * @param {String} content Body Content
	 * @param {String} contentType if specified, specifies the contentType. Else tries to guess it
	 */
	badRequest: function(res, content, contentType) {
		if (contentType) {
			res.writeHead(400, "", {'Content-Type': contentType});
		} else {
			res.writeHead(400, "", {'Content-Type': CyriusUtils.guessContentType(content)});
		}
		res.end(content);

	},
	/**
	 * Sends a server error (status code 500)
	 * @param {Response} res response
	 * @param {String} content Body Content
	 * @param {String} contentType if specified, specifies the contentType. Else tries to guess it
	 */
	serverError: function(res, content, contentType) {
		if (contentType) {
			res.writeHead(500, "", {'Content-Type': contentType});
		} else {
			res.writeHead(500, "", {'Content-Type': CyriusUtils.guessContentType(content)});
		}
		res.end(content);

	},
	/**
	 * Sends a not found (status code 404)
	 * @param {Response} res response
	 * @param {String} content Body Content
	 * @param {String} contentType if specified, specifies the contentType. Else tries to guess it
	 */
	notFound: function(res, content, contentType) {
		if (contentType) {
			res.writeHead(404, "", {'Content-Type': contentType});
		} else {
			res.writeHead(404, "", {'Content-Type': CyriusUtils.guessContentType(content)});
		}
		res.end(content);

	},
	/**
	 * Sends a custom response
	 * @param {Response} res response
	 * @param {String} content Body Content
	 * @param {String} statusCode Http status code. If not specified, sends 200
	 * @param {String} contentType if specified, specifies the contentType. Else tries to guess it
	 */
	send: function(content, statusCode, contentType) {
		if (!statusCode) {
			statusCode = "200";
		}
		if (contentType) {
			this.writeHead(statusCode, "", {'Content-Type': contentType});
		} else {
			this.writeHead(statusCode, "", {'Content-Type': CyriusUtils.guessContentType(content)});
		}
		this.end(content);

	}
}


module.exports = Cyrius;

