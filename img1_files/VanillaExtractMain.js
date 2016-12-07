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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */
/*global define: true, graphite: true, unescape: true, localStorage: true, window: true, navigator: true*/


define(
    [
        'jquery',
        'underscore',
        'backbone',
        'plugin-dependencies',
        './Constants',
        './models/PSDSettingsModel',
        './models/ConfigModel',
        './models/AuthModel',
        './models/PSDModel',
        './views/detail/PSDDetailsView',    // main view file
        './views/layers/LayersListView',
        './views/layers/LayerItemView',
        './views/landing/AssetListView',
        './controllers/InterceptController',
        './controllers/AssetController',    // controller to populate a PSDModel with graphite JSON
        './controllers/AuthController',
        './controllers/DetailsController',
        './controllers/SelectionController',
        './external/ZeroClipboard/ZeroClipboard',
        './serverAPI',
        './cceco/StorageServiceAPI',
        './cceco/ImageServiceAPI',
        './config/environment',
        'module',
        'require',
        'css!./css/topcoat.css',
        'css!./css/firstUserExp.css',
        'css!./css/jobListing.css',
        'css!./css/inspect.css',
        'css!./css/layers.css',
        'css!./css/main.css',
        'css!./css/popup.css',
        'css!./css/preview.css',
        'css!./css/zIndex.css',
        'css!./css/mobile.css'
    ],

    function ($, _, Backbone, deps, Constants,
              PSDSettingsModel, ConfigModel, AuthModel, PSDModel,
              PSDDetailsView, LayersListView, LayerItemView, AssetListView,
              InterceptController, AssetController, AuthController, DetailsController, SelectionController, ZeroClipboard,
              serverAPI, StorageServiceAPI, ImageServiceAPI, ENVIRONMENT,
              module, require) {
        'use strict';

        var _serverAPI = serverAPI,
            _imageServiceAPI = ImageServiceAPI,
            _storageServiceAPI = StorageServiceAPI;

        window.graphite = window.graphite || {};
        var GRAPHITE = window.graphite;

        GRAPHITE.getServerAPI = function() {
            return _serverAPI;
        };
        
        GRAPHITE.events = GRAPHITE.events || _.extend({}, Backbone.Events);

        //set Feature Enabled
        GRAPHITE.fflags = GRAPHITE.fflags || {};
        GRAPHITE.setFeatureEnabled = function (aFeatureName, bFeatureEnabled) {
            if (aFeatureName !== null) {
                window.graphite.fflags[aFeatureName] = bFeatureEnabled;
            }
        };

        
        GRAPHITE.setConfigModel = function(oConfigModel) {
            GRAPHITE.configModel = oConfigModel;
        };

        GRAPHITE.getConfigModel = function() {
            return new ConfigModel();
        };


        GRAPHITE.setAuthModel = function(oAuthModel) {
            GRAPHITE.authModel = oAuthModel;
        };

        GRAPHITE.getAuthModel = function(){
            return new ConfigModel();
        };


        GRAPHITE.setMetricsProxyModel = function(oMPM){
            GRAPHITE.metricsProxyModel = oMPM;
            GRAPHITE.metricsProxyModel.setAuthModel(GRAPHITE.authModel);
            GRAPHITE.metricsProxyModel.setConfigModel(GRAPHITE.configModel);
        };

        GRAPHITE.getMetricsProxyModel = function(){
            // To be implemented by client
            return null;
        };

        GRAPHITE.getAssetController = function(){
            // AssetController is singleton
            return AssetController;
        };

        

        GRAPHITE.events.trigger('register-defaults');

        //isFeatureEnabled
        GRAPHITE.isFeatureEnabled = function (aFeatureName) {
            var bFeatureEnabled = false;
            if (aFeatureName !== null) {
                if (GRAPHITE.fflags[aFeatureName]) {
                    bFeatureEnabled = true;
                }
            }
            return bFeatureEnabled;
        };

        GRAPHITE.inPublicOneUp = function () {
            return deps.utils.getCurrentBasePath() === 'link';
        };

        GRAPHITE.clearFeatureFlags = GRAPHITE.clearFeatureFlags || function () {
            window.graphite.fflags = {};
        };

        GRAPHITE.getGraphite = function(){
            return GRAPHITE;
        };

        GRAPHITE.getRawPSDModel = function(oParam) {
            return new PSDModel(oParam);
        };

        GRAPHITE.getCurrentPSDModel = function() {
            return SelectionController.getPSDModel();
        };

        GRAPHITE.getPSDDetailsView = function(psdModel) {
            return new PSDDetailsView({model: extractPSDModel});
        };

        GRAPHITE.getLayersListView = function(psdModel){
            return new LayersListView({model: psdModel});
        };
        
        // Only this getter passes exactly what receives to the wrapped claass'es constructor
        // This is inconsistent, but I am more interested in making this thing work for now.
        GRAPHITE.getLayerItemView = function(oModel){
            return new LayerItemView(oModel);   
        };


        GRAPHITE.getAssetListView = function(authModel, path){
            return new AssetListView(authModel, path);
        };

        GRAPHITE.getAuthController = function(){
            return AuthController;
        };

        
        GRAPHITE.getDetailsController = function(){
            return DetailsController;
        };

        GRAPHITE.getClipboard = function(){
            return new ZeroClipboard();
        };


        GRAPHITE.getConstants = function(){
            return Constants;
        };

        
        GRAPHITE.getImageServiceAPI = function(){
            return _imageServiceAPI;
        };
        
        GRAPHITE.getStorageServiceAPI = function(){
            return _storageServiceAPI;
        };

        GRAPHITE.getEnvironment = function(){
            return ENVIRONMENT;
        };

        
        var prevAssetGuid,
            prevAssetEtag,
            extractPSDModel;



        return function (model) {
            var modelId = model.get('id'),
                assetGuid = modelId.substr(modelId.lastIndexOf('/') + 1),
                layerCompId = model.get("layerCompId"),
                path = model.get("path");

            window.graphite.urlBase = modelId.substr(0, modelId.indexOf('/api/'));
            window.graphite.ownerId = model.get('owner');
            window.graphite.linkId = model.get('linkId');

            if (this) {
                this.localContent = model.get('localContent') || false;
            }

            if (prevAssetGuid !== assetGuid || model.get("etag") !== prevAssetEtag) {
                extractPSDModel = graphite.getAssetController().getAsset(assetGuid,
                    layerCompId,
                    function () {
                        if (window.graphite.metricsProxyModel.authModel.isAnalyticsOptIn()) {
                            InterceptController.applyBehaviors();
                        }
                        var graphiteInfo = extractPSDModel.get("info"),
                            graphiteVersion = graphiteInfo.version || "";

                        if (!extractPSDModel.get('localContent') && extractPSDModel.get("path")) {
                            graphite.events.trigger("asset-data-loaded", {
                                path: extractPSDModel.get("path"),
                                graphiteVersion: graphiteVersion
                            });
                        }
                    },
                    function (response) {
                        if (response.status === 401) {
                            graphite.events.trigger('reauthenticate');
                        }
                    },
                    this,
                    path);
                PSDSettingsModel.setup(assetGuid);
                prevAssetGuid = assetGuid;
                prevAssetEtag = model.get("etag");
            }

            // Propagate a few additional attributes of the asset model
            // we received from our plugin host (if applicable).
            extractPSDModel.set('modified', model.get('modified'));
            extractPSDModel.set('assetId', model.get('id'));
            extractPSDModel.set('fileName', model.get('name'));
            extractPSDModel.set('type', model.get('type'));

            // Infer a width and height from plugin host iff our model
            // doesn't already have a width and height that can be
            // acquired from the image data.
            var psdImageData = extractPSDModel.get('imgdata');
            if (!psdImageData || (psdImageData.bounds.right === 0 && psdImageData.bounds.bottom === 0)) {
                extractPSDModel.set('height', model.get('height'));
                extractPSDModel.set('width', model.get('width'));
            }
            extractPSDModel.set('size', model.get('size'));

            /****************************************************************************************
            * Below definition is a remnant of ccweb plugin interface.
            *
            * Be careful when you modify/remove any existing methods.
            * There was an attempt to make vanilla-extract completely free from these
            * ccwb-imposed interface.
            * But it tunred out, a lot of code, especially, layer comp code has a
            * deep dependency on the apis defined here, due to how the layer comp support was
            * implemented. For example, whenever new layercomp is loaded, the entire PSDDetailsView
            * will have to be recreated, and to do it, existence of 3rd creator function is required.
            *
            * 9/10/2015 Karl Park
            *****************************************************************************************/

            var VanillaExtractInterface = {
                $el: $('<div>').addClass('vanilla-extract'),
                show: function () {
                    if (window.graphite.inPublicOneUp()) {
                        this.$el.addClass('public');
                    }
                    this.psdDetailsView = GRAPHITE.getPSDDetailsView(extractPSDModel);
                    this.$el.html(this.psdDetailsView.$el);
                    this.addHandlers();
                },

                hide: function () {
                    graphite.events.trigger('reset-layers-visibility');
                    if (this.psdDetailsView) {
                        this.psdDetailsView.remove();
                        this.psdDetailsView = null;
                    }
                    this.removeHandlers();
                    extractPSDModel.reset();
                },

                addHandlers: function () {
                    graphite.events.on('layerCompChanged', this.layerCompChanged, this);
                },

                removeHandlers: function () {
                    graphite.events.off('layerCompChanged', this.layerCompChanged, this);
                },

                layerCompChanged: function (model) {
                    this.hide();
                    if (extractPSDModel) {
                        //Copy the old value to the new model since layerCompSelectedTab was from a layerCompChange
                        model.get('imgdata').layerCompSelectedTab = extractPSDModel.get('imgdata').layerCompSelectedTab;
                    }
                    extractPSDModel = model;
                    this.show();
                    this.trigger('added-to-dom');
                },

                trigger: function (event) {
                    if (event === 'added-to-dom') {
                        if (this.psdDetailsView.previewView) {
                            this.psdDetailsView.previewView.attached();
                        }
                    }
                },

                sizeChange: function () {

                },

                getServerAPI: function() {
                    if(this._if_overriden('getServerAPI')){
                        console.log('return _overridden version of AuthController');
                        return GRAPHITE.getServerAPI;
                    }
                    return GRAPHITE.getServerAPI;
                },

                getAuthController: function(){
                    return AuthController;
                }

            };

            return VanillaExtractInterface;

        };

    }
);
