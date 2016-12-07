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
/*global define: true, graphite: true, unescape: true, localStorage: true, window: true, navigator: true*/

define([
    'underscore',
    '../models/PSDSettingsModel',
    '../models/UserSettingsModel',
    '../Constants'

], function (_, PSDSettingsModel, UserSettingsModel, Constants) {
    'use strict';
    var MeasurementUtil = {

        calcLayerGroupBounds: function (layerList, PSDModel) {
            var bounds,
                groupBounds,
                i;
            if (!layerList || layerList.length < 1) {
                return;
            }

            bounds = this.getVisibleBounds(layerList[0], PSDModel);
            groupBounds = {top: bounds.top, left: bounds.left, bottom: bounds.bottom, right: bounds.right};
            for (i = 1; i < layerList.length; i++) {
                bounds = this.getVisibleBounds(layerList[i], PSDModel);
                groupBounds.top = Math.min(groupBounds.top, bounds.top);
                groupBounds.left = Math.min(groupBounds.left, bounds.left);
                groupBounds.bottom = Math.max(groupBounds.bottom, bounds.bottom);
                groupBounds.right = Math.max(groupBounds.right, bounds.right);
            }
            return groupBounds;
        },

        boundsIntersect: function (bounds1, bounds2) {
            return bounds1.left < bounds2.right && bounds1.right > bounds2.left &&
                   bounds1.top < bounds2.bottom && bounds1.bottom > bounds2.top;
        },

        getVisibleBounds: function (layerModel, PSDModel, boundsOnly) {
            var layerBounds,
                imageBounds = PSDModel.get('imgdata').bounds,
                artboardParent = layerModel.getArtboardParent(),
                artboardParentBounds = artboardParent ? artboardParent.get('bounds') : {top: 0, left: 0, bottom: imageBounds.bottom, right: imageBounds.right},
                designedAtMultiplier = PSDSettingsModel.get('designedAtMultiplier'),
                result;

            // Prefer rawBounds unless specified otherwise, to ignore any drop
            // shadow or other layer effects.
            layerBounds = layerModel.zeroRawBounds() || boundsOnly ?
                layerModel.get('bounds') : layerModel.get('rawBounds');

            //Limit the bounds to the PSD. Also limit to the artboard bounds if this layer has a parent that is an artboard.
            result = {top: Math.max(0, layerBounds.top, artboardParentBounds.top),
                left: Math.max(0, layerBounds.left, artboardParentBounds.left),
                bottom: Math.min(imageBounds.bottom, layerBounds.bottom, artboardParentBounds.bottom),
                right: Math.min(imageBounds.right, layerBounds.right, artboardParentBounds.right)};

            result.width = result.right - result.left;
            result.height = result.bottom - result.top;

            //Calc the "Designed At" values. Put them in new variables so we don't get placement and display values confused.
            result.displayLeft = Math.round(result.left/designedAtMultiplier);
            result.displayRight = Math.round(result.right/designedAtMultiplier);
            result.displayTop = Math.round(result.top/designedAtMultiplier);
            result.displayBottom = Math.round(result.bottom/designedAtMultiplier);

            return result;
        },

        layer1ContainsLayer2: function (layer1, layer2) {
            var PSDModel = graphite.getDetailsController().getPSDModel(),
                rect1 = this.getVisibleBounds(layer1, PSDModel),
                rect2 = this.getVisibleBounds(layer2, PSDModel);

            return this.rect1ContainsRect2(rect1, rect2);
        },

        getMeasurementsOfLayerAgainstPSDBounds: function (layerModel) {
            var layerBounds = this.getVisibleBounds(layerModel, graphite.getDetailsController().getPSDModel());

            if (layerModel.getArtboardParent()) {
                return this.getMeasurementsOfRectInsideRect(layerBounds, layerModel.getArtboardParent().get('bounds'), true);
            } else {
                return this.getMeasurementsOfRectAgainstPSDBounds(layerBounds);
            }
        },

        getMeasurementsOfRectAgainstPSDBounds: function (rect) {
            var psdBounds = graphite.getDetailsController().getPSDModel().get('imgdata').bounds;

            return this.getMeasurementsOfRectInsideRect(rect, psdBounds, false);
        },

        getMeasurementsOfRectInsideRect: function (innerRect, outerRect, outerRectIsArtboard) {
            var result = _.clone(innerRect),
                preferredUnits = UserSettingsModel.get('preferredMeasurementUnits'),
                designedAtMultiplier = PSDSettingsModel.get('designedAtMultiplier');

            if (outerRectIsArtboard) {
                //Child layers of artboards should report their positions relative to the artboard parent layer.
                result.displayLeft = result.left - outerRect.left;
                result.displayTop = result.top - outerRect.top;
            }

            result.width = result.right - result.left;
            result.height = result.bottom - result.top;

            outerRect.width = outerRect.right - outerRect.left;
            outerRect.height = outerRect.bottom - outerRect.top;

            result.percentWidth = +(result.width / outerRect.width * 100).toFixed(1);
            result.displayWidth = (preferredUnits === Constants.MeasurementUnitType.PX ? Math.round(result.width/designedAtMultiplier) : result.percentWidth) +  preferredUnits;

            result.percentHeight = +(result.height / outerRect.height * 100).toFixed(1);
            result.displayHeight = (preferredUnits === Constants.MeasurementUnitType.PX ? Math.round(result.height/designedAtMultiplier) : result.percentHeight) +  preferredUnits;

            return result;
        },

        setLayerBounds: function (childElem, isFlattened, currentModel, parentModel, SelectionController) {
            var bounds = currentModel.get('bounds'),
                psdModelBounds = graphite.getDetailsController().getPSDModel().get('imgdata').bounds,
                parentBounds = parentModel ? parentModel.get('bounds') : null,
                flattenedSprite;

            if (!parentBounds) {
                parentBounds = {top: 0, left: 0};
            }

            var top = bounds.top,
                left = bounds.left,
                right = bounds.right,
                bottom = bounds.bottom,
                parentLeft = parentBounds.left,
                parentTop = parentBounds.top;

            if (isFlattened) {
                flattenedSprite = currentModel.get('flattenedSprite');
                left = flattenedSprite.psdOrigin.left;
                top = flattenedSprite.psdOrigin.top;
                right = left + (flattenedSprite.bounds.right - flattenedSprite.bounds.left);
                bottom = top + (flattenedSprite.bounds.bottom - flattenedSprite.bounds.top);
            }

            if (SelectionController.clipLayersToImage) {
                top = Math.max(0, top);
                left = Math.max(0, left);
                right = Math.min(psdModelBounds.right, right);
                bottom = Math.min(psdModelBounds.bottom, bottom);
                parentLeft = Math.max(0, parentLeft);
                parentTop = Math.max(0, parentTop);
            }

            childElem.css('top', top - parentTop);
            childElem.css('left', left - parentLeft);

            if (((currentModel.get('type') === Constants.Type.LAYER_GROUP) || (currentModel.get('type') === Constants.Type.LAYER_ARTBOARD)) && !isFlattened) {
                childElem.css('width', right - left + 'px');
                childElem.css('height', bottom - top + 'px');
            } else {
                if (right - left < 0 || bottom - top < 0) {
                    childElem[0].width = 0;
                    childElem[0].height = 0;
                } else {
                    childElem[0].width = right - left;
                    childElem[0].height = bottom - top;
                }
            }

            return {top: top, left: left, bottom: bottom, right: right};
        },

        rect1ContainsRect2: function (rect1, rect2) {
            return ((rect1.left <= rect2.left) && (rect1.top <= rect2.top) && (rect1.right >= rect2.right) && (rect1.bottom >= rect2.bottom));
        },
        
        getClippedBounds: function (bounds, psdModel) {
            return {
                left: Math.max(bounds.left, 0),
                top: Math.max(bounds.top, 0),
                right: Math.min(psdModel.get('width'), bounds.right),
                bottom: Math.min(psdModel.get('height'), bounds.bottom)
            };
        }

    };

    return MeasurementUtil;
});
