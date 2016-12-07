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
/*global define: true, graphite: true, unescape: true, localStorage: true, window: true, navigator: true*/

define([
    'underscore',
    'backbone',
    'plugin-dependencies',
    '../collections/SubLayerCollection',
    './LayerPropertiesModel',
    './ColorUsageModel',
    './GradientUsageModel',
    './TextStyleUsageModel',
    './LayerModelMap',
    './UsageModelMap',
    './UserSettingsModel',
    '../utils/MeasurementUtil',
    '../Constants',
    '../utils/CSSUtil',
    '../utils/UTF8',
    '../utils/ExtractTextLayerCss'
], function (_, Backbone, deps, SubLayerCollection, LayerPropertiesModel, ColorUsageModel,
             GradientUsageModel, TextStyleUsageModel, LayerModelMap, UsageModelMap, UserSettingsModel,
             MeasurementUtil, Constants, CSSUtil, UTF8, extractTextLayerCss) {
    'use strict';
    var LayerModel = Backbone.Model.extend({
        defaults: {
            type: '',
            layerName: '',
            layerId: '',
            bounds: '',
            properties: '',
            selected: false,
            rendered: false,
            parentModel: null,
            flattenedParent: null,
            flattenedSprite: null,
            zIndex: 0,
            toplevel: false,
            psdGuid: '',
            layerCollection: null,
            colors: null,
            usageModels: null,
            visible: false,
            psdVisible: false, //The original visibility setting for the layer in the PSD. Do not modify this value
            renderedVisible: false, //Denotes visibility of this layer as captured by any flattened sprites.
            smartObjectInfo: null
        },

        initialize: function () {
            this.set('colors', []); // Make sure the colors array is not null in case $.each
        },

        toString: function () {
            return '[object LayerModel name: ' + this.get('layerName') + ', layerId: ' + this.get('layerId') + ', zIndex: ' + this.get('zIndex') + ']';
        },

        parse: function (response) {
            var result = {},
                props,
                childrenArray = response.children,
                layerCollection = new SubLayerCollection(LayerModel);

            result.type = response.type;
            result.layerName = response.layerName;
            result.layerId = response.layerId;
            result.visible = response.visible;
            if (result.visible === undefined) {
                result.visible = true;
            }

            if (response.type === Constants.Type.LAYER_SMARTOBJ) {
                if (response.hasOwnProperty('smartObjectType')) {
                    result.smartObjectType = response.smartObjectType;
                } else if (response.hasOwnProperty('smartObjectInfo')) {
                    result.smartObjectType = response.smartObjectInfo.linked ? 'linked' : 'embedded ';
                    result.smartObjectInfo = response.smartObjectInfo;
                }
            } else if (response.type === Constants.Type.LAYER_ADJUSTMENT) {
                if (response.adjustmentLayer) {
                    result.adjustmentLayerType = response.adjustmentLayer.type;
                }
            }

            if (response.type === Constants.Type.LAYER_ARTBOARD && response.artboardRect) {
                //MJR 2015/02/12 - The current understanding is that artboardRect bounds take precedence
                // over all other bounds for the layer
                result.bounds = response.artboardRect;
                result.rawBounds = response.artboardRect;
            } else {
                result.bounds = response.bounds;
                result.rawBounds = response.rawBounds;
            }

            result.flattenedParent = response.flattenedParent;
            result.flattenedSprite = response.flattenedSprite;
            result.isFlattened = result.flattenedSprite !== undefined  || result.flattenedParent !== undefined;
            result.psdVisible = result.renderedVisible = result.visible;

            if (!response.smartObjectLayer) {
                LayerModelMap.addModel(result.layerId, this);

                if (response.clipped && response.hasOwnProperty('clipLayerBaseId')) {
                    var clipbaseModel = LayerModelMap.getModel(response.clipLayerBaseId),
                        clippedArray;

                    if (clipbaseModel) {
                        clippedArray = clipbaseModel.get('clippedLayers') || [];
                        clippedArray.push(this);
                        clipbaseModel.set('clippedLayers', clippedArray);
                        result.clipbase = clipbaseModel;
                    }
                }
            }
            result.smartObjectInfo = response.smartObjectInfo;

            if (response.hasOwnProperty('spriteSheet')) {
                result.spriteSheet = response.spriteSheet;
            }

            if (response.flattenedSprite) {
                LayerModelMap.addFlattenedLayer(this);
            }

            // result.thumb = response.thumb;
            if (childrenArray) {
                layerCollection.reset();
                layerCollection.add(childrenArray, {parse: true});
                result.layerCollection = layerCollection;
            }

            if (!deps.parfait && response.hasOwnProperty('smartObjectData')) {
                result.smartObjectLayers = new SubLayerCollection(LayerModel);
                result.smartObjectLayers.reset();

                // Mark these layers as being smartObject layers
                _.each(response.smartObjectData.children, function (layer) {
                    layer.smartObjectLayer = true;
                });

                result.smartObjectLayers.add(response.smartObjectData.children, {parse: true});
            }

            props = new LayerPropertiesModel({layerType: result.type, layerModel: this});
            props.set(props.parse(response.properties, {parse: true}));
            result.properties = props;

            return result;
        },


        //returns the first parent model that is an artboard layer, or null if none is found
        getArtboardParent: function () {
            if (typeof this.artboardParent === 'undefined') {
                if (this.get('type') === Constants.Type.LAYER_ARTBOARD) {
                    this.artboardParent = this;
                } else if (this.get('parentModel') instanceof LayerModel) {
                    this.artboardParent = this.get('parentModel').getArtboardParent();
                } else {
                    this.artboardParent = null;
                }
            }
            return this.artboardParent;
        },

        //returns an array of css property objects (property:, value:)
        getCSSArray: function (showVendorPrefixes) {
            var cssArray = [],
                properties = this.get('properties'),
                //Fixes issue #529
                bounds = MeasurementUtil.getMeasurementsOfLayerAgainstPSDBounds(this),
                usageModels = this.get('usageModels'),
                color,
                layerEffects = properties.get('layerEffects'),
                shape,
                blendOptions;

            if (properties.layerType === Constants.Type.LAYER_TEXT) {
                cssArray = cssArray.concat(extractTextLayerCss(properties, usageModels));
            } else if (properties.layerType === Constants.Type.LAYER_CONTENT) {
                // TODO: create test file for the case with multiple gradients (would that ever happen?)
                shape = properties.get('shape');
                blendOptions = properties.get('blendOptions');
                var isOpacity = blendOptions && blendOptions.hasOwnProperty('opacity'),
                    isFillOpacity = blendOptions && blendOptions.hasOwnProperty('fillOpacity'),
                    globalOpacity = isOpacity ? blendOptions.opacity / 100 : 1,
                    fillOpacity = isFillOpacity ? blendOptions.fillOpacity / 100 : 1,
                    gradientUsage = usageModels.gradientUsageModels[0],
                    colorUsage = usageModels.colorUsageModels[0],
                    isFill = (colorUsage || gradientUsage),
                    isStroke = shape && shape.stroke,
                    solidFill = (layerEffects && layerEffects.solidFill.length === 1) ? layerEffects.solidFill[0]: null,
                    gradientFill = (layerEffects && layerEffects.gradientFill.length === 1) ? layerEffects.gradientFill[0]: null,
                    gradientModel,
                    cssObj,
                    alpha;

                if (shape) {
                    if (shape.type === Constants.Shape.ELLIPSE) {
                        cssArray.push({property: 'border-radius', value: '50%'});
                    }
                    if (shape.type === Constants.Shape.RECTANGLE) {
                        cssObj = CSSUtil.getBorderRadiusCSS(shape.bottomLeftRadius, shape.bottomRightRadius, shape.topLeftRadius, shape.topRightRadius);
                        if (cssObj) {
                            cssArray = cssArray.concat(cssObj);
                        }
                    }
                }

                if (isStroke) {
                    //Handles the case of a stroke on the layer itself.
                    cssArray = cssArray.concat(CSSUtil.strokeToCSS(shape, isFill ? null : +(globalOpacity * fillOpacity).toFixed(2)));
                }

                if (layerEffects && layerEffects.frameFX) {
                    //Handles the case of strokes as layer effects
                    cssArray = cssArray.concat(CSSUtil.layerEffectStrokesToCSS(shape, layerEffects.frameFX));
                }

                if (solidFill && solidFill.opacity === 100 && solidFill.color) {
                    //The solidFill overlay blocks out the layer background & gradient, use the solid fill color as the background color
                    color = solidFill.color;
                    cssArray.push({
                        property: 'background-color',
                        value: CSSUtil.getDefaultColorString(color.red, color.green, color.blue)
                    });
                } else if (!solidFill && gradientFill && gradientFill.opacity === 100 && gradientFill.gradient) {
                    //If there is a gradientOverlay with no solidFill overlay use the gradient as the background color
                    if (gradientUsage) {
                        gradientModel = gradientUsage.get('style');
                        cssObj = gradientModel.getCSS(showVendorPrefixes, alpha);
                        if (cssObj) {
                            cssArray = cssArray.concat(cssObj);
                        }
                    }
                } else {
                    //The overlay(s) are partially transparent. Give the user all the background colors/gradients
                    // we know about... if appropriate we'll also give them a warning about it (see below)
                    if (shape && shape.fillEnabled && colorUsage) {
                        alpha = (isStroke ? 1 : globalOpacity) * fillOpacity;
                        alpha = +alpha.toFixed(2);
                        color = properties.get('color') || colorUsage.get('style').attributes;
                        cssArray.push({
                            property: 'background-color',
                            value: CSSUtil.getDefaultColorString(color.red, color.green, color.blue, alpha)
                        });
                    }
                    if (gradientUsage) {
                        gradientModel = gradientUsage.get('style');
                        cssObj = gradientModel.getCSS(showVendorPrefixes, parseFloat(gradientModel.get('opacity'))/100);
                        if (cssObj) {
                            cssArray = cssArray.concat(cssObj);
                        }
                    }
                    if (layerEffects && layerEffects.solidFill) {
                        _.each(layerEffects.solidFill, function(fillValue) {
                            color = fillValue.color;
                            cssArray.push({
                                property: 'background-color',
                                value: CSSUtil.getDefaultColorString(color.red, color.green, color.blue, parseFloat(fillValue.opacity)/100)
                            });
                        });
                    }
                }

                if (isOpacity && isStroke && isFill) {
                    cssArray.push({
                        property: 'opacity',
                        value: +globalOpacity.toFixed(2)
                    });
                }
                if (properties.get('transform')) {
                    var cssTransform = CSSUtil.getCSSTransform(properties.get('transform'));
                    if (cssTransform && cssTransform.toString() !== '') {
                        cssArray.push({
                            property: 'transform',
                            value: cssTransform
                        });
                    }
                }
            }

            //The if test for masterFXSwitch is correct. We want undefined to test as if it were true
            if (layerEffects && (layerEffects.masterFXSwitch !== false)) {
                if (layerEffects.dropShadow) {
                    if (layerEffects.dropShadow.some(function (currValue) { return currValue.enabled; })) {
                        CSSUtil.addCSS(cssArray, CSSUtil.getShadowCSS(properties.layerType, layerEffects.dropShadow));
                    }
                }
            }

            if (this.isMultipleLayerStylesCSSWarning()) {
                cssArray.push({
                    comment: deps.translate(Constants.LayerWarnings.MULTI_LAYER_STYLES_WARNING)
                });
            }

            //CSS Width doesn't calculate correctly if using inside or path borders.  Bug 1035. Subtract border, if appropriate
            if (shape && (shape.type === Constants.Shape.RECTANGLE || shape.type === Constants.Shape.ELLIPSE)) {
                if (shape.stroke && shape.stroke.strokeStyleLineAlignment) {
                    if (shape.stroke.strokeStyleLineAlignment) {
                        // Subtract twice the border thickness
                        bounds.right -= (parseInt(shape.stroke.strokeStyleLineWidth, 10) * 2);
                        bounds.bottom -= (parseInt(shape.stroke.strokeStyleLineWidth, 10) * 2);
                        //Call getMeasurements to recalc the display values
                        bounds = MeasurementUtil.getMeasurementsOfRectInsideRect(bounds, graphite.getDetailsController().getPSDModel().get('imgdata').bounds, false);
                    }
                }
            }

            // The width and height we have are those of the bounding box
            // *after* the transform has occurred. CSS applies the transform to
            // the given width and height. Hence outputting both leads to
            // incorrect results.
            //
            // The easiest fix is to not output width and height when a
            // transform is applied to the layer. We add a comment to explain.
            if (properties.get('transform')) {
                // The transform property is added elsewhere and differs between
                // text layers and others. Here we find the added property and
                // add the comment explaining the missing width and height
                for (var i = 0; i < cssArray.length; i++) {
                    if (cssArray[i].property === 'transform') {
                        cssArray[i].comment = deps.translate('width and height properties ommitted due to transform');
                        break;
                    }
                }
            } else {
                cssArray.push({
                    property: 'width',
                    value: bounds.displayWidth
                }, {
                    property: 'height',
                    value: bounds.displayHeight
                });
            }

            return cssArray;
        },

        isFontSubstitution: function () {
            if (this.fontSubstitution !== undefined) {
                return this.fontSubstitution;
            }

            var properties = this.get('properties'),
                i,
                textStyle,
                textRanges,
                decodedText,
                textFragment;

            if (properties.layerType === Constants.Type.LAYER_TEXT) {
                textRanges = properties.get('textStyleRange');
                decodedText = UTF8.decodeCharacters(properties.get('rawText'));
                if (textRanges && textRanges.length > 0) {
                    for (i = 0; i < textRanges.length; i++) {
                        textStyle = textRanges[i].textStyle;
                        textFragment = decodedText.substring(textRanges[i].from, textRanges[i].to);
                        if (!this.isWhitespace(textFragment)) {
                            if (!CSSUtil.getFontInfo(textStyle).coolTypeResolved) {
                                this.fontSubstitution = true;
                                break;
                            }
                        }
                    }
                }
            }
            this.fontSubstitution = this.fontSubstitution || false;
            return this.fontSubstitution;
        },


        isLinkedSmartObject: function () {
            var smartObjInfo = this.get('smartObjectInfo');
            return (smartObjInfo ? smartObjInfo.linked : false);
        },

        isMultipleLayerStylesCSSWarning: function() {
            var layerEffects = this.get('properties').get('layerEffects');

            if (layerEffects) {
                //The if test for masterFXSwitch is correct. We want undefined to test as if it were true
                if (layerEffects && (layerEffects.masterFXSwitch !== false)) {
                    if ((layerEffects.frameFX && layerEffects.frameFX.length > 1) ||
                        (layerEffects.gradientFill && layerEffects.gradientFill.length > 1) ||
                        (layerEffects.innerShadow && layerEffects.innerShadow.length > 1) ||
                        (layerEffects.solidFill && layerEffects.solidFill.length > 1)) {
                        //We can only properly handle multiples of dropShadow layer effects. If any other layer effect
                        //properties are multiples, give the user a warning.
                        return true;
                    }
                }
                if (layerEffects.solidFill[0] && layerEffects.solidFill[0].opacity !== 100) {
                    //The PSD has a transparent solid fill. We don't know the blended color, so we need to warn the user
                    return true;
                }
                if (layerEffects.gradientFill[0] && layerEffects.gradientFill[0].opacity !== 100) {
                    //The PSD has a transparent gradientFill. We don't know the blended color, so we need to warn the user
                    return true;
                }
            }

            return false;
        },

        isWhitespace: function (s) {
            s = s.replace(/\s/gm, '');
            return (!s || s.length === 0);
        },

        getCSSAsString: function (showVendorPrefixes, preprocessor) {
            var retCSSStr = '',
                cssProps = this.getCSSArray(preprocessor === 'css'),
                cssPropsLength = cssProps.length,
                i,
                aCSSProp;
            for (i = 0; i < cssPropsLength; i++) {
                aCSSProp = cssProps[i];
                if (aCSSProp.property || aCSSProp.value || aCSSProp.comment) {
                    retCSSStr += CSSUtil.formatCSSString(aCSSProp, preprocessor);
                    if (i !== (cssPropsLength - 1)) {
                        retCSSStr += '\r\n';
                    }
                }
            }
            return retCSSStr;
        },


        /* Ensure that all layerEffects properties are arrays. Older versions of the JSON (prior to 2+) would
           create these properties as a single value.
         */
        fixupLayerEffects: function () {
            var layerEffects = this.get('properties').get('layerEffects'),
                filterOutDisabledEffects = function(effect) {
                    return effect.enabled;
                };

            if (layerEffects) {
                //Make sure the multiple layer style array properties are actually arrays and remove all effects that
                //aren't enabled. This simplifies things in the rest of the code
                if(!layerEffects.frameFX){
                    layerEffects.frameFX = [];
                } else if (!Array.isArray(layerEffects.frameFX)) {
                    layerEffects.frameFX = [layerEffects.frameFX];
                }
                layerEffects.frameFX = layerEffects.frameFX.filter(filterOutDisabledEffects);

                if(!layerEffects.innerShadow){
                    layerEffects.innerShadow = [];
                } else if (!Array.isArray(layerEffects.innerShadow)) {
                    layerEffects.innerShadow = [layerEffects.innerShadow];
                }
                layerEffects.innerShadow = layerEffects.innerShadow.filter(filterOutDisabledEffects);
                
                if(!layerEffects.solidFill){
                    layerEffects.solidFill = [];
                } else if (!Array.isArray(layerEffects.solidFill)) {
                    layerEffects.solidFill = [layerEffects.solidFill];
                }
                layerEffects.solidFill = layerEffects.solidFill.filter(filterOutDisabledEffects);

                if(!layerEffects.gradientFill){
                    layerEffects.gradientFill = [];
                } else if (!Array.isArray(layerEffects.gradientFill)) {
                    layerEffects.gradientFill = [layerEffects.gradientFill];
                }
                layerEffects.gradientFill = layerEffects.gradientFill.filter(filterOutDisabledEffects);

                if(!layerEffects.dropShadow){
                    layerEffects.dropShadow = [];
                } else if (!Array.isArray(layerEffects.dropShadow)) {
                    layerEffects.dropShadow = [layerEffects.dropShadow];
                }
                layerEffects.dropShadow = layerEffects.dropShadow.filter(filterOutDisabledEffects);
            }

        },

        getUsageModels: function () {
            var usageModels = this.get('usageModels'), // if I enable the cache, its a global cache for some reason...
                properties,
                sublayers,
                sublayer,
                subStyleUsageModels,
                i,
                self = this,
                resetLayers = function(usage) {
                    usage.get('layers').length = 0;
                    usage.get('layers').push(self);
                };


            if (!usageModels) {
                usageModels = { colorUsageModels: [], gradientUsageModels: [], textStyleUsageModels: [] };
                properties = this.get('properties');
                sublayers = this.get('layerCollection');

                if (properties) {
                    this.fixupLayerEffects();
                    this.addColorStyles(usageModels.colorUsageModels, properties.getColors()); // add all styles for this specific layer
                    this.addGradientStyles(usageModels.gradientUsageModels, properties.getGradients()); // add all styles for this specific layer
                    this.addTextStyles(usageModels.textStyleUsageModels, properties.getTextStyles()); // add all styles for this specific layer
                }

                if (sublayers) {
                    for (i = 0; i < sublayers.length; i++) {
                        sublayer = sublayers.at(i);
                        subStyleUsageModels = sublayer.getUsageModels();
                    }
                }

                sublayers = this.get('smartObjectLayers');
                if (sublayers) {
                    for (i = 0; i < sublayers.length; i++) {
                        sublayer = sublayers.at(i);
                        subStyleUsageModels = sublayer.getUsageModels();
                        _.each(subStyleUsageModels.colorUsageModels, resetLayers);
                        _.each(subStyleUsageModels.gradientUsageModels, resetLayers);
                        _.each(subStyleUsageModels.textStyleUsageModels, resetLayers);
                    }
                }

                this.set('usageModels', usageModels);
            }
            return {
                colorUsageModels: usageModels.colorUsageModels,
                gradientUsageModels: usageModels.gradientUsageModels,
                textStyleUsageModels: usageModels.textStyleUsageModels
            };
        },

        addColorStyles: function (usageModelsArray, colorsArray) {
            var usageModel = null,
                color,
                colorStyle;

            // store colors for this layer
            this.set('colors', colorsArray);

            for (var i = 0; i < colorsArray.length; i++) {
                color = colorsArray[i];
                colorStyle = color.toHEXString(); //Don't send the alpha for the style string
                usageModel = UsageModelMap.getUsageModelForStyle(colorStyle);
                if (usageModel) {
                    usageModel.addUsage(this, color); //Pass in the color because it may contain new alphas
                }
                else {
                    usageModel = new ColorUsageModel({style: color});
                    usageModel.addUsage(this, color);
                    UsageModelMap.addUsageModelToMap(colorStyle, usageModel);
                }
                if (!_.contains(usageModelsArray, usageModel)) {
                    usageModelsArray.push(usageModel);
                }
            }
        },

        addGradientStyles: function (usageModelsArray, gradientsArray) {
            var usageModel = null,
                gradient,
                gradientStyle;

            for (var i = 0; i < gradientsArray.length; i++) {
                gradient = gradientsArray[i];
                gradientStyle = gradient.toString();
                usageModel = UsageModelMap.getUsageModelForStyle(gradientStyle);
                if (usageModel) {
                    usageModel.addUsage(this);
                }
                else {
                    usageModel = new GradientUsageModel({style: gradient});
                    usageModel.addUsage(this);
                    UsageModelMap.addUsageModelToMap(gradientStyle, usageModel);
                }
                if (!_.contains(usageModelsArray, usageModel)) {
                    usageModelsArray.push(usageModel);
                }
            }
        },

        addTextStyles: function (usageModelsArray, textStylesArray) {
            var usageModel = null,
                textStyle,
                textStyleId;

            for (var i = 0; i < textStylesArray.length; i++) {
                textStyle = textStylesArray[i];
                textStyleId = textStyle.toString();
                usageModel = UsageModelMap.getUsageModelForStyle(textStyleId);
                if (usageModel) {
                    usageModel.addUsage(this);
                }
                else {
                    usageModel = new TextStyleUsageModel({style: textStyle});
                    usageModel.addUsage(this);
                    UsageModelMap.addUsageModelToMap(textStyleId, usageModel);
                }
                if (!_.contains(usageModelsArray, usageModel)) {
                    usageModelsArray.push(usageModel);
                }
            }
        },

        isEqual: function (layerModel) {
            return this.get('layerId') === layerModel.get('layerId');
        },

        zeroBounds: function () {
            var bounds = this.get('bounds');
            return bounds.top === 0 && bounds.bottom === 0 && bounds.left === 0 && bounds.right === 0;
        },

        zeroRawBounds: function () {
            var rawBounds = this.get('rawBounds');
            return !rawBounds || (rawBounds.top === 0 && rawBounds.bottom === 0 && rawBounds.left === 0 && rawBounds.right === 0);
        },

        isDescendantOf: function (model) {
            var parentModel = this.get('parentModel'),
                result = false;
            while (parentModel && parentModel instanceof LayerModel) {
                if (parentModel.isEqual(model)) {
                    result = true;
                    break;
                }
                parentModel = parentModel.get('parentModel');
            }
            return result;
        },

        /**
         * Returns true if this layer and all ancestor layers visible
         * property matches their renderedVisible property, meaning, the
         * layer matches the visibility it had at the time it was rendered
         * by any associated flattened sprites.
         */
        isEffectiveRenderedVisibility: function () {
            return this.get('renderedVisible') === this.getEffectiveVisibility();
        },

        /**
         * Returns true if the layer and all ancestor layer sets are visible.
         */
        getEffectiveVisibility: function () {
            var isVisible = this.isVisibleOnStage(),
                parentModel = this.get('parentModel'),
                children = this.get('layerCollection'),
                child,
                i;
            if (isVisible && parentModel && parentModel instanceof LayerModel) {
                isVisible = parentModel.getEffectiveVisibility();
            }

            // Layer groups are considered effectively invisible if none of its
            // children are visible.
            if (isVisible && children) {
                isVisible = false;
                for (i = 0; i < children.length; i++) {
                    child = children.at(i);
                    if (child.get('visible')) {
                        isVisible = true;
                        break;
                    }
                }
            }

            return isVisible;
        },

        /*
         * Returns the opacity of the object combined with the opacity of any parents.  If any element
         * is invisible the effective opacity is 0
         */
        getEffectiveOpacity: function () {
            var opacity = this.isVisibleOnStage() ? this.getCombinedOpacity() : 0,
                parentModel = this.get('parentModel'),
                children = this.get('layerCollection'),
                child,
                i;
            if (opacity !== 0 && parentModel && parentModel instanceof LayerModel) {
                opacity = opacity * parentModel.getEffectiveOpacity();
            }

            // Layer groups are considered effectively invisible if none of its
            // children are visible.
            if (opacity > 0 && children) {
                var isVisible = false;
                for (i = 0; i < children.length; i++) {
                    child = children.at(i);
                    if (child.get('visible')) {
                        isVisible = true;
                        break;
                    }
                }
                if (!isVisible) {
                    opacity = 0;
                }
            }

            return opacity;
        },

        findDescendantFlattenedSprites: function () {
            var flattenedLayers = LayerModelMap.getFlattenedLayers(),
                results = [],
                self = this;
            _.each(flattenedLayers, function (layer) {
                if (layer.isDescendantOf(self)) {
                    results.push(layer);
                }
            });
            return results;
        },

        isVisibleOnStage: function () {
            var visible = this.get('visible'),
                clipbase = this.get('clipbase'),
                baseVisible = clipbase ? clipbase.get('visible') : true;

            return visible && baseVisible;
        },

        //Returns true if the layer and all of its parents are visible. False otherwise
        isLayerShown: function() {
            var currLayer = this,
                result = true;

            while (result && (currLayer instanceof LayerModel)) {
                result = currLayer.get('visible');
                currLayer = currLayer.get('parentModel');
            }
            return result;
        },

        getCombinedOpacity: function () {
            var blendOptions = this.get('properties') && this.get('properties').get('blendOptions');
            if (blendOptions) {
                var opacity = (blendOptions.opacity || 100) / 100,
                    fillOpacity = (blendOptions.fillOpacity || 100) / 100;
                return opacity * fillOpacity;
            } else {
                return 1;
            }
        },

        canBeExtracted: function () {
            // a layer can be extracted if it is not an adjustment layer and it is visible
            // a layerSet can be extracted if it is visible and contains a layer that can be extracted
            if (this.getEffectiveVisibility()) {
                if ((this.get('type') === Constants.Type.LAYER_GROUP) || (this.get('type') === Constants.Type.LAYER_ARTBOARD)) {
                    var models = this.get('layerCollection') ? this.get('layerCollection').models : [];
                    return _.some(models, function (value, index) { return value.canBeExtracted(); });
                } else {
                    return (this.get('type') !== Constants.Type.LAYER_ADJUSTMENT);
                }
            }
            return false;
        }
    });

    return LayerModel;
});
