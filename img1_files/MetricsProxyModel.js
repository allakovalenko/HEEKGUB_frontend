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
/*global graphite*/

define([
    'underscore',
    'backbone'
], function (_, Backbone) {
    'use strict';
    var MetricsProxyModel = Backbone.Model.extend({

        defaults: {
            authModel: null,
            configModel: null
        },

        // The Auth model and Config model are necessarily different betwixt Parfait and Extract, so we pass them in during initialization. Weak Typing is your friend
        setAuthModel: function (model) {
            this.authModel = model;
        },

        setConfigModel: function (model) {
            this.configModel = model;
            this.setDefaultParam('parfaitBuild', this.configModel.getBuildNumber());
        },

        initialize: function () {
            window.graphite = window.graphite || {};
            window.graphite.events = window.graphite.events || _.extend({}, Backbone.Events);

            window.graphite.events.on('landing-page', this.onLandingPage, this);
            window.graphite.events.on('login-dialog-shown', this.handleLogInDialogShown, this);
            window.graphite.events.on('logged-in', this.handleLoggedIn, this);
            window.graphite.events.on('upload-init', this.uploadInit, this);
            window.graphite.events.on('uploaded', this.uploaded, this);
            window.graphite.events.on('upload-failed', this.uploadFailed, this);
            window.graphite.events.on('processed', this.processed, this);
            window.graphite.events.on('processing-failed', this.processingFailed, this);
            window.graphite.events.on('drawPreviewFinish', this.drawPreviewFinish, this);//Confusing, because unlike other event listeners, this fires a 'rendered' event
            window.graphite.events.on('selectedTab', this.selectedTab, this);
            window.graphite.events.on('help-dialog', this.helpDialog, this);
            window.graphite.events.on('help-dialog-shortcut', this.helpDialogShortCut, this);
            window.graphite.events.on('first-user-overlay-shortcut', this.FUXShortCut, this);
            window.graphite.events.on('show-color-popup', this.showColorPopup, this);
            window.graphite.events.on('show-measurement-offsets', this.showMeasurementOffsets, this);
            window.graphite.events.on('copy-css', this.copyCSS, this);
            window.graphite.events.on('copy-text', this.copyText, this);
            window.graphite.events.on('copy-value', this.copyValue, this);
            window.graphite.events.on('color-format', this.colorFormat, this);
            window.graphite.events.on('report-fidelity-error', this.reportFidelityError, this);
            window.graphite.events.on('typekitSearch', this.typekitSearch, this);
            window.graphite.events.on('extract-asset-download-init', this.extractAssetDownload, this);
            window.graphite.events.on('extract-asset-direct-download', this.extractAssetDownloadDirect, this);
            window.graphite.events.on('add-asset-to-catalog', this.addAssetToCatalog, this);
            window.graphite.events.on('asset-extracted-scaled', this.scaledAssetExtracted, this);
            window.graphite.events.on('canvasClick', this.canvasClicked, this);
            window.graphite.events.on('canvasClickDrag', this.canvasClickDrag, this);
            window.graphite.events.on('cssDoublClick', this.cssDoubleClick, this);
            window.graphite.events.on('register-defaults', this.registerDefaults, this);
            window.graphite.events.on('load-alert', this.loadAlert, this);
            window.graphite.events.on('load-calltoaction', this.loadCallToAction, this);
            window.graphite.events.on('bad-file-type-dragdrop', this.badFileTypeDragDrop, this);
            window.graphite.events.on('show-extract-asset-popup', this.showExtractAssetPopup, this);
            window.graphite.events.on('downloading-extracted-asset', this.downloadingExtractedAsset, this);
            window.graphite.events.on('downloading-psd', this.downloadingPSD, this);
            window.graphite.events.on('featureFlagSet', this.featureFlagSet, this);
            window.graphite.events.on('layerCompShown', this.layerCompShown, this);
            window.graphite.events.on('layerCompChanged', this.layerCompChanged, this);
            window.graphite.events.on('commitDropperColor', this.handleDropperExtraction, this);
            window.graphite.events.on('preprocessorChanged', this.handlePreprocessorChanged, this);
            window.graphite.events.on('catchIntercept', this.handleIntercept, this);
            window.graphite.events.on('baseFontSizeChanged', this.handleBaseFontSizeChanged, this);
            window.graphite.events.on('preferredFontUnitsChanged', this.handlePreferredFontUnitsChanged, this);
            window.graphite.events.on('show-job-list-overlay', this.handleShowJobListOverlay, this);
            window.graphite.events.on('upload-psd-public-one-up', this.handleUploadOneUp, this);
            window.graphite.events.on('measurement-notification-shown', this.handleMeasurementNotificationShown, this);
            window.graphite.events.on('measurement-notification-closed', this.handleMeasurementNotificationClosed, this);
            window.graphite.events.on('artboardpsd-shown', this.handleArtboardShown, this);
            window.graphite.events.on('nonartboardpsd-shown', this.handleNonArtboardShown, this);
            window.graphite.events.on('artboard-zoomToFit', this.handleArtboardZoomToFit, this);

            this.defaultParams = {
            };
        },

        registerDefaults: function () {
            graphite.getServerAPI().registerPersistentParameters(this.defaultParams);
            window.graphite.events.off('register-defaults');
        },

        mergeParams: function (params) {
            var thisParam,
                returnParams = {},
                currentDate = new Date();
            for (thisParam in this.defaultParams) {
                if (this.defaultParams.hasOwnProperty(thisParam)) {
                    returnParams[thisParam] = this.defaultParams[thisParam];
                }
            }
            for (thisParam in params) {
                if (params.hasOwnProperty(thisParam)) {
                    returnParams[thisParam] = params[thisParam];
                }
            }
            returnParams.timestamp = currentDate.getTime();
            return returnParams;
        },

        setDefaultParam: function (key, value) {
            this.defaultParams[key] = value;
        },

        onLandingPage: function () {
            this.trackEvent('landing-page');
        },

        handleLogInDialogShown: function () {
            this.trackEvent('login-dialog-shown');
        },

        handleLoggedIn: function () {
            //initialize the adobeID
            this.trackEvent('logged-in');
        },

        uploadInit: function (params) {
            var nFiles = params.files.length,
                i;
            for (i = 0; i < nFiles; i++) {
                var aFileName = params.files[i].name,
                    eventParams = { filename : aFileName };
                this.trackEvent('upload-init', eventParams);
            }
        },

        uploaded: function (params) {
            this.trackEvent('uploaded', params);
        },

        uploadFailed: function (params) {
            this.trackEvent('upload-failed', params);
        },

        processed: function (params) {
            this.trackEvent('processed', params);
        },

        processingFailed: function (params) {
            this.trackEvent('processing-failed', params);
        },

        drawPreviewFinish: function (psdModel) {
            var currTime = Date.now();
            var renditionDuration = currTime - psdModel.get('previewStarted');
            var eventParams = { renditionDuration : renditionDuration };

            this.setDefaultParam('assetID', psdModel.get('id'));
            this.trackEvent('rendered', eventParams);
        },

        selectedTab: function (params) {
            this.trackEvent('selected-tab', {tabName: params.selectedTab});
        },

        helpDialog: function () {
            this.trackEvent('help-dialog');
        },

        helpDialogShortCut: function () {
            this.trackEvent('help-dialog-shortcut');
        },

        FUXShortCut: function () {
            this.trackEvent('first-user-overlay-shortcut');
        },

        showColorPopup: function () {
            this.trackEvent('show-color-popup');
        },

        showMeasurementOffsets: function () {
            this.trackEvent('show-measurement-offsets');
        },

        copyCSS: function (params) {
            this.trackEvent('copy-css', params);
        },

        copyText: function () {
            this.trackEvent('copy-text');
        },

        copyValue: function (params) {
            this.trackEvent('copy-value', params);
        },

        colorFormat: function (params) {
            this.trackEvent('color-format', params);
        },

        reportFidelityError: function () {
            this.trackEvent('report-fidelity-error');
        },

        typekitSearch: function () {
            this.trackEvent('typekit-search');
        },

        extractAssetDownload: function (params) {
            this.trackEvent('extract-asset-download-init', params);
        },

        extractAssetDownloadDirect: function (params) {
            this.trackEvent('extract-asset-direct-download', params);
        },

        addAssetToCatalog: function (params) {
            this.trackEvent('add-asset-to-catalog', params);
        },

        scaledAssetExtracted: function (params) {
            this.trackEvent('asset-extracted-scaled', params);
        },

        canvasClicked: function (params) {
            this.trackEvent('psd-preview-canvas-clicked', params);
        },

        canvasClickDrag: function (params) {
            this.trackEvent('psd-preview-canvas-clickdrag', params);
        },

        cssDoubleClick: function (params) {
            this.trackEvent('css-properties-doubleclick', params);
        },

        loadAlert: function (message) {
            this.trackEvent('load-alert', {alertMessage: message});
        },

        loadCallToAction: function (params) {
            this.trackEvent('load-calltoaction');
        },

        badFileTypeDragDrop: function (params) {
            this.trackEvent('bad-file-type-dragdrop', params);
        },

        showExtractAssetPopup: function (params) {
            //track the origin of show-extract-asset-popup to be 'layerPanel' or 'measurementPopup'
            //stripping off 'sourceElement' and 'layerModel' params and only sending the origin.
            this.trackEvent('show-extract-asset-popup', {origin : params.origin});
        },

        downloadingExtractedAsset: function (params) {
            //track downloading of asset from the asset panel
            this.trackEvent('downloading-extracted-asset', params);
        },

        downloadingPSD: function (params) {
            //track downloading of asset from the asset list (psd)
            this.trackEvent('downloading-psd', params);
        },

        featureFlagSet: function (params) {
            this.trackEvent('feature-flag-set', params);
        },

        layerCompShown: function () {
            this.trackEvent('layer-comp-shown');
        },

        layerCompChanged: function () {
            this.trackEvent('layer-comp-changed');
        },

        handleDropperExtraction: function () {
            this.trackEvent('dropper-color-extracted');
        },

        handlePreprocessorChanged: function (params) {
            this.trackEvent('preprocessor-changed', params);
        },

        handleIntercept: function (params) {
            this.trackEvent('catch-intercept', params);
        },

        handleBaseFontSizeChanged: function (params) {
            this.trackEvent('base-font-size-changed', params);
        },

        handlePreferredFontUnitsChanged: function (params) {
            this.trackEvent('preferred-font-units-changed', params);
        },

        handleShowJobListOverlay: function (params) {
            this.trackEvent('show-job-list-overlay', params);
        },

        handleUploadOneUp: function (params) {
            this.trackEvent('upload-psd-public-one-up', params);
        },

        handleMeasurementNotificationShown: function(params) {
            this.trackEvent('measurement-notification-shown', params);
        },

        handleMeasurementNotificationClosed: function(params) {
            this.trackEvent('measurement-notification-closed', params);
        },

        handleArtboardShown: function(params) {
            this.trackEvent('artboardpsd-shown', params);
        },

        handleNonArtboardShown: function(params) {
            this.trackEvent('nonartboardpsd-shown', params);
        },

        handleArtboardZoomToFit: function(params) {
            this.trackEvent('artboard-zoomToFit', params);
        },

        trackEvent: function (eventName, eventParams) {
            var baseEvent =  'EDGE_EXTRACT_LANDING',
                eventMap,
                eventInfo,
                params = eventParams || {};

            if (this.authModel) {
                if (!this.authModel.isAnalyticsOptIn()) {
                    return;
                }

                if (this.authModel.isValid()) {
                    // This should all be moved to something that registers them as defaults in the Metrics Controller once the user's Auth Model is returned and valid.
                    //attach the adobeID
                    params.adobeID = this.authModel.getAdobeId();
                    //track whether the e-mail originates from adobe.com, adobetest.com & 601t.com
                    params.internalUser = this.authModel.isAdobeInternalUser();
                    // Get the user's register date
                    params.registerDate = this.authModel.getRegisterDate();
                    graphite.getServerAPI().registerPersistentParameters({ internalUser: params.internalUser, registerDate: this.authModel.getRegisterDate() });
                    baseEvent = 'EDGE_EXTRACT_ACTIVITY';
                }
            }

            params.isPublic1UpView = graphite.inPublicOneUp();

            eventMap = {
                'selected-tab'                   : {event : baseEvent, subevent : 'SELECTED_TAB'},
                'show-color-popup'               : {event : baseEvent, subevent : 'SHOW_COLOR_POPUP'},
                'show-measurement-offsets'       : {event : baseEvent, subevent : 'SHOW_MEASUREMENT_OFFSETS'},
                'copy-css'                       : {event : baseEvent, subevent : 'COPY_CSS'},
                'copy-text'                      : {event : baseEvent, subevent : 'COPY_TEXT'},
                'copy-value'                     : {event : baseEvent, subevent : 'COPY_VALUE'},
                'color-format'                   : {event : baseEvent, subevent : 'COLOR_FORMAT'},
                'dropper-color-extracted'        : {event : baseEvent, subevent : 'DROPPER_COLOR_EXTRACTED'},
                'report-fidelity-error'          : {event : baseEvent, subevent : 'FIDELITY_ERROR'},
                'typekit-search'                 : {event : baseEvent, subevent : 'TYPEKIT_SEARCH'},
                'extract-asset-download-init'    : {event : baseEvent, subevent : 'ASSET_DOWNLOAD_INIT'},
                'extract-asset-direct-download'  : {event : baseEvent, subevent : 'ASSET_DIRECT_DOWNLOAD'},
                'add-asset-to-catalog'           : {event : baseEvent, subevent : 'ADD_ASSET_TO_CATALOG'},
                'asset-extracted-scaled'         : {event : baseEvent, subevent : 'ASSET_EXTRACTED_SCALED'},
                'show-extract-asset-popup'       : {event : baseEvent, subevent : 'SHOW_EXTRACT_ASSET_POPUP'},
                'downloading-extracted-asset'    : {event : baseEvent, subevent : 'DOWNLOADING_EXTRACTED_ASSET'},
                'downloading-psd'                : {event : baseEvent, subevent : 'DOWNLOADING_PSD'},
                'psd-preview-canvas-clicked'     : {event : baseEvent, subevent : 'PSD_CANVAS_CLICKED'},
                'psd-preview-canvas-clickdrag'   : {event : baseEvent, subevent : 'PSD_CANVAS_CLICKDRAG'},
                'css-properties-doubleclick'     : {event : baseEvent, subevent : 'CSS_PROPERTIES_DOUBLECLICKED'},
                'rendered'                       : {event : baseEvent, subevent : 'RENDERED'},
                'layer-comp-shown'               : {event : baseEvent, subevent : 'LAYER_COMP_SHOWN'},
                'layer-comp-changed'             : {event : baseEvent, subevent : 'LAYER_COMP_CHANGED'},
                'show-vendor-prefixes'           : {event : baseEvent, subevent : 'SHOW_VENDOR_PREFIXES'},
                'preprocessor-changed'           : {event : baseEvent, subevent : 'CSS_PREPROCESSOR_CHANGED'},
                'catch-intercept'                : {event : baseEvent, subevent : 'CATCH_INTERCEPT'},
                'base-font-size-changed'         : {event : baseEvent, subevent : 'BASE_FONT_SIZE_CHANGED'},
                'preferred-font-units-changed'   : {event : baseEvent, subevent : 'PREFERRED_FONT_UNITS_CHANGED'},
                'upload-psd-public-one-up'       : {event : baseEvent, subevent : 'UPLOAD_PSD_PUBLIC_ONE_UP'},
                'measurement-notification-shown' : {event : baseEvent, subevent : 'MEASUREMENT-NOTIFICATION-SHOWN'},
                'measurement-notification-closed': {event : baseEvent, subevent : 'MEASUREMENT-NOTIFICATION-CLOSED'},
                'artboardpsd-shown'              : {event : baseEvent, subevent : 'ARTBOARDPSD-SHOWN'},
                'nonartboardpsd-shown'           : {event : baseEvent, subevent : 'NONARTBOARDPSD-SHOWN'},
                'artboard-zoomToFit'             : {event : baseEvent, subevent : 'ARTBOARD-ZOOMTOFIT'},
                'load-calltoaction'              : {event : 'EDGE_EXTRACT_LANDING', subevent : 'CALLTOACTION_DIALOG'},
                'landing-page'                   : {event : 'EDGE_EXTRACT_LANDING', subevent : 'LANDING_PAGE'},
                'login-dialog-shown'             : {event : 'EDGE_EXTRACT_LANDING', subevent : 'LOGIN_DIALOG'},
                'feature-flag-set'               : {event : 'EDGE_EXTRACT_NAVIGATION', subevent : 'FEATURE_FLAG_SET'},
                'load-alert'                     : {event : 'EDGE_EXTRACT_NAVIGATION', subevent : 'ALERT_DIALOG'},
                'logged-in'                      : {event : 'EDGE_EXTRACT_NAVIGATION', subevent : 'SIGNON_SSO'},
                'upload-init'                    : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'INIT'},
                'uploaded'                       : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'COMPLETE'},
                'upload-failed'                  : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'FAILED'},
                'processed'                      : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'PROCESSED'},
                'processing-failed'              : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'PROCESSING_FAILED'},
                'bad-file-type-dragdrop'         : {event : 'EDGE_EXTRACT_UPLOAD', subevent : 'BAD_FILE_TYPE_DRAGDROP'},
                'help-dialog'                    : {event : 'EDGE_EXTRACT_HELP', subevent : 'HELP_DIALOG'},
                'help-dialog-shortcut'           : {event : 'EDGE_EXTRACT_HELP', subevent : 'HELP_DIALOG_SHORTCUT'},
                'first-user-overlay-shortcut'    : {event : 'EDGE_EXTRACT_HELP', subevent : 'FIRST_USER_OVERLAY_SHORTCUT'},
                'show-job-list-overlay'          : {event : 'EDGE_EXTRACT_HELP', subevent : 'JOB_LIST_OVERLAY_SHORTCUT'}
            };

            eventInfo = eventMap[eventName];

            function successCallback(resp) {
                //console.log('trackEventOnServer: ' + JSON.stringify(resp || 'success'));
            }

            function errorCallback(resp) {
                //console.log('trackEventOnServer: ' + JSON.stringify(resp || 'fail'));
            }

            if (eventInfo) {

                var mergedParams = this.mergeParams(params);

                // timestamp
                if (!mergedParams.timestamp) {
                    var currentDate = new Date();
                    mergedParams.timestamp = currentDate.getTime();
                }

                // define firstUse parameter. In this case, it's if the timestamp - registerDate < 60 minutes (3600000 milliseconds)
                mergedParams.firstUse = mergedParams.registerDate && (mergedParams.timestamp - mergedParams.registerDate < 3600000);

                // subevent
                mergedParams.subevent = eventInfo.subevent;

                // eventname (subevent has already been embedded)
                mergedParams.eventname = eventInfo.event;

                mergedParams.ownerId = graphite.ownerId;

                // Now post our event
                graphite.getServerAPI().trackEvent(mergedParams, successCallback, errorCallback, this);
            }

        }
    });

    return MetricsProxyModel;
});
