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
    '../../models/ColorUsageModel',
    '../../models/TextStyleUsageModel',
    '../../models/GradientUsageModel',
    '../../models/LayerModelMap',
    '../../utils/CSSUtil',
    '../../utils/TemplateUtil',
    'text!../templates/inspectFontCalloutTemplate.html',
    'text!../templates/inspectColorCalloutTemplate.html'
], function ($, _, Backbone, SelectionController, ZoomController,
    ColorUsageModel, TextStyleUsageModel, GradientUsageModel, LayerModelMap,
    CSSUtil, TemplateUtil, InspectFontCalloutTemplate, InspectColorCalloutTemplate) {
    'use strict';

    var InspectStyleOverlayView = Backbone.View.extend({
        colorCalloutDict: {},
        inspectableLayers: {},

        initialize: function () {
            this.render();
            this.model.on('change:extractedStyles', this.handleExtractedStylesChanged, this);

            this.addHandlers();

            if (this.model.get('extractedStyles')) {
                this.handleExtractedStylesChanged();
            }
        },

        render: function () {
            var div = $('<div id="inspectStyleOverlay">');
            this.setElement(div);
        },

        handleExtractedStylesChanged: function () {
            this.loadInspectableLayers();
        },

        addHandlers: function () {
            // events
            graphite.events.on('show-style-usage', this.handleShowStyleUsage, this);
            graphite.events.on('hide-style-usage', this.handleHideStyleUsage, this);
            graphite.events.on('show-originating-layers', this.handleShowOriginatingLayers, this);
            graphite.events.on('hide-originating-layers', this.handleHideOriginatingLayers, this);
            graphite.events.on('show-alpha-usage', this.handleShowAlphaUsage, this);
            graphite.events.on('hide-alpha-usage', this.handleHideAlphaUsage, this);
            graphite.events.on('zoomChanged', this.handleSelectedInspectItemChange, this);
            graphite.events.on('layerVisiblityChanged', this.handleSelectedInspectItemChange, this);

            graphite.getDetailsController().on('change:selectedInspectItem', this.handleSelectedInspectItemChange, this);

            SelectionController.on('change:extractedStylesInSelection', _.bind(this.updateCallouts, this, TextStyleUsageModel, null));
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
            graphite.getDetailsController().off(null, null, this);
            SelectionController.off(null, null, this);
            SelectionController.unbind('change:extractedStylesInSelection');
        },

        attachCalloutClickHandler: function (callout, layer) {
            var self = this;

            //first remove all previous click handlers for callout
            callout.unbind('click');
            callout.click(function (event) {
                SelectionController.changeSelection([layer], false, true);

                if (!SelectionController.isLayerVisible(layer, true)) {
                    if (layer.get('spriteSheet') !== undefined) {
                        var canvas = self.inspectableLayers.spriteSheetLayers;
                        var bounds = layer.get('bounds');
                        canvas[0].width = bounds.right - bounds.left;
                        canvas[0].height = bounds.bottom - bounds.top;
                        canvas.css('top', bounds.top + 'px');
                        canvas.css('left', bounds.left + 'px');

                        var context = canvas[0].getContext('2d');
                        var spriteBounds = layer.get('spriteSheet').bounds;
                        var image = SelectionController.spriteSheets[layer.get('spriteSheet').sheetID];
                        context.drawImage(image, spriteBounds.left, spriteBounds.top, spriteBounds.right - spriteBounds.left, spriteBounds.bottom - spriteBounds.top, 0, 0, spriteBounds.right - spriteBounds.left, spriteBounds.bottom - spriteBounds.top);

                        canvas.show();
                    } else {
                        self.inspectableLayers[layer.get('layerId')].show();
                    }
                }
                event.stopPropagation();
            });

        },


        //------------------------------------------------
        // Inspectable layers
        //------------------------------------------------
        loadInspectableLayers: function () {
            var inspectableItems, extractedStyles, layers, self;

            this.inspectableLayers = {};
            inspectableItems = [];
            extractedStyles = this.model.get('extractedStyles');
            self = this;

            inspectableItems = inspectableItems.concat(extractedStyles.colorUsageModels,
                extractedStyles.textStyleUsageModels,
                extractedStyles.gradientUsageModels);

            $.each(inspectableItems, function (itemIndex, item) {
                layers = item.get('layers');

                $.each(layers, function (layerIndex, layer) {
                    self.loadInspectableLayer(layer);
                });
            });
        },


        loadInspectableLayer: function (layer) {
            var canvas;

            if (layer.get('spriteSheet') !== undefined) {
                if (!this.inspectableLayers.spriteSheetLayers) {
                    canvas = $('<canvas class="inspectable-layer">');
                    this.inspectableLayers.spriteSheetLayers = canvas;
                    this.$el.append(canvas);
                }
            }
        },


        //------------------------------------------------
        // Style Usage and callouts
        //------------------------------------------------
        handleShowStyleUsage: function (params) {
            this.updateHoverRects(params.styles);
            this.updateCallouts(params.styles[0].constructor, params.styles);
        },


        handleHideStyleUsage: function (params) {
            this.updateCallouts(params[0].constructor, null);
            graphite.events.trigger('item-hovered-over', [], false);
        },

        updateHoverRects: function (styles) {
            var layers = [];
            $.each(styles, function (styleIndex, style) {
                layers = layers.concat(style.get('layers'));
            });
            graphite.events.trigger('item-hovered-over', layers, false);
        },

        handleSelectedInspectItemChange: function () {
            this.updateCallouts(TextStyleUsageModel, null);
            this.updateCallouts(ColorUsageModel, null);
            this.updateCallouts(GradientUsageModel, null);
        },

        handleShowAlphaUsage: function (params) {
            this.getCalloutsForStyleType(ColorUsageModel).each(function () {
                if ($(this).is(':visible')) {
                    $(this).removeClass('defocused');
                    if (params.alpha !== $(this).data('alpha')) {
                        $(this).addClass('defocused');
                    }
                }
            });
        },

        handleHideAlphaUsage: function () {
            this.getCalloutsForStyleType(ColorUsageModel).each(function () {
                if ($(this).is(':visible')) {
                    $(this).removeClass('defocused');
                }
            });
        },

        updateCallouts: function (styleType, overStyles) {
            this.getCalloutsForStyleType(styleType).each(function () {
                $(this).hide();
                $(this).removeClass('defocused');
            });

            // figure out what callouts to show
            var toShow = [];
            var selectedItem = graphite.getDetailsController().get('selectedInspectItem');
            if (overStyles) {
                toShow = toShow.concat(overStyles);
            }

            if (selectedItem &&
                    selectedItem.constructor === styleType &&
                    selectedItem !== overStyles) {
                toShow.push(selectedItem);
            }

            if (toShow.length) {
                this.showCalloutsForStyles(styleType, toShow);
            } else {
                this.$el.find('canvas.inspectable-layer').hide();
            }
        },


        showCalloutsForStyles: function (styleType, styles) {
            var self = this;
            var callouts = this.getCalloutsForStyleType(styleType);
            var callout;
            var count = 0;

            $.each(styles, function (styleIndex, style) {
                $.each(style.get('layers'), function (layerIndex, layer) {
                    if (layer.isLayerShown()) { //Only show callouts that are visible to the user. Git issue #1744
                        if (callouts[count]) {
                            callout = $(callouts[count]);
                            count++;
                        } else {
                            callout = self.createCalloutForStyleType(styleType);
                            self.$el.append(callout);
                        }
                        self.initCallout(callout, style, layer);
                    }
                });
            });
        },


        getCalloutsForStyleType: function (styleType) {
            var calloutSelector = '';
            switch (styleType) {
            case TextStyleUsageModel:
                calloutSelector = '.font-callout';
                break;
            case ColorUsageModel:
                calloutSelector = '.solid-color-callout';
                break;
            case GradientUsageModel:
                calloutSelector = '.gradient-callout';
                break;
            default:
                console.warn('Unknown callout for model');
                break;
            }
            return this.$el.find(calloutSelector);
        },


        createCalloutForStyleType: function (styleType, model) {
            var callout;
            switch (styleType) {
            case TextStyleUsageModel:
                callout = TemplateUtil.createTemplate(InspectFontCalloutTemplate);
                break;
            case ColorUsageModel:
                callout = TemplateUtil.createTemplate(InspectColorCalloutTemplate);
                callout.addClass('solid-color-callout');
                break;
            case GradientUsageModel:
                callout = TemplateUtil.createTemplate(InspectColorCalloutTemplate);
                callout.addClass('gradient-callout');
                break;
            default:
                console.warn('Unknown callout for model');
                break;
            }
            return callout;
        },


        initCallout: function (callout, model, layer) {
            if (model instanceof ColorUsageModel) {
                callout.css('background', 'none');
                callout.css('background-color', model.get('style').toRGBString());

                $.each(layer.get('colors'), function (index, color) {
                    var alphaValue,
                        alpha;
                    if (color.isEqual(model.get('style'))) {
                        alphaValue = callout.find('.alpha-value');
                        alpha = color.get('alpha');
                        if (alpha === 1) {
                            alphaValue.hide();
                        } else {
                            alphaValue.show();
                            alphaValue.text(alpha);
                        }
                        callout.data('alpha', alpha);
                    }
                });

            } else if (model instanceof GradientUsageModel) {
                callout.css('background', 'none');
                callout.find('.alpha-value').hide();
                CSSUtil.applyCSS(callout, model.get('style'), true);
            }

            callout.removeClass('invisible');
            if (!SelectionController.isLayerVisible(layer, true)) {
                callout.addClass('invisible');
            }

            this.attachCalloutClickHandler(callout, layer);
            this.positionCallout(callout, layer);
            callout.show();
        },


        //------------------------------------------------
        // Derived Assets
        //------------------------------------------------
        handleShowOriginatingLayers: function (params) {
            var layers = params.assetModel.get('originatingLayers');
            this.hideShowOriginatingLayers(layers, true);
        },


        handleHideOriginatingLayers: function (params) {
            var layers = params.get('originatingLayers');
            this.hideShowOriginatingLayers(layers, false);
        },

        hideShowOriginatingLayers: function (layers, show) {
            var layer,
                i;
            for (i = 0; i < layers.length; i++) {
                layer = LayerModelMap.getLayerInfoForId(layers[i]).item;
                if (show) {
                    $(layer).addClass('originating-layer');
                } else {
                    $(layer).removeClass('originating-layer');
                }
            }
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        positionCallout: function (callout, layerModel) {
            var top, left;

            var bounds = ZoomController.zoomRect(layerModel.get('bounds'));
            var layerHeight = bounds.bottom - bounds.top;
            var calloutWidth = parseInt(callout.css('width'), 10);
            var calloutHeight = parseInt(callout.css('height'), 10);
            var notchWidth = parseInt(callout.find('.callout-notch').width(), 10);

            top = bounds.top + (layerHeight - calloutHeight) / 2 - 4;
            if (top < 0) {
                top = 0;
            }

            left = bounds.left - calloutWidth - notchWidth - 7;
            if (left < 0) {
                left = 0;
            }

            callout.css({
                top:  top + 'px',
                left: left + 'px'
            });
        }
    });

    return InspectStyleOverlayView;
});
