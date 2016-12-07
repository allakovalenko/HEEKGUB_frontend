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

define([
    'underscore',
    'backbone'
], function (_, Backbone) {
    'use strict';

    var LayerModelMap = Backbone.Model.extend({

        defaults: {
            psdLayersMap: {},
            layerNameMap: {}
        },

        initialize: function () {
            this.reset();
        },

        addLayerToMap: function (id, layerElem, flattenedElem, layerModel) {
            this.get('psdLayersMap')[id] = {item: layerElem, flattenedItem: flattenedElem, model: layerModel};
            this.get('layerNameMap')[layerModel.get('layerName')] = layerModel;
        },

        addModel: function (id, model) {
            this.idToModelMap[id] = model;
        },

        getLayerInfoForId: function (id) {
            return this.get('psdLayersMap')[id];
        },

        getLayerModelFromId: function (id) {
            var layer = this.get('psdLayersMap')[id];
            return layer ? layer.model : null;
        },

        getLayerModelFromName: function (layerName) {
            return this.get('layerNameMap')[layerName];
        },

        getModel: function (id) {
            return this.idToModelMap[id];
        },

        reset: function () {
            this.idToModelMap = {};
            this.flattenedLayers = [];
        },

        addFlattenedLayer: function (model) {
            this.flattenedLayers.push(model);
        },

        getFlattenedLayers: function () {
            return this.flattenedLayers;
        }

    });

    return new LayerModelMap();
});
