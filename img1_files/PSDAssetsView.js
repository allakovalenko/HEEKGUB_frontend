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
/*global graphite*/

define([
    'jquery',
    'underscore',
    'backbone',
    '../../controllers/DerivedAssetController',
    '../assets/DerivedAssetView',
    '../../Constants',
    'plugin-dependencies',
    '../../utils/TemplateUtil',
    'text!./../templates/derivedAssetsListTemplate.html',
    'text!./../templates/derivedAssetsListTemplateRedux.html'
], function ($, _, Backbone, DerivedAssetController, InspectDerivedAssetView,
       Constants, deps, TemplateUtil, DerivedAssetsListTemplate, DerivedAssetsListTemplateRedux) {
    'use strict';

    var PSDAssetsView = Backbone.View.extend({
        derivedAssetCollection: null,

        events: {
            'click #extract_for_device': 'handleExtractForDevicesClick',
            'click #show_files': 'handleShowFilesClick',
            'click .extraction-complete .close-button': 'handleCloseCompletePane'
        },

        initialize: function () {
            this.render();
            this.renderAssets();
            graphite.events.on('refreshAssetsView', this.renderAssets, this);
            graphite.events.on('batch_extract_start', this.handleBatchExtractStart, this);
            graphite.events.on('batch_extract_complete', this.handleBatchExtractComplete, this);
            graphite.events.on('batch_extract_cancelled', this.handleBatchExtractCancelled, this);
            graphite.events.on('batch_extract_complete_error', this.handleBatchExtractError, this);
        },

        render: function () {
            this.setElement(deps.utils.hasFeature('extract_batch') ?
                    TemplateUtil.createTemplate(DerivedAssetsListTemplateRedux) :
                    TemplateUtil.createTemplate(DerivedAssetsListTemplate));
            return this;
        },

        renderAssets: function () {
            this.assetViews = [];
            this.$el.find('.derived-assets-list').empty();
            this.loadDerivedAssets();
        },

        loadDerivedAssets: function () {
            if (!this.model.get('localContent')) {
                if (this.derivedAssetCollection) {
                    this.derivedAssetCollection.off(null, null, this);
                }

                this.derivedAssetCollection = DerivedAssetController.getDerivedAssets(this.model,
                    this.handleDerivedAssetSuccess, this.handleDerivedAssetError, this);
                this.derivedAssetCollection.on('add', this.handleDerivedAssetAdd, this);
                this.derivedAssetCollection.on('remove', this.handleDerivedAssetRemove, this);
            }
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleDerivedAssetSuccess: function (result) {
            var list = this.$el.find('.derived-assets-list'),
                self = this,
                asset;

            if (result && result.collectionId) {
                this.collectionId = result.collectionId;
                this.handleDerivedAssetsId();
            }

            $.each(this.derivedAssetCollection.models, function (index, value) {
                if (!value.get('childAssets') && value.get('name') !== '_extract.manifest') {
                    asset = new InspectDerivedAssetView({model: value});
                    self.assetViews.push(asset);
                    list.append(asset.el);
                } /* else {
                     // TODO Render hierarchy TBD on design.
                } */
            });

            //notification params
            var params = {
                numExtractedAssets: this.assetViews.length,
                flash: false //flash is false when we are loading the page
            };

            //update the asset counter
            graphite.events.trigger('assetExtracted', params);
            this.update();
        },

        handleDerivedAssetAdd: function (assetModel) {
            var list = this.$el.find('.derived-assets-list'),
                asset;

            if (!assetModel.get('childAssets')) {
                asset = new InspectDerivedAssetView({model: assetModel});
                this.assetViews.push(asset);
                list.prepend(asset.el);

                //notification params
                var params = {
                    numExtractedAssets: this.assetViews.length,
                    flash: true //flash is true when adding new asset
                };

                //update the asset counter on successful addition
                graphite.events.trigger('assetExtracted', params);

                // Reconsider whether Show Files button should be enabled.
                if (this.$el.find('#show_files').prop('disabled')) {
                    this.handleDerivedAssetsId();
                } else {
                    this.update();
                }
            }
        },

        handleDerivedAssetRemove: function (assetModel) {
            var view,
                i;
            for (i = 0; i < this.assetViews.length; i++) {
                view = this.assetViews[i];
                if (view.model.get('guid') === assetModel.get('guid')) {
                    view.remove();
                    this.assetViews.splice(i, 1);
                    break;
                }
            }

            //notification params
            var params = {};
            params.numExtractedAssets = this.assetViews.length;
            params.flash = false; //flash is false when removing an asset

            //update the asset counter on successful deletion
            graphite.events.trigger('assetExtracted', params);
            this.update();
        },

        handleDerivedAssetError: function (response) {
            if (response.status !== 404 && response.status !== 401 && response.status !== 0) {
                deps.notifyUser(deps.translate('Error retrieving derived assets ({0})', response.status));
            }
        },

        handleDerivedAssetsId: function () {
            var self = this;
            if (!this.model.get('localContent') && !deps.parfait && !graphite.inPublicOneUp()) {
                if (this.collectionId && this.collectionId.length > 0) {
                    this.filesURL = 'files?location=' + encodeURIComponent(graphite.urlBase + '/api/v1/collections/' + this.collectionId);
                } else {
                    graphite.getServerAPI().getAssetCollectionID(
                        this.model.get('id'),
                        false,
                        function (collectionId) {
                            if (collectionId && collectionId.length > 0) {
                                self.collectionId = collectionId;
                                self.filesURL = 'files?location=' + encodeURIComponent(graphite.urlBase + '/api/v1/collections/' + collectionId);
                                self.update();
                            }
                        },
                        function () {}
                    );
                }
                this.update();
            }
        },

        handleExtractForDevicesClick: function () {
            graphite.events.trigger('show-extractForDevice-dialog');
        },

        handleShowFilesClick: function () {
            window.open(this.filesURL, '_blank');
        },

        handleCloseCompletePane: function () {
            this.$el.find('.extraction-complete').hide();
        },

        update: function () {
            var hasAssets = !!this.assetViews.length;
            this.$el.find('.derived-assets').toggle(hasAssets);
            this.$el.find('.no-derived-assets').toggle(!hasAssets);

            var hasFilesUrl = hasAssets && this.filesURL && this.filesURL.length > 0;
            this.$el.find('#show_files').prop('disabled', !hasFilesUrl);
        },

        handleBeforeUnload: function () {
            return deps.translate('Assets are still being extracted.');
        },

        handleBatchExtractStart: function () {
            this.$el.find('#extract_for_device').prop('disabled', true);
            this.$el.find('.extraction-complete').hide();
            this.$el.find('.extraction-in-progress').show();
            $(window).on('beforeunload', this.handleBeforeUnload);
        },

        handleBatchExtractComplete: function () {
            this.$el.find('#extract_for_device').prop('disabled', false);
            this.$el.find('.extraction-complete').show();
            this.$el.find('.extraction-in-progress').hide();
            $(window).off('beforeunload', this.handleBeforeUnload);
        },

        handleBatchExtractCancelled: function () {
            this.$el.find('#extract_for_device').prop('disabled', false);
            this.$el.find('.extraction-in-progress').hide();
            $(window).off('beforeunload', this.handleBeforeUnload);
        },

        handleBatchExtractError: function () {
            this.$el.find('#extract_for_device').prop('disabled', false);
            this.$el.find('.extraction-complete').hide();
            this.$el.find('.extraction-in-progress').hide();
            $(window).off('beforeunload', this.handleBeforeUnload);
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------

        remove: function () {
            this.assetViews = [];
            this.collectionId = null;
            graphite.events.off('refreshAssetsView', this.renderAssets, this);
            Backbone.View.prototype.remove.call(this);

            // Stop listening to events on the derivedAssetCollection
            if (this.derivedAssetCollection) {
                this.derivedAssetCollection.off(null, null, this);
            }
        }

    });

    return PSDAssetsView;
});
