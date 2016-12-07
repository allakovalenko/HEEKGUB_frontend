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
    'jquery',
    'underscore',
    'backbone',
    './LayerModelMap'

], function ($, _, Backbone, LayerModelMap) {
    'use strict';
    var mimeTypes = {
        png : 'image/png',
        svg : 'image/svg+xml',
        jpg : 'image/jpeg',
        jpeg : 'image/jpeg'
    };
    function getMimeByName(name) {
        if (!name) {
            return '';
        }
        var ext = name.substring(name.lastIndexOf('.') + 1);
        return mimeTypes[ext] || '';
    }
    var DerivedAssetModel = Backbone.Model.extend({

        defaults: {
            guid: '',
            name: '',
            mimeType: ''
        },

        hasLinkedSmartObject: function () {
            var originatingLayers = this.get('originatingLayers'),
                result = false,
                layerMap;

            if (originatingLayers) {
                result = originatingLayers.some(function(originatingLayer, layerIndex) {
                    layerMap = LayerModelMap.getLayerModelFromId(originatingLayer);
                    return layerMap ? layerMap.isLinkedSmartObject() : false;
                });
            }
            return result;
        },

        parse: function (response) {
            var result = {
                id: response.id,
                guid: response.id,
                name: response.name,
                mimeType: getMimeByName(response.name)
            };
            return result;
        }

    });

    return DerivedAssetModel;

});
