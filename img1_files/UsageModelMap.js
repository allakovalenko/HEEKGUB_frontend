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

define([
    'underscore',
    'backbone',
    './ColorUsageModel',
    './GradientUsageModel',
    './TextStyleUsageModel'
], function (_, Backbone, ColorUsageModel, GradientUsageModel, TextStyleUsageModel) {
    'use strict';

    var UsageModelMap = Backbone.Model.extend({

        defaults: {
            usageModelMap: null,         //Maps styles to the usageModel instance that holds all the usages of that style
            colorUsageModelArray: null,
            gradientUsageModelArray: null,
            textStyleUsageModelArray: null
        },

        initialize: function () {
            this.reset();
        },

        addUsageModelToMap: function (style, usageModel) {
            if (usageModel instanceof ColorUsageModel) {
                this.get('usageModelMap')[style] = usageModel;
                this.get('colorUsageModelArray').push(usageModel);
            } else if (usageModel instanceof GradientUsageModel) {
                this.get('usageModelMap')[style] = usageModel;
                this.get('gradientUsageModelArray').push(usageModel);
            } else if (usageModel instanceof TextStyleUsageModel) {
                this.get('usageModelMap')[style] = usageModel;
                this.get('textStyleUsageModelArray').push(usageModel);
            } else {
                console.warn('Unknown usageModel type. Not added to map');
            }
        },

        getColorUsageModelList: function() {
            return this.get('colorUsageModelArray');
        },

        getGradientUsageModelList: function() {
            return this.get('gradientUsageModelArray');
        },

        getTextStyleUsageModelList: function() {
            return this.get('textStyleUsageModelArray');
        },

        getUsageModelForStyle: function(style) {
            return this.get('usageModelMap')[style];
        },

        reset: function() {
            this.set('usageModelMap', {});
            this.set('colorUsageModelArray', []);
            this.set('gradientUsageModelArray', []);
            this.set('textStyleUsageModelArray', []);
        }

    });

    return new UsageModelMap();
});