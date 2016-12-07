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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*global define: true, graphite: true, Modernizr: true, window: true, clearTimeout: true, setTimeout: true, FileReader: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    'plugin-dependencies',
    './AssetView',
    '../../controllers/UploadController',
    '../../controllers/AuthController',
    '../../controllers/AssetListController',
    '../../utils/TemplateUtil',
    'text!../templates/assetListViewTemplate.html',
    'text!../templates/uploadFilesHereTemplate.html',
    'text!../templates/dragDropFileCaptureTemplate.html',
    'text!../templates/uploadTileTemplate.html'
], function ($, _, Backbone, deps, AssetView, UploadController,
    AuthController, AssetListController, TemplateUtil, AssetListViewTemplate,
    UploadFilesHereTemplate, DragDropFileCaptureTemplate, UploadTileTemplate) {

    'use strict';
    
    function navigateTo(route) {
        Backbone.history.navigate(route, true);
    }

    var AssetListView = Backbone.View.extend({

        el: '#results',
        collection: null,
        loading: true,
        childViews: [],
        path: null,

        tagName: 'section',

        initialize: function (authModel, path) {
            this.scErrorText = null;
            // get Asset List
            this.collection = this.getAssetList(
                this.onAssetCollectionSuccess,
                this.onAssetCollectionError,
                this,
                path
            );
            this.path = path;
            
            graphite.events.on('update-asset-list-view', function () {
                this.showUploadGuidance();
            }, this);
            this.addHandlers();
            this.render();
        },


        addHandlers: function () {
            this.collection.on('add', this.renderNewAsset, this);
            this.collection.on('reset', this.onReset, this);

            var viewThis = this,
                clickHandler = function (e) {
                    viewThis.childViews.forEach(function (view) {
                        view.stopListening();
                    });
                    viewThis.childViews.length = 0;
                    viewThis.collection.fetch();
                };

            graphite.events.on('upload-init', this.uploadFiles, this);
            $('.logo').on('click', clickHandler);

            graphite.events.on('route-change', function (newRoute) {
                // clean up
                if (newRoute === 'handleAsset') {
                    graphite.events.off('upload-init', viewThis.uploadFiles);
                    $('.logo').off('click', clickHandler);

                    viewThis.childViews.forEach(function (view) {
                        view.stopListening();
                    });
                    viewThis.childViews.length = 0;
                }
            });
            graphite.events.on('loadMoreAssets', this.loadMoreAssets, this);
        },
        
        loadMoreAssets: function (incrementalFetchObj) {
            this.collection = this.getAssetList(
                this.onAssetCollectionSuccess,
                this.onAssetCollectionError,
                this,
                incrementalFetchObj.path,
                incrementalFetchObj.xChildrenNextStart
            );
        },

        removeEventListeners: function () {
            this.collection.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        onAssetCollectionSuccess: function () {
            if (this.loading) {
                this.onReset();
            }
        },

        onAssetCollectionError: function (response) {
            if (response.status === 401) {
                graphite.events.trigger('reauthenticate');
            }

            if ((null === this.scErrorText || undefined === this.scErrorText || '' === this.scErrorText) && response.status >= 500) {
                this.scErrorText = '<em>SharedCloud Services currently unavailable.  Please try again</em>';
                this.scErrorText = this.scErrorText + '<br/><br/>(HTTP status code: " + response.status + ")';
            }
            if (this.loading) {
                this.onReset();
            }
        },


        onReset: function () {
            this.loading = false;
            this.render();
            UploadController.restoreUploads(this.collection);
        },

        reRender: function () {
            this.loading = true;
            this.collection = this.getAssetList(this.onAssetCollectionSuccess, this.onAssetCollectionError, this, this.path);
        },
        
        getAssetList: function (onAssetCollectionSuccess, onAssetCollectionError, context, path, xChildrenNextStart) {
            return AssetListController.getAssetList(
                onAssetCollectionSuccess,
                onAssetCollectionError,
                context,
                path,
                xChildrenNextStart
            );
        },
        
        render: function () {
            var tmpl = TemplateUtil.createTemplate(AssetListViewTemplate),
                noFiles = TemplateUtil.createTemplate(UploadFilesHereTemplate),
                dragDrop = TemplateUtil.createTemplate(DragDropFileCaptureTemplate),
                uploadTile = TemplateUtil.createTemplate(UploadTileTemplate),
                self = this;
            
            var doShowUploadTile = this.collection.models.length > 0;

            if (!this.$el[0]) {
                this.setElement('#results');
            }

            this.$el.html(tmpl);
                    
            var $assetListContainer = this.$el.find(".asset-list-container");
            
            $assetListContainer.append(noFiles);
            $assetListContainer.append(dragDrop);
            
            // prepend upload tile if there is at least one other tile.
            if (doShowUploadTile) {
                this.$el.find('#gridContainer').prepend(uploadTile);
            }

            // draw title
            if (this.loading === false) {
                $('#loadingSpinner').hide();

                if (this.scErrorText) {
                    this.$el.find('.asset_list_view_error_text').html(this.scErrorText);
                    this.$el.find('.asset_list_view_error').show();
                } else {
                    this.showUploadGuidance();
                }
            }
            
            var CREATIVE_CLOUD_ASSETS = deps.translate("Creative Cloud Assets"),
                FILES = "files",
                title = this.path ? FILES + "/" + this.path : FILES,
                pathSegments = title.split("/"),
                link = "",
                $assetListTitle = this.$el.find('.asset-list-title');
            
            _.each(pathSegments, function (segment) {
                if (segment) {
                    var $titleSegment = $("<span>"),
                        myLink;
                    
                    link = link + segment + "/";
                    myLink = link;
                    $titleSegment.addClass("path-segment");
                    $titleSegment.text(segment.replace(/^files/i, CREATIVE_CLOUD_ASSETS));
                    $assetListTitle.append($titleSegment);
                    $titleSegment.click(function (event) {
                        navigateTo(myLink);
                    });
                }
            });

            if (this.collection.models.length === 1 && this.collection.models[0].id === undefined) {
                return this;
            }

            var that = this;
            
            this.$el.find('input[name="uploadPSD"]').on('change', function (e) {
                e.preventDefault();

                var files = this.files,
                    filesToUpload = [],
                    i,
                    headersLoaded = 0,
                    thisContext = this;

                _.each(files, function (file) {
                    var blob = file.slice(0, 4, 'UTF-8');
                    var reader = new FileReader();
                    var mimetype = file.type;
                    var currFile = file;
                    var ext = file.name.substr((~-file.name.lastIndexOf(".") >>> 0) + 2).toLowerCase();

                    reader.addEventListener("loadend", function () {
                        if (this.result === "8BPS") { // http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_pgfId-1055726
                            filesToUpload.push(currFile);
                        }

                        headersLoaded = headersLoaded + 1;
                        if (headersLoaded === files.length) {
                            if (filesToUpload.length > 0) {
                                graphite.events.trigger("upload-init", { files: filesToUpload });
                            }
                            if (filesToUpload.length !== files.length) {
                                graphite.events.trigger('load-alert', deps.translate("You can only upload PSD files. " + (files.length - filesToUpload.length) + " of " + files.length + " files were not uploaded."));
                                graphite.events.trigger('bad-file-type-dragdrop', {extension: ext, type: mimetype});
                                window.graphite.events.trigger("bad-file-type-upload", 'badFileUpload', (files.length - filesToUpload.length), files.length);
                            }
                            $(thisContext).val('');
                        }
                    });
                    reader.readAsText(blob, 'UTF-8');
                });
                
                return false;
            });
            
            _.each(this.collection.models, function (assetModel) {
                that.renderAsset(assetModel);
            }, this);
            

            var dropzone = $('#dropzone');

            if (Modernizr.draganddrop) {
                var $dropTarget = $('#drag_drop_file_capture'),
                    $uploadFiles = $('#upload_files_here');
                $assetListContainer[0].ondragover = function (e) {
                    if (!$.contains($assetListContainer[0], $dropTarget)) {
                        $dropTarget.show();
                        $('#upload_files_here').hide();
                    }
                    return false;
                };

                $dropTarget[0].ondragleave = function (e) {
                    if ($.contains($assetListContainer[0], $dropTarget[0])) {
                        $dropTarget.hide();
                        that.showUploadGuidance();
                    }
                };
                $dropTarget[0].ondragend = function (e) {
                    if ($.contains($assetListContainer[0], $dropTarget[0])) {
                        $dropTarget.hide();
                        that.showUploadGuidance();
                    }
                };
                $dropTarget[0].ondrop = function (e) {
                    if ($.contains($assetListContainer[0], $dropTarget[0])) {
                        $dropTarget.hide();
                        that.showUploadGuidance();
                    }
                    e.preventDefault();

                    var files = e.dataTransfer.files,
                        filesToUpload = [],
                        i,
                        headersLoaded = 0;

                    _.each(files, function (file) {
                        var blob = file.slice(0, 4, 'UTF-8');
                        var reader = new FileReader();
                        var mimetype = file.type;
                        var currFile = file;
                        var ext = file.name.substr((~-file.name.lastIndexOf('.') >>> 0) + 2).toLowerCase();

                        reader.addEventListener('loadend', function () {
                            if (this.result === '8BPS') { // http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_pgfId-1055726

                                filesToUpload.push(currFile);
                            }

                            headersLoaded = headersLoaded + 1;
                            if (headersLoaded === files.length) {
                                if (filesToUpload.length > 0) {
                                    graphite.events.trigger('upload-init', { files: filesToUpload });
                                }
                                if (filesToUpload.length !== files.length) {
                                    graphite.events.trigger('load-alert', deps.translate('You can only upload PSD files. ' + (files.length - filesToUpload.length) + ' of ' + files.length + ' files were not uploaded.'));
                                    graphite.events.trigger('bad-file-type-dragdrop', {extension: ext, type: mimetype});
                                }
                            }
                        });
                        reader.readAsText(blob, 'UTF-8');
                    });

                    return false;
                };
            } else {
                dropzone.hide();
            }
            return this;
        },

        renderAsset: function (item) {
            var view = new AssetView({
                model: item
            });

            $('#gridContainer').append(view.el);

            this.childViews.push(view);
            $('#upload_files_here').hide();
        },

        renderNewAsset: function (item) {
            //metadata is empty on new uploads, so we need to skip mimetype checks on those
            var mimeType = item ? item.attributes.type : null,
                view;

            if (!mimeType ||
                    mimeType === "application/x-photoshop" ||
                    mimeType === "image/vnd.adobe.photoshop" ||
                    mimeType === "image/x-photoshop" ||
                    mimeType === "image/photoshop" ||
                    mimeType === "application/psd" ||
                    mimeType === "application/photoshop" ||
                    mimeType === "application/vnd.adobe.directory+json") {

                view = new AssetView({
                    model: item
                });

                $('#gridContainer').prepend(view.render().el);
                this.childViews.push(view);
            }
        },

        remove: function () {
            this.removeEventListeners();
            this.$el.empty();
            this.stopListening();
            return this;
        },

        showUploadGuidance: function () {
            if ($('#gridContainer .card-asset').length === 0) {
                $('#upload_files_here').show();
            } else {
                $('#upload_files_here').hide();
                $('#upload_tile').show();
            }
        },

        //------------------------------------------------
        // Upload
        //------------------------------------------------

        uploadFiles: function (data) {
            if (AuthController.isLoggedIn()) {
                var files = data.files,
                    i;
                for (i = 0; i < files.length; i++) {
                    var item = UploadController.upload(files[i]);

                    this.collection.add(item);
                    $('#upload_files_here').hide();
                    // keep upload tile in front after adding new asset tile
                    var $uploadTile = $('#gridContainer').find('#upload_tile');
                    if ($uploadTile.length === 0) {
                        // create new upload tile if the view started with an empty folder
                        $uploadTile = TemplateUtil.createTemplate(UploadTileTemplate);
                    } else {
                        $uploadTile.detach();
                    }
                    $('#gridContainer').prepend($uploadTile);
                }
            } else {
                // DPO - I can't work out when or how this method gets fired.
                // There was an alert here before. This would never get shown, because it's not an alert.
                deps.notifyUser(deps.translate('You are no longer logged in.  Please log in again'));
                window.location.href = window.location;
            }
        }
    });

    return AssetListView;
});
