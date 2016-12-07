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
/*global graphite*/

define([
    'underscore',
    'backbone',
    '../Constants',
    '../models/LayerModel',
    '../models/LayerModelMap',
    '../models/ColorUsageModel',
    '../models/TextStyleUsageModel',
    '../models/GradientUsageModel',
    '../utils/StyleUtil',
    '../utils/MeasurementUtil'
], function (_, Backbone, Constants, LayerModel,
        LayerModelMap, ColorUsageModel, TextStyleUsageModel, GradientUsageModel,
        StyleUtil, MeasurementUtil) {
    'use strict';
    var SelectionController = Backbone.Model.extend({
        selectionMap: {},
        focusMap: {}, // map of models that are currently in focus (lightboxed)

        defaults: {
            psdModel: null,
            psdView: null,
            extractedStylesInSelection: null //colors/fonts/gradients in the selection

        },

        getPSDModel: function () {
            return this.psdModel;
        },

        setPSDModel: function (model) {
            if (this.psdModel) {
                this.psdModel.off(null, null, this);
            }

            this.psdModel = model;
            this.psdModel.on('change:info', this.handleModelInfoChanged, this);
            this.resetFocusMap();
            this.resetSelection();

            this.offscreenCanvas = null;
            this.offscreenContext = null;
            this.clipLayersToImage = false;
            this.handleModelInfoChanged();
        },

        handleModelInfoChanged: function () {
            var info = this.psdModel.get('info');
            if (info && info.hasOwnProperty('clipSpriteSheetLayers')) {
                this.clipLayersToImage = info.clipSpriteSheetLayers;
            }
        },


//***** Hover Methods *****/
        isLayerVisible: function (layerModel, recurse) {
            var isVisible = layerModel.get('visible');
            if (recurse && layerModel.get('parentModel') && isVisible) {
                if (layerModel.get('parentModel') instanceof LayerModel) {
                    isVisible = this.isLayerVisible(layerModel.get('parentModel'), recurse);
                }
            }
            return isVisible;
        },

//***** Selection Methods *****/

        isSelected: function (layerID) {
            return (this.selectionMap[layerID] !== null);
        },

        getSelectedLayers: function () {
            return _.values(this.selectionMap);
        },

        selectParent: function () {
            // only select the parent if one item is selected
            if (Object.keys(this.selectionMap).length === 1) {
                var id,
                    layerModel,
                    parentModel;

                for (id in this.selectionMap) {
                    if (this.selectionMap.hasOwnProperty(id)) {
                        layerModel = LayerModelMap.getLayerModelFromId(id);
                        parentModel = layerModel.get('parentModel');
                        if (parentModel instanceof LayerModel) {
                            this.changeSelection([parentModel], false);
                        }
                    }
                }
            }
        },

        selectTopChild: function () {
            // the top child in z-order is the last item in the layerCollection
            // only select the parent if one item is selected
            if (Object.keys(this.selectionMap).length === 1) {
                var id,
                    layerModel,
                    childLayers;

                for (id in this.selectionMap) {
                    if (this.selectionMap.hasOwnProperty(id)) {
                        layerModel = LayerModelMap.getLayerModelFromId(id);
                        childLayers = layerModel.get('layerCollection');
                        if (childLayers && childLayers.length > 0) {
                            this.changeSelection([childLayers.at(childLayers.length - 1)], false);
                        }
                    }

                }
            }
        },

        selectNextSibling: function () {
            if (Object.keys(this.selectionMap).length === 1) {
                var id,
                    layerModel,
                    parentModel,
                    childLayers,
                    currentIndex;

                for (id in this.selectionMap) {
                    if (this.selectionMap.hasOwnProperty(id)) {
                        layerModel = LayerModelMap.getLayerModelFromId(id);
                        parentModel = layerModel.get('parentModel');
                        childLayers = parentModel.get('layerCollection');
                        currentIndex = childLayers.indexOf(layerModel);
                        if (currentIndex > -1) {
                            if (currentIndex > 0) {
                                this.changeSelection([childLayers.at(currentIndex - 1)], false);
                            } else {
                                //Wrap around
                                this.changeSelection([childLayers.at(childLayers.length - 1)], false);
                            }
                        }
                    }
                }
            }
        },

        selectPrevSibling: function () {
            if (Object.keys(this.selectionMap).length === 1) {
                var id,
                    layerModel,
                    parentModel,
                    childLayers,
                    currentIndex;

                for (id in this.selectionMap) {
                    if (this.selectionMap.hasOwnProperty(id)) {
                        layerModel = LayerModelMap.getLayerModelFromId(id);
                        parentModel = layerModel.get('parentModel');
                        childLayers = parentModel.get('layerCollection');
                        currentIndex = childLayers.indexOf(layerModel);
                        if (currentIndex > -1) {
                            if (currentIndex < childLayers.length - 1) {
                                this.changeSelection([childLayers.at(currentIndex + 1)], false);
                            } else {
                                //Wrap around
                                this.changeSelection([childLayers.at(0)], false);
                            }
                        }
                    }

                }
            }
        },

        changeSelection: function (layerModelArray, addToSelection, fromPreviewView) {
            var id, i, layerModel;

            if (!addToSelection || !layerModelArray) {
                // deselect all selected items
                for (id in this.selectionMap) {
                    if (this.selectionMap.hasOwnProperty(id)) {
                        this.selectionMap[id].set('selected', false);
                    }
                }
                this.selectionMap = {};
            }

            if (layerModelArray) {
                for (i = 0; i < layerModelArray.length; i++) {
                    layerModel = layerModelArray[i];
                    if (layerModel && !layerModel.get('selected')) {
                        layerModel.set('selected', true);
                        this.selectionMap[layerModel.get('layerId')] = layerModel;
                    } else {
                        if (layerModel && addToSelection) {
                            //toggle selection off if already selected and modifier is pressed
                            layerModel.set('selected', false);
                            delete this.selectionMap[layerModel.get('layerId')];
                        }
                    }
                }
            }

            graphite.events.trigger('selection-changed', fromPreviewView);
            this.updateStylesForSelection();
        },

        resetSelection: function () {
            this.selectionMap = {};
        },

        selectItemAtPoint: function (x, y, addToSelection) {
            var hitItem = (x !== -1 && y !== -1) ? this.itemAtPoint(x, y) : null;
            this.changeSelection([hitItem], addToSelection, true);
            var hoverArray = hitItem !== null ? [hitItem] : [];
            graphite.events.trigger('item-hovered-over', hoverArray, true);
        },

        // Private helper used for replacing a layer group with
        // an explicit set of its descendants.
        _expandGroup: function (layer, expanded) {
            var collection = layer.get('layerCollection'),
                foundHiddenLayer = false,
                i;
            for (i = 0; i < collection.length; i++) {
                var child = collection.at(i),
                    childCollection = child.get('layerCollection');
                expanded.push(child);
                if (child.get('visible') === false) {
                    foundHiddenLayer = true;
                }
                if (childCollection) {
                    foundHiddenLayer = foundHiddenLayer || this._expandGroup(child, expanded);
                }
            }
            return foundHiddenLayer;
        },

        /**
         * Expands a selection in preparation for asset extraction or sprite
         * regeneration.  Removes any redundant groups from selection, expands
         * groups to only include explicitly visible layers, and filters out
         * non-visible layers.
         */
        expandSelection: function (selection) {
            var filteredGroups = [],
                expandedLayers = [],
                expandedGroups = [],
                filteredSelection = selection,
                self = this;

            // Remove any redundant groups from original list. Basically
            // any layer group that has additional descendant layers explicitly
            // selected, can be filtered out.
            _.each(selection, function (layer) {
                var parent = layer.get('parentModel');
                while (parent) {
                    if (parent.get('selected')) {
                        filteredGroups.push(parent.get('layerId'));
                    }
                    parent = parent.get('parentModel');
                }
            });

            if (filteredGroups.length) {
                filteredSelection = _.filter(selection, function (layer) {
                    return filteredGroups.indexOf(layer.get('layerId')) === -1;
                });
            }

            // Now expand any remaining groups that have hidden descendants.
            // Returns true if there was a hidden layer otherwise if false,
            // there is no reason to expand.
            _.each(filteredSelection, function (layer) {
                if (layer.get('layerCollection')) {
                    var descendants = [],
                        hasHiddenLayers = self._expandGroup(layer, descendants);
                    if (hasHiddenLayers) {
                        expandedGroups.push(layer.get('layerId'));
                        expandedLayers = expandedLayers.concat(descendants);
                    }
                }
            });

            // Combine any expandedLayers with our original selection.
            filteredSelection = filteredSelection.concat(expandedLayers);

            // Now filtered out any expanded groups and any hidden layers.
            filteredSelection = _.filter(filteredSelection, function (layer) {
                return self.isLayerVisible(layer, true) &&
                    expandedGroups.indexOf(layer.get('layerId')) === -1;
            });

            return filteredSelection;
        },

        updateStylesForSelection: function () {
            var selectedLayers = this.getSelectedLayers(),
                extractedStyles = this.psdModel.get('extractedStyles') ||
                {colorUsageModels: [], gradientUsageModels: [], textStyleUsageModels: [], models: []},
                layerUsageModels;

            if (selectedLayers.length) {
                var combinedColorUsageModelList = [],
                    combinedGradientUsageModelList = [],
                    combinedTextStyleUsageModelList = [];

                _.each(selectedLayers, function (value) {
                    layerUsageModels = value.getUsageModels();
                    combinedColorUsageModelList = combinedColorUsageModelList.concat(layerUsageModels.colorUsageModels);
                    combinedGradientUsageModelList = combinedGradientUsageModelList.concat(layerUsageModels.gradientUsageModels);
                    combinedTextStyleUsageModelList = combinedTextStyleUsageModelList.concat(layerUsageModels.textStyleUsageModels);
                });

                extractedStyles = {
                    colorUsageModels: combinedColorUsageModelList,
                    gradientUsageModels: combinedGradientUsageModelList,
                    textStyleUsageModels: combinedTextStyleUsageModelList,
                    models: selectedLayers
                };
            }

            var arrayToCheck;
            if (graphite.getDetailsController().get('selectedInspectItem') instanceof ColorUsageModel) {
                arrayToCheck = extractedStyles.colorUsageModels;
            } else if (graphite.getDetailsController().get('selectedInspectItem') instanceof GradientUsageModel) {
                arrayToCheck = extractedStyles.gradientUsageModels;
            } else if (graphite.getDetailsController().get('selectedInspectItem') instanceof TextStyleUsageModel) {
                arrayToCheck = extractedStyles.textStyleUsageModels;
            }

            if (arrayToCheck) {
                var found = false;
                _.each(arrayToCheck, function (value, index) {
                    if (StyleUtil.areUsageStylesEqual(value, graphite.getDetailsController().get('selectedInspectItem'))) {
                        graphite.getDetailsController().set('selectedInspectItem', value);
                        found = true;
                        return false;
                    }
                    return true;
                });

                if (!found) {
                    graphite.getDetailsController().setSelectedInspectItem(null);
                }
            }

            this.set('extractedStylesInSelection', extractedStyles);
        },


//***** HitTest Methods *****/
        itemAtPoint: function (x, y) {
            var hitItem = null;
            var id,
                root,
                layerCollection,
                i,
                layerItem;

            for (id in this.focusMap) {
                if (this.focusMap.hasOwnProperty(id)) {
                    root = this.focusMap[id];

                    if (root !== null) {
                        layerCollection = root.get('layerCollection');
                        if (layerCollection) {
                            for (i = layerCollection.length - 1; i >= 0; i--) {
                                layerItem = layerCollection.at(i);
                                hitItem = this.hitTestItem(layerItem, x, y, true);
                                if (hitItem) {
                                    break;
                                }
                            }
                        }
                        if (hitItem) {
                            break;
                        }

                    }
                }
            }

            return hitItem;
        },

        findHitItem: function (root, x, y, recurse) {
            var newSelectedItem = null,
                layerCollection = root.get('layerCollection'),
                i,
                layerItem;

            for (i = layerCollection.length - 1; i >= 0; i--) {
                layerItem = layerCollection.at(i);
                newSelectedItem = this.hitTestItem(layerItem, x, y, recurse);

                if (newSelectedItem !== null) {
                    break;
                }
            }
            return newSelectedItem;
        },

        hitTestItem: function (layerItem, x, y, recurse) {
            var hitItem = null,
                bounds = layerItem.get('bounds'),
                visible = layerItem.get('visible'),
                adjustmentLayer = layerItem.get('type') === Constants.Type.LAYER_ADJUSTMENT,
                useBoundsOnly = layerItem.get('type') === Constants.Type.LAYER_TEXT;

            if (visible === undefined) {
                visible = true;
            }
            if (visible && !adjustmentLayer && this.pointInRect(x, y, bounds)) {
                if (this.psdModel.get('dataType') === 'complete') {
                    var canvasItem = LayerModelMap.getLayerInfoForId(layerItem.get('layerId')).item;
                    if (canvasItem[0].tagName === 'CANVAS') {
                        if (useBoundsOnly || this.pixelHit(canvasItem[0], x, y, bounds)) {
                            hitItem = layerItem;
                        }
                    } else {
                        var children = layerItem.get('layerCollection');
                        if (children !== null && recurse) {
                            hitItem = this.findHitItem(layerItem, x, y, recurse);
                        }
                    }
                } else {
                    if (layerItem.get('layerCollection') !== null && recurse) {
                        hitItem = this.findHitItem(layerItem, x, y, recurse);
                    } else {
                        if (this.pointInRect(x, y, MeasurementUtil.getClippedBounds(bounds, this.psdModel))) {
                            hitItem = layerItem;
                        }
                    }
                }
            }
            return hitItem;
        },

        pointInRect: function (x, y, rect) {
            return (x <= rect.right && x >= rect.left && y <= rect.bottom && y >= rect.top);
        },

        pixelHit: function (canvas, x, y, bounds) {
            var hit = false,
                left = bounds.left,
                top = bounds.top,
                imgData,
                i;

            if (!this.offscreenContext) {
                this.offscreenCanvas = document.createElement('canvas');
                // Note 257x256 here instead of 1x1. For now we are working around
                // a chrome issue https://code.google.com/p/chromium/issues/detail?id=382588
                this.offscreenCanvas.width = 257;
                this.offscreenCanvas.height = 256;
                this.offscreenContext = this.offscreenCanvas.getContext('2d');
                this.offscreenContext.webkitImageSmoothingEnabled = false;
            }

            if (this.clipLayersToImage) {
                left = Math.max(left, 0);
                top = Math.max(top, 0);
            }

            this.offscreenContext.clearRect(0, 0, 1, 1);
            this.offscreenContext.drawImage(canvas, x - left, y - top, 1, 1, 0, 0, 1, 1);

            imgData = this.offscreenContext.getImageData(0, 0, 1, 1);

            for (i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i + 3] > 0) {
                    hit = true;
                    break;
                }
            }
            return hit;
        },

        resetFocusMap: function () {
            this.focusMap = {'root': this.psdModel};
        },

        groupExpanded: function (model) {
            this.psdView.groupExpanded(model);
        },

        clearDOMSelection: function () {
            if (window.getSelection) {
                if (window.getSelection().empty) {  // Chrome
                    window.getSelection().empty();
                } else if (window.getSelection().removeAllRanges) {  // Firefox
                    window.getSelection().removeAllRanges();
                }
            } else if (document.selection) {  // IE?
                document.selection.empty();
            }
        },

        enableDropperTool: function () {
            if (graphite.getDetailsController().get('activeTool') === Constants.Tool.DROPPER) {
                this.disableDropperTool();
                return;
            }

            graphite.getDetailsController().changeActiveTool(Constants.Tool.DROPPER);
            this.selectItemAtPoint(-1, -1, false);
            graphite.getDetailsController().setSelectedInspectItem(null);
            graphite.events.trigger('dropperStart');
        },

        disableDropperTool: function () {
            graphite.getDetailsController().changeActiveTool(Constants.Tool.SELECT_DIRECT);
            graphite.events.trigger('dropperStop');
        },

        rectIntersectsWith: function (a, b) {
            if (a.left < b.right && b.left < a.right && a.top < b.bottom) {
                return b.top < a.bottom;
            }
            return false;
        },

        rectIntersect: function (a, b) {
            var x = Math.max(a.left, b.left),
                y = Math.max(a.top, b.top),
                overlapX = Math.min(a.right, b.right),
                overlapY = Math.min(a.bottom, b.bottom);
            if (overlapX >= x && overlapY >= y) {
                return {
                    left: x - b.left,
                    top: y - b.top,
                    width: overlapX - x,
                    height: overlapY - y,
                    destLeft: x - a.left,
                    destTop: y - a.top
                };
            }
            return null;
        },

        findIntersectsBackToFront: function (rect, collection, intersects) {
            var layerCollection = collection || this.psdModel.get('layerCollection'),
                results = intersects || [],
                layerItem,
                origItem,
                layerBounds,
                flattenedSprite,
                flattenedParent,
                childCollection,
                intersect,
                i;

            if (layerCollection) {
                for (i = layerCollection.length - 1; i >= 0; i--) {

                    layerItem = origItem = layerCollection.at(i);
                    layerBounds = MeasurementUtil.getVisibleBounds(layerItem, this.psdModel, true);
                    flattenedSprite = layerItem.get('flattenedSprite');
                    flattenedParent = layerItem.get('flattenedParent');

                    // Bubble up to flattened sprite if necessary
                    if (layerItem.get('visible') && flattenedParent) {
                        layerItem = LayerModelMap.getLayerModelFromId(flattenedParent);
                        flattenedSprite = layerItem.get('flattenedSprite');
                    }

                    if (flattenedSprite) {
                        var psdOrigin = flattenedSprite.altPsdOrigin || flattenedSprite.psdOrigin;
                        layerBounds.left = psdOrigin.left;
                        layerBounds.top = psdOrigin.top;
                        layerBounds.bottom = layerBounds.top + (flattenedSprite.bounds.bottom - flattenedSprite.bounds.top);
                        layerBounds.right = layerBounds.left + (flattenedSprite.bounds.right - flattenedSprite.bounds.left);
                    }

                    if (origItem.getEffectiveVisibility()) {
                        childCollection = layerItem.get('layerCollection');
                        if (childCollection && !flattenedSprite) {
                            if (this.rectIntersectsWith(rect, layerBounds)) {
                                this.findIntersectsBackToFront(rect, childCollection, results);
                            }
                        } else {
                            intersect = this.rectIntersect(rect, layerBounds);
                            if (intersect) {
                                results.push({item: layerItem, intersect: intersect});
                            }
                        }

                        if (flattenedSprite) {
                            break;
                        }
                    }

                }
            }

            return results;
        },

//***** Asset Extraction Methods *****/
        canExtractAsset: function () {
            var selectedLayers = this.expandSelection(this.getSelectedLayers());

            return _.some(selectedLayers, function (value, index) {
                return value.canBeExtracted();
            });

        }

    });

    return new SelectionController();
});
