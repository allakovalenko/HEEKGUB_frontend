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
    'jquery',
    'underscore',
    'backbone',
    '../../controllers/SelectionController',
    '../../controllers/ZoomController',
    '../../utils/MeasurementUtil'
], function ($, _, Backbone, SelectionController, ZoomController, MeasurementUtil) {
    'use strict';
    var SelectionOverlayView = Backbone.View.extend({
        selectionButtonBars: [],

        parentView: null,

        initialize: function (options) {
            _.bindAll(this, 'handleSelectionChange', 'handleHoverOver');
            this.parentView = options.parentView;
            this.render();
            graphite.events.on('selection-changed', this.handleSelectionChange, this);
            graphite.events.on('item-hovered-over', this.handleHoverOver, this);
            graphite.events.on('zoomChanged', this.handleZoomChanged, this);
        },

        render: function () {
            var div = this.parentView.$el.find('#selection-overlay')[0];
            this.setElement(div);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        drawOutline: function (layerModel, className) {
            var newOutlineRect,
                outlineOffset,
                overlayWidth = this.$el.width(),
                overlayHeight = this.$el.height(),
                isEdgeAdjacent,
                bounds;

            //Show the selection rects
            bounds = MeasurementUtil.getVisibleBounds(layerModel, SelectionController.getPSDModel());
            bounds = ZoomController.zoomRect(bounds);

            // Inset outline if our layerModel is adjacent
            // to our overlay edge.
            isEdgeAdjacent = bounds.top <= 0 ||
                bounds.left <= 0 ||
                bounds.right >= overlayWidth ||
                bounds.bottom >= overlayHeight;
            outlineOffset = isEdgeAdjacent ? -1 : 0;

            newOutlineRect = $('<div class="' + className + '"></div>');
            newOutlineRect.css({
                'top': bounds.top + 'px',
                'left': bounds.left + 'px',
                'height': bounds.bottom - bounds.top,
                'width': bounds.right - bounds.left,
                'outline-offset': outlineOffset + 'px'
            });
            this.$el.append(newOutlineRect);
        },

        handleSelectionChange: function () {
            var newSelection = SelectionController.getSelectedLayers(),
                i,
                j;

            // first remove all the existing buttonbars
            // (if performance becomes an issue we can recycle existing buttonbars)
            for (i = 0; i < this.selectionButtonBars.length; i++) {
                this.selectionButtonBars[i].remove();
            }

            this.selectionButtonBars = [];
            this.$el.find('.selection').remove();
            this.$el.find('.hover').remove();

            for (j = 0; j < newSelection.length; j++) {
                this.drawOutline(newSelection[j], 'selection');
            }
        },

        handleZoomChanged: function () {
            this.$el.find('.hover').remove();
            var lastSelectedLayers = SelectionController.getSelectedLayers();
            SelectionController.changeSelection([], false, true);
            graphite.events.once('zoomCompleted', function () {
                if (!SelectionController.getSelectedLayers().length){
                    SelectionController.changeSelection(lastSelectedLayers, false, true);
                }
            });
        },

        handleHoverOver: function (hoverArray) {
            var i;
            this.$el.find('.hover').remove();

            for (i = 0; i < hoverArray.length; i++) {
                if (!this.isItemSelected(hoverArray[i])) {
                    this.drawOutline(hoverArray[i], 'hover');
                }
            }
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------

        isItemSelected: function (item) {
            var id, layerModel;
            //Draw the selection box around selected layers
            for (id in SelectionController.selectionMap) {
                if (SelectionController.selectionMap.hasOwnProperty(id)) {
                    layerModel = SelectionController.selectionMap[id];
                    if (item === layerModel) {
                        return true;
                    }
                }
            }
            return false;
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }

    });

    return SelectionOverlayView;
});

