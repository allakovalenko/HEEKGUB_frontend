/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true  */
/*global define, graphite, window, XMLHttpRequest */

define([
    "jquery",
    "underscore",
    "../external/jquery.mxhr",
    "./CCEcoUtils",
    "../controllers/AuthController",
    "../Constants"
], function ($, _, mpAjax, CCEcoUtils, AuthController, Constants) {
    "use strict";
    
    var INTROSPECT_RESOURCE = "/introspect",
        SPRITESHEET_RESOURCE = "/spritesheet",
        CREATE_WEBASSET_RESOURCE = "/createwebasset",
        IMAGE_OPERATION_CONTENT_TYPE = "application/vnd.adobe.image-operation+json",
        BASE64_PREFIX = "data:image/png;base64,",
        AUTHLESS_API_PREFIX = "/public/extract";
    
    var _authlessRenditionCache = {};
    
    function _packStringFromUint8Array(arraybuffer) {
        var str = '',
            i = 0;
        for (i = 0; i < arraybuffer.byteLength; i++) {
            str += String.fromCharCode(arraybuffer[i]);
        }
        return str;
    }
        
    function _unit8ArrayBufferToBase64(arrayBuffer) {
        var str = _packStringFromUint8Array(arrayBuffer);
        return window.btoa(str);
    }
        
    function _toDataUrl(data) {
        return BASE64_PREFIX + _unit8ArrayBufferToBase64(data);
    }

    function _initRequestParams(psdModel, headers, postData, hasOutputs) {
        var ccPath = psdModel.get("path"),
            isAuthless = psdModel.get("authless");

        // initialize post data structure
        postData.inputs = {};
        postData.inputs.image = {};

        headers["Content-Type"] = IMAGE_OPERATION_CONTENT_TYPE;

        if (isAuthless) {
            headers["x-creativeurl-share"] = psdModel.get("id");
            postData.inputs.image.href = ccPath;
        } else {
            postData.inputs.image.href = "/" + encodeURIComponent(ccPath);
        }

        if (hasOutputs) {
            postData.outputs = {};
        }
    }
    
    function _handleIntrospectJson(jsonData, layerCompId, ccPath) {
        /* Result corresponding to content type 'application/json' in our multipart response. */
        var data = _packStringFromUint8Array(jsonData);
        data = JSON.parse(data);

        if (data.imgdata) {
            data.imgdata.originalFile = ccPath.split('/').pop();
            data.imgdata.psdPath = ccPath;
            if (layerCompId) {
                data.imgdata.appliedLayerCompId = parseInt(layerCompId, 10);
            }
        }
        return data;
    }
    
        
    function _handleSpritesheetJson(jsonData) {
        var data = _packStringFromUint8Array(jsonData),
            sheetJSON = JSON.parse(data),
            pngLocations  = [];

        /* Result corresponding to content type contentType in our multipart response. */
        var i = 1;
        while (sheetJSON.outputs && sheetJSON.outputs.hasOwnProperty("sheet" + i) && sheetJSON.outputs["sheet" + i].location) {
            pngLocations.push(sheetJSON.outputs["sheet" + i].location);
            i++;
        }

        return {pngLocations: pngLocations, sheetJSON: sheetJSON};
    }
    
        
    function _findKey(obj, cid) {
        return _.find(_.keys(obj), function (k) {
            if (obj[k].href === cid) {
                return k;
            }
        });
    }
        
    function _handleSpritesheetImage(data, contentId, outputs, psdModel) {
        var cid = 'cid:' + contentId.substring(1, contentId.length - 1),
            sheetID = _findKey(outputs, cid);

        var id = psdModel.get("id"),
            image = BASE64_PREFIX + _unit8ArrayBufferToBase64(data);

        return {
            image: image,
            sheetID: sheetID
        };
    }
    
    /* Image Service utility to fetch Introspect and SpriteSheet Data. */
    var ImageServiceAPI = {
        
        /**
         * Image Service utility to fetch Introspect data.
         * @param {PSDModel} psdModel
         * @param {Object} headers Includes required AJAX headers (API key and Bearer token for authorized calls)
         * @return {$.Promise}
         */
        _introspect: function (psdModel, headers) {
            var deferred = new $.Deferred(),
                isAuthless = psdModel.get("authless"),
                layerCompId = psdModel.get("layerCompId") && psdModel.get("layerCompId").toString(),
                postData = {},
                url;

            _initRequestParams(psdModel, headers, postData, !isAuthless);

            postData.options = { rendtion: true };
            if (layerCompId) {
                postData.options.layerCompId = layerCompId;
            }

            if (isAuthless) {
                url = graphite.getEnvironment().COLLAB_IMAGE_SERVICE_HOST +  AUTHLESS_API_PREFIX + INTROSPECT_RESOURCE;
            } else {
                url = graphite.getEnvironment().url(INTROSPECT_RESOURCE, graphite.getEnvironment().IMAGE_SERVICE_HOST);

                postData.outputs.output = {
                    accept: IMAGE_OPERATION_CONTENT_TYPE
                };
            }

            var ajaxOptions = {
                headers: headers,
                url: url,
                type: 'POST',
                data: JSON.stringify(postData),
                port: graphite.getEnvironment().IMAGE_SERVICE_PORT,
                'application/vnd.adobe.image-operation+json': function (contentId) {
                    /* Result corresponding to content type contentType in our multipart response. */
                    // need to consume this part other wise the applicatpn/json handler will consume it and fail.
                },

                'application/json': function (contentId) {
                    // need to pass this, as it holds the data to be parsed. That's just the way our multipart parser works
                    var data = _handleIntrospectJson(this, layerCompId, psdModel.get("path"));
                    
                    deferred.resolve(data);
                },

                'onError': function () {
                    deferred.reject(this);
                }
            };
            
            // enable clients integrating this module to provide an array of custom headers
            if (!isAuthless && this.introspectCustomHeader) {
                _.each(this.introspectCustomHeader, function (value, key) {
                    // Headers should not contain any non-ASCII chars.
                    // Base64_encoding_and_decoding is a pain: 
                    // https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22
                    ajaxOptions.headers[key] = unescape(encodeURIComponent(value));
                });
            }

            /* Make AJAX request and parse the multipart response */
            $.multipart(ajaxOptions);

            return deferred.promise();
            
        },

        /**
         * Image Service utility to fetch Introspect data.
         * @param {PSDModel} psdModel
         * @return {$.Promise}
         */
        introspect: function (psdModel) {
            var self = this,
                accessTokenPromise = CCEcoUtils.getAjaxHeaders(psdModel.get("authless"));

            return accessTokenPromise.then(function (headers) {
                return self._introspect(psdModel, headers);
            });
        },

        /**
         * Image Service utility to fetch sprite sheet data.
         * @param {PSDModel} psdModel
         * @param {Object} headers Includes required AJAX headers (API key and Bearer token for authorized calls)
         * @return {$.Promise}         
         */
        _spritesheet: function (psdModel, headers) {
            var deferred = new $.Deferred(),
                isAuthless = psdModel.get("authless"),
                layerCompId = psdModel.get("layerCompId") && psdModel.get("layerCompId").toString(),
                sheetJSON,
                outputs,
                pngLocations = [],
                postData = {},
                url,
                spritesheetJSON = '',
                spritesheets = [];

            _initRequestParams(psdModel, headers, postData, true);

            postData.options = {
                includeDrawable: false,
                minSheets: 6,
                clipLayers: true,
                flattenLayers: true,
                layerCompId: layerCompId,
                rendition: true
            };

            postData.outputs.spriteInfo = {
                accept: IMAGE_OPERATION_CONTENT_TYPE
            };
            postData.outputs.sheets = {
                // Only use disposition for authorized requests
                accept: "image/png"
            };

            if (isAuthless) {
                url = graphite.getEnvironment().url(AUTHLESS_API_PREFIX + SPRITESHEET_RESOURCE, graphite.getEnvironment().COLLAB_IMAGE_SERVICE_HOST);
            } else {
                url = graphite.getEnvironment().url(SPRITESHEET_RESOURCE, graphite.getEnvironment().IMAGE_SERVICE_HOST);
            }

            var ajaxOptions = {
                headers: headers,
                url: url,
                type: 'POST',
                data: JSON.stringify(postData),
                port: graphite.getEnvironment().IMAGE_SERVICE_PORT,
                'application/vnd.adobe.image-operation+json': function (contentId) {
                    var parsedData = _handleSpritesheetJson(this);
                    
                    pngLocations = parsedData.pngLocations ? _.union(pngLocations, parsedData.pngLocations) : undefined;
                    sheetJSON = parsedData.sheetJSON;
                    if (sheetJSON.outputs) {
                        outputs = sheetJSON.outputs;
                    }
                    
                    if (sheetJSON.imgdata) {
                        sheetJSON.imgdata.originalFile = psdModel.get("path").split('/').pop();
                    }
                    
                    if (pngLocations) {
                        sheetJSON.pngLocations = pngLocations;
                        spritesheetJSON = sheetJSON;
                    }
                },
                               
                'application/json': function (contentId) {
                    var data = _packStringFromUint8Array(this);
                    /* Result corresponding to content type 'application/json' in our multipart response. */
                    spritesheetJSON = JSON.parse(data);                  
                },
                               
                'image/png': function (contentId) {
                    var imageData = _handleSpritesheetImage(this, contentId, outputs, psdModel);

                    spritesheets.push({id: imageData.sheetID, dataUrl: imageData.image});
                },
                               
                'onSuccess': function () {
                    deferred.resolve({"spritesheetJSON": spritesheetJSON, "spritesheets": spritesheets});
                },
                'onError': function () {
                    deferred.reject(this);
                }
            };
            
            // enable clients integrating this module to provide an array of custom headers            
            if (!isAuthless && this.spritesheetCustomHeader) {
                _.each(this.spritesheetCustomHeader, function (value, key) {
                    // Headers should not contain any non-ASCII chars.
                    // unescape to make sure the nodejs proxy writes to a path that is consistant with 
                    // paths from used for StorageService
                    ajaxOptions.headers[key] = unescape(encodeURIComponent(value));
                });
            }

            /* Make AJAX request and parse the multipart response */
            $.multipart(ajaxOptions);

            return deferred.promise();
        },

        /**
         * Image Service utility to fetch sprite sheet data.
         * @param {PSDModel} psdModel
         * @return {$.Promise}         
         */
        spritesheet: function (psdModel) {
            var self = this,
                accessTokenPromise = CCEcoUtils.getAjaxHeaders(psdModel.get("authless"));

            return accessTokenPromise.then(function (headers) {
                return self._spritesheet(psdModel, headers);
            });
        },
        
        /**
         * Image Service utility to request derived assets from a PSD
         * @param {PSDModel} psdModel
         * @param {Array.<LayerModel>} layerModels
         * @param {string} imageFormat Valid file formats: svg, jpeg/jpg, png-32/png32
         * @param {Object} options Options for createwebasset endpoint
         * @param {Object} headers Includes required AJAX headers (API key and Bearer token for authorized calls)
         * @return {$.Promise}
         */
        _createWebAsset: function (psdModel, layerModels, imageFormat, options, headers) {
            var deferred = new $.Deferred(),
                url,
                layerIds = [],
                layerCompId = psdModel.get("layerCompId") && psdModel.get("layerCompId").toString(),
                ccPath = psdModel.get("path"),
                isAuthless = psdModel.get("authless"),
                iImageQuality,
                postData = {},
                accept,
                useCache = isAuthless && !layerModels,
                cachedRendition = useCache && _authlessRenditionCache[ccPath];
            
            // Use cached rendition for authless requests only
            if (cachedRendition) {
                // Self-destruct cache for this PSD on first use
                delete _authlessRenditionCache[ccPath];
                
                deferred.resolve(cachedRendition);
                return deferred.promise();
            }

            _initRequestParams(psdModel, headers, postData, true);

            options = options || {};

            // TODO White-list options
            // https://wiki.corp.adobe.com/display/coretech/Image+Service+Requests#ImageServiceRequests-CreateWebAsset
            iImageQuality = (typeof options.q === "number") ? options.q : 1.0;
            options.q = undefined;

            // Set layerIds
            if (layerModels) {
                _.each(layerModels, function (layerModel) {
                    layerIds.push(layerModel.get("layerId"));
                });
                options.layerIds = layerIds;
            }
            
            if (layerCompId) {
                options.layerCompId = layerCompId;
            }

            postData.options = options;

            // Set image output
            if (imageFormat === "svg") {
                accept = 'image/svg+xml';
            } else if (imageFormat === "jpeg" || imageFormat === "jpg") {
                accept = 'image/jpeg; q=' + iImageQuality;
            } else if (imageFormat === "png-32" || imageFormat === "png32" || !imageFormat) {
                accept = 'image/png'; //Special case: png-32 doesn't require x-format parameter.
            } else {
                accept = 'image/png; x-format=' + imageFormat;
            }

            postData.outputs.output = {
                accept: accept
            };

            if (isAuthless) {
                url = graphite.getEnvironment().url(AUTHLESS_API_PREFIX + CREATE_WEBASSET_RESOURCE, graphite.getEnvironment().COLLAB_IMAGE_SERVICE_HOST);
            } else {
                url = graphite.getEnvironment().url(CREATE_WEBASSET_RESOURCE, graphite.getEnvironment().IMAGE_SERVICE_HOST);
            }

            var successCallback = function () {
                var data = _toDataUrl(this);
                
                // Cache authless renditions for one-time use in PSDPreviewView
                if (useCache) {
                    _authlessRenditionCache[ccPath] = data;
                }
                
                deferred.resolve(data);
            };

            var ajaxOptions = {
                headers: headers,
                url: url,
                type: 'POST',
                data: JSON.stringify(postData),
                port: graphite.getEnvironment().IMAGE_SERVICE_PORT,
                onError: function () {
                    deferred.reject(this);
                },
                'application/vnd.adobe.image-operation+json': function (contentId) {
                    //dummy function required to consume the json data and prevent it from bleeding into other parts                      
                },
                'application/json': function () {
                    //dummy function required to consume the json data and prevent it from bleeding into other parts
                },
                'image/png': successCallback,
                'image/jpeg': successCallback,
                'image/svg+xml': successCallback
            };
            
            $.multipart(ajaxOptions);

            return deferred.promise();
        },

        /**
         * Image Service utility to request derived assets from a PSD
         * @param {PSDModel} psdModel
         * @param {Array.<LayerModel>} layerModels
         * @param {string} imageFormat Valid file formats: svg, jpeg/jpg, png-32/png32
         * @param {Object} options Options for createwebasset endpoint
         * @return {$.Promise}
         */

        createWebAsset: function (psdModel, layerModels, imageFormat, options) {
            var self = this,
                accessTokenPromise = CCEcoUtils.getAjaxHeaders(psdModel.get("authless"));

            return accessTokenPromise.then(function (headers) {
                return self._createWebAsset(psdModel, layerModels, imageFormat, options, headers);
            });
        }
    };

    return ImageServiceAPI;
});