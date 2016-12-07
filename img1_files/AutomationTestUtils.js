/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2015 Adobe Systems Incorporated. All rights reserved.
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
/*global graphite: true*/

define([
    'underscore',
    '../vanilla-extract/public/js/core/controllers/SelectionController',
    '../vanilla-extract/public/js/core/models/LayerModelMap'

], function ( _, SelectionController, LayerModelMap ) {
    'use strict';

    var _clipboardData = null;

    var AutomationTestUtils = {
        initialize: function() {
            graphite.events.on('clipboard-text-set', this._captureClipboardContents);
        },

        _captureClipboardContents: function(clipText) {
            _clipboardData = clipText;
        },

        getClipboardContents: function() {
            return _clipboardData;
        },

        /* Expects either a string parameter with a layer name or an array of strings that are layer names to select.
         Note: the result returned (true/false) does not seem to pass back through to Nightwatch for an unknown
         reason.
         */
        selectLayers: function (layers) {
            if (!Array.isArray(layers)) {
                if (typeof layers === 'string') {
                    layers = [layers];
                } else {
                    return false;
                }
            }

            var layerModels = [],
                layerModel;

            for (var i = 0; i < layers.length; i++) {
                layerModel = LayerModelMap.getLayerModelFromName(layers[i]);
                if (layerModel) {
                    layerModels.push(layerModel);
                }
            }
            SelectionController.changeSelection(layerModels, false, false);
            return true;
        },

        getLayerBounds: function (layerName) {
            if (typeof layerName !== "string") {
                throw new Error("Layer name must be a string");
            }

            var layerModel = LayerModelMap.getLayerModelFromName(layerName);
            if (!layerModel) {
                throw new Error("Layer not found");
            }

            // TODO, maybe should get `flattenedItem` if available, or if `item`
            // is hidden by CSS?
            var element = LayerModelMap.getLayerInfoForId(layerModel.get('layerId')).item;
            if (!element || !element[0]) {
                throw new Error("Layer does not have an element");
            }

            return element[0].getBoundingClientRect();
        }

    };

    return AutomationTestUtils;

});
