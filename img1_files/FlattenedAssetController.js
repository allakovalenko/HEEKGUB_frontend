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
    '../Constants',
    './SelectionController',
    '../models/LayerModelMap',
    '../models/LayerModel',
    '../utils/MeasurementUtil'
], function ($, _, Constants, SelectionController, LayerModelMap, LayerModel, MeasurementUtil) {

    'use strict';

    var FlattenedAssetController = {
        activeRequests: {},
        requestDelay: 1000,
        cachedImages: {},

        /**
         * Used to invalidate a pre-existing flattened sprite. We
         * request another that matches the current visibility state
         * of the flattenedSprite model's 'included layers'.
         * @param model
         */
        invalidateSprite: function (model) {
            var psdModelID = SelectionController.getPSDModel().id,
                layerCompId = SelectionController.getPSDModel().get('layerCompId'),
                spriteInfo = this.deriveSpriteInfo(model, psdModelID),
                refreshRequest,
                cachedImage = this.cachedImages[spriteInfo.key()],
                self = this;

            if (!cachedImage && this.isOriginalPSDVisibility(model)) {
                // For initial state obtain sprite from our DetailsController
                cachedImage = {
                    image: graphite.getDetailsController().spriteSheets[model.get('flattenedSprite').sheetID],
                    bounds: model.get('flattenedSprite').bounds
                };
                this.cachedImages[spriteInfo.key()] = cachedImage;
            }

            if (spriteInfo.visibleLayers && spriteInfo.visibleLayers.length === 0) {
                this.replaceFlattenedSprite(model, null);
            } else if (cachedImage && cachedImage.image.complete) {
                this.replaceFlattenedSprite(model, cachedImage.image, cachedImage.bounds);
            } else {
                refreshRequest = {};
                refreshRequest.model = model;
                refreshRequest.psdModelID = psdModelID;
                refreshRequest.layerCompId = layerCompId;
                refreshRequest.info = spriteInfo;
                refreshRequest.delayTimer = setTimeout(function () {
                    self.activateRequest(refreshRequest);
                }, this.requestDelay);
                this.queueRequest(refreshRequest);
            }
        },

        /**
         * Used to denote that a flattened sprite model is in sync
         * with its included layer visibility.
         * @param model
         */
        validateSprite: function (model) {
            this.cancelRequest(model);
        },

        /**
         * Once our lazy-load timeout has expired, fire off
         * the actual image request.
         * @param request
         */
        activateRequest: function (request) {
            var self = this,
                imageLoaded = function () {
                    self.imageLoaded(request);
                },
                imageError = function (result) {
                    self.imageError(request);
                };

            request.image = graphite.getServerAPI().getDerivedSpriteImage(SelectionController.getPSDModel(), request.info.visibleLayers, imageLoaded, imageError);
            request.delayTimer = null;
        },

        /**
         * Invoked when replacement sprite sheet has been received.
         * @param request
         */
        imageLoaded: function (request) {
            // Only service if still relevant to our loaded document
            // and request wasn't cancelled.
            var activeRequest = this.activeRequests[request.model.get('layerId')],
                bounds = {top: 0, left: 0, right: request.image.width, bottom: request.image.height};

            // Cache successful request.
            this.cachedImages[request.info.key()] = { image: request.image, bounds: bounds };

            if (activeRequest && activeRequest.info.key() === request.info.key() &&
                    request.psdModelID === SelectionController.getPSDModel().id) {
                this.replaceFlattenedSprite(request.model, request.image, bounds);
                this.cancelRequest(request.model);
            }
        },

        /**
         * Invoked when replacement sprite sheet had load error.
         * We'll just use blank/empty sprite.
         * @param request
         */
        imageError: function (request) {
            // Only service if still relevant to our loaded document
            // and request wasn't cancelled.
            if (this.activeRequests[request.model.get('layerId')] &&
                    request.psdModelID === SelectionController.getPSDModel().id) {
                this.replaceFlattenedSprite(request.model, null);
            }
            this.cancelRequest(request.model);
        },

        /**
         * Performs the actual replacement of a flattened sprite rendition
         * Updates the associated layers and dispatches notification of
         * completion.
         * @param model
         * @param image
         * @param optional imageBounds
         */
        replaceFlattenedSprite: function (model, image, imageBounds) {
            var elemId = 'flattenedLayer' + model.get('layerId'),
                $spriteElem = $('#' + elemId),
                flattenedSprite = model.get('flattenedSprite'),
                curLayerModel,
                curBounds,
                layerBounds,
                layerVisible,
                adjustmentLayer,
                context,
                PSDModel = SelectionController.getPSDModel(),
                psdBounds = PSDModel.get('imgdata').bounds;

            if ($spriteElem.length) {
                context = $spriteElem[0].getContext('2d');
                context.clearRect(0, 0, $spriteElem.width(), $spriteElem.height());

                // Replace rendition of our previous flattened sprite.
                if (image) {
                    $spriteElem[0].width = imageBounds.right - imageBounds.left;
                    $spriteElem[0].height = imageBounds.bottom - imageBounds.top;
                    context.drawImage(image, imageBounds.left, imageBounds.top, $spriteElem[0].width, $spriteElem[0].height,
                        0, 0, $spriteElem[0].width, $spriteElem[0].height);
                }

                // Capture the current set of visibility matching the
                // new rendition, also gather up cumulative bounds for the new
                // set of visible items so we can adjust our flattened sprite
                // element position.
                layerVisible = model.getEffectiveVisibility();
                adjustmentLayer = model.get('type') === Constants.Type.LAYER_ADJUSTMENT;
                model.set('renderedVisible', layerVisible);
                layerBounds = MeasurementUtil.getVisibleBounds(model, PSDModel);
                curBounds = {
                    top: layerVisible && !adjustmentLayer ? layerBounds.top : psdBounds.bottom,
                    left: layerVisible && !adjustmentLayer ? layerBounds.left : psdBounds.right
                };

                _.each(flattenedSprite.includedLayers, function (layerId) {
                    curLayerModel = LayerModelMap.getLayerModelFromId(layerId);
                    layerVisible = curLayerModel.getEffectiveVisibility();
                    adjustmentLayer = curLayerModel.get('type') === Constants.Type.LAYER_ADJUSTMENT;
                    layerBounds = MeasurementUtil.getVisibleBounds(curLayerModel, PSDModel);
                    curLayerModel.set('renderedVisible', layerVisible);
                    if (layerVisible && !adjustmentLayer) {
                        curBounds.left = Math.min(curBounds.left, layerBounds.left);
                        curBounds.top = Math.min(curBounds.top, layerBounds.top);
                    }
                });

                if (SelectionController.clipLayersToImage) {
                    curBounds.top = Math.max(0, curBounds.top);
                    curBounds.left = Math.max(0, curBounds.left);
                }

                // Find nearest visible parent div and place
                // the validated sprite element in its proper
                // location.
                this.applyParentAndPosition(model, curBounds, $spriteElem, flattenedSprite);

                // Notify so that the new flattened sprite can be leveraged.
                graphite.events.trigger('flattenedSpriteUpdated', model);
            }
        },

        /**
         * The div representing the layer set our flattened sprite belongs to
         * may be hidden so we must hoist our flattened sprite element to a visible
         * parent.  Position in DOM is recomputed each time a flattened sprite is
         * validated.
         * @param model
         * @param $spriteElem
         * @returns parent model;
         */
        placeSprite: function (model, $spriteElem) {
            var candidate = model.get('parentModel'),
                layerChildren,
                parentModel,
                lastFlattenedChild,
                $adjacentElem,
                $parentElem,
                layer,
                i;

            // Start at our layer model and walk up to find our nearest
            // visible parent.
            while (candidate && candidate instanceof LayerModel && candidate.getEffectiveOpacity() != 1) {
                candidate = candidate.get('parentModel');
            }

            if (candidate) {
                // Determine sibling to insert next to.
                layerChildren = candidate.get('layerCollection');
                for (i = 0; i < layerChildren.length; i++) {
                    layer = layerChildren.at(i);
                    if (layer.get('flattenedParent') === model.get('layerId')) {
                        lastFlattenedChild = layer;
                    }
                }
                if (lastFlattenedChild) {
                    $adjacentElem = $('#layer' + lastFlattenedChild.get('layerId'));
                }

                // Assign pending parent element.
                if (candidate instanceof LayerModel) {
                    // Append to the candidate.
                    $parentElem = $('#layer' + candidate.get('layerId'));
                    parentModel = candidate;
                } else {
                    // Append to root of layer tree.
                    $parentElem = $('#psdpreview_root');
                }

                // Insert in new location as appropriate.
                if ($parentElem) {
                    if ($adjacentElem) {
                        $adjacentElem.before($spriteElem);
                    } else {
                        $parentElem.prepend($spriteElem);
                    }
                }
            }

            return parentModel;
        },

        /**
         * Places our flattened sprite with a new visible
         * parent and updates the CSS position accordingly.
         * @param model
         * @param $spriteElem
         * @returns parent model
         */
        applyParentAndPosition: function (model, curBounds, $spriteElem, flattenedSprite) {
            //Get the actual bounds of the parent so that flattenedSprite is placed correctly within
            var parentModel = this.placeSprite(model, $spriteElem),
                parentBounds = parentModel ? parentModel.get('bounds') : null;

            if (!parentBounds) {
                parentBounds = {top: 0, left: 0};
            }

            // Provide alternate psdOrigin
            if (flattenedSprite) {
                flattenedSprite.altPsdOrigin = _.clone(curBounds);
            }

            var top = curBounds.top,
                left = curBounds.left,
                parentLeft = parentBounds.left,
                parentTop = parentBounds.top;

            //Parent's bounds may be clipped when placed, so we must do so again for correct bounds
            if (SelectionController.clipLayersToImage) {
                top = Math.max(0, top);
                left = Math.max(0, left);
                parentLeft = Math.max(0, parentLeft);
                parentTop = Math.max(0, parentTop);
            }

            // Update sprite element position
            $spriteElem.css({
                left: curBounds.left - parentLeft + 'px',
                top: curBounds.top - parentTop + 'px'
            });
        },

        /**
         * Denote actively outstanding refresh request.
         * @param request
         */
        queueRequest: function (request) {
            var model = request.model,
                id = request.model.get('layerId');

            this.cancelRequest(model);
            this.activeRequests[id] = request;
            $('.spinner').show();
        },

        /**
         * Cancels outstanding refresh request.
         * @param request
         */
        cancelRequest: function (model) {
            var id = model.get('layerId'),
                request = this.activeRequests[id];
            if (request) {
                clearTimeout(request.delayTimer);
                delete this.activeRequests[id];
            }
            if (Object.keys(this.activeRequests).length === 0) {
                $('.spinner').hide();
            }
        },

        /**
         * Helper that returns true if a flattened sprite and its
         * members match their original psd visibility.
         * @param model
         */
        isOriginalPSDVisibility: function (model) {
            var visibility = model.getEffectiveVisibility(),
                result = visibility === model.get('psdVisible'),
                flattenedSprite = model.get('flattenedSprite'),
                curLayerModel;
            if (result) {
                _.each(flattenedSprite.includedLayers, function (layerId) {
                    curLayerModel = LayerModelMap.getLayerModelFromId(layerId);
                    visibility = curLayerModel.getEffectiveVisibility();
                    if (visibility !== curLayerModel.get('psdVisible')) {
                        result = false;
                    }
                });
            }
            return result;
        },

        /**
         * Construct URL required to obtain our new flattened sprite
         * instance.
         * @param request
         */
        deriveSpriteInfo: function (model, psdModelID) {
            var flattenedSprite = model.get('flattenedSprite'),
                visibleLayers = [],
                spriteInfo = {
                    psdId: psdModelID,
                    visibleLayers: [],
                    key: function () {
                        return psdModelID + ',' + this.visibleLayers.join(',');
                    }
                },
                curLayerModel;

            if (model.getEffectiveVisibility()) {
                visibleLayers.push(model);
            }

            _.each(flattenedSprite.includedLayers, function (layerId) {
                curLayerModel = LayerModelMap.getLayerModelFromId(layerId);
                if (curLayerModel.getEffectiveVisibility()) {
                    visibleLayers.push(curLayerModel);
                }
            });

            visibleLayers = SelectionController.expandSelection(visibleLayers);

            spriteInfo.visibleLayers = _.unique(_.map(visibleLayers, function (layer) {
                return layer.get('layerId');
            }));

            return spriteInfo;
        },

        reset: function () {
            this.activeRequests = {};
            this.cachedImages = {};
        }
    };

    return FlattenedAssetController;
});
