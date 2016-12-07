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

/* This overlay view was created for popups because we had to split the display of popups out from the
   MeasurementOverviewView. Why? Because we had to be able to place layers higher in the z-index order
   than MouseListenerOverlayView that need to display elements (e.g. Artboard labels and popups) that receive
   clicks but allows other clicks to pass through to MouseListenerOverlayView which listens for mouse moves and
   clicks.

   This view is placed to display the popups in front of all other elements.
 */

define([
    'jquery',
    'underscore',
    'backbone',
    '../../Constants',
    '../../controllers/SelectionController',
    '../../controllers/ZoomController',
    '../../models/UserSettingsModel',
    '../../utils/MeasurementUtil',
    '../../utils/ScrollUtils',
    '../../utils/TemplateUtil',
    '../popup/MeasurementPopupView',
    '../popup/MeasurementOffsetPopupView',
    'text!../templates/measurementTooltipTemplate.html',
    'text!../templates/popupOverlayTemplate.html'
], function ($, _, Backbone, Constants, SelectionController, ZoomController, UserSettingsModel, MeasurementUtil, ScrollUtils,
             TemplateUtil, MeasurementPopupView, MeasurementOffsetPopupView, MeasurementTooltipTemplate, PopupOverlayTemplate) {

    'use strict';
    var PopupOverlayView = Backbone.View.extend({
        bShowMeasurementOnHover: false,
        measurementPopupView: null,
        measurementTooltip: null,
        mouseOverElement: null,
        lastMouseX: 0,
        lastMouseY: 0,
        lastItemMousedOver: null,

        initialize: function () {
            this.bShowMeasurementOnHover = false;
            this.measurementTooltip = null;
            this.mouseOverElement = null;
            this.render();
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(PopupOverlayTemplate));

            var tooltip = TemplateUtil.createTemplate(MeasurementTooltipTemplate);
            this.$el.append(tooltip);
            this.measurementTooltip = this.$el.find('#measurementTooltipInfo');
            this.measurementTooltip.hide();

            this.addHandlers();
        },

        addHandlers: function () {
            graphite.events.on('selection-changed', this.refreshSelection, this);
            graphite.events.on('preview-scroll-end', this.showMeasurementPopups, this);
            graphite.events.on('zoomChanged', this.handleZoomChanged, this);
            graphite.events.on('toggle-hover-measurement', this.toggleHoverMeasurement, this);
            graphite.events.on('multiSelectPending', this.handleMultiSelectPending, this);

            /* We can't listen for mouse move events here because properly listening for mouse moves would block all other
             mouse clicks and moves from passing through to overlays behind this one. Instead we let those pass through
             and rely on the MouseListenerOverlayView trigger an event to let us know about the current mouse position
             */
            graphite.events.on('mouseMoved', this.handleMouseMoved, this);
        },

        handleMouseMoved: function (mouseInfo) {
            if (mouseInfo) {
                if (this.bShowMeasurementOnHover && mouseInfo.itemMousedOver) {
                    this.syncMeasurementTooltip(mouseInfo.x, mouseInfo.y, mouseInfo.itemMousedOver);
                } else {
                    this.measurementTooltip.hide();
                }
                this.lastMouseX = mouseInfo.x;
                this.lastMouseY = mouseInfo.y;
                this.lastItemMousedOver = mouseInfo.itemMousedOver;
            } else {
                this.lastItemMousedOver = null;
                this.measurementTooltip.hide();
            }
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleMultiSelectPending: function (pending) {
            this.isMultiSelectPending = pending;
            if (this.measurementPopupView) {
                if (pending) {
                    this.measurementPopupView.hide();
                } else {
                    this.measurementPopupView.show();
                }
            }
        },

        handleZoomChanged: function () {
            this.refreshSelection();
        },

        refreshSelection: function () {
            var self = this;

            this.$el.children().remove();
            _.delay(function() {
                if (!ScrollUtils.isScrollNeeded) {
                    self.showMeasurementPopups();
                } //If scrolling is needed, defer showing the popups until the animation is done.
            }, 50);
        },

        showMeasurementPopups: function() {
            var selectionList = SelectionController.getSelectedLayers(),
                psdModel = SelectionController.getPSDModel(),
                measurementPopup,
                measurementOffsetPopup,
                layerModel,
                rectBounds;

            // Nuke all the measurement overlay children except our measurement tooltip.
            if (this.measurementPopupView) {
                this.measurementPopupView.destroy();
                this.measurementPopupView = null;
            }

            this.measurementTooltip.hide();
            this.$el.append(this.measurementTooltip);
            if (this.bShowMeasurementOnHover && this.lastItemMousedOver) {
                this.syncMeasurementTooltip(this.lastMouseX, this.lastMouseY, this.lastItemMousedOver);
            }

            if (selectionList.length === 1) {
                //Show the measurement popup
                layerModel = selectionList[0];
                measurementPopup = new MeasurementPopupView();
                this.measurementPopupView = measurementPopup;
                this.$el.append(measurementPopup.el);
                measurementPopup.handleShowMeasurementInfo({layerModel: layerModel});
            } else if (selectionList.length === 2) {
                var bounds1 = MeasurementUtil.getVisibleBounds(selectionList[0], psdModel);
                var bounds2 = MeasurementUtil.getVisibleBounds(selectionList[1], psdModel);
                //The bounds of the selected layers previously were scaled to the zoom level here. This led to rounding
                //errors in the displayed values because they were zoomed and unzoomed. To fix this I changed the bounds
                //parameters to unzoomed values. The scaling of the bounds to the current zoom is now done inside MeasurementOffsetPopupView
                //Mark R 07/14/15

                var containerBounds;
                if (MeasurementUtil.rect1ContainsRect2(bounds1, bounds2)) {
                    containerBounds = bounds1;
                } else if (MeasurementUtil.rect1ContainsRect2(bounds2, bounds1)) {
                    containerBounds = bounds2;
                } else {
                    //if neither container is inside the other, the 'container' for measurements is the whole PSD or
                    //it is the artboard layer if the selected layer is in an artboard
                    var layer1 = selectionList[0],
                        layer2 = selectionList[1],
                        layer1Artboard = layer1.getArtboardParent(),
                        layer2Artboard = layer2.getArtboardParent();
                    if (psdModel.get('isArtboardPSD') && layer1Artboard && (layer1Artboard === layer2Artboard)) {
                        containerBounds = layer1Artboard.get('bounds');
                    } else {
                        containerBounds = psdModel.get('imgdata').bounds;
                    }
                }

                //Calculate the measurement rect bounds
                rectBounds = {top: 0, left: 0, right: 0, bottom: 0, height: 100, width: 100};
                if (bounds1.top >= bounds2.bottom) {
                    rectBounds.top = bounds2.bottom;
                    rectBounds.height = bounds1.top - bounds2.bottom;
                } else if (bounds2.top >= bounds1.bottom) {
                    rectBounds.top = bounds1.bottom;
                    rectBounds.height = bounds2.top - bounds1.bottom;
                } else {
                    rectBounds.top = Math.min(bounds1.top, bounds2.top);
                    rectBounds.height = Math.abs(bounds1.top - bounds2.top);
                }

                if (bounds1.left > bounds2.right) {
                    rectBounds.left = bounds2.right;
                    rectBounds.width = bounds1.left - bounds2.right;
                } else if (bounds2.left > bounds1.right) {
                    rectBounds.left = bounds1.right;
                    rectBounds.width = bounds2.left - bounds1.right;
                } else {
                    rectBounds.left = Math.min(bounds1.left, bounds2.left);
                    rectBounds.width = Math.abs(bounds1.left - bounds2.left);
                }
                rectBounds.right = rectBounds.left + rectBounds.width;
                rectBounds.bottom = rectBounds.top + rectBounds.height;

                //Show the measurement offsets in a popup
                measurementOffsetPopup = new MeasurementOffsetPopupView();
                this.$el.append(measurementOffsetPopup.el);
                measurementOffsetPopup.handleShowMeasurementInfo({bounds: rectBounds, containerBounds: containerBounds});

                //If one rect is fully contained within the other also show measurements from bottom right corner to bottom right corner
                if (MeasurementUtil.rect1ContainsRect2(bounds1, bounds2) || MeasurementUtil.rect1ContainsRect2(bounds2, bounds1)) {
                    rectBounds.left = Math.min(bounds1.right, bounds2.right);
                    rectBounds.width = Math.abs(bounds1.right - bounds2.right);
                    rectBounds.top = Math.min(bounds1.bottom, bounds2.bottom);
                    rectBounds.height = Math.abs(bounds1.bottom - bounds2.bottom);
                    rectBounds.right = rectBounds.left + rectBounds.width;
                    rectBounds.bottom = rectBounds.top + rectBounds.height;

                    //Show the measurement offsets in a popup
                    measurementOffsetPopup = new MeasurementOffsetPopupView();
                    this.$el.append(measurementOffsetPopup.el);
                    measurementOffsetPopup.handleShowMeasurementInfo({bounds: rectBounds, containerBounds: containerBounds});
                }
            }

            if (selectionList.length >= 2) {
                UserSettingsModel.setInterceptShown(Constants.InterceptNames.SHIFT_CLICK_MEASUREMENT, false);
                measurementPopup = new MeasurementPopupView();
                this.measurementPopupView = measurementPopup;
                this.$el.append(measurementPopup.el);
                measurementPopup.handleShowMeasurementInfo({layerList: selectionList});
            }

            if (this.isMultiSelectPending && measurementPopup) {
                // Don't show the popup in multi-select mode as it will flicker. It will get shown when the
                // shift key is released
                measurementPopup.hide();
            }
        },

        positionMeasurementTooltip: function (x, y) {
            this.measurementTooltip.css({left: 0, top: 0, width: 'auto'}); //Move the tooltip to give it room to resize if needed

            var overlayOffset = this.$el.offset(),
                tooltipWidth = this.measurementTooltip.width(),
                tooltipX = Math.min(x - overlayOffset.left + 3, this.$el.width() - tooltipWidth,
                        $('#detail-panel').offset().left - tooltipWidth - overlayOffset.left),
                tooltipY = Math.max(y - overlayOffset.top - 58, 0);
            this.measurementTooltip.css({left: tooltipX, top: tooltipY, width: tooltipWidth + 1 + 'px'});
        },

        syncMeasurementTooltip: function (clientX, clientY, itemMousedOver) {
            if (itemMousedOver) {
                if (itemMousedOver !== this.mouseOverElement) {
                    //Only update the tooltip measurements info if we have a new item
                    this.mouseOverElement = itemMousedOver;
                    var bounds = MeasurementUtil.getMeasurementsOfLayerAgainstPSDBounds(itemMousedOver);
                    this.measurementTooltip.find('.measurementElementInfoDim').html('W: ' + bounds.displayWidth + '<br/> H: ' + bounds.displayHeight);
                    this.measurementTooltip.find('.measurementElementInfoPos').html('X: ' + bounds.left + 'px' + '<br/> Y: ' + bounds.top + 'px');
                }
                //Position the tooltip properly
                this.positionMeasurementTooltip(clientX, clientY);
                this.measurementTooltip.show();
            } else {
                this.measurementTooltip.hide();
            }
        },

        toggleHoverMeasurement: function () {
            this.bShowMeasurementOnHover = !this.bShowMeasurementOnHover;
            if (this.bShowMeasurementOnHover) {
                this.syncMeasurementTooltip(this.lastMouseX, this.lastMouseY, this.lastItemMousedOver);
            }
            else {
                this.measurementTooltip.hide();
            }
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }

    });

    return PopupOverlayView;

});
