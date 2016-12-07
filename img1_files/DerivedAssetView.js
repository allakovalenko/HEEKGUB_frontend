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
/*global define: true, graphite: true, setTimeout: true, clearTimeout: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    '../../controllers/SelectionController',
    '../../controllers/DerivedAssetController',
    '../../models/LayerModelMap',
    '../../utils/ImageUtil',
    '../../utils/TemplateUtil',
    'plugin-dependencies',
    'text!../templates/derivedAssetListItemTemplate.html'
], function ($, _, Backbone, SelectionController, DerivedAssetController, LayerModelMap,
             ImageUtil, TemplateUtil, deps, DerivedAssetListItemTemplate) {
    'use strict';

    var InspectDerivedAssetView = Backbone.View.extend({
        hoverTimer: null,
        events: {
            'load img': 'handleImageLoad',
            'mouseenter': 'handleMouseEnter',
            'mouseleave': 'handleMouseLeave',
            'click .del-button': 'handleDeleteButton',
            'click .download-button': 'handleDownload',
            'click .image-wrapper': 'handleDownload',
            'click .settings-button': 'handleSettingsClick'
        },

        initialize: function () {
            _.bindAll(this, 'handleThumbMouseEnter', 'handleThumbMouseLeave');
            this.render();
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(DerivedAssetListItemTemplate, this.model.attributes));
            this.$deleteButton = this.$el.find('.del-button');
            this.$settingsButton = this.$el.find('.settings-button');
            this.$downloadButton = this.$el.find('.download-button');
            this.$warningIcon    = this.$el.find('.warning-icon');

            this.$deleteButton.css('visibility', 'hidden');

            if (deps.utils.hasFeature('extract_batch') && this.model.hasLinkedSmartObject()) {
                this.$warningIcon.css('visibility', 'visible');
            }

            this.$el.find('div.image-wrapper').mouseenter(this.handleThumbMouseEnter);
            this.$el.find('div.image-wrapper').first().mouseleave(this.handleThumbMouseLeave);
        },

        removeEventListeners: function () {
            graphite.getDetailsController().off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleImageLoad: function (event) {
            var image = event.target;
            var wrapper = $(image).parent();
            ImageUtil.sizeAndCenterImage(image,
                parseInt(wrapper.width(), 10),
                parseInt(wrapper.height(), 10),
                ImageUtil.ImageScaleType.FIT,
                false);
        },

        handleMouseEnter: function () {
            this.$deleteButton.css('visibility', 'visible');
            this.$downloadButton.css('visibility', 'visible');

            if (deps.utils.hasFeature('extract_batch')) {
                this.$settingsButton.css('visibility', 'visible');
            }
        },

        handleMouseLeave: function () {
            this.$deleteButton.css('visibility', 'hidden');
            this.$downloadButton.css('visibility', 'hidden');
            if (!this.beingEdited) {
                this.$settingsButton.css('visibility', 'hidden');
            }
        },

        handleDeleteButton: function (event) {
            this.$el.addClass('pending-delete');
            DerivedAssetController.deleteDerivedAsset(this.model,
                this.handleDeleteSuccess,
                this.handleDeleteError,
                this);
            event.stopImmediatePropagation();
        },

        handleDownload: function (event) {
            event.preventDefault();
            if (SelectionController.get('inspectedAsset') &&
                    SelectionController.get('inspectedAsset').get('id') === this.model.get('id')) {
                graphite.getDetailsController().setInspectedAsset(null);
            } else {
                graphite.getDetailsController().setInspectedAsset(this.model);
            }
            //initial metric tracking for when downloading the extracted asset
            graphite.events.trigger('downloading-extracted-asset');
            if (!this.$downloadFrame) {
                this.$downloadFrame = $('<iframe class="download-frame"/>');
                this.$el.append(this.$downloadFrame);
            }

            // Ensure resource is accessible before ultimately downloading.
            var assetURL = graphite.getServerAPI().getDerivedDownloadURL(this.model.get('guid'), this.model.get('name'));
            graphite.getServerAPI().getAssetETag(this.model.get('guid'),
                function (response) {
                    this.$downloadFrame.attr('src', assetURL);
                },
                function (response) {
                    if (response.status === 401) {
                        graphite.events.trigger('reauthenticate');
                    }
                },
                this);
        },

        handleDeleteSuccess: function () {
            var collection = DerivedAssetController.derivedAssetCollection;
            collection.remove(this.model);
        },

        handleDeleteError: function (result) {
            if (result && result.status === 401) {
                graphite.events.trigger('reauthenticate');
            }
            this.$el.removeClass('pending-delete');
        },

        handleThumbMouseEnter: function () {
            var self = this;
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
            }

            graphite.events.trigger('load-asset-thumb-popup', self.model);

            this.hoverTimer = setTimeout(function () {
                graphite.events.trigger('show-asset-thumb-popup',
                    {sourceElement: self.$el.find('.image-wrapper div').first(), model: self.model});
            }, 500);
        },

        handleThumbMouseLeave: function () {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }

            graphite.events.trigger('hide-asset-thumb-popup',
                {sourceElement: this.$el.find('.sprite_preview').first(), model: this.model});
        },

        handleSettingsClick: function (event) {
            if (deps.utils.hasFeature('extract_batch')) {
                graphite.events.trigger('show-extract-asset-popup', {
                    type: "edit",
                    sourceElement: $(event.target),
                    origin: 'assetPanel',
                    model: this.model
                });
                event.stopPropagation();

                this.beingEdited = true;
                graphite.events.once('hide-extract-asset-popup', this.handleAssetPopupHide, this);
            }
        },

        handleAssetPopupHide: function () {
            this.beingEdited = false;
            var el = this.el;
            // $el.is(":hover") is broken in jQuery 1.9.1
            if (!(el.querySelector(":hover") || el.parentNode.querySelector(":hover") === el)) {
                this.handleMouseLeave();
            }
        },

        remove: function () {
            if (this.$downloadFrame) {
                this.$downloadFrame.remove();
                this.$downloadFrame = null;
            }
            this.$deleteButton = null;
            this.$settingsButton = null;
            this.$downloadButton = null;
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return InspectDerivedAssetView;
});
