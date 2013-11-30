define(["jquery", "./string"], function($, stringUtil) {
	var jerk = {};
		
	jerk._baseClass = function() {
		// this._baseWidgetInit.apply(this, arguments);
	};
	
	jerk._baseClass.__isWidgetized = true;

	jerk._baseClass.prototype = {
		
		_baseWidgetInit: function() {
			
			
			this.__applyConfig__.apply(this, arguments);
			if (this.domNode) {
				this.domNode.data("widget", this);
				this.srcNode = this.domNode;
			}
			for (var i = 0; i < this.__constructorChain.length; i++) {
				this.__constructorChain[i].apply(this, arguments);
			}
			
			if (this.__mustInit) {
				this.__mustInit.apply(this, arguments);
			}

			if (this.init) {
				this.init.apply(this, arguments);
			}
			if (this._postWidgetInit) {
				this._postWidgetInit();
			}
			if (this.parent && this.parent.addChild) {
				this.parent.addChild(this);
			}
			// var self = this;
			//$(window).unload(function() {if  (self.destroy) self.destroy();});
		},
		
		__applyConfig__: function(opts) {

			if (opts) {
				// console.log("opts:", opts, this)
				for (prop in opts) {
					if (prop == "inherited") continue;
					if (prop == "_supers") continue;
					this[prop] = opts[prop];
				}
			}
		} 
		
	};
	
	
	
	/*
		inhert is where some magic happens.
		sets up the inheritance of an object, prepares functions so the 
		'this.inherited(arguments)' call works properly
		sets up the prototype for the object
	*/
	jerk.inherit = function(proto, ext) {
		proto._supers = [];
		if (ext == null) ext = [];
		ext = ext && $.isArray(ext) ? ext : [ext];
		ext.unshift(jerk._baseClass); 
		var target = {};
		var x;
		target.__constructorChain = (target.__constructorChain) ? target.__constructorChain : [];

		while(x = ext.shift()) {
			var e = x.prototype;
			proto._supers.unshift(e);
			target = $.extend(target, e);
			/*
				if we're extending an object that is not created using this library,
				we will try to respect them and call their constructors.
				this. may cause some havoc with some libraries that have their own object system, such as canjs
				extending such objects is not recommended.
				Backbone objects have been extended without issues so far. The Backbone 'initialize' function should
				be called if it exusts on your object.

				__isWidgetized is set to true when you create an prototype with this library.
				no need to put that init in the constuctor chain. would actually create problems as all objects oin this system
				have the same constructor.
			*/
			if (x.__isWidgetized !== true && x.constructor.name !== 'Object') {
				// console.log('adding to __constructorChain:', x);
				target.__constructorChain.push(x)
			}
		}
		/*
			if the member is a function, get it ready for inherited (super) calls
		*/
		for (prop in proto) {
			if (prop != "super" && prop != "_supers" && $.isFunction(proto[prop])) {
				proto[prop]._nomen = prop;
				proto[prop]._supers = proto._supers;
			}
		}
		
		for (prop in target) {
			if (proto[prop] == undefined) {
				if ($.isFunction(target[prop])) {
					/*
						for functions, we need to skip inheritance at this level 
						if the function was not defined on the prototype.
						otherwise calling this.inherited may result in 2 calls to the same function.
						setting a flag on the function that can be read later.
					*/
					if (!proto.hasOwnProperty(prop)) {
						proto[prop] = target[prop];
						proto[prop]._skipInheritance = false;
					} else {
						proto[prop] = target[prop];
						proto[prop]._skipInheritance = true;
					}
				} else {
					proto[prop] = target[prop];
				}
			}
		}
	}
	
	var count = 0;
	var total = 0;
	var query = "[data-object]";
	var not = "[data-object] [data-object]";
	var paramAttr = "data-object-opt-";
	var paramNameAttr= "data-object-opt-name";
	var paramValueAttr= "data-object-opt-value";
	var paramAttrQuery = "> [data-object-opt-name]";
	var contentQuery = "> [data-object-opt-name]";
	
	var passAttr = "data-object-pass";
	var uniqueIdCnt = 0;
	
	var parseDef = function(domNode, onComplete, forceComplete) {
		var val = $(domNode).attr("data-object");
			require([val], function(def) {
				
				requireComplete(val, def, domNode, false, onComplete, null);
				count++;
				if (onComplete && ((count == total) || forceComplete)) {
					onComplete();
				}
			});
	};
	
	var parseChildDef = function(domNode, parent, onComplete, forceComplete) {
		var val = $(domNode).attr("data-object");
			require([val], function(def) {
				requireComplete(val, def, domNode, forceComplete, onComplete, parent);
			});
	};
	
	var parseParams = function(domNode) {
		var attrs = domNode.attributes;

		var opts = {}
		$.each(attrs, function(index, attr) {
			var name = attr.name;
			if (name.indexOf(paramAttr) == 0) {
				var value = attr.value;
				var optName = name.substr(paramAttr.length);
				opts[stringUtil.camelize(optName)] = value;
			}
		});
		var paramNodes = $(paramAttrQuery, domNode);
		$.each(paramNodes, function(index, node) {
			node = $(node);
			var attrName = node.attr(paramNameAttr);
			var val = node.attr(paramValueAttr);
			val = val ? val : node.html();
			opts[attrName] = val;
		});

		opts.content = opts.content ? opts.content : $(domNode).html();
		return opts;
	};
	
	var requireComplete = function(decl, def, domNode, done, onComplete, parent) {
		
		var options = {declared: decl, domNode: $(domNode), parent: parent};
		
		var declaredOptions = parseParams(domNode);
		for (prop in declaredOptions) {
			options[prop] = declaredOptions[prop];
		}

		if (parent) {
			var kvs = stringUtil.parseKeyValue($(domNode), passAttr);
			var pass = $(domNode).attr(passAttr);
			
			if (kvs) {
				$.each(kvs, function(index, kv) {
					var val = parent[kv.value];
					var prop = ($.isFunction(val)) ?
						function() { 
							return val.apply(parent, arguments); 
						} : val;
					options[kv.key] = prop;
				})
			}
		}
		var object = new def(options);
		
		
		
		if (object.preChildParse) {
			if (object.preChildParse()) object.parseChildren();
		} else {
			object.parseChildren();	
		}
		
		
		if (done) {
			if (onComplete) {
				onComplete(object);
			}
			//console.log(domNode);
			//alert(domNode == document.body);
		}	
	};
	
	
	var jerkify = function(node, onComplete, eachCallBack) {
		var start = new Date().getTime();
		var res = node ? $(query, node) : $(query);
		res = node ? res.not($(not, node)) : res.not(not);

		total = res.length;
		// console.log("parsing: ", res);
		if (res.length) {
			$.each(res, function(index, domNode) {
				parseDef(domNode, onComplete, eachCallBack);
			});
		} else {
			onComplete();
		}
		// console.log("jerkification took " + (new Date().getTime() - start) + "ms");
	};
	
	var connectionCount = 0;
	var getUniqueConnectionName = function() {
		return "_Object_Connection_" + connectionCount++;
	};
	var triggerConnectionEvent = function(func, event, data) {
		setTimeout(function() {}, 0);
	};
	//not ready for prime time. do not use this method
	jerk.connect = function(obj, funcName, method, context) {
		if (obj[funcName] && $.isFunction(obj[funcName])) {

			if (obj[funcName].__beenConnected !== true) {
				var oldFunc = obj[funcName];
				var eventName = getUniqueConnectionName();
				//track this event so it can be cleaned on destroy.
				obj.__method_connections__ = obj.__method_connections__ ? obj.__method_connections__ : [];
				obj.__method_connections__.push(eventName);
				var $obj = $(obj);
				var newFunc = function() {
					var res = oldFunc.apply(obj, arguments);
					var args = {connectionArguments: arguments};
					setTimeout(function() {$obj.trigger(eventName, args)}, 0);
					return res;
				};
				newFunc.__connectionEventName = eventName;
				newFunc.__beenConnected = true;
				obj[funcName] = newFunc;
			}

			var connecToMethod = $.isFunction(method) ? method : null;
			var connectToContext = context ? context : window;
			connecToMethod = connecToMethod ? connecToMethod : connectToContext[method];


			$(obj).on(obj[funcName].__connectionEventName, function(evt, extra) {
				connecToMethod.apply(context, extra.connectionArguments)
			});
		}
		
	},
	
	jerk.declare = function(extensions, body) {
		if (extensions && (body == null || body == undefined)) {
			body = extensions;
			extensions = [];
		}
		
		if (!$.isArray(extensions)) {
			extensions = [extensions];
		}
		var myWidget = function() {
			this._baseWidgetInit.apply(this, arguments);
		};
		myWidget.__isWidgetized = true;

		myWidget.prototype = body;
				
		var overrideableFunctions = function() {};
		overrideableFunctions.prototype = {
			_clearArray: function(a) {
				while (a && a.length) {
	            	a.pop();
	            }
			},
			genUniqueId: function() {
				return this.declared.split("/").join("_") + "_" + uniqueIdCnt++;
			},

			parseChildren: function() {
				
				var self = this;
				var children = $(query, this.domNode).not($(not, this.domNode));
				this.children = [];
				$.each(children, function(index, node) {
					parseChildDef(node, self, function(object) {
						if (self.childDefined) {
							self.childDefined(object);
						}
					}, true);
				});
			},
			trigger: function() {
				var context = $(this);
				context.trigger.apply(context, arguments);
			},

			destroy: function() {
				if (this.__method_connections__) {
					for (var i = this.__method_connections__.length - 1; i >= 0; i--) {
						$(this).off(this.__method_connections__[i])
					};
				}
				for (var i = 0; this.children && i < this.children.length; i++) {
					var child = this.children[i]
					if ($.isFunction(child.destroy())) {
						child.destroy();
					}
				};
				this._clearArray(this.children);
				
	            if (this.domNode) {
	            	this.domNode.data("widget", null);
	            	this.domNode.replaceWith("");
	            	this.domNode = null;
	            }
			}
		}
		extensions.unshift(overrideableFunctions);
		jerk.inherit(myWidget.prototype, extensions);
		myWidget.prototype.inherited = function(args) {
			var caller = args.callee;
			/*
				we have to attach the supers to the function itself
				to avoid a potential infinite loop.
			*/
			caller._supers = caller._supers ? caller._supers : this._supers;
			var name = caller._nomen;
			if(!name){
				return;
			}
			var self = this;
			for (var i = 0; i < caller._supers.length; i++) {
				var fn = caller._supers[i][name]; 
				if (fn && $.isFunction(fn) && !fn._skipInheritance) {
					return fn.apply(this, args);
				}
			}
			return null;
		}

		myWidget.extend = function (mixins, body) {
			var ext = [myWidget];
			if (mixins && (body == null || body == undefined)) {
				body = mixins;
				mixins = [];
			}
			ext.push.apply(ext, mixins);
			return jerk.declare(ext, body);
		}
		myWidget.connect = jerk.connect;
		return myWidget;
		
	};
	jerk.declare.parse = jerkify;
	return jerk.declare;	
	
});