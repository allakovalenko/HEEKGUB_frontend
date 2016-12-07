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
    'backbone',
    './BaseStyleUsageModel'
], function (_, Backbone, BaseStyleUsageModel) {
    'use strict';
    var ColorUsageModel = BaseStyleUsageModel.extend({

        defaults: {
            alphas: null
        },

        alphaMap: null, // private


        initialize: function (attributes) {
            BaseStyleUsageModel.prototype.initialize.apply(this, arguments);

            this.set('alphas', []);
            this.alphaMap = {};
        },

        addUsage: function (layerModel, color) {
            BaseStyleUsageModel.prototype.addUsage.apply(this, arguments);
            var found = false,
                layerAlpha,
                originalAlpha,
                alpha,
                style,
                alphas,
                i,
                ii;

            if (color instanceof ColorUsageModel) {
                style = color.get('style');
                originalAlpha = style.get('alpha');
                alphas = color.get('alphas');
                for (i = 0, ii = alphas.length; i < ii; i++) {
                    alpha = alphas[i] === undefined ? 1 : alphas[i];
                    style.set('alpha', alpha);
                    this.addUsage(layerModel, style);
                }
                style.set('alpha', originalAlpha);
                return;
            }

            layerAlpha = color.get('alpha');
            for (alpha in this.alphaMap) {
                if (this.alphaMap.hasOwnProperty(alpha) && alpha === String(layerAlpha)) {
                    found = true;
                    this.alphaMap[alpha].push(layerModel);
                }
            }

            if (!found) {
                this.alphaMap[layerAlpha] = [layerModel];
                this.get('alphas').push(layerAlpha);
            }
        }
    });

    return ColorUsageModel;
});
