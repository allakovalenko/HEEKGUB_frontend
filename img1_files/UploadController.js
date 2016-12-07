/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
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
/*global define: true, XMLHttpRequest: true, FormData: true, console: true, graphite: true, window: true, setTimeout: true, Backbone */

var max_concurrent_uploads = 2;

define([
    'jquery',
    '../models/AssetModel',
    'plugin-dependencies' /*,
    '../config/environment'*/
], function ($, AssetModel, deps/*, environment*/) {
    'use strict';

    // serverAPI
    var UploadController = {

        uploadQueue : [],   // Queue of files to upload
        uploadList : [],    // list of files being uploaded
        fakeArray: [],      // list of files that have been uploaded but the response has not been returned

        upload : function (file, fileNameToLoad) {
            var item = new AssetModel();
            
            fileNameToLoad = fileNameToLoad || file.name;
            
            item.set("fileToLoad", file);
            item.set("name", fileNameToLoad);
            
            var currentCCPath = Backbone.history.fragment || "files";
            item.set('ccPath', currentCCPath);
            
            this.uploadQueue.push({'file': file, 'asset': item});
            this.processQueue();
            return item;
        },

        restoreUploads : function (assetCollection) {

            this.uploadList.forEach(function (entry) {
                assetCollection.add(entry.asset);
            });

            this.uploadQueue.forEach(function (entry) {
                assetCollection.add(entry.asset);
            });
        },

        hasActiveUploads : function () {
            // if we are actively uploading either we have something in the queue or uploading
            return (this.uploadQueue.length > 0 || this.uploadList.length > 0);
        },

        buildQueryString: function () {
            var queryString = '',
                joiner = '?';

            if (graphite.getEnvironment().hasOwnProperty('ssCount')) {
                queryString = queryString + joiner + 'sheetCount=' + graphite.getEnvironment().ssCount;
                joiner = '&';
            }

            if (graphite.getEnvironment().hasOwnProperty('ssFormat')) {
                queryString = queryString + joiner + 'format=' + graphite.getEnvironment().ssFormat;
                joiner = '&';
            }

            if (graphite.getEnvironment().hasOwnProperty('ssScale')) {
                queryString = queryString + joiner + 'scale=' + graphite.getEnvironment().ssScale;
                joiner = '&';
            }

            return queryString;
        },

        processQueue : function () {
            // Limit the number of file POST to no more than 5 concurrent requests.  This way
            // we have less of a chance of hitting the browsers active connection limit
            var that = this,
                entry,
                url = decodeURI(Backbone.history.fragment),
                pathSeparator = '/';
            
            function loadHandler(response) {
                //set the upload-finished property on the model class
                entry.asset.set('uploadFinished', Date.now());


                that.uploadList.splice(that.uploadList.indexOf(entry), 1);

                if (response.status === 200 || response.status === 201) {
                    //start processing since we have a valid workerID
                    var prog = {'status' : deps.translate("UPLOADING"),
                        'percentage' : 100
                        };

                    entry.asset.set("uploadProgress", prog);

                    entry.asset.set("processStarted", Date.now());

                    var res = JSON.parse(response.responseText),
                        uploadDuration = entry.asset.get("uploadFinished") - entry.asset.get("uploadStarted"),
                        params = {};

                    prog = {'status' : deps.translate("PROCESSING"),
                                'nextStep' : deps.translate("Almost ready"),
                                'assetID' : res.assetID,
                                'workerID' : res.workerID};

                    entry.asset.set("uploadProgress", prog);

                    //set the assetId (guid) on the model class
                    entry.asset.set('assetId', res.assetID);

                    //trigger uploaded event for metrics
                    params.fileSize = entry.asset.get('fileSize');
                    params.uploadDuration = uploadDuration;
                    params.path = url;
                    params.fileName = entry.asset.get('name');
                    //uploaded complete event
                    graphite.events.trigger('uploaded', params);

                } else if (response.status === 401) {
                    graphite.events.trigger('reauthenticate');
                } else if (response.status === 409) {
                    /* File Conflict error! Uploaded file is already present in user's CC location.  */
                    that.failedToUpload(entry.asset, entry.file, 'duplicateFileUploadError');
                } else {
                    that.failedToUpload(entry.asset, entry.file, 'validFileUploadError');
                }
                that.processQueue();
            }
            
            function errorHandler() {
                that.uploadCount = that.uploadCount - 1;
                that.uploadList.splice(that.uploadList.indexOf(entry), 1);
                that.failedToUpload(entry.asset, entry.file, 'validFileUploadError');
                that.processQueue();
            }
            
            function progressHandler(progress) {
                //set the percentage on upload step.
                var perc,
                    prog;
                
                if (progress.lengthComputable) {
                    //firefox                    
                    perc = Math.floor((progress.loaded / progress.total) * 90);
                } else if (progress.hasOwnProperty('position')) {
                    //chrome
                    perc = Math.floor((progress.position / progress.totalSize) * 90);
                }
                prog = {'status' : deps.translate("UPLOADING"),
                        'percentage' : perc
                       };

                entry.asset.set("uploadProgress", prog);
            }

            if (that.uploadList.length < max_concurrent_uploads && that.uploadQueue.length > 0) {
                entry = that.uploadQueue.shift();
                if (url === '') {
                    url = '/files/' + url;
                }

                url = pathSeparator + url + pathSeparator + entry.asset.get('name');
                url = url.replace(/\/\//, "/"); // remove dupe slashes                  

                that.uploadList.push(entry);
               
                graphite.getServerAPI().upload(entry, url, loadHandler, errorHandler, progressHandler);
                
                //set the name,filesize for metrics
                if (!entry.asset.get('name')) {
                    entry.asset.set("name", entry.file.name);
                }
                entry.asset.set("fileSize", entry.file.size);

                //set the upload-started property on the model class    
                entry.asset.set("uploadStarted", Date.now());
            }
        },

        failedToUpload : function (model, file, failure) {
            var params = {};
            if (failure === 'validFileUploadError') {
                window.graphite.events.trigger("valid-file-upload-error", 'validFileUploadError', model.get('name'));
            } else if (failure === 'duplicateFileUploadError') {
                window.graphite.events.trigger("duplicate-file-upload-error", 'duplicateFileUploadError', model.get('name'));
            }
            params.filesize = model.get("fileSize");
            graphite.events.trigger('upload-failed', params);
            model.destroy();
        }
    };
    return UploadController;
});
