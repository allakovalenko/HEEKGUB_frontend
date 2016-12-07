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
    'backbone'
], function (_, Backbone) {
    'use strict';
    var BaseStyleUsageModel = Backbone.Model.extend({

        defaults: {
            style: null,
            layers: null
        },

        initialize: function () {
            this.set('layers', []);
        },

        addUsage: function (layerModel) {
            var layers = this.get('layers');
            // A poor-persons' Set:
            if (layers.indexOf(layerModel) === -1) {
                layers.push(layerModel);
            }
        }

    });

    return BaseStyleUsageModel;

});
