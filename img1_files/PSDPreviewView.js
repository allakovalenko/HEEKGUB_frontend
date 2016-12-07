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
    '../../controllers/SelectionController',
    '../../controllers/ZoomController',
    '../../controllers/FlattenedAssetController',
    '../../models/LayerModelMap',
    '../../utils/KeyboardUtils',
    '../../utils/ScrollUtils',
    '../preview/InspectStyleOverlayView',
    '../preview/SelectionOverlayView',
    '../preview/MouseListenerOverlayView',
    '../preview/ArtboardOverlayView',
    '../preview/PopupOverlayView',
    '../../utils/MeasurementUtil',
    '../../utils/TemplateUtil',
    'text!../templates/lensTemplate.html',
    'text!../templates/workerProgressTemplate.html',
    'text!../templates/psdPreviewTemplate.html',
    'text!../templates/psdPreviewDivSpriteSheetTemplate.html',
    'text!../templates/psdPreviewLayerTemplate.html',
    'text!../templates/errorNotificationTemplate.html',
    'plugin-dependencies',
    'plugin-components/image-loader'
], function ($, _, Backbone, Constants, SelectionController,
    ZoomController, FlattenedAssetController, LayerModelMap, KeyboardUtils, ScrollUtils,
    InspectStyleOverlayView, SelectionOverlayView, MouseListenerOverlayView, ArtboardOverlayView,
    PopupOverlayView, MeasurementUtil, TemplateUtil, LensTemplate, WorkerProgressTemplate, PSDPreviewTemplate,
    PSDPreviewDivSpriteSheetTemplate, PSDPreviewLayerTemplate, ErrorNotificationTemplate,
    deps, imageLoader) {
    'use strict';
    var PSDPreviewView = Backbone.View.extend({
        className: 'psd-preview-view',
        events: {
            'click': 'handleClickEvent',
            'mousedown': 'handleMouseDownEvent',
            'mouseup': 'handleMouseUpEvent',
            'dblclick': 'handleDoubleClickEvent'
        },

        isClickDrag: false,
        extractionStartTime: null,
        selectionOverlay: null,
        inspectStyleOverlay: null,
        mouseListenerOverlay: null,
        artboardOverlay: null,
        popupOverlay: null,
        extractTooltip: null,
        tempPreviewHidden: false,

        initialize: function () {
            _.bindAll(this, 'hideTempPreview', 'attached', '_previewImageDataReceived');

            this.addHandlers();
            this.renderProgressPane();

            this.$defocused = $('<div class="defocused"></div>');

            this.model.on('change:info', this.handleModelInfoChanged, this);
            this.model.on('change:extractedStyles', this.handleExtractedStylesChanged, this);
            this.model.on('change:status', this.handleStatusChanged, this);

            this.handleStatusChanged();
        },

        render: function () {
            this.renderContainer();

            this.inspectStyleOverlay = new InspectStyleOverlayView({model: this.model});
            this.selectionOverlay = new SelectionOverlayView({parentView: this});
            this.mouseListenerOverlay = new MouseListenerOverlayView({model: this.model});
            this.mouseListenerOverlay.previewView = this;
            this.artboardOverlay = new ArtboardOverlayView({model: this.model});
            this.popupOverlay = new PopupOverlayView({model: this.model});
            this.$psdLens = TemplateUtil.createTemplate(LensTemplate);

            this.$el.find('.preview-container').append(this.mouseListenerOverlay.el);
            this.$el.find('.preview-container').append(this.artboardOverlay.el);
            this.$el.find('.preview-container').append(this.inspectStyleOverlay.el);
            this.$el.find('.preview-container').append(this.popupOverlay.el);

            this.mouseListenerOverlay.addHandlers();

            return this;
        },

        // Post DOM initialization
        attached: function () {
            // Only bootstrap component parts if we haven't already.
            if (!this.mouseListenerOverlay) {
                if (this.model.get('info')) {
                    this.handleModelInfoChanged();
                } else {
                    // Render our place holder early if we have the requisite bounds while
                    // we await our model info. For now we fake image bounds until the real
                    // data arrives.
                    if (this.model.get('width') && this.model.get('height')) {
                        var bounds = this.model.get('imgdata').bounds;
                        this.renderContainer();
                        bounds.bottom = this.model.get('height');
                        bounds.right = this.model.get('width');
                        graphite.events.trigger('zoomToFit', bounds);
                        this.applyCurrentZoomLevel(true);
                    }
                }
                if (this.model.get('extractedStyles')) {
                    this.handleExtractedStylesChanged();
                }
            }
        },

        handleStatusChanged: function () {
            var status = this.model.get('status');
            if (status < 200) {
                // new/pending
                this.renderSpinner();
            } else if (status >= 400) {
                // normally, it goes away after spritesheet load. But in case of error we have to do it
                this.$el.find('.preview-loading-spinner').remove();
            }
        },

        handleModelInfoChanged: function () {
            graphite.events.trigger('psdModelInfoChanged');
            this.render();
        },

        handleExtractedStylesChanged: function () {
            $('.preview-loading-spinner').remove();
            if (this.model.get('dataType') !== 'complete') {
                this.populateLayerModelMap(this.model);
                graphite.getDetailsController().triggerSpriteSheetLoadedEvent('JSONPreviewReady');
                return;
            }

            this.addLayerSpritesBackToFront(this.model);
            this.model.set('renderedSprites', true);
            graphite.getDetailsController().triggerWhenSpriteSheetsLoaded('drawPreviewFinish');
        },

        renderSpinner: function () {
            this.$el.append('<div class="spinner preview-loading-spinner" style="display:block;"></div>');
        },

        renderProgressPane: function () {
            var tips = [
                deps.translate('Use shift-click to measure the distance between elements in the PSD view.'),
                deps.translate('After extracting assets, find them in the Assets tab where they can be downloaded locally.'),
                deps.translate('Select a color swatch in the Styles tab to see where the color is used in your design.'),
                deps.translate('You can select multiple layers in the Layers tab and export them as a single image.'),
                deps.translate('Select layer comps with the drop down above the PSD view.'),
                deps.translate('Zoom in and out on your PSD view using ALT +/-.'),
                deps.translate('Use the arrow keys to traverse the layers in your design.'),
                deps.translate('Hover over thumbnails in the Layers tab to see a preview for a layer or layer group.')
            ];

            this.$progressPane = TemplateUtil.createTemplate(WorkerProgressTemplate,
                {tip: deps.translate('Tip: ') + tips[Math.round(Math.random() * (tips.length - 1))]});
            this.$progressPane.hide();
            this.$el.append(this.$progressPane);
        },

        renderContainer: function () {
            if (this.$el.find('.preview-container').length === 0) {
                this.$el.append(TemplateUtil.createTemplate(PSDPreviewTemplate,
                    _.defaults(this.model.toJSON(), {width: 0, height: 0})));
                this.$tempPreview = this.$el.find('#tempPreview');
                this._loadPreviewImage();
            } else {
                var $previewRoot = this.$el.find('#psdpreview_root'),
                    $preview = this.$el.find('#tempPreview'),
                    $centerHelper = this.$el.find(".center-helper"),
                    bounds = this.model.get('imgdata').bounds,
                    css = {width: bounds.right, height: bounds.bottom};

                $previewRoot.css(css);
                $preview.css(css);
                // This calculation matches the one in the template
                $centerHelper.css('margin-bottom', -(bounds.bottom/2 + 50) + "px");
                ZoomController.zoomElementScale($previewRoot);
                ZoomController.zoomElementScale($preview);
            }
            this.$el.removeClass('preview-rendered');
        },

        showProgressPane: function (workerGuid) {
            if (!this.workerProgressShown) {
                this.$el.addClass('worker-progress-shown');
                $('.worker-status').text(deps.translate('Processing') + ' 0%...');
                $('.worker-progress-bar').css('width', 0);
                this.$progressPane.show();
                this.workerProgressShown = true;
            }
            this.workerGuid = workerGuid;
        },

        hideProgressPane: function (workerGuid) {
            if (workerGuid === -1 || this.workerGuid === workerGuid) {
                this.$el.find('.preview-loading-spinner').remove();
                this.$el.removeClass('worker-progress-shown');
                $('.worker-status').text(deps.translate('Processing') + ' 100%');
                $('.worker-progress-bar').width('100%');
                this.$progressPane.fadeOut(300);
                this.workerProgressShown = false;
                this.workerGuid = null;
            }
        },

        updateProgressPane: function (workerGuid, status, progress) {
            var msg,
                complete;

            if (!this.workerProgressShown && workerGuid === this.model.get('id')) {
                this.showProgressPane(workerGuid);
            }

            if (this.workerGuid === workerGuid) {
                if (status === 'queued') {
                    msg = deps.translate('Job queued...');
                    $('.worker-progress-bar').width(0);
                } else {
                    complete = (!isNaN(progress) ? Math.round(progress) : 0) + '%';
                    msg = deps.translate('Processing') + ' ' + complete + '...';
                    $('.worker-progress-bar').width(complete);
                }
                $('.worker-status').text(msg);
            }
        },

        addHandlers: function () {
            graphite.events.on('drawPreviewFinish', this.hideTempPreview, this);
            graphite.events.on('zoomChanged', this.handleZoomChanged, this);
            graphite.events.on('flattenedSpriteUpdated', this.updateFlattenedLayers, this);
            graphite.events.on('layerCompChanging', this.layerCompChanging, this);
            graphite.events.on('showWorkerProgress', this.showProgressPane, this);
            graphite.events.on('hideWorkerProgress', this.hideProgressPane, this);
            graphite.events.on('updateWorkerProgress', this.updateProgressPane, this);
            graphite.events.on('jsonExtractionFailure', this.handleJSONExtractionFailure, this);
            graphite.events.on('dropperStart', this.handleDropperStart, this);
            graphite.events.on('dropperStop', this.handleDropperStop, this);
            graphite.events.on('extract-asset-download-init', this.handleAssetExtractInit, this);
            graphite.events.on('assetExtracted', this.handleAssetExtracted, this);
            graphite.events.on('assetExtractionFailure', this.handleAssetExtracted, this);
            graphite.events.on('multiSelectPending', this.handleMultiSelectPending, this);
            graphite.events.on('selection-changed', this.handleSelectionChanged, this);
        },

        convertClientPtToPSDPt: function (clientX, clientY) {
            var $previewContainer = this.$el.find('.preview-container');

            var documentOffset = $previewContainer.offset();
            var paddingTop = $previewContainer.css('padding-top');
            var paddingLeft = $previewContainer.css('padding-left');

            var point = {
                x: clientX - documentOffset.left - parseInt(paddingLeft, 10),
                y: clientY - documentOffset.top - parseInt(paddingTop, 10)
            };

            point = ZoomController.zoomPoint(point, true);

            return point;
        },

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


        //These are the layers that could be light boxed from the summary view
        getPriorityLayers: function () {
            var typeArrays = [],
                typeArray,
                type,
                layers,
                retMap = {},
                i,
                j,
                k;
            typeArrays.push(this.model.get('extractedStyles').colorUsageModels);
            typeArrays.push(this.model.get('extractedStyles').textStyleUsageModels);
            typeArrays.push(this.model.get('extractedStyles').gradientUsageModels);

            for (i = 0; i < typeArrays.length; i++) {
                typeArray = typeArrays[i];
                for (k = 0; k < typeArray.length; k++) {
                    type = typeArray[k];
                    layers = type.get('layers');
                    for (j = 0; j < layers.length; j++) {
                        retMap[layers[j].get('layerId')] = true;
                    }
                }
            }

            return retMap;
        },

        //Only used by addLayerSpritesBackToFront to determine if a blendmode should obscure an item inside an artboard
        shouldFlattenedParentObscure: function (model, flattenedParent) {
            var artboard = model.getArtboardParent();
            var flattenedParentArtboard = flattenedParent.getArtboardParent();
            return (!flattenedParentArtboard || artboard && artboard.isEqual(flattenedParentArtboard));
        },

        addLayerSpritesBackToFront: function (model) {
            var queue = [],
                currentModel = model,
                parentModel,
                childTmplId,
                childElem,
                flattenedElem,
                flattenedSpriteLayers = [],
                bounds,
                previewRoot = this.$el.find('#psdpreview_root'),
                parentContainer,
                zIndex = 0,
                isGroup,
                layerCollection;

            var waitingOnFlattenedParent = [];
            while (currentModel) {
                isGroup = (currentModel.get('type') === Constants.Type.LAYER_GROUP) || (currentModel.get('type') === Constants.Type.LAYER_ARTBOARD);
                parentModel = currentModel.get('parentModel');
                if (parentModel) {
                    childTmplId = isGroup ? PSDPreviewDivSpriteSheetTemplate : PSDPreviewLayerTemplate;
                    childElem = TemplateUtil.createTemplate(childTmplId, currentModel.toJSON());
                    if (currentModel.get('type') === Constants.Type.LAYER_ARTBOARD) {
                        childElem.addClass('artboard');
                    }
                    flattenedElem = null;
                    bounds = currentModel.get('bounds');
                    MeasurementUtil.setLayerBounds(childElem, false, currentModel, parentModel, SelectionController);

                    childElem.attr('id', 'layer' + currentModel.get('layerId'));

                    if (currentModel.isVisibleOnStage()) {
                        childElem.show();
                    } else {
                        childElem.hide();
                    }

                    parentContainer = LayerModelMap.getLayerInfoForId(parentModel.get('layerId')) ?
                            LayerModelMap.getLayerInfoForId(parentModel.get('layerId')).item : null;
                    if (!parentContainer) {
                        parentContainer = previewRoot;
                    }

                    if (currentModel.get('flattenedSprite')) {
                        flattenedElem = TemplateUtil.createTemplate(PSDPreviewLayerTemplate, currentModel.toJSON());
                        flattenedElem.attr('id', 'flattenedLayer' + currentModel.get('layerId'));
                        var curBounds = MeasurementUtil.setLayerBounds(flattenedElem, true, currentModel, parentModel, SelectionController);
                        parentContainer.append(flattenedElem);
                        FlattenedAssetController.applyParentAndPosition(currentModel, curBounds,
                                flattenedElem, currentModel.get('flattenedSprite'));
                        flattenedSpriteLayers.push(currentModel);

                        if (!isGroup) {
                            childElem.css('visibility', 'hidden');
                        }

                        //Hide elems currently waiting on this as their flattenedParent
                        for (var i = waitingOnFlattenedParent.length - 1; i >= 0; --i) {
                            if (this.shouldFlattenedParentObscure(waitingOnFlattenedParent[i].model, currentModel)) {
                                waitingOnFlattenedParent[i].item.css('visibility', 'hidden');
                                waitingOnFlattenedParent.splice(i, 1);
                            }
                        }
                    }
                    
                    if (currentModel.get('flattenedParent')) {
                        //Hide the layer if it's involved in a blend mode, but only if the blend mode is not in an artboard, or if both belong to the same artboard
                        var flattenedParentModel = LayerModelMap.getLayerModelFromId(currentModel.get('flattenedParent'));
                        if (!flattenedParentModel) {
                            waitingOnFlattenedParent.push({item: childElem, model: currentModel});
                        } else if (this.shouldFlattenedParentObscure(currentModel, flattenedParentModel)) {
                            childElem.css('visibility', 'hidden');
                        }
                    }

                    LayerModelMap.addLayerToMap(currentModel.get('layerId'), childElem, flattenedElem, currentModel);

                    // Load our flattened sprite representation.
                    if (flattenedElem) {
                        this.loadSpriteSheet(flattenedElem, currentModel, currentModel.get('flattenedSprite'), true);
                    }

                    // Also load our single sprite representation (if not a layer set)
                    if (!isGroup) {
                        this.loadSpriteSheet(childElem, currentModel, currentModel.get('spriteSheet'));
                    } else {
                        if (currentModel.get('properties') && currentModel.get('properties').get('blendOptions')) {
                            // Note we can't use (blendOptions.opacity || 100).  0 is a valid value for
                            // opacity/fillOpacity and that logical will result in the calculation being 1
                            // and we want it to be 0
                            var blendOptions = currentModel.get('properties').get('blendOptions'),
                                opacity = (blendOptions.opacity >= 0) ?  blendOptions.opacity / 100 : 1,
                                fillOpacity = (blendOptions.fillOpacity >= 0) ?  blendOptions.fillOpacity / 100 : 1;
                            childElem.css('opacity', opacity * fillOpacity);
                        }
                    }
                    parentContainer.append(childElem);

                    this.addEventHandlers(currentModel, parentContainer, previewRoot);
                }

                layerCollection = currentModel.get('layerCollection');
                if (layerCollection) {
                    /*jshint loopfunc: true */
                    layerCollection.each(function (layerModel) {
                        layerModel.set('parentModel', currentModel);
                        layerModel.set('zIndex', zIndex);
                        zIndex++;
                        queue.push(layerModel);
                    });
                    /*jshint loopfunc: false */
                }
                currentModel = queue.shift();
            }

            // Hide our flattened sprite(s) if none of their members are visible.
            _.each(flattenedSpriteLayers, function (layer) {
                var flattenedSprite = layer.get('flattenedSprite'),
                    curLayerModel,
                    allHidden = true,
                    $flattenedSpriteElem;

                _.each(flattenedSprite.includedLayers, function (layerId) {
                    curLayerModel = LayerModelMap.getLayerModelFromId(layerId);
                    if (curLayerModel.getEffectiveVisibility()) {
                        allHidden = false;
                    }
                });

                if (allHidden) {
                    $flattenedSpriteElem = LayerModelMap.getLayerInfoForId(layer.get('layerId')).flattenedItem;
                    if ($flattenedSpriteElem) {
                        $flattenedSpriteElem.css('visibility', 'hidden');
                    }
                }
            });
        },


        loadImage: function (currentModel, bounds, display) {
            if ((bounds.right !== bounds.left) && (bounds.top !== bounds.bottom)) {
                var image = new Image();
                // DPO - I suspect this is never used because it referred to an API that no longer exists. Updating anyway.
                var imgURL = graphite.getServerAPI().getLayerURL(this.model.id, currentModel.get('layerId'));
                image.title = currentModel.get('layerId');
                image.addEventListener('load', function () {
                    var elem = LayerModelMap.getLayerInfoForId(this.title).item;
                    if ((currentModel.get('type') === Constants.Type.LAYER_GROUP) || (currentModel.get('type') === Constants.Type.LAYER_ARTBOARD)) {
                        elem = elem.children().first();
                    }
                    var context = elem[0].getContext('2d');
                    context.drawImage(this, 0, 0);
                    if (!display) {
                        elem.css('display', 'none');
                    }
                    currentModel.set('rendered', true);
                }, false);
                graphite.getServerAPI().loadCrossDomainImage(image, imgURL);
            }
        },

        populateLayerModelMap: function (model) {
            var queue = [],
                currentModel = model,
                previewRoot = this.$el.find('#psdpreview_root'),
                layerCollection,
                addToQueue = function (layerModel) {
                    layerModel.set('parentModel', currentModel);
                    queue.push(layerModel);
                };

            LayerModelMap.reset();
            while (currentModel) {
                if (currentModel.get('parentModel')) {
                    LayerModelMap.addLayerToMap(currentModel.get('layerId'), previewRoot, null, currentModel);
                }

                layerCollection = currentModel.get('layerCollection');
                if (layerCollection) {
                    layerCollection.each(addToQueue);
                }
                currentModel = queue.shift();
            }
        },

        loadSpriteSheet: function (element, currentModel, spriteSheet, isSpriteElem) {
            var isGroup = (currentModel.get('type') === Constants.Type.LAYER_GROUP) || (currentModel.get('type') === Constants.Type.LAYER_ARTBOARD),
                isFlattenedSprite = currentModel.get('flattenedSprite');

            // We don't draw layer groups in the preview view
            if ((spriteSheet === undefined) || (isGroup && !isFlattenedSprite)) {
                return;
            }

            if (spriteSheet.sheetID) {
                graphite.getDetailsController().drawSpriteSheet(spriteSheet.sheetID, this.drawSprite(element, currentModel, isSpriteElem));
            } else if (spriteSheet.color) {
                this.drawRectangle(currentModel, spriteSheet.color, spriteSheet.opacity);
            }
        },

        drawSprite: function ($element, model, isSpriteElem) {
            return function (image) {
                var context = $element[0].getContext('2d'),
                    flattenedSprite = model.get('flattenedSprite'),
                    bounds = isSpriteElem && flattenedSprite ?
                            flattenedSprite.bounds : model.get('spriteSheet').bounds,
                    width = bounds.right - bounds.left,
                    height = bounds.bottom - bounds.top;

                context.drawImage(image, bounds.left, bounds.top,
                    width, height, 0, 0, width, height);
            };
        },

        drawRectangle: function (model, color, opacity) {
            var elem = LayerModelMap.getLayerInfoForId(model.get('layerId')).item;
            var bounds = model.get('bounds');
            var context = elem[0].getContext('2d');

            context.globalAlpha = opacity / 255;
            context.beginPath();
            context.rect(0, 0, bounds.right - bounds.left, bounds.bottom - bounds.top);
            context.fillStyle = 'rgb(' + color.red + ',' + color.green + ',' + color.blue + ')';
            context.fill();
        },


        addEventHandlers: function (currentItem, parentContainer, previewRoot) {
            var self = this;
            currentItem.on('change:visible', function () {
                self.layerVisibilityChanged(this);
            });

            currentItem.on('focus', function () {
                if (previewRoot.find(self.$defocused).length === 0) {
                    previewRoot.append(self.$defocused);
                }
                var layerId = '#layer' + this.get('layerId');
                parentContainer.find(layerId).addClass('focused');

                self.groupExpanded(this);
            });
        },

        groupExpanded: function (layerGroup) {
            this.refreshVisibilityForFocus(layerGroup);
            var parent = layerGroup.get('parentModel');
            if (!parent.get('info')) {
                this.groupExpanded(parent);
            }
        },

        refreshVisibilityForFocus: function (layerModel) {
            if ((layerModel.get('type') !== Constants.Type.LAYER_GROUP) && (layerModel.get('type') !== Constants.Type.LAYER_ARTBOARD)) {
                this.refreshVisibilityForItem(layerModel);
            } else {
                var layerCollection = layerModel.get('layerCollection');
                var self = this;
                if (layerCollection) {
                    layerCollection.each(function (model) {
                        self.refreshVisibilityForItem(model);
                    });
                }
            }
        },

        refreshVisibilityForItem: function (layerModel) {
            var layerElem = LayerModelMap.getLayerInfoForId(layerModel.get('layerId')).item,
                clippedLayers = layerModel.get('clippedLayers'),
                that = this;

            if (layerModel.isVisibleOnStage()) {
                layerElem.show();
            } else {
                layerElem.hide();
            }

            if (clippedLayers) {
                clippedLayers.forEach(function (model) {
                    that.refreshVisibilityForItem(model);
                });
            }
        },

        layerVisibilityChanged: function (layerModel) {
            this.updateFlattenedLayers(layerModel);
            this.refreshVisibilityForItem(layerModel);
        },

        /**
         * Walks layer tree and flattens or expands the layer
         * views based on the currently visible layers. If our
         * blendmode group layer's visibility matches the initial
         * state when first loaded, we leverage a flattened sprite.
         * If the layer visibility for any members of the blendmode
         * group vary from the initial state, we hide the flattened
         * sprite and represent each with its own sprite.
         *
         * For layers that do not belong to a blend mode group we do
         * nothing.
         *
         * @param model The layer most recent shown/hidden.
         */
        updateFlattenedLayers: function (model) {
            var flattenedParentId = model.get('flattenedParent'),
                flattenedParentModel = LayerModelMap.getLayerModelFromId(flattenedParentId),
                flattenedSprite = model.get('flattenedSprite'),
                origVisibilityState = true,
                layerSpriteInfo = [],
                $flattenedSpriteElem,
                curLayerModel,
                $curLayerView,
                affectedSprites = [],
                flattenedSpriteModels = [],
                self = this;

            // Gather up the affected 'flattened' sprite layers
            if (flattenedParentModel || flattenedSprite) {
                flattenedParentModel = flattenedParentModel || model;
                flattenedSpriteModels.push(flattenedParentModel);
            } else if ((model.get('type') === Constants.Type.LAYER_GROUP) || (model.get('type') === Constants.Type.LAYER_ARTBOARD)) {
                flattenedSpriteModels = model.findDescendantFlattenedSprites();
            }

            // Gather up info for each affected model.
            _.each(flattenedSpriteModels, function (layer) {
                flattenedSprite = layer.get('flattenedSprite');
                if (flattenedSprite) {
                    $flattenedSpriteElem = LayerModelMap.getLayerInfoForId(layer.get('layerId')).flattenedItem;
                    affectedSprites.push({
                        layer: layer,
                        flattenedSprite: flattenedSprite,
                        $flattenedSpriteElem: $flattenedSpriteElem
                    });
                }
            });

            // For each flattened sprite that was possibly affected by the
            // layer that was just toggled, determine if we need to flatten or
            // unflatten it.
            _.each(affectedSprites, function (spriteInfo) {
                origVisibilityState = true;
                flattenedSprite = spriteInfo.flattenedSprite;
                $flattenedSpriteElem = spriteInfo.$flattenedSpriteElem;

                // Walk all included layers for the current flattenedParent and determine
                // if its visibility is different than the initial document state.
                _.each(flattenedSprite.includedLayers, function (layerId) {
                    curLayerModel = LayerModelMap.getLayerModelFromId(layerId);
                    $curLayerView = LayerModelMap.getLayerInfoForId(curLayerModel.get('layerId')).item;
                    layerSpriteInfo.push({
                        model: curLayerModel,
                        $elem: $curLayerView,
                        elemVisibility: $curLayerView.css('visibility')
                    });

                    // Mark this layer group's collective visibility state as being different
                    // than the initial loaded state that the flattened sprite represents.
                    if (origVisibilityState && !curLayerModel.isEffectiveRenderedVisibility()) {
                        origVisibilityState = false;
                    }
                });

                if (origVisibilityState) {
                    $flattenedSpriteElem.css('visibility', 'visible');
                    self._flattenLayerElems(true, layerSpriteInfo);
                    FlattenedAssetController.validateSprite(spriteInfo.layer);
                } else {
                    $flattenedSpriteElem.css('visibility', 'hidden');
                    self._flattenLayerElems(false, layerSpriteInfo);
                    FlattenedAssetController.invalidateSprite(spriteInfo.layer);
                }

            });

        },

        handleClickEvent: function (event) {
            if ($(event.target).parents('.popup').length || $(event.target).hasClass('popup')) {
                return;
            }
            var activeTool = graphite.getDetailsController().get('activeTool');
            if (activeTool === Constants.Tool.SELECT_DIRECT) {
                // Select the item
                SelectionController.set('shouldScrollLayers', true);
                var point = this.convertClientPtToPSDPt(
                    event.clientX + $(document).scrollLeft(),
                    event.clientY + $(document).scrollTop()
                );
                SelectionController.selectItemAtPoint(
                    point.x,
                    point.y,
                    KeyboardUtils.isMultiSelectKey(event)
                );
                event.stopPropagation();
            }
        },

        logCanvasClick: function (eventName, clientX, clientY) {
            var point = this.convertClientPtToPSDPt(clientX, clientY),
                hitItemModel = SelectionController.itemAtPoint(point.x, point.y),
                hitType = hitItemModel ? hitItemModel.get('type') : 'nothingUnderCursor';

            graphite.events.trigger('canvasClick', {type: eventName, layerType: hitType });
        },

        handleDoubleClickEvent: function (event) {
            this.logCanvasClick('doubleClick', event.clientX, event.clientY);
        },

        handleMouseDownEvent: function (event) {
            if (event.button === 2) {
                this.logCanvasClick('rightClick', event.clientX, event.clientY);
            } else if (event.button === 0) {
                var page = { x: event.pageX, y: event.pageY };

                $(window).on('mousemove.dragDetect', function (event) {
                    this.isClickDrag = true;

                    if (Math.abs(event.pageX - page.x) > 20 || Math.abs(event.pageY - page.y) > 20) {
                        graphite.events.trigger('canvasClickDrag');
                        $(window).off('.dragDetect');
                    }
                });
            }
        },

        handleMouseUpEvent: function () {
            $(window).off('.dragDetect');
            this.isClickDrag = false;
        },

        layerCompChanging: function () {
            this.$el.find('.preview-loading-spinner').remove();
            this.renderSpinner();
        },

        handleAssetExtractInit: function (params) {
            this.extractionStartTime = new Date().getTime();
            if (!graphite.inPublicOneUp()) {
                this.showSuccessTooltip(deps.translate('Extracting asset. Look for it in the Assets tab.'));
            }
        },

        handleAssetExtracted: function (params) {
            if (this.extractTooltip) {
                var tooltipDuration = Constants.NotificationTooltip.MIN_DURATION - (new Date().getTime() - this.extractionStartTime);

                if (tooltipDuration <= 0) {
                    this.extractTooltip.remove();
                    this.extractTooltip = null;
                } else {
                    setTimeout(this.handleAssetExtracted.bind(this), tooltipDuration);
                }
            }
        },

        handleMultiSelectPending: function (pending) {
            var selection = SelectionController.getSelectedLayers();
            this.$el.toggleClass('measure-pending', pending && selection.length === 1);
        },

        handleSelectionChanged: function (fromPreviewView) {
            var selection = SelectionController.getSelectedLayers(),
                bounds,
                previewAreaBounds;

            if (selection.length !== 1) {
                this.$el.removeClass('measure-pending');
            }
            if (selection.length >= 1) {
                bounds = MeasurementUtil.calcLayerGroupBounds(selection, SelectionController.getPSDModel());
                bounds = ZoomController.zoomRect(bounds);

                previewAreaBounds = this.$el[0].getBoundingClientRect();

                //Translate the bounds of the layer in the PSD into browser coordinates
                bounds.top += previewAreaBounds.top - this.$el.scrollTop();
                bounds.bottom += previewAreaBounds.top - this.$el.scrollTop();
                bounds.left += previewAreaBounds.left - this.$el.scrollLeft();
                bounds.right += previewAreaBounds.left - this.$el.scrollLeft();
                if (!fromPreviewView) {
                    ScrollUtils.scrollRectIntoView(this.$el, bounds);
                }
            }
        },

        showSuccessTooltip: function (message) {
            // is it already being shown?
            if (this.extractTooltip) {
                return;
            }

            var $measurementPopup = this.$el.find('div.blueHUD');
            var $parent = $measurementPopup.parent();
            $parent.append('<div id="notificationTooltip"><span>' + message + '</span></div>');
            this.extractTooltip = $('#notificationTooltip');

            //Set the width of the tooltip to the width of the blue HUD
            this.extractTooltip.width($measurementPopup.outerWidth() - (this.extractTooltip.outerWidth() - this.extractTooltip.width()));

            //Calculate the left position. The 13 accounts for negative margins in the HUD and in the tooltip
            var tipPosLeft = Math.round($measurementPopup.position().left) + 13 + $parent.scrollLeft();

            var tipPosTop;
            var tipHeight = this.extractTooltip.outerHeight();
            if ($measurementPopup.hasClass('bottom')) {
                //Place the tooltip just below the blue HUD
                tipPosTop = $measurementPopup.position().top + $measurementPopup.outerHeight();
            } else {
                //Place the tooltip just above the blue HUD. Negative 15 accounts for the negative margin in the HUD
                tipPosTop = $measurementPopup.position().top - tipHeight - 15;
            }
            this.extractTooltip.css({top: tipPosTop, left: tipPosLeft});
            this.extractTooltip.fadeIn(250);
        },

        setBackgroundWhite: function () {
            var $previewRoot = this.$el.find('#psdpreview_root');
            $previewRoot.css('background', 'white');
        },

        showErrorNotification: function (message) {
            var basePath = deps.utils.getCurrentBasePath(),
                isPublicOneUp = graphite.inPublicOneUp();

            // Default
            message.anchor = "";
            if (basePath === 'file' || basePath === 'link') {
                var anchorText =  isPublicOneUp ? deps.translate('Go to Comments to preview the PSD.') :
                        deps.translate('Go to Details to preview the PSD.');
                message.anchor = ' <a class="details-anchor">' + anchorText + '</a>';
            }

            if (this.$notification) {
                this.$notification.find('.details-anchor').off('.details');
                this.$notification.remove();
                this.$notification = null;
            }

            // Render
            this.$el.append(TemplateUtil.createTemplate(ErrorNotificationTemplate, message));
            this.$notification = this.$el.find('.error-notification');

            // Attach anchor listener so we can delegate to an alternative plugin.
            var $anchor = this.$el.find('.details-anchor');
            if ($anchor.length) {
                $anchor.on('click.details', function (e) {
                    e.preventDefault();
                    deps.events.trigger('plugin.show', isPublicOneUp ? 'ccweb.files.activity_public' : 'ccweb.files.details');
                });
            }

            // Hide remainder of preview UI in error state.
            this.$el.addClass('has-error');

            graphite.events.trigger('errorNotificationShown');
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        remove: function () {
            FlattenedAssetController.reset();
            if (this.inspectStyleOverlay) {
                this.inspectStyleOverlay.remove();
            }
            if (this.selectionOverlay) {
                this.selectionOverlay.remove();
            }
            if (this.mouseListenerOverlay) {
                this.mouseListenerOverlay.remove();
            }
            if (this.artboardOverlay) {
                this.artboardOverlay.remove();
            }
            if (this.popupOverlay) {
                this.popupOverlay.remove();
            }
            if (this.$progressPane) {
                this.$progressPane.remove();
                this.$progressPane = null;
            }
            if (this.$psdLens) {
                this.$psdLens.remove();
                this.$psdLens = null;
            }
            if (this.$notification) {
                this.$notification.find('.details-anchor').off('.details');
                this.$notification.remove();
                this.$notification = null;
            }
            this.inspectStyleOverlay = null;
            this.selectionOverlay = null;
            this.mouseListenerOverlay = null;
            this.artboardOverlay = null;
            this.popupOverlay = null;
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        },

        //------------------------------------------------
        // Private Helpers
        //------------------------------------------------

        _loadPreviewImage: function () {
            if (imageLoader) {
                var loaderConfig = {
                    id : this.model.get('assetId'),
                    modified : this.model.get('modified'),
                    height : this.model.get('width'),
                    width : this.model.get('height'),
                    type: this.model.get('type'),
                    name: this.model.get('fileName'),
                    link: graphite.linkId
                };
                imageLoader(loaderConfig, this._previewImageDataReceived);
            } else if (!this.model.get('localContent') && !this.model.get('layerCompId')) {
                if (deps.utils.hasFeature('temp_extract_use_webtier')) {
                    var self = this;
                    graphite.getStorageServiceAPI().storagePath(this.model.get('id')).then(
                        function (path) {
                            self.$tempPreview.attr('src', graphite.getServerAPI().getDefaultRenditionURL(path));
                        }
                    );
                } else {
                    this.$tempPreview.attr('src', graphite.getServerAPI().getDefaultRenditionURL(this.model.get('id')));
                }
            }
        },

        _previewImageDataReceived: function ($img) {
            // Replace our preview image with a clone of
            // the newly received preview image.
            if ($img && $img.length) {
                if ($img.attr('src').indexOf(deps.utils.getFileIconPath()) === -1) {
                    var width = this.model.get('width'),
                        height = this.model.get('height'),
                        $canvas = $('<canvas id="tempPreview" class="tempPreview"></canvas>'),
                        context = $canvas[0].getContext('2d');

                    $canvas.css({
                        width: width + 'px',
                        height: height + 'px'
                    });

                    $canvas[0].width = width;
                    $canvas[0].height = height;

                    if ($img[0].width && $img[0].height) {
                        context.drawImage($img[0], 0, 0, $img[0].width, $img[0].height, 0, 0, width, height);
                    }

                    this.$tempPreview.replaceWith($canvas);
                    this.$tempPreview = $canvas;
                    ZoomController.zoomElementScale(this.$tempPreview);

                    if (this.tempPreviewHidden) {
                        this.hideTempPreview();
                    }
                }
            }
        },

        _flattenLayerElems: function (doFlatten, layerSpriteInfo) {
            var visibleVal = doFlatten ? 'hidden' : 'visible';
            _.each(layerSpriteInfo, function (info) {
                info.model.set('isFlattened', doFlatten);
                if (info.elemVisibility !== visibleVal && info.$elem) {
                    info.$elem.css('visibility', visibleVal);
                }
            });
        },

        handleZoomChanged: function (scrollRect) {
            this.applyCurrentZoomLevel(false, scrollRect);
        },

        hideTempPreview: function () {
            var artboardsInfo;
            this.$el.addClass('preview-rendered');
            this.tempPreviewHidden = true;

            var psdModel = SelectionController.getPSDModel();
            if (psdModel.get('isArtboardPSD')) {
                this.$el.find('div.preview-container').addClass('artboard');
                this.$el.find('#psdpreview_root').addClass('artboard');
                artboardsInfo = psdModel.get('artboards');
                if (artboardsInfo) {
                    this.$el.find('#psdpreview_root').css('background-color', 'rgb(' + parseInt(artboardsInfo.canvasColor.red, 10) + ', ' +
                                                                                       parseInt(artboardsInfo.canvasColor.green, 10) + ', ' +
                                                                                       parseInt(artboardsInfo.canvasColor.blue, 10) +')');
                }
                graphite.events.trigger('zoomToFit', psdModel.get('artboardsBounds'));
                graphite.events.trigger('artboardpsd-shown');
            } else {
                graphite.events.trigger('zoomToFit', psdModel.get('imgdata').bounds);
                graphite.events.trigger('nonartboardpsd-shown'); //Send this to help make it clear this is not a PSD with artboards
            }

        },

        applyCurrentZoomLevel: function (skipTransition, scrollRect) {
            var $previewContainer = this.$el.find('div.preview-container'),
                $previewBackground = this.$el.find('#psdpreview_bg'),
                $previewRoot = this.$el.find('#psdpreview_root'),
                $preview = this.$el.find('#tempPreview'),
                $selectionOverlay = this.$el.find('#selection-overlay'),
                bounds = this.model.get('imgdata').bounds,
                size = {width: bounds.right, height: bounds.bottom};

            ZoomController.zoomElementSize($selectionOverlay, size);
            if (!this.tempPreviewHidden || skipTransition) {
                //Check the height & width to the view area width & height and determine if we need to add padding to center it
                var viewWidth = this.$el.outerWidth() - Constants.PREVIEW_SCROLLBAR_SPACING,  //Account for scrollbar width
                    viewHeight = this.$el.outerHeight() - Constants.PREVIEW_SCROLLBAR_SPACING,//and scrollbar height
                    scaledSize = ZoomController.zoomSize(size),
                    leftPosPadding = Math.max(0, Math.round((viewWidth - scaledSize.width)/2)),
                    topPosPadding = Math.max(0, Math.round((viewHeight - scaledSize.height)/2));

                if (leftPosPadding > 0 || topPosPadding > 0) {
                    $previewContainer.css({top: topPosPadding, left: leftPosPadding});
                }

                //This is before the PSD is fully loaded when we still show the temp preview, so don't scale using transitions
                ZoomController.zoomElementScale($preview);
                ZoomController.zoomElementSize($previewContainer, size);
                ZoomController.zoomElementSize($previewBackground, size);
                ZoomController.zoomElementScale($previewRoot);
            } else {
                //PSD is fully ready, scale using transitions
                ZoomController.zoomAndScrollElements($previewRoot, this.$el, scrollRect, $previewContainer, $previewBackground, size,
                                                     SelectionController.getPSDModel().get('isArtboardPSD'));
            }

            // Ensure when zoomed > 100% that we don't clip to unscaled bounds.
            $previewRoot.css('overflow', ZoomController.getZoomLevel() > 1 ? 'visible' : 'hidden');
        },

        handleDropperStart: function () {
            var $lensGrid = this.$psdLens.find('.lens-grid'),
                miniCanvas = $('<canvas/>')[0],
                miniContext = miniCanvas.getContext('2d'),
                lastColor,
                gridSize = 7,
                halfGrid = 3,
                self = this;

            $('.vanilla-extract').addClass('dropper-tool');
            $('.vanilla-extract').append(this.$psdLens);
            this.$psdLens.hide();

            miniCanvas.width = gridSize;
            miniCanvas.height = gridSize;

            this.$el.on('mousedown.dropper', function (event) {
                // Notify everyone that the user has extracted a color.
                if (lastColor) {
                    graphite.events.trigger('commitDropperColor', lastColor);
                }
            });

            $(window).on('click.dropper', function (event) {
                SelectionController.disableDropperTool();
                self.$psdLens.css('border-color', '');
                event.preventDefault();
                event.stopPropagation();
            });

            this.$el.on('mouseleave.dropper', function (event) {
                self.$psdLens.hide();
            });

            this.$el.on('mouseenter.dropper', function (event) {
                self.$psdLens.show();
            });

            this.$el.on('mousemove.dropper', function (event) {

                var topLeft = self.convertClientPtToPSDPt(event.clientX - halfGrid, event.clientY - halfGrid),
                    lensBounds = {
                        top: Math.round(topLeft.y),
                        left: Math.round(topLeft.x),
                        bottom: Math.round(topLeft.y) + gridSize,
                        right: Math.round(topLeft.x) + gridSize
                    },
                    intersects = SelectionController.findIntersectsBackToFront(lensBounds),
                    i;

                self.$psdLens.show();

                // Clear mini context
                miniContext.clearRect(0, 0, gridSize, gridSize);

                // Composite all sprites that intersected with our lens in
                // our mini 7x7 canvas.
                for (i = intersects.length - 1; i >= 0; i--) {
                    var bits = intersects[i].intersect,
                        item = intersects[i].item,
                        canvasItem,
                        element;

                    if (item.get('flattenedSprite')) {
                        canvasItem = LayerModelMap.getLayerInfoForId(item.get('layerId')).flattenedItem;
                    } else {
                        canvasItem = LayerModelMap.getLayerInfoForId(item.get('layerId')).item;
                    }
                    element = canvasItem[0];
                    miniContext.drawImage(element, bits.left, bits.top, bits.width, bits.height, bits.destLeft, bits.destTop, bits.width, bits.height);
                }

                // Let's note the current color at the center of
                // our lens, and update our swatches for this frame.
                var pixel = miniContext.getImageData(halfGrid, halfGrid, 1, 1);
                lastColor = null;
                if (pixel.data && pixel.data.length >= 4 && pixel.data[3] > 0) {
                    lastColor = {};
                    lastColor.red = pixel.data[0];
                    lastColor.green = pixel.data[1];
                    lastColor.blue = pixel.data[2];
                    lastColor.alpha = pixel.data[3] / 255;
                    var rgb = 'rgb(' + lastColor.red + ',' + lastColor.green + ',' + lastColor.blue + ')';
                    $('.dropper-item .color-chip').css('background-color', rgb);
                    self.$psdLens.css('border-color', rgb);
                } else {
                    $('.dropper-item .color-chip').css('background-color', '');
                    self.$psdLens.css('border-color', '');
                }

                // Now we blit to our larger lens making sure that result is pixellated.
                var lensContext = $lensGrid[0].getContext('2d');
                lensContext.webkitImageSmoothingEnabled = false;
                lensContext.mozImageSmoothingEnabled = false;
                lensContext.msImageSmoothingEnabled = false;
                lensContext.clearRect(0, 0, gridSize * 10, gridSize * 10);
                lensContext.drawImage(miniCanvas, 0, 0, gridSize, gridSize, 0, 0, gridSize * 10, gridSize * 10);

                // Move our updated lens to current cursor position.
                self.$psdLens.css({
                    left: event.clientX + 'px',
                    top: event.clientY - $('.vanilla-extract').offset().top +   'px'
                });
            });
        },

        handleDropperStop: function () {
            $('.vanilla-extract').removeClass('dropper-tool');
            $(window).off('.dropper');
            this.$el.off('.dropper');
            $('.dropper-item .color-chip').css('background-color', '');
            this.$psdLens.hide();
        }

    });

    return PSDPreviewView;
});
