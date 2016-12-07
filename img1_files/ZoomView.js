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
    'plugin-dependencies',
    '../../Constants',
    '../../utils/TemplateUtil',
    '../../controllers/ZoomController',
    '../../controllers/SelectionController',
    'text!../templates/zoomControlsTemplate.html'
], function ($, _, Backbone, deps, Constants, TemplateUtil, ZoomController, SelectionController, ZoomControlsTemplate) {
    'use strict';
    var ZoomView = Backbone.View.extend({

        className: 'zoom-controls',

        events: {
            'click .zoom-100-button': 'handleOneToOne',
            'click .zoom-fit-button': 'handleZoomToFitClick',
            'mouseover .zoom-fit-button': 'handleZoomToFitMouseOver',
            'focus .zoom-input': 'handleFocus',
            'keydown .zoom-input': 'handleInputKey',
            'blur .zoom-input': 'handleBlur'
        },

        defaults: {
            previewView: null
        },

        initialize: function (options) {
            this.previewView = options.previewView;
            this.render();
            this.addListeners();
        },

        render: function () {
            this.$el.html(TemplateUtil.createTemplate(ZoomControlsTemplate, SelectionController.getPSDModel().toJSON()));

            this.$zoomInput = this.$el.find('.zoom-input');
            this.setInputLabel();

            return this;
        },

        addListeners: function () {
            _.bindAll(this, 'handleDocumentKey', 'toggleZoomButtonStates', 'handleZoomToFitClick');

            graphite.events.on('zoomChanged', this.handleZoomChange, this);
            graphite.events.on('zoomToFit', this.handleZoomToFitRect, this);
            graphite.events.on('drawPreviewFinish', this.toggleZoomButtonStates, this);
            graphite.events.on('psdModelInfoChanged', this.render, this);
            graphite.events.on('dropperStart', this.handleDropperStart, this);
            graphite.events.on('dropperStop', this.handleDropperStop, this);

            $(document).on('keydown.zoomview', this.handleDocumentKey);
            $(window).on('resize.zoomView', _.debounce(this.toggleZoomButtonStates, 300));
        },

        remove: function () {
            this.removeListeners();
            this.$zoomInput = null;
            this.$el.empty();
            this.previewView = null;
            return Backbone.View.prototype.remove.call(this);
        },

        removeListeners: function () {
            $(document).off('keydown.zoomview', this.handleDocumentKey);
            $(window).off('.zoomView');
            graphite.events.off(null, null, this);
        },

        setInputLabel: function () {
            this.$zoomInput.val(ZoomController.getZoomPercent());
        },

        /* This function takes a list of layers and returns the layerModel that is the single common artboard
           parent for all of the layers in the list. If the layers are not in an artboard or there are
           multiple artboard parents for the layers in the list of parents, this function returns null.
         */
        getCommonArtboardParent: function(layersList) {
            var currArtboardParent = null,
                commonParent = null;
            for (var i = 0; i < layersList.length; i++) {
                currArtboardParent = layersList[i].getArtboardParent();
                if (currArtboardParent !== null) {
                    if (commonParent === null) {
                        commonParent = currArtboardParent;
                    } else {
                        if (commonParent !== currArtboardParent) {
                            //There are at least 2 artboards selected, so zoom to the bounds of all
                            commonParent = null;
                            break;
                        }
                    }
                }
            }
            return commonParent;
        },

        handleZoomToFitClick: function () {
            var psdModel = SelectionController.getPSDModel(),
                selectedLayers = SelectionController.getSelectedLayers(),
                artboardParent = null,
                isArtboardPSD = psdModel.get('isArtboardPSD'),
                zoomRect;

            if (isArtboardPSD) {
                artboardParent = this.getCommonArtboardParent(selectedLayers);
                if (artboardParent) {
                    //If all of the selected layers are within the bounds of a single artboard, zoom to the bounds of that artboard
                    zoomRect = artboardParent.get('bounds');
                } else {
                    //Otherwise, zoom to the bounds of all the artboards in the PSD
                    zoomRect = psdModel.get('artboardsBounds');
                }
            } else {
                zoomRect = psdModel.get('imgdata').bounds;
            }
            this.handleZoomToFitRect(zoomRect);
        },

        /* Set the tooltip text to display so it is contextually correct for the action that will be performed
         */
        handleZoomToFitMouseOver: function () {
            var psdModel = SelectionController.getPSDModel(),
                selectedLayers = SelectionController.getSelectedLayers(),
                artboardParent = null;

            if (psdModel.get('isArtboardPSD')) {
                artboardParent = this.getCommonArtboardParent(selectedLayers);
                if (artboardParent) {
                    //If all of the selected layers are within the bounds of a single artboard, zoom to the bounds of that artboard
                    this.$el.find('.zoom-fit-button').attr('title', deps.translate("Zoom to fit ") + artboardParent.get('layerName'));
                } else {
                    //Otherwise, zoom to the bounds of all the artboards in the PSD
                    this.$el.find('.zoom-fit-button').attr('title', deps.translate("Zoom to fit all artboards"));
                }
            } else {
                this.$el.find('.zoom-fit-button').attr('title', deps.translate("Zoom to fit width in view"));
            }
        },

        handleZoomToFitRect: function (zoomRect) {
            var previewViewRect = this.getPsdVisibleRect();
            ZoomController.zoomToFitRect(zoomRect, previewViewRect, SelectionController.getPSDModel().get('isArtboardPSD'));
        },

        handleOneToOne: function () {
            var zoomRect = this.getCenterZoomRect(1);
            ZoomController.setZoomLevel(1, zoomRect);
        },

        handleZoomChange: function () {
            this.setInputLabel();
            this.toggleZoomButtonStates();

            if (this._isDropperActive && ZoomController.getZoomLevel() < 1) {
                graphite.events.trigger('show-zoom-in-hint-popup', {sourceElement: this.$zoomInput});
            } else {
                graphite.events.trigger('hide-zoom-in-hint-popup');
            }
        },

        toggleZoomButtonStates: function () {
            var $fitButton = this.$el.find('.zoom-fit-button'),
                $zoom100Button = this.$el.find('.zoom-100-button'),
                zoomLevel = ZoomController.getZoomLevel(),
                psdModel = SelectionController.getPSDModel(),
                viewWidth = this.previewView.$el.outerWidth() - 50,
                imageBounds = psdModel.get('imgdata').bounds,
                imageWidth = imageBounds.right - imageBounds.left,
                fitZoomLevel = viewWidth / imageWidth;

            if (viewWidth) {
                if (!psdModel.get('isArtboardPSD')) {
                    //Only toggle the Fit button if this is not an artboard PSD. Artboard PSDs have complicated
                    //contextual situations for how the Fit button works. Fixes issue #2369
                    $fitButton.toggleClass('disabled', fitZoomLevel === zoomLevel ||
                        ((imageWidth * zoomLevel) < viewWidth) && zoomLevel >= 1);
                } else {
                    $fitButton.removeClass('disabled');
                }
                $zoom100Button.toggleClass('disabled', zoomLevel === 1.0);
            }
        },

        handleDropperStart: function () {
            if (ZoomController.getZoomLevel() < 1) {
                graphite.events.trigger('show-zoom-in-hint-popup', {sourceElement: this.$zoomInput});
            }
            this._isDropperActive = true;
        },

        handleDropperStop: function () {
            graphite.events.trigger('hide-zoom-in-hint-popup');
            this._isDropperActive = false;
        },

        handleInputKey: function (event) {
            var keyCode = event.keyCode;
            if (keyCode === 9 || keyCode === 13 || keyCode === 14) {
                if (keyCode !== 9) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.commitEdit();
            } else if (keyCode === 27) {
                event.preventDefault();
                event.stopPropagation();
                this.$zoomInput.val(this.revertVal);
            }
        },

        handleDocumentKey: function (event) {
            var keyCode = event.keyCode,
                newZoomLevel = 1,
                zoomRect = null;
            if (event.altKey) {
                if (keyCode === 189 || keyCode === 109 || keyCode === 173) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (!ZoomController.isZooming()) {
                        newZoomLevel = this.getPrevZoomStep();
                        zoomRect = this.getCenterZoomRect(newZoomLevel);
                        ZoomController.setZoomLevel(newZoomLevel, zoomRect);
                    }
                } else if (keyCode === 187 || keyCode === 107 || keyCode === 61) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (!ZoomController.isZooming()) {
                        newZoomLevel = this.getNextZoomStep();
                        zoomRect = this.getCenterZoomRect(newZoomLevel);
                        ZoomController.setZoomLevel(newZoomLevel, zoomRect);
                    }
                }
            }
        },

        handleBlur: function () {
            this.setInputLabel();
        },

        handleFocus: function () {
            this.revertVal = this.$zoomInput.val();
        },

        commitEdit: function () {
            var value = parseFloat(this.$zoomInput.val()) / 100.0,
                newZoomLevel,
                zoomRect;

            if (!isNaN(value) && value > 0) {
                newZoomLevel = value;
                zoomRect = this.getCenterZoomRect(newZoomLevel);
                ZoomController.setZoomLevel(newZoomLevel, zoomRect);
            }
        },

        /* This function calls into Zoom controller to allow us to predict what area of the PSD will fit within the
           preview area at the zoom level that is passed in as the parameter.

           Since ZoomController can't know anything about the views that are involved, this method gathers the height
           & width information about the views and the PSD (allowing for scrollbars spacing) and creates rect and size
           objects to pass along to the ZoomController to do the actual calculations
ß         */
        getCenterZoomRect: function (zoomLevel) {
            var $scrollElem = this.previewView.$el,
                scrollAreaSize = {width: $scrollElem.outerWidth() - Constants.PREVIEW_SCROLLBAR_SPACING,
                                  height: $scrollElem.outerHeight() - Constants.PREVIEW_SCROLLBAR_SPACING},
                $sizeElem = $scrollElem.find('div.preview-container'),
                left = $scrollElem.scrollLeft() !== 0 ? $scrollElem.scrollLeft() : -$sizeElem.position().left,
                top = $scrollElem.scrollTop() !== 0 ? $scrollElem.scrollTop() : -$sizeElem.position().top,
                viewWidth = Math.min(scrollAreaSize.width, $sizeElem.outerWidth()),
                viewHeight = Math.min(scrollAreaSize.height, $sizeElem.outerHeight() - (Constants.PREVIEW_SPACING * 2)),
                currViewRect = {left: left, top: top, right: left + viewWidth, bottom: top + viewHeight},
                newViewRect;

            newViewRect = ZoomController.getCenterZoomRect(currViewRect, scrollAreaSize, zoomLevel, ZoomController.getZoomLevel());
            return newViewRect;
        },

        getNextZoomStep: function () {
            var zoom = ZoomController.getZoomLevel(),
                nextStop;
            if (zoom < 0.25) {
                nextStop = 0.25;
            } else if (zoom < 0.33) {
                nextStop = 0.33;
            } else if (zoom < 0.5) {
                nextStop = 0.5;
            } else if (zoom < 0.66) {
                nextStop = 0.66;
            } else if (zoom < 1) {
                nextStop = 1;
            } else {
                nextStop = parseInt(zoom + 1, 10);
            }
            return nextStop;
        },

        getPrevZoomStep: function () {
            var zoom = ZoomController.getZoomLevel(),
                prevStop;
            if (zoom <= 0.25) {
                prevStop = 0.10;
            } else if (zoom <= 0.33) {
                prevStop = 0.25;
            } else if (zoom <= 0.5) {
                prevStop = 0.33;
            } else if (zoom <= 0.66) {
                prevStop = 0.5;
            } else if (zoom <= 1) {
                prevStop = 0.66;
            } else if (zoom <= 2) {
                prevStop = 1;
            } else {
                prevStop = parseInt(zoom - 1, 10);
            }

            return prevStop;
        },

        /* Returns the bounds of the preview view area in relation to the unscaled PSD. The unscaled scroll position
         is used so the rect that is the result of this function describe which portion of the original PSD is visible
         to the user. The rect also contains the width and height of the preview area.
         */
        getPsdVisibleRect: function () {
            var $previewView = this.previewView.$el,
                previewWidth = $previewView.outerWidth(),
                previewHeight = $previewView.outerHeight(),
                zoomLevel = ZoomController.getZoomLevel(),
                resultRect;

            resultRect = {top: $previewView.scrollTop() / zoomLevel,
                left: $previewView.scrollLeft() / zoomLevel,
                bottom: $previewView.scrollTop() + previewHeight,
                right: $previewView.scrollLeft() + previewWidth,
                width: previewWidth,
                height: previewHeight};

            return resultRect;
        }

    });
    return ZoomView;
});
