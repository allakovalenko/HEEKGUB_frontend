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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */
/*global define, graphite, FileReader, escape */

define([
    "jquery",
    "underscore"
], function ($, _/*, environment ,VanillaExtract*/) {
    "use strict";
    
    var acceptHeader;
    
    function beforeSend(xhr, headers) {
        var myAccessToken = graphite.getAuthController().getAuthModel().attributes.access_token;
        xhr.setRequestHeader('Authorization', "Bearer " + myAccessToken);
        xhr.setRequestHeader('x-api-key', graphite.getEnvironment().API_KEY);
        
        if (acceptHeader) {
            xhr.setRequestHeader('Accept', acceptHeader);
        }
    }
    
    function setFetchCallbacks(fetchOptions, successCallback, errorCallback, context) {
        if (successCallback) {
            fetchOptions.success = function (model, response) {
                successCallback.apply(context, [response]);
            };
        }

        if (errorCallback) {
            fetchOptions.error = function (model, response) {
                errorCallback.apply(context, [response]);
            };
        }
        
        fetchOptions.beforeSend = beforeSend;

        return fetchOptions;
    }

    function setAJAXCallbacks(options, successCallback, errorCallback, context) {
        if (successCallback) {
            options.success = function (data, textStatus, response) {
                successCallback.apply(context, [response]);
            };
        }

        if (errorCallback) {
            options.error = function (response) {
                errorCallback.apply(context, [response]);
            };
        }
    }
    
    function _isApiEndpoint(url) {
        return url.match(/https:\/\/cc-api/);
    }
    
    function _isStorageRequest(url) {
        return url.match(/files|archive/);
    }
    
    function constructProxyURL(url, args) {
        if (_isApiEndpoint(url)) {
            return graphite.getEnvironment().url(url + (args ? '?' + args : ''));
        }
        
        if (_isStorageRequest(url)) {
            return graphite.getEnvironment().url(url + (args ? '?' + args : ''), graphite.getEnvironment().FILESTORAGE_HOST);
        }
            
        return url + (args ? '?' + args : '');
    }
        
    function _customFilter(object, key, spriteSheet, flattenedSprite) {
        if (object.hasOwnProperty('layerId') && object.layerId === key) {
            object.spriteSheet = spriteSheet;
            object.flattenedSprite = flattenedSprite;
            return;
        }

        var i;
        for (i = 0; i < Object.keys(object).length; i++) {
            if (typeof object[Object.keys(object)[i]] === "object") {
                _customFilter(object[Object.keys(object)[i]], key, spriteSheet, flattenedSprite);
            }
        }
        return;
    }

    function _mergeIntroAndLayerSpriteSheets(introspectData, spriteData) {
        _.each(spriteData.layers, function (layer) {
            _customFilter(introspectData, layer.layerId, layer.spriteSheet, layer.flattenedSprite);
        });
        
        return introspectData;
    }

    function _parseModel(introspectData, spritesheetResult, model) {
        var spritesheetData = spritesheetResult.spritesheetJSON,
            spritesheets = spritesheetResult.spritesheets,
            mergeData = _mergeIntroAndLayerSpriteSheets(introspectData, spritesheetData);

        if (spritesheetData.pngLocations) {
            model.set("pngLocations", spritesheetData.pngLocations);
        }

        _.each(spritesheets, function (sheet) {
            model.set(sheet.id, sheet.dataUrl);
        });

        model.parse(mergeData);
        
        return model;
    }

    var serverAPI = {
        
        createAjaxOptions: function (type, location) {
            var authorization = "Bearer " + graphite.getAuthController().getAuthModel().attributes.access_token,
                options = {
                    'type': type,
                    'url': constructProxyURL(location),
                    'headers': {
                        'Authorization': authorization,
                        'Accept': '*/*',
                        'X-api-key': graphite.getEnvironment().API_KEY
                    }
                };

            return options;
        },
        
        // APIs used by AssetController
        // Load an AssetCollection object, shouldn't need this for ccweb but added the API for AssetController
        loadAssetCollection: function (assetCollection, successCallback, errorCallback, context, inPath, xChildrenNextStart) {
            var ccfilesRoot = "/files",
                path = inPath ?  ccfilesRoot + "/" + inPath : ccfilesRoot,
                fetchOptions;

            acceptHeader = "application/vnd.adobe.directory+json";
            path = encodeURI(path);
            fetchOptions = {
                url: graphite.getEnvironment().url(path, graphite.getEnvironment().FILESTORAGE_HOST)
            };
            
            setFetchCallbacks(fetchOptions, successCallback, errorCallback, context);
                        
            if (xChildrenNextStart) {
                fetchOptions.url = fetchOptions.url + '?start=' + xChildrenNextStart;
                fetchOptions.remove = false; //Append the newly fetch data to collection
            }
            
            var jqXHR = assetCollection.fetch(fetchOptions);
            jqXHR.done(function () {
                var xChildrenNextStart = jqXHR.getResponseHeader('X-Children-Next-Start');
                if (xChildrenNextStart) {
                    var incrementalFetchObj = {};
                    incrementalFetchObj.path = inPath;
                    incrementalFetchObj.xChildrenNextStart = xChildrenNextStart;
                    window.graphite.events.trigger('loadMoreAssets', incrementalFetchObj);
                }
            });
        },

        loadAssetMetadata: function (storagePath) {
            return graphite.getStorageServiceAPI().metadata(storagePath);
        },

        loadPsdModelFromPath: function (psdModel, successCallback, errorCallback, context) {
            var introspectPromise = graphite.getImageServiceAPI().introspect(psdModel),
                spritesheetPromise = graphite.getImageServiceAPI().spritesheet(psdModel);
            
            $.when(introspectPromise, spritesheetPromise).then(function (introspectData, spritesheetResult) {
                psdModel = _parseModel(introspectData, spritesheetResult, psdModel);
                successCallback.apply(context);
            }, function (err) {
                graphite.events.trigger("image-service-error", encodeURI(psdModel.get("path")), false);
                errorCallback.apply(context);
            });
        },
        
        getAssetFromUrl: function (url, callback) {
            var options = {
                url: url
            };

            var oReq = new XMLHttpRequest(),
                accessToken = graphite.getAuthController().getAuthModel().attributes.access_token;
            
            oReq.open("get", options.url, true);
            oReq.responseType = "blob";
            oReq.setRequestHeader("Authorization", "Bearer " + accessToken);
            oReq.setRequestHeader("x-api-key", graphite.getEnvironment().API_KEY);
            oReq.setRequestHeader("Accept", 'image/png, image/jpeg, image/jpg, application/pdf, text/html, text/plain, */*;q=0.1');
            
            // enable clients integrating this module to provide an array of custom headers
            if (this.customHeader) {
                _.each(this.customHeader, function (value, key) {
                    oReq.setRequestHeader(key, value);
                });
            }
            
            oReq.onload = function (oEvent) {
                if (oReq.status === 200) {
                    var blob = oReq.response,
                        reader = new FileReader();

                    reader.addEventListener("loadend", function () {
                        if (callback) {
                            callback.apply(null, [reader.result]);
                        }
                    });
                    reader.readAsDataURL(blob);
                }
            };
            oReq.onerror = function (data) {
                // TBI
            };
            oReq.send(null);
        },

        // Load a local PSDModel object, only used for 1st launch content
        loadLocalPsdModel: function (psdModel, inUrl, successCallback, errorCallback, context) {
            var fetchOptions = {
                    url: inUrl
                },
                self = this;

            setFetchCallbacks(fetchOptions, successCallback, errorCallback, context);
            psdModel.fetch(fetchOptions);

        },

        /**
         *
         * @param {PSDModel} psdModel
         * @param {Array.<LayerModel>} layerModels
         * @param {{layerCompID: string, scale: number, svgEncodingType: string, svgEncodingQuality: number, scaleX: number, scaleY: number}} options
         */
        getDerivedAsset: function (psdModel, layerModels, imageFormat, options) {
            return graphite.getImageServiceAPI().createWebAsset(psdModel, layerModels, imageFormat, options);
        },

        // Archive an asset from the users collection
        deleteAsset: function (ccPath, successCallback, errorCallback) {
            graphite.getStorageServiceAPI().archive(ccPath, successCallback, errorCallback);
        },

        // APIs used by DerivedAssetController
        // PSD Lens currently has no use case for this , hence I'm leaving it as it may be required by other clients.
        loadDerivedAssetCollection: function (derivedAssetCollection, psdModel,
                                               successCallback, errorCallback, context) {
            var post_data,
                fetchOptions = {
                    url: graphite.getEnvironment().url("/createwebasset", graphite.getEnvironment().IMAGE_SERVICE_HOST),
                    reset: true,
                    post_data: post_data
                };
            setFetchCallbacks(fetchOptions, successCallback, errorCallback, context);
            derivedAssetCollection.fetch(fetchOptions);
        },
        
        // TODO fix this call
        // PSD Lens currently has no use case for this , hence I'm leaving it as it may be required by other clients.        
        createDerivedAsset: function (jsonPostObject, successCallback, errorCallback, context) {
            var jsonPostData = JSON.stringify(jsonPostObject),
                options = {
                    type: 'POST',
                    url: graphite.getEnvironment().url('/api/v1/psd/' + jsonPostObject.psdGuid + '/derived?nocache=' + $.now()),
                    // The key needs to match your method's input parameter (case-sensitive).
                    data: jsonPostData,
                    dataType: "json"
                };

            setAJAXCallbacks(options, successCallback, errorCallback, context);
            $.ajax(options);
        },

        getWorkerStatus: function (workerGuid, successCallback, errorCallback, context) {
            var options = {
                url: graphite.getEnvironment().url('/api/v1/worker/' + workerGuid)
            };

            setAJAXCallbacks(options, successCallback, errorCallback, context);
            $.ajax(options);
        },

        getSpriteSheetURL: function (path) {
            var location = graphite.getEnvironment().url(path, graphite.getEnvironment().FILESTORAGE_HOST);
            return location;
        },

        // ___________ metrics_________
        // called from MetricsProxyModel

        registerPersistentParameters: function (params) {
            // Vanilla-Extract shouldn't depend on mixpanel.
            // mixpanel.register(params);
        },
        // ________end metrics_________

        // APIs used by AssetView - probably don't need for ccweb
        getAssetInfo: function (assetId, successCallback, errorCallback, context) {
            var options = this.createAjaxOptions('GET', '/api/v1/psd/' + assetId + '/info');

            setAJAXCallbacks(options, successCallback, errorCallback, context);
            $.ajax(options);
        },

        // API used by InspectStyleOverlayView
        getLayerURL: function (psdGuid, layerId) {
            return graphite.getEnvironment().url('/api/v1/psd/' + psdGuid + '/layer/' + layerId);
        },

        // Effectively replaces getDefaultRenditionURL but returns image as
        // dataURI
        getRendition: function (storagePathOrModel, size, callback) {
            var isPathString = typeof storagePathOrModel === "string",
                path = isPathString ? storagePathOrModel : (storagePathOrModel.get && storagePathOrModel.get("path")),
                isAuthless = (storagePathOrModel.get && storagePathOrModel.get("authless")) || false,
                layerCompId = (storagePathOrModel.get && storagePathOrModel.get("layerCompId"));

            // StorageServiceAPI can only show authorized renditions that don't use layer comps
            if (isAuthless || layerCompId) {
                graphite.getImageServiceAPI().createWebAsset(storagePathOrModel, null, "jpeg", { q: 0.25 }).done(function (dataURI) {
                    callback.call(null, null, dataURI);
                }).fail(function (err) {
                    callback.call(null, err, null);
                });
            } else if (path) {
                graphite.getStorageServiceAPI().rendition(path, size, callback);
            } else {
                callback(null, "Invalid parameter in getRendition: " + storagePathOrModel);
            }
        },

        getDefaultRenditionURL: function (psdGuid) {
            return graphite.getEnvironment().url('/api/v1/psd/' + psdGuid);
        },

        // APIs used by ViewTemplates.html
        getDerivedRenditionURL: function (assetID) {
            return graphite.getEnvironment().url('/api/v1/asset/' + assetID + '/thumbnail');
        },

        getDerivedDownloadURL: function (assetID, name) {
            return graphite.getEnvironment().url('/api/v1/asset/' + assetID + '/download');
        },

        deleteDerivedAsset: function (derivedAssetId, successCallback, errorCallback, context) {
            var options = {
                url: graphite.getEnvironment().url('/api/v1/psd/' + derivedAssetId + '/derived/delete'),
                type: 'DELETE'
            };
            setAJAXCallbacks(options, successCallback, errorCallback, context);

            $.ajax(options);
        },

        getDerivedSpriteImage: function (psdModel, layers, successCallback, errorCallback, context) {
            var image = new Image(),
                options;

            image.onload = function () {
                successCallback.apply(context);
            };
            
            image.onerror = function (result) {
                errorCallback.apply(context, [result]);
            };
            
            // Bypass LayerModels array param. `layers` input arg is passed as
            // raw layer IDs.
            options = {
                layerIds: layers
            };
            
            graphite.getImageServiceAPI().createWebAsset(psdModel, null, "png32", options).done(function (result) {
                image.src = result;
            }).fail(function () {
                errorCallback.apply(context);
            });

            return image;
        },
        
        upload: function (entry, url, loadHandler, errorHandler, progressHandler) {
            graphite.getStorageServiceAPI().upload(entry, url, loadHandler, errorHandler, progressHandler);
        },

        loadCrossDomainImage: function (image, src) {
            image.src = src;
        },
        
        applyCrossDomainPolicy: function (image) {
            // NOOP
        }
    };

    return serverAPI;

});
