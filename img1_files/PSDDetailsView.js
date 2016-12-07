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
/*global graphite*/

define([
    'underscore',
    'backbone',
    '../../controllers/KeyboardController',
    '../../controllers/SelectionController',
    '../../controllers/ZoomController',
    './DetailPanelView',
    './HelpView',
    './SelectionBarView',
    '../assets/ExtractForDeviceDlg',
    '../popup/ExtractAssetView',
    '../popup/ExtractCodeView',
    '../popup/ColorChipPopupView',
    '../popup/LayerThumbPopupView',
    '../popup/AssetThumbPopupView',
    '../popup/ZoomInHintPopupView',
    '../preview/PSDPreviewView',
    '../../Constants',
    'plugin-dependencies',
    'text!../templates/mobileWarningTemplate.html',
    'text!../templates/psdHeaderTemplate.html',
    'text!../templates/errorNotificationTemplate.html',
    '../../utils/TemplateUtil'
], function (_, Backbone, KeyboardController, SelectionController, ZoomController,
        DetailPanelView, HelpView, SelectionBarView, ExtractForDeviceDlg, ExtractAssetView, ExtractCodeView,
        ColorChipPopupView, LayerThumbPopupView, AssetThumbPopupView, ZoomInHintPopupView, PSDPreviewView, Constants, deps,
        MobileWarningTemplate, PSDHeaderTemplate, ErrorNotificationTemplate, TemplateUtil) {
    'use strict';

    var PSDDetailsView = Backbone.View.extend({
        assetId: null,
        tagName: 'section',

        /* Cached Views */
        detailPanelView: null,
        previewView: null,
        extractAssetPopup: null,
        extractCodePopup: null,
        colorChipPopup: null,
        layerThumbPopup: null,
        assetThumbPopup: null,
        helpView: null,
        selectionBar: null,

        events: {
            'click .mobile-styles-toggle': 'handleMobileStylesToggle',
            'click .modal-window-overlay' : 'handleClickInModalOverlay'
        },

        initialize: function () {
            this.model.set('previewStarted', Date.now());
            this.model.on('change:imgdata', this.handleModelImgdataChanged, this);
            this.model.on('change:renderedSprites', this.handleRenderedSpritesChanged, this);
            this.model.on('change:status', this.handleStatusChanged, this);

            this.addHandlers();

            this.render();
            this.handleModelImgdataChanged();
            this.handleStatusChanged();
        },

        /* ------------ Overrides Begin ------------*/
        getDetailPanelView : function(oModel){
            return new DetailPanelView(oModel);
        },

        getPSDPreviewView: function(oModel){
            return new PSDPreviewView(oModel);
        },

        getSelectionBarView: function(oModel){
            return new SelectionBarView(oModel);
        },

        getExtractAssetView: function(oModel){
            return new ExtractAssetView(oModel);
        },

        getExtractCodeView: function(oModel){
            return new ExtractCodeView(oModel);
        },

        getColorChipPopupView: function(){
            return new ColorChipPopupView();
        },

        getLayerThumbPopupView: function(){
            return new LayerThumbPopupView();
        },

        getAssetThumbPopupView: function(){
            return new AssetThumbPopupView();
        },

        getZoomInHintPopupView: function(){
            return new ZoomInHintPopupView();
        },

        getHelpView: function(){
            return new HelpView();
        },

        getExtractForDeviceDlg: function(oModel){
            return new ExtractForDeviceDlg(oModel);
        },
        /* ------------ Overrides End ------------*/

        render: function () {
            ZoomController.reset();
            SelectionController.setPSDModel(this.model);
            graphite.getDetailsController().setPSDModel(this.model);

            this.detailPanelView = this.getDetailPanelView({model: this.model});
            this.previewView = this.getPSDPreviewView({model: this.model});
            this.selectionBar =  this.getSelectionBarView({previewView: this.previewView});
            this.extractAssetPopup = this.getExtractAssetView({model: this.model});
            this.extractCodePopup = this.getExtractCodeView({model: this.model});
            this.colorChipPopup = this.getColorChipPopupView();
            this.layerThumbPopup = this.getLayerThumbPopupView();
            this.assetThumbPopup = this.getAssetThumbPopupView();
            this.zoomInHintPopup = this.getZoomInHintPopupView();
            this.helpView = this.getHelpView();
            this.extractForDeviceDlg = this.getExtractForDeviceDlg({model: this.model});
            
            SelectionController.psdView = this.previewView;

            this.$el.append(TemplateUtil.createTemplate(MobileWarningTemplate));
            this.$el.append(this.previewView.el);
            this.$el.append(this.selectionBar.el);
            this.$el.append(this.detailPanelView.el);
            this.$el.append(this.extractAssetPopup.el);
            this.$el.append(this.extractCodePopup.el);
            this.$el.append(this.colorChipPopup.el);
            this.$el.append(this.layerThumbPopup.el);
            this.$el.append(this.assetThumbPopup.el);
            this.$el.append(this.zoomInHintPopup.el);

            var modalOverlay = this.$el.find('.modal-window-overlay');
            if (modalOverlay.length === 0) {
                this.$el.append('<div class="modal-window-overlay" style="display:none;">');
                modalOverlay = this.$el.find('.modal-window-overlay');
                modalOverlay.append(this.helpView.el);
                modalOverlay.append(this.extractForDeviceDlg.el);
            }

            graphite.events.trigger('do-first-use-overlay-check');

            return this;
        },

        handleClickInModalOverlay: function (event) {
            if (event.target.className === 'modal-window-overlay') {
                graphite.events.trigger('dismiss-modal-views');
            }
        },

        handleModelImgdataChanged: function () {
            this.$el.find('.psd-header').remove();
            this.$el.append(TemplateUtil.createTemplate(PSDHeaderTemplate, this.model.toJSON()));

            this.$el.find('.psd-header .back-to-files').text(deps.translate('Files'));
            if (deps.utils.getCurrentPage() !== undefined) {
                this.$el.find('.psd-header .back-to-files').css('visibility', 'visible');
                this.$el.find('.psd-header .header-separator').css('visibility', 'visible');
            } else {
                this.$el.find('.psd-header .back-to-files').css('visibility', 'hidden');
                this.$el.find('.psd-header .header-separator').css('visibility', 'hidden');
            }
        },

        handleMobileStylesToggle: function () {
            this.$el.toggleClass('mobile-styles-visible');
        },

        handleRenderedSpritesChanged: function () {
        },

        handleStatusChanged: function () {
            var errMsg,
                status = this.model.get('status');
            if (status >= 300) {
                var err = this.model.get('errorInfo');
                if (err && err.errorCode === Constants.WorkerErrorCodes.GRAPHITE_REJECTED) {
                    var matches = err.errorMessage.match(/File rejected - too many layers \((\d+)\/(\d+)\)/);
                    if (!matches) {
                        matches = err.errorMessage.match(/File rejected - limits exceeded: {"limitName":"maxLayers","value":(\d+),"limit":(\d+)/);
                    }
                    if (matches) {
                        var layerCount = matches[1];
                        var layerLimit = matches[2];
                        errMsg = deps.translate('Uh oh, this PSD has an exceptional number of layers and has failed to process. Please keep the number of layers below {0}. This PSD has {1}.', layerLimit, layerCount);
                    } else {
                        // fail of some sort. Be generic.
                        errMsg = deps.translate('Uh oh, this PSD has an exceptional number of layers and has failed to process.');
                    }
                }
                errMsg = errMsg || deps.translate("Uh oh, this PSD was not successfully processed because it's not currently compatible with Extract.");
            }

            if (errMsg) {
                this.showErrorNotification({messageText: errMsg});
            }
        },

        addHandlers: function () {
            KeyboardController.attachKeyHandlers();
            graphite.events.on('dismiss-modal-views', this.handleHideModals, this);
        },

        handleHideModals: function () {
            graphite.events.trigger('hide-help-dialog');
            graphite.events.trigger('hide-extractForDevice-dialog');
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
            KeyboardController.removeKeyHandlers();
        },

        showErrorNotification: function (message) {
            if (this.previewView) {
                this.previewView.showErrorNotification(message);
            }
        },

        destroyViews: function (views) {
            var self = this;
            _.each(views, function (view) {
                if (self.hasOwnProperty(view)) {
                    self[view].remove();
                    delete self[view];
                }
            });
        },

        remove: function () {
            this.removeEventListeners();

            var views = ['detailPanelView', 'previewView', 'extractAssetPopup', 'extractCodePopup',
                    'colorChipPopup', 'layerThumbPopup', 'assetThumbPopup', 'helpView',
                    'extractForDeviceDlg', 'selectionBar'];

            graphite.getDetailsController().setSelectedTab('psdInspectTab');
            graphite.getDetailsController().setSelectedInspectItem(null);
            this.destroyViews(views);
            SelectionController.psdView = null;

            this.$el.empty();
            this.stopListening();
            return this;
        }

    });

    return PSDDetailsView;

});
