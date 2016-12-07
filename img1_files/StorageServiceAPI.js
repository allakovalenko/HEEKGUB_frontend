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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*jshint bitwise: false*/

define([
    "jquery",
    "plugin-dependencies",
    "./CCEcoUtils"
    
], function ($, deps, CCEcoUtils) {
    "use strict";

    function getAssetThumbnailUrl(ccPath, size) {
        var env = graphite.getEnvironment();
        size = size || 230;
        ccPath = ccPath.replace(/\/*files\/*/, "");
        // TODO select size in a smarter way so that we can fetch smaller thumbnails for PSD that don't have an extreme height to width ratio
        var url = env.url("/files/" + ccPath + "/:rendition;size=" + size, env.FILESTORAGE_HOST);
        return url;
    }
    
    /* 
     * Storage Service utility to fetch data such as image files from Storage Service
     * @param {string} storagePath CC path to asset to fetch
     * @callback callback         
     */
    var StorageServiceAPI = {
        //}} MANUALMERGE-BEGINS
        _rendition: function (storagePath, size, headers, callback) {
            var self = this,
                pathStr = "",
                oReq = new XMLHttpRequest(),
                parfaitUrl = getAssetThumbnailUrl(storagePath, size);
            
            oReq.open("get", parfaitUrl, true);
            oReq.responseType = "blob";
            oReq.setRequestHeader("Authorization", headers["Authorization"]);
            oReq.setRequestHeader("x-api-key", headers["x-api-key"]);
            oReq.setRequestHeader("Accept", 'image/jpeg, image/jpg, */*;q=0.1');
            oReq.onload = function (oEvent) {
                if (oReq.status === 200) {
                    var blob = oReq.response,
                        reader = new FileReader();

                    reader.addEventListener("loadend", function () {
                        if (callback) {
                            callback(null, [reader.result]);
                        }
                    });
                    reader.readAsDataURL(blob);
                } else {
                    callback(oReq.status, null);
                }
            };

            oReq.send(null);
        },

        rendition: function (storagePath, size, callback) {
            var self = this;

            CCEcoUtils.getAjaxHeaders().done(function (headers) {
                self._rendition(storagePath, size, headers, callback);
            });
        },

        metadata: function (storagePath) {
            return CCEcoUtils.getAjaxHeaders().then(function (headers) {
                var env = graphite.getEnvironment();
                var endpoint = "/" + storagePath + "/:metadata";

                var ajaxPromise = $.ajax({
                    headers: headers,
                    url: env.url(endpoint, env.FILESTORAGE_HOST),
                    dataType: "json"
                });

                ajaxPromise.fail(function (jqXHR, textStatus, errorThrown) {
                    graphite.events.trigger("image-service-error", encodeURI(storagePath), textStatus);
                });

                return ajaxPromise;
            });
        },
        
        upload: function (entry, url, loadHandler, errorHandler, progressHandler) {
            var xhr = new XMLHttpRequest(),
                ajaxOptions = graphite.getServerAPI().createAjaxOptions('PUT', url);

            xhr.open('put', ajaxOptions.url);

            xhr.setRequestHeader('Content-Type', 'application/octet-stream');
            xhr.setRequestHeader('Content-Disposition', 'attachment; filename="' +
                                 encodeURIComponent(entry.asset.get('name')) + '"');
            xhr.setRequestHeader('Authorization', ajaxOptions.headers.Authorization);
            xhr.setRequestHeader('X-api-key', ajaxOptions.headers['X-api-key']);
            
            xhr.onload = function () {
                loadHandler(this);
            };
            xhr.onerror = errorHandler;
            xhr.upload.onprogress = function (progress) {
                progressHandler(progress);
            };

            xhr.send(entry.file);
        },
        //}} MANUALMERGEEND

        storagePath: function (assetID) {
            var deferredData = $.Deferred(),
                options = {
                    'type': 'HEAD',
                    'url': 'https://cc-api-storage-stage.adobe.io/resolve?id=' + assetID,
                    'headers': {
                        'authorization': deps.auth.token,
                        'x-api-key': 'webpagraphics'
                    }
                };

            $.ajax(options).fail(function(jqXHR, textStatus, errorThrown) {
                deferredData.reject(jqXHR);
            }).done(function (resp, textStatus, jqXHR) {
                deferredData.resolve(jqXHR.getResponseHeader('Content-Location'));
            });

            return deferredData.promise();
        },

        storageId: function (assetPath) {
            var deferredData = $.Deferred(),
                options = this.metadataOptions(assetPath);

            $.ajax(options).fail(function(jqXHR, textStatus, errorThrown) {
                deferredData.resolve(['','']);
            }).done(function (resp, textStatus, jqXHR) {
                deferredData.resolve(resp.id.split('/'));
            });

            return deferredData.promise();
        },

        assetDirectory: function (assetID) {
            var deferredData = $.Deferred(),
                self = this;

            this.storagePath(assetID).then(
                function (path) {
                    deferredData.resolve(self.assetDirectoryPath(path));
                },
                function (error) {
                    deferredData.reject(error);
                }
            );
            return deferredData.promise();
        },

        assetDirectoryPath: function (assetPath) {
            var extIndex = assetPath.lastIndexOf('.');

            if (extIndex !== -1) {
                assetPath = assetPath.substr(0, extIndex);
            }

            return assetPath + '-assets';
        },

        fetchContents: function (path) {
            var deferredData = $.Deferred(),
                options = {
                    'type': 'GET',
                    'url': 'https://cc-api-storage-stage.adobe.io' + path,
                    'headers': {
                        'authorization': deps.auth.token,
                        'x-api-key': 'webpagraphics'
                    }
                };
            $.ajax(options).fail(function(jqXHR, textStatus, errorThrown) {
                deferredData.reject(jqXHR);
            }).done(function (resp, textStatus, jqXHR) {
                deferredData.resolve(resp, jqXHR.getResponseHeader('etag'));
            });

            return deferredData.promise();
        },

        storeContents: function (path, etag, data) {
            var deferredData = $.Deferred(),
                options = {
                    'type': 'PUT',
                    'url': 'https://cc-api-storage-stage.adobe.io' + path,
                    'headers': {
                        'authorization': deps.auth.token,
                        'x-api-key': 'webpagraphics',
                        'content-type': '*/*'
                    },
                    'dataType': 'text',
                    'data': data
                };

            if (etag) {
                options.headers['if-match'] = etag;
            }

            $.ajax(options).fail(function(jqXHR, textStatus, errorThrown) {
                deferredData.reject(jqXHR);
            }).done(function (resp, textStatus, jqXHR) {
                deferredData.resolve(jqXHR.getResponseHeader('etag'));
            });

            return deferredData.promise();
        },

        renditionURL: function (path, accept, size) {
            return 'https://cc-api-storage-stage.adobe.io' + path + '/:rendition;size=' + size + '?accept=' + accept + '&api_key=webpagraphics&user_token=' + deps.auth.token.substring(7);
        },

        downloadURL: function (path, name) {

            return 'https://cc-api-storage-stage.adobe.io' + path + '?content_disposition=attachment;filename=' + encodeURIComponent(name) + '&api_key=webpagraphics&user_token=' + deps.auth.token.substring(7);
        },

        metadataOptions: function (path) {
            return {
                'type': 'GET',
                'url': 'https://cc-api-storage-stage.adobe.io' + path + '/:metadata',
                'headers': {
                    'authorization': deps.auth.token,
                    'x-api-key': 'webpagraphics'
                }
            };
        },

        //}} MANUALMERGE-BEGINS
        archive: function (path, successCallback, errorHandler) {
            var deferredData = $.Deferred();
            var that = this;
            
            
            $.ajax(this.metadataOptions(path)).fail(function(jqXHR, textStatus, errorThrown) {
                deferredData.reject(jqXHR);
            }).done(function (resp, textStatus, jqXHR) {
                var cbSuccess = successCallback, cbFail = errorHandler;
                
                var options = {
                    'type': 'PUT',
                    'url': 'https://cc-api-storage-stage.adobe.io/archive/' + encodeURI(path.substring(path.lastIndexOf('/') + 1)) + '?invocation_mode=async',
                    'headers': {
                        'authorization': deps.auth.token,
                        'x-api-key': 'webpagraphics',
                        'link': '<' + path.substring(1) + '>;rel=self',
                        'accept': 'application/vnd.adobe.file+json, application/vnd.adobe.directory+json',
                        'if-match': resp.etag
                    }
                };
                $.ajax(options).fail(function(jqXHR, textStatus, errorThrown) {
                    if(cbFail){
                        deferredData.reject(errorThrown);
                    } else {
                        deferredData.reject(jqXHR);
                    }
                }).done(function (resp, textStatus, jqXHR) {
                    if(cbSuccess){
                       // This is temporary workaround to keep E4B working.
                       // I am mindful of doing this.
                       // would 'that' be the 'that' outside?
                       // will see...
                        deferredData.resolve(that); 
                    } else {
                        deferredData.resolve(jqXHR);
                    }
                });
            });

            return deferredData.promise();

        }
        
    };

    return StorageServiceAPI;
});