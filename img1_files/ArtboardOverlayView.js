/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
    '../../Constants',
    '../../utils/KeyboardUtils',
    '../../utils/TemplateUtil',
    '../../controllers/SelectionController',
    '../../controllers/ZoomController',
    'text!../templates/artboardOverlayTemplate.html'

], function ($, _, Backbone, Constants, KeyboardUtils, TemplateUtil, SelectionController, ZoomController, ArtboardOverlayTemplate) {
    'use strict';
    var ArtboardOverlayView = Backbone.View.extend({

        psdModel: null,

        initialize: function (options) {
            this.psdModel = options.model;
            this.render();
            graphite.events.on('drawPreviewFinish', this.handleDrawPreviewFinish, this);
            graphite.events.on('selection-changed', this.handleSelectionChange, this);
            graphite.events.on('zoomChanged', this.removeLabels, this);
            graphite.events.on('zoomCompleted', this.placeLabels, this);
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(ArtboardOverlayTemplate));
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleDrawPreviewFinish: function () {
            this.placeLabels();
        },

        handleSelectionChange: function () {
            var selectedLayers = SelectionController.getSelectedLayers(),
                self = this;

            //Unselect all the selected artboard labels
            this.$el.find('.artboardLabel').removeClass('selected');

            //Now highlight all the selected artboard labels
            $.each(selectedLayers, function(id, layer) {
                if (layer.get('type') === Constants.Type.LAYER_ARTBOARD) {
                    self.$el.find('#ArtboardLabel' + layer.get('layerId')).addClass('selected');
                }
            });
        },

        onLabelClick: function (event) {
            var layerModel = $(event.target).data('layerModel');

            SelectionController.changeSelection([layerModel], KeyboardUtils.isMultiSelectKey(event), true);
            if (event.altKey) {
                //User alt/option clicked, so we zoom to this artboard's bounds
                graphite.events.trigger('zoomToFit', layerModel.get('bounds'));
                graphite.events.trigger('artboard-zoomToFit');
            }
            event.stopPropagation(); //Allowing this event to propagate will select whatever is underneath the label
        },

        onLabelHoverIn: function (event) {
            var layerModel = $(event.target).data('layerModel');
            if (layerModel && !layerModel.get('selected')) {
                graphite.events.trigger('item-hovered-over', [layerModel], true);
            }
        },

        onLabelHoverOut: function (event) {
            graphite.events.trigger('item-hovered-over', [], true);
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        placeLabels: function () {
            var self = this,
                artboardBounds = null;

            if (this.psdModel && this.psdModel.get('layerCollection') && !ZoomController.isZooming()) {
                //Iterate through all the top level layers in the collection and add labels to this overlay for them
                this.psdModel.get('layerCollection').each(function (layer) {
                    var $label = null;
                    if (layer.get('type') === Constants.Type.LAYER_ARTBOARD) {
                        $label = $("<div/>");
                        $label.attr('id', 'ArtboardLabel' + layer.get('layerId'));
                        $label.text(layer.get('layerName'));
                        $label.attr('title', layer.get('layerName'));
                        $label.addClass('artboardLabel');
                        $label.data('layerModel', layer);
                        self.$el.append($label);
                        artboardBounds = ZoomController.zoomRect(layer.get('bounds'));
                        $label.css({top: artboardBounds.top - 16, left: artboardBounds.left + 1, maxWidth: artboardBounds.right - artboardBounds.left - 2});
                        $label.hover(self.onLabelHoverIn, self.onLabelHoverOut);
                        $label.bind('click', self.onLabelClick);
                    }
                });
            }
        },

        removeLabels: function() {
            //Remove all existing labels
            this.$el.find('.artboardLabel').remove();
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }

    });

    return ArtboardOverlayView;
});

