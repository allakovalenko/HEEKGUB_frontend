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
    '../../Constants',
    '../popup/BasePreviewPopupView',
    '../../controllers/ZoomController',
    '../../controllers/ClipboardController',
    '../../models/PSDSettingsModel',
    '../../models/UserSettingsModel',
    '../../utils/TemplateUtil',
    'text!../templates/measurementOffsetsBoxTemplate.html',
    'text!../templates/measurementOffsetsBannerTemplate.html'
], function ($, _, Backbone, Constants, BasePreviewPopupView, ZoomController, ClipboardController, PSDSettingsModel,
             UserSettingsModel, TemplateUtil, MeasurementOffsetsBoxTemplate, MeasurementOffsetsBannerTemplate) {

    'use strict';

    var MeasurementOffsetPopupView = BasePreviewPopupView.extend({
        showParams: null,

        initialize: function () {
            BasePreviewPopupView.prototype.initialize.apply(this, arguments);

            graphite.events.on('preferredMeasurementUnitsChanged', this.handlePreferredMeasurementUnitsChanged, this);
            graphite.events.on('designedAtMultiplierChanged', this.designedAtMultiplierChanged, this);
        },

        render: function () {
            BasePreviewPopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(
                TemplateUtil.createTemplate(MeasurementOffsetsBoxTemplate)
            );

            return this;
        },


        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        designedAtMultiplierChanged: function () {
            this.updateMeasurementDisplay();
        },

        handlePreferredMeasurementUnitsChanged: function () {
            this.updateMeasurementDisplay();
        },

        handleShowMeasurementInfo: function (params) {
            this.showParams = $.extend(true, {}, params); //do a deep clone of the params object
            if (params.bounds) {
                graphite.events.trigger('show-measurement-offsets');

                var $measurementOffsetsBox = this.$el.find('#measurementOffsetsBox');

                //The incoming bounds parameters were values that were scaled to the zoom level. This led to rounding
                //errors in the displayed values because they were zoomed and unzoomed. To fix this I changed the bounds
                //parameters to unzoomed values, so now we have to change to zoomed values here so the popup
                //and the offset rectangle & arrows are drawn on the correct position
                //Mark R 07/14/15
                var zoomedBounds = ZoomController.zoomRect(params.bounds);

                // Account for box-sizing:border-box 1px border
                var canvasWidth = zoomedBounds.width - 2;
                var canvasHeight = zoomedBounds.height - 2;

                //Show the pre-calculated offsets between two elements
                //Size the div to the bounds parameter
                $measurementOffsetsBox.css({'top': zoomedBounds.top + 'px', 'left': (zoomedBounds.left) + 'px',
                                            'height': Math.max(1, canvasHeight), 'width': Math.max(1, canvasWidth)});
                var $drawingCanvas = this.$el.find('#measurementOffsetsCanvas');
                $drawingCanvas[0].width = Math.max(1, zoomedBounds.width);
                $drawingCanvas[0].height = Math.max(1, zoomedBounds.height);

                var drawingContext = $drawingCanvas[0].getContext('2d');
                this.$el.show();

                drawingContext.lineWidth = 1;
                drawingContext.strokeStyle = '#000';
                var arrowheadSize = 3;

                var midX = Math.floor(canvasWidth / 2) + 0.5;
                var midY = Math.floor(canvasHeight / 2) + 0.5;

                drawingContext.moveTo(0, midY);

                //Only draw the horizontal arrow line if there is room for it
                if (canvasHeight >= 5) {
                    //Draw the left arrowhead if there is room for it
                    if (canvasWidth > (arrowheadSize + 3) * 2) {
                        drawingContext.lineTo(arrowheadSize, midY - arrowheadSize);
                        drawingContext.stroke();
                        drawingContext.moveTo(0, midY);
                        drawingContext.lineTo(arrowheadSize, midY + arrowheadSize);
                        drawingContext.stroke();
                        drawingContext.moveTo(0, midY);
                    }

                    drawingContext.lineTo(canvasWidth, midY);
                    drawingContext.stroke();

                    //Draw the right arrowhead if there is room for it
                    if (canvasWidth > (arrowheadSize + 3) * 2) {
                        drawingContext.lineTo(canvasWidth - arrowheadSize, midY - arrowheadSize);
                        drawingContext.stroke();
                        drawingContext.moveTo(canvasWidth, midY);
                        drawingContext.lineTo(canvasWidth - arrowheadSize, midY + arrowheadSize);
                        drawingContext.stroke();
                    }
                }

                //Only draw the vertical arrow line if there is room for it
                if (canvasWidth >= 5) {
                    //Draw the top arrowhead if there is room for it
                    if (canvasHeight > (arrowheadSize + 3) * 2) {
                        drawingContext.moveTo(midX, 0);
                        drawingContext.lineTo(midX - arrowheadSize, arrowheadSize);
                        drawingContext.stroke();
                        drawingContext.moveTo(midX, 0);
                        drawingContext.lineTo(midX + arrowheadSize, arrowheadSize);
                        drawingContext.stroke();
                    }

                    drawingContext.moveTo(midX, 0);
                    drawingContext.lineTo(midX, canvasHeight);
                    drawingContext.stroke();

                    //Draw the bottom arrowhead if there is room for it
                    if (canvasHeight > (arrowheadSize + 3) * 2) {
                        drawingContext.lineTo(midX - arrowheadSize, canvasHeight - arrowheadSize);
                        drawingContext.stroke();
                        drawingContext.moveTo(midX, canvasHeight);
                        drawingContext.lineTo(midX + arrowheadSize, canvasHeight - arrowheadSize);
                        drawingContext.stroke();
                    }
                }

                //Draw the offset info banner with the correct values
                $measurementOffsetsBox.append(
                    TemplateUtil.createTemplate(MeasurementOffsetsBannerTemplate)
                );

                var copyables = this.$el.find('.copyable'),
                    clipboard = ClipboardController.getClipboard();

                _.each(copyables, function (elem) {
                    clipboard.clip(elem);
                });

                this.updateMeasurementDisplay();

                var $banner = this.$el.find('#measurementOffsetsBanner');
                $banner.click(function (e) {
                    e.stopPropagation();
                });

                //Check where the banner box will fit and place it
                var notch = this.$el.find('.notch');
                notch.show();
                var bannerLeft = (canvasWidth - $banner.outerWidth()) / 2;
                var bannerTop = 0;
                if ((canvasWidth >= ($banner.outerWidth() + (arrowheadSize + 3) * 2)) &&
                        (canvasHeight >= ($banner.outerHeight() + (arrowheadSize + 3) * 2))) {
                    //The banner fits inside, place it in the center of the box
                    bannerTop = (canvasHeight - $banner.outerHeight()) / 2;
                    notch.hide();
                } else {
                    //Place the banner outside the box, above or below
                    bannerTop = canvasHeight + 6;
                    if (bannerTop + $banner.outerHeight() > $('#selection-overlay').height()) {
                        bannerTop = -$banner.outerHeight() - 6;
                    }
                }
                $banner.css({top: bannerTop + 'px', left: bannerLeft + 'px'});

                //center notch on the popup
                var notchWidth = 20; //Hardcode the width rather than try to calculate the length of the triangle base
                var notchx = Math.round(($banner.outerWidth() - notchWidth) / 2);
                notch.css({left: notchx, top: '-6px'});
            } else {
                this.closePopup();
            }
        },

        updateMeasurementDisplay: function () {
            var params = $.extend(true, {}, this.showParams),
                preferredMeasurementUnits = UserSettingsModel.get('preferredMeasurementUnits'),
                designedAtMultiplier = PSDSettingsModel.get('designedAtMultiplier');

            if (preferredMeasurementUnits === Constants.MeasurementUnitType.PCT) {
                //Convert the pixel values to percent
                params.containerBounds.width = params.containerBounds.right - params.containerBounds.left;
                params.containerBounds.height = params.containerBounds.bottom - params.containerBounds.top;
                params.bounds.width = +(params.bounds.width/params.containerBounds.width * 100).toFixed(1);
                params.bounds.height = +(params.bounds.height/params.containerBounds.height * 100).toFixed(1);
            } else {
                params.bounds.width = Math.round(params.bounds.width/designedAtMultiplier);
                params.bounds.height = Math.round(params.bounds.height/designedAtMultiplier);
            }

            this.$el.find('#measurementOffsetX').html('<i class="xOffsetIcon"></i>' + params.bounds.width + preferredMeasurementUnits);
            this.$el.find('#measurementOffsetY').html('<i class="yOffsetIcon"></i>' + params.bounds.height + preferredMeasurementUnits);
        }

    });

    return MeasurementOffsetPopupView;
});
