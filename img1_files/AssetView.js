
/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013-2014 Adobe Systems Incorporated. All rights reserved.
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
/*global define: true, graphite: true, window: true, setTimeout: true, XMLHttpRequest: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    'plugin-dependencies',
    '../../controllers/AuthController',
    '../../utils/TemplateUtil',
    '../../controllers/ThumbnailController',
    '../../controllers/ErrorMessageController',
    'text!../../views/templates/assetViewLoadingTemplate.html',
    'text!../../views/templates/assetViewTemplate.html',
    'text!../../views/templates/assetFolderViewTemplate.html'
], function ($, _, Backbone, deps, AuthController, TemplateUtil, ThumbnailController, ErrorMessageController,
             AssetViewLoadingTemplate, AssetViewTemplate, AssetFolderViewTemplate) {
    "use strict";

    var AssetView = Backbone.View.extend({

        tagName: 'article',
        className: 'card-asset',

        initialize: function () {
            if (this.model.get("fileToLoad") === undefined) {
                var date = new Date(this.model.attributes.created);
                this.model.attributes.date = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes();
            }

            this.listenTo(this.model, 'change:uploadProgress', this.updateProgress);
            this.listenTo(this.model, 'destroy', this.remove);
            this.render();
            this.addHandlers();
        },

        render: function () {
            try {
                var tmplId;

                if (this.model.get("fileToLoad") !== undefined) {
                    if (this.model.get('type') === 'application/vnd.adobe.directory+json') {
                        tmplId = AssetFolderViewTemplate;
                    } else {
                        tmplId = AssetViewLoadingTemplate;
                    }
                } else {
                    if (this.model.get('type') === 'application/vnd.adobe.directory+json') {
                        tmplId = AssetFolderViewTemplate;
                    } else {
                        tmplId = AssetViewTemplate;
                        //Call out to see if this file is still processing. This can happen if the UI is refreshed
                        //while one or more PSDs are being processed.
                        //this.checkStatus();
                    }
                }
                var el = this.$el;
                el.html(TemplateUtil.createTemplate(tmplId, this.model.toJSON()));

                var elem = el.find('#assetThumbnail');
                if (elem[0]) {
                    ThumbnailController.drawThumbnail(this.model, elem[0]);
                }
            } catch (err) {
                console.log("Failed to render thumb for:" + this.model.attributes.name);
            }
            return this;
        },
        
        getAssetCCPath: function (model) {
            var path = Backbone.history.fragment || "files",
                unencoded;
            
            path = path.replace(/\/$/, "");
            unencoded = decodeURI(path);
            return unencoded + "/" + model.get("name");
        },
        
        addHandlers : function () {
            graphite.events.on("uploaded", this.showUploadedAssetPreview, this);
            
            var that = this;
            this.$el.mouseenter(function () {
                $(that.el).find('.del-button, .download-button').css('opacity', '1');
                $(that.el).find('.del-button').click(function (event) {
                    $(this).closest('.frame').css('opacity', 0.2);
                    graphite.getServerAPI().deleteAsset(that.getAssetCCPath(that.model),
                        that.handleDeleteSuccess.bind(that),
                        that.handleDeleteError.bind(that));
                    event.stopImmediatePropagation();
                });
                $(that.el).find('.download-button').click(function (event) {
                    // Download asset
                    that.downloadPSD();
                    event.stopImmediatePropagation();
                });
            });

            this.$el.mouseleave(function () {
                $(that.el).find('.del-button, .download-button').css('opacity', '0');
            });

            this.$el.click(function () {
                if (AuthController.isLoggedIn()) {
                    if (!that.model.get("uploadProgress")) {
                        var url;

                        if (that.model.attributes.type === "application/vnd.adobe.directory+json") {
                            url = that.getAssetCCPath(that.model);

                            Backbone.history.navigate(encodeURI(url), true);
                        } else if (that.model.attributes.type === "image/vnd.adobe.photoshop") {
                            url = "asset/psd/" + that.model.get("id").replace(/\//, "_") + "/" +
                                        that.getAssetCCPath(that.model);

                            Backbone.history.navigate(encodeURI(url), true);
                        }
                    }
                } else {
                    // DPO - I can't work out when or how this method gets fired.
                    // There was an alert here before. This would never get shown, because it's not an alert.
                    deps.notifyUser(deps.translate('You are no longer logged in.  Please log in again'));
                    window.location.href = window.location;
                }
            });
        },

        handleDeleteSuccess: function () {
            this.remove();
            graphite.events.trigger('update-asset-list-view');
        },


        handleDeleteError: function (xhr) {
            if (xhr.status === 401) {
                graphite.events.trigger('reauthenticate');
            }
        },

        updateProgress : function () {
            this.callCount++;
            //console.log('AssetView.updateProgress(): ' + this.model.id);
            var progress = this.model.get('uploadProgress');
            if (progress) {
                if (progress.status === deps.translate('PROCESSING')) {
                    //remove the uploading class , replace it with processing class
                    //console.log('PROGRESS_PROCESSING ***********************');
                    this.$('.image-wrapper-progress').removeClass('asset-uploading').addClass('asset-processing');
                    this.$('#progressbar').removeClass('progressbar-uploading').addClass('progressbar-processing');
                    this.model.unset('uploadProgress');
                }
                var perc = '';
                if (progress.percentage) {
                    perc = Math.floor(progress.percentage) + "%";
                    this.$('#progressbar').width(perc);
                }
                
                this.$('#uploadStep').text(progress.status + " " + perc);
                
                if (progress.nextStep) {
                    this.$('#nextStep').text(progress.nextStep);
                }
                //console.log("updateProgress(), workerId = " + progress.workerID);
                if (progress.workerID) {
                    graphite.getServerAPI().setWorkerOnAsset(progress.workerID, progress.assetID);
                    this.checkWorkerProgress(progress.workerID, progress.assetID);
                }
            }
        },


        checkWorkerProgress: function (workerId, assetId) {
            var that = this,
                thatWorker = workerId,
                thatAsset = assetId;

            function successCallback(response) {
                var json = JSON.parse(JSON.parse(response.responseText)),
                    progress = json.progress || 0,
                    status = null,
                    params,
                    statusText = "";

                if (json.results) {
                    status = json.results.status;
                }

                status = status || json.status || "Unknown";

                //console.log("worker status = " + status);
                //console.log("worker progress = " + progress);

                // TODO needs LOC
                if (status === "success") {
                    that.model.set("processFinished", Date.now());

                    //send the processed event
                    params = {};
                    params.filesize = that.model.get("fileSize");
                    params.processDuration = that.model.get("processFinished") - that.model.get("processStarted");
                    params.totalDuration = that.model.get("processFinished") - that.model.get("uploadStarted");
                    graphite.events.trigger('processed', params);

                    statusText = deps.translate("PROCESSING");
                    that.getModelData(thatAsset);

                } else if (status === "queued") {
                    statusText = deps.translate("QUEUED");
                    setTimeout(function () { that.checkWorkerProgress(thatWorker, thatAsset); }, 1000); // Ping the server for the status again
                } else if (status === "failed") {
                    //send the proccessedFailed event
                    params = {};
                    params.fileSize = that.model.get("fileSize");
                    params.errorCode = json.errorCode;
                    params.errorMessage = json.errorMessage;
                    graphite.events.trigger('processing-failed', params);

                    graphite.events.trigger('load-alert', ErrorMessageController.getErrorMessageForWorkerResult(json, that.model.get("fileToLoad").name));
                    that.model.id = thatAsset;

                    // Go ahead and delete it. It's not going to get better.
                    graphite.getServerAPI().deleteAsset(that.model.id,
                        that.handleDeleteSuccess,
                        that.handleDeleteError,
                        that);

                    that.model.destroy();
                } else {
                    statusText = deps.translate("PROCESSING");
                    setTimeout(function () { that.checkWorkerProgress(thatWorker, thatAsset); }, 1000); // Ping the server for the status again
                }
                that.setProcessingProgressPercent(progress, statusText);
            }

            function errorCallback(resp) {
                that.getModelData(thatAsset);
            }
            graphite.getServerAPI().getWorkerStatus(workerId, successCallback, errorCallback, this);
        },

        getModelData: function (assetId) {
            var that = this,
                thatAssetId = assetId;

            function successCallback(response) {
                var data = JSON.parse(response.responseText);
                // remove the graphite worker so we don't try to get the progress again
                graphite.getServerAPI().setWorkerOnAsset(null, thatAssetId);

                if (data.hasOwnProperty('custom') && data.custom.hasOwnProperty('graphiteWorker')) {
                    delete data.custom.graphiteWorker;
                }
                var modelData = { 'id' : thatAssetId,
                                  'updated' : data.asset.created,
                                  'created' : data.asset.created,
                                  'mimeType' : data.asset.mimeType,
                                  'metadata' : data };

                that.model.clear();
                that.model.set(modelData);
                that.initialize();
            }

            graphite.getServerAPI().getAssetInfo(assetId, successCallback, null, this);
        },


        setProcessingProgressPercent: function (progress, statusText) {
            var perc = Math.floor(progress) + '%';
            //console.log('setProcessingProgressPercent: ' + statusText + ' ' + perc);
            this.$('#uploadStep').text(statusText + ' ' + perc);
            this.$('#progressbar').width(perc);
        },

        showUploadedAssetPreview: function (params) {
            var self = this;
            if (this.model.get('name') === params.fileName) {
                var path = params.path || '';
                path = encodeURI(path);
                var fetchOptions = graphite.getServerAPI().createAjaxOptions('GET',  path + "/:metadata");
                $.ajax({
                    type: "GET",
                    url: fetchOptions.url,
                    headers: fetchOptions.headers
                }).done(function (msg) {
                    if (_.contains(this.dataTypes, "json")) {
                        self.model.set(msg);
                    } else {
                        self.model.set(JSON.parse(msg));
                    }

                    self.model.unset('fileToLoad');
                    var date = new Date(self.model.attributes.created);
                    self.model.attributes.date = date.getMonth() + 1 + "/" + date.getDate() + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes();
                    self.render();
                });
            }
        },
        

        setProcessingView: function () {
            var el = this.$el;
            if (this.model.get('fileToLoad') === undefined) {
                this.model.set('fileToLoad', {name: this.model.get('metadata').asset.fileName});
            }

            var tmpl = TemplateUtil.createTemplate(AssetViewLoadingTemplate, this.model.toJSON());
            el.html(tmpl);

            this.$('.image-wrapper-progress').removeClass('asset-uploading').addClass('asset-processing');
            this.$('#progressbar').removeClass('progressbar-uploading').addClass('progressbar-processing');
        },

        downloadPSD: function () {
            var self = this;
            graphite.events.trigger('downloading-psd');

            if (!self.$downloadFrame) {
                self.$downloadFrame = $('<iframe class="download-frame"/>');
                self.$el.append(self.$downloadFrame);
            }

            // Ensure resource is accessible before ultimately downloading.
            var assetURL = graphite.getServerAPI().getDerivedDownloadURL(self.model.get('id'));
            graphite.getServerAPI().getAssetETag(self.model.get('id'),
                function (response) {
                    self.$downloadFrame.attr('src', assetURL);
                },
                function (response) {
                    if (response.status === 401) {
                        graphite.events.trigger('reauthenticate');
                    }
                },
                this);
        }
    });
    return AssetView;
});
