/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */

define([
    'underscore',
    'backbone',
    '../Constants',
    './ColorModel',
    './TextStyleModel',
    './GradientModel'
], function (_, Backbone, Constants, ColorModel, TextStyleModel, GradientModel) {
    'use strict';
    var LayerPropertiesModel = Backbone.Model.extend({

        defaults: {
            layerType: '',
            colors: null,
            gradients: null,
            textStyles: null
        },

        enabledGradientTypes: {
            linear: true,
            radial: true,
            angle: false,
            reflected: false, // This should be doable in CSS, we just need to mirror the stops, but disable for now
            diamond: false,
            shapeburst: false
        },

        enabledGradientForms: {
            customStops: true,
            colorNoise: false
        },

        initialize: function (attributes) {
            this.layerType = attributes.layerType;
        },

        layerEffectsAreTransparent: function () {
            var effects = this.get('layerEffects'),
                isSolidFillOpaque = function (solidFillValue) { return solidFillValue.enabled && (solidFillValue.opacity === 100); };

            if (effects) {
                if (effects.solidFill.some(isSolidFillOpaque)) {
                    return false;
                }
            }
            return true;
        },

        getColorsFromEffects: function (colors) {
            var effects = this.get('layerEffects'),
                colorModel,
                self = this;
            if (effects && effects.solidFill) {
                _.each(effects.solidFill, function (solidFillValue) {
                    if (solidFillValue.enabled) {
                        colorModel = new ColorModel();
                        self.setColorModelAlpha(solidFillValue.opacity, colorModel);
                        colors.push(colorModel.set(
                            colorModel.parse(solidFillValue.color, {parse: true})
                        ));
                    }
                });
            }

            // only include base color if our layer effects are transparent
            return this.layerEffectsAreTransparent();
        },

        getColors: function () {
            var colors = this.get('colors'),
                i;

            if (colors === null) {
                colors = [];
                var color,
                    shape,
                    effects,
                    colorModel;

                switch (this.layerType) {
                case Constants.Type.LAYER_CONTENT:
                    color = this.get('color');
                    shape = this.get('shape');
                    effects = this.getColorsFromEffects(colors);
                    if (color) {
                        if (effects) {
                            colorModel = new ColorModel();
                            colors.push(colorModel.set(
                                colorModel.parse(color, {parse: true})
                            ));

                            this.checkFillOpacity(colorModel);
                        }

                        if (shape && shape.stroke) {
                            var stroke = shape.stroke;
                            if (stroke.strokeStyleContent) {
                                var strokeContent = stroke.strokeStyleContent;
                                color = strokeContent.color;
                                if (color) {
                                    colorModel = new ColorModel();
                                    this.checkStrokeOpacity(colorModel);
                                    colors.push(colorModel.set(
                                        colorModel.parse(color, {parse: true})
                                    ));
                                }
                            }
                        }
                    }

                    break;
                case Constants.Type.LAYER_TEXT:
                    var ranges = this.get('textStyleRange');
                    if (ranges) {
                        if (this.getColorsFromEffects(colors)) {
                            for (i = 0; i < ranges.length; i++) {
                                color = ranges[i].textStyle.color;
                                if (color) {
                                    colorModel = new ColorModel();
                                    colors.push(colorModel.set(
                                        colorModel.parse(color, {parse: true})
                                    ));
                                    this.checkFillOpacity(colorModel);
                                }
                            }
                        }
                    }
                    break;
                }
            }
            return colors;
        },

        checkFillOpacity: function (colorModel) {
            var blendOptions = this.get('blendOptions'),
                shape = this.get('shape'),
                opacity = 1;
            if (blendOptions) {
                if (blendOptions.hasOwnProperty('opacity')) {
                    opacity *= blendOptions.opacity / 100;
                }
                if (shape && shape.fillEnabled && blendOptions.hasOwnProperty('fillOpacity')) {
                    opacity *= blendOptions.fillOpacity / 100;
                }
                this.setColorModelAlpha(opacity * 100, colorModel);
            }
        },

        checkStrokeOpacity: function (colorModel) {
            var blendOptions = this.get('blendOptions'),
                shape = this.get('shape'),
                stroke = shape.stroke,
                opacity = 1;
            if (blendOptions) {
                if (blendOptions.hasOwnProperty('opacity')) {
                    opacity *= blendOptions.opacity / 100;
                }
                if (stroke.hasOwnProperty('strokeStyleOpacity')) {
                    opacity *= stroke.strokeStyleOpacity / 100;
                }
                if (shape && !shape.fillEnabled && blendOptions.hasOwnProperty('fillOpacity')) {
                    opacity *= blendOptions.fillOpacity / 100;
                }
                this.setColorModelAlpha(opacity * 100, colorModel);
            }
        },

        setColorModelAlpha: function (opacity, colorModel) {
            colorModel.set('alpha', +(opacity / 100).toFixed(2));
        },

        getGradients: function () {
            var gradients = this.get('gradients');
            if (gradients === null) {
                gradients = [];
                if (this.layerType === Constants.Type.LAYER_CONTENT) {
                    gradients = this.getGradientEffects();
                    if (this.layerEffectsAreTransparent()) {
                        if (this.get('class') === 'gradientLayer' &&
                                this.enabledGradientTypes[this.get('type')] &&
                                this.enabledGradientForms[this.get('gradient').gradientForm]) {
                            var gradientModel = new GradientModel(this.toJSON(), {parse: true});
                            gradients.push(gradientModel);
                        }
                    }
                }
            }

            return gradients;
        },


        getTextStyles: function () {
            var textStyles = this.get('textStyles');
            var i;
            if (textStyles === null) {
                textStyles = [];
                if (this.layerType === Constants.Type.LAYER_TEXT && this.get('rawText') !== '') {
                    var ranges = this.get('textStyleRange');
                    var textStyle, textStyleModel;
                    if (ranges) {
                        for (i = 0; i < ranges.length; i++) {
                            textStyle = ranges[i].textStyle;
                            textStyleModel = new TextStyleModel();
                            textStyles.push(textStyleModel.set(
                                textStyleModel.parse(textStyle, {parse: true})
                            ));
                        }
                    }
                }
            }
            return textStyles;
        },


        // “Private”
        getGradientEffects: function () {
            var gradientObj = null,
                gradientEffect,
                gradientEffects = [],
                effects;
            if (this.layerType === Constants.Type.LAYER_CONTENT) {
                effects = this.get('layerEffects');
                if (effects) {
                    if (effects.gradientFill) {
                        for (var i = 0; i < effects.gradientFill.length; i++) {
                            if (effects.gradientFill[i].enabled) {
                                gradientEffect = this.getGradientEffect(effects.gradientFill[i]);
                                if (gradientEffect) {
                                    gradientEffects.push(gradientEffect);
                                }
                            }
                        }
                    }
                    if (effects.innerGlow && effects.innerGlow.gradient && effects.innerGlow.enabled) {
                        gradientObj = effects.innerGlow;
                        gradientEffect = this.getGradientEffect(gradientObj);
                        if (gradientEffect) {
                            gradientEffects.push(gradientEffect);
                        }
                    } else if (effects.outerGlow && effects.outerGlow.gradient && effects.outerGlow.enabled) {
                        gradientObj = effects.outerGlow;
                        gradientEffect = this.getGradientEffect(gradientObj);
                        if (gradientEffect) {
                            gradientEffects.push(gradientEffect);
                        }
                    }
                }
            }

            return gradientEffects;
        },

        getGradientEffect: function(gradientObj) {
            if (this.enabledGradientTypes[gradientObj.type]) {
                gradientObj.layerModel = this.get('layerModel');
                return new GradientModel(gradientObj, {parse: true});
            }
            return null;
        }
    });

    return LayerPropertiesModel;
});
