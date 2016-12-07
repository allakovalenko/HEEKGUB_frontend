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
    '../collections/LayerCollection',
    './LayerCompModel',
    './LayerModelMap',
    './UsageModelMap',
    '../utils/MeasurementUtil',
    '../utils/UTF8',
    '../controllers/DetailsController'
], function (_, Backbone, Constants, LayerCollection, LayerCompModel, LayerModelMap, UsageModelMap, MeasurementUtil, UTF8, DetailsController) {
    'use strict';

    function mergeSpriteSheetAndJSONData(jsonData, spriteSheetData) {
        var layerMap = [],
            mergeLayers = function(layers) {
                _.each(layers, function (layer) {
                    var mappedLayer = layerMap[layer.layerId];
                    if (mappedLayer) {
                        layer.spriteSheet = mappedLayer.spriteSheet;
                        if (mappedLayer.flattenedSprite) {
                            layer.flattenedSprite = mappedLayer.flattenedSprite;
                        }
                    }

                    if (layer.children) {
                        mergeLayers(layer.children);
                    }
                });
            };

        _.each(spriteSheetData.layers, function(layer) {
            layerMap[layer.layerId] = layer;
        });

        mergeLayers(jsonData.children);
        jsonData.dataType = 'complete';

        return jsonData;
    }

    var PSDModel = Backbone.Model.extend({

        defaults: {
            id: '',
            info: '',
            imgdata: null,
            isArtboardPSD: false,
            artboardsBounds: null, //The union of the bounds of all the artboards. Used for ZoomToFit
            artboards: null,
            layerCollection: null,
            layerComps: null,
            layerCompId: null,
            extractedStyles: null,
            localContent: false,
            status: 0
        },

        toString: function () {
            return '[object PSDModel id: ' + this.get('id') + ', info: ' + this.get('info') + ']';
        },

        initialize: function (options) {
            this.id = options.id;
            this.set('imgdata', {originalFile: '', bounds: {bottom: 0, left: 0, right: 0, top: 0 }});
        },

        decodeChildNames: function (children) {
            var that = this;
            if (children) {
                children.forEach(function (child) {
                    child.layerName = UTF8.decodeCharacters(child.layerName);
                    that.decodeChildNames(child.children);
                });
            }
        },

        parse: function (response) {
            response.dataType = response.dataType || 'complete';
            if (response.dataType === 'spriteSheetOnly') {
                if (this.jsonData) {
                    response = mergeSpriteSheetAndJSONData(this.jsonData, response);
                    delete this.jsonData;
                } else {
                    this.spriteSheetData = response;
                    var i,
                        dummyFunc = function (image) { };

                    if (response.info && response.info.totalSheets) {
                        for (i = 1; i <= response.info.totalSheets; i++) {
                            DetailsController.drawSpriteSheet(i, dummyFunc);
                        }
                    }
                    return;
                }
            } else if (response.dataType === 'JSONOnly') {
                this.decodeChildNames(response.children);
                if (this.spriteSheetData) {
                    response = mergeSpriteSheetAndJSONData(response, this.spriteSheetData);
                    delete this.spriteSheetData;
                } else {
                    this.jsonData = response;
                }
            } else {
                this.decodeChildNames(response.children);
            }

            if (response.imgdata && response.imgdata.originalFile) {
                response.imgdata.originalFile = decodeURIComponent(response.imgdata.originalFile);
            }

            this.set('imgdata', response.imgdata);
            this.set('info', response.info);
            this.set('width', response.imgdata.bounds.right);
            this.set('height', response.imgdata.bounds.bottom);
            this.set('dataType', response.dataType);

            LayerModelMap.reset();
            UsageModelMap.reset();

            var layerCollection = new LayerCollection();
            layerCollection.add(layerCollection.parse(response.children), {parse: true});
            var usageModels = this.extractStyles(layerCollection);
            this.set('layerCollection', layerCollection);

            //Calc the artboard info
            var artboardsList,
                artboardsBounds = null;

            artboardsList = layerCollection.reduce(function(array, layer) {
                if (layer.get('type') === Constants.Type.LAYER_ARTBOARD) {
                    array.push(layer);
                }
                return array;
            }, []);
            if (artboardsList.length > 0) {
                artboardsBounds = MeasurementUtil.calcLayerGroupBounds(artboardsList, this);
            }
            this.set('isArtboardPSD', artboardsList.length > 0);
            this.set('artboardsBounds', artboardsBounds);
            this.set('artboards', response.imgdata.artboards);

            //trigger the numLayer event to track # of layers in psd
            graphite.events.trigger('num-layers', response.imgdata);

            this.set('extractedStyles', usageModels);

            var layerComps = this.extractLayerComps(response.layerComps);
            this.set('layerComps', layerComps);
            graphite.events.trigger('layerCompsLoaded');

            var layerCompId = this.get('layerCompId');
            if (layerComps && layerComps.length && !layerCompId) {
                //Checking !layerCompId ensures that we only fire this once per PSD
                graphite.events.trigger('layerCompShown');
            }
            this.set('status', 200);
            this.unset('errorInfo');
        },

        extractStyles: function (layers) {
            var layer,
                usageModels = {
                    colorUsageModels: [],
                    gradientUsageModels: [],
                    textStyleUsageModels: [],
                    dataType: this.get('dataType')
                },
                i,
                newUsageModels;

            for (i = 0; i < layers.length; i++) {
                layer = layers.at(i);
                newUsageModels = layer.getUsageModels();
            }

            usageModels.colorUsageModels = _.clone(UsageModelMap.getColorUsageModelList());
            usageModels.gradientUsageModels = _.clone(UsageModelMap.getGradientUsageModelList());
            usageModels.textStyleUsageModels = _.clone(UsageModelMap.getTextStyleUsageModelList());

            return usageModels;
        },

        extractLayerComps: function (comps) {
            var comp,
                layerComp,
                i,
                result = [];

            for (i = 0; i < comps.length; i++) {
                comp = comps[i];
                layerComp = new LayerCompModel({
                    id: comp.id,
                    name: UTF8.decodeCharacters(comp.name),
                    capturedInfo: comp.capturedInfo
                });
                result.push(layerComp);
            }
            return result;
        },

        _resetLayerSelection: function (layers) {
            var self = this;
            if (layers) {
                layers.each(function (layer) {
                    layer.set('selected', false);
                    layers = layer.get('layerCollection');
                    self._resetLayerSelection(layers);
                });
            }
        },

        reset: function () {
            this._resetLayerSelection(this.get('layerCollection'));
        }
    });

    return PSDModel;
});
