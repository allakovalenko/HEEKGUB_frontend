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

/* superclass for layers list items that handles selection and visibility */
define([
    'underscore',
    'backbone',
    '../../Constants',
    '../../controllers/SelectionController',
    '../../mixins/ScrollableItem',
    '../../utils/KeyboardUtils'
], function (_, Backbone, Constants, SelectionController, ScrollableItem, KeyboardUtils) {

    'use strict';
    var LayersListItemView = Backbone.View.extend({

        className: 'layer-item-row',

        initialize: function (options) {
            this.parentView = options.parentView;
        },

        addHandlers: function () {
            this.model.on('change:visible', this.handleVisibilityChange, this);
            this.model.on('change:selected', this.handleSelectionChange, this);
            graphite.events.on('reset-layers-visibility', this.handleVisibilityReset, this);
        },

        render: function () {
            return this;
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
        },

        handleLayerSelect: function (event) {
            var layerModel = this.model;
            if ((layerModel.get('type') === Constants.Type.LAYER_ARTBOARD) && event.altKey) {
                //User alt/option clicked, so we zoom to this artboard's bounds
                graphite.events.once('zoomCompleted', function () {
                    SelectionController.changeSelection([layerModel], false, false);
                });
                graphite.events.trigger('zoomToFit', layerModel.get('bounds'));
                graphite.events.trigger('artboard-zoomToFit');
            } else {
                SelectionController.changeSelection([layerModel], KeyboardUtils.isMultiSelectKey(event));
            }
        },

        handleSelectionChange: function () {
            if (this.$el.hasClass('selected')) {
                this.$el.removeClass('selected');
                if (this.parentView) {
                    this.parentView.childSelected(false);
                }
            }

            if (this.model.get('selected') === true) {
                this.$el.addClass('selected');
                if (this.model.canBeExtracted()) {
                    this.$el.find('.layer-group-header').first().addClass('show-export');
                }
                if (this.parentView) {
                    this.parentView.childSelected(true);
                    this.parentView.expand();
                }
                if (graphite.getDetailsController().get('selectedTab') === 'psdLayersTab') {
                    this.scrollIntoView({itemHeight: 42}); //42 is the height of a single item and prevents the entire group from being scrolled into view
                }
            } else {
                this.$el.find('.layer-group-header').first().removeClass('show-export');
            }
        },

        handleVisibilityChange: function () {
            var $visibleButton = this.$el.find('.visible-button').first();
            $visibleButton.toggleClass('off-state', !this.model.get('visible'));
            this.$el.find('.layer-group-header').toggleClass('show-export', this.model.get('selected') === true && this.model.canBeExtracted());
        },

        handleVisibilityToggleClick: function (event) {
            this.model.set('visible', !this.model.get('visible'));
            graphite.events.trigger('layerVisiblityChanged', { layer: this.model });
            event.stopPropagation();
        },

        handleVisibilityReset: function () {
            this.model.set('visible', this.model.get('psdVisible'));
        },

        remove: function () {
            this.removeEventListeners();
            Backbone.View.prototype.remove.call(this);
        }

    });

    _.extend(LayersListItemView.prototype, ScrollableItem);

    return LayersListItemView;
});
