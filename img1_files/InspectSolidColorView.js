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

define([
    'underscore',
    '../inspect/BaseInspectColorView',
    '../../controllers/SelectionController'
], function (_, BaseInspectColorView, SelectionController) {
    'use strict';
    var InspectSolidColorView = BaseInspectColorView.extend({
        render: function () {
            BaseInspectColorView.prototype.render.apply(this, arguments);

            this.$el.find('.color-chip').css('background-color',
                this.model.get('style').toRGBString());
        },

        getStylesForSelection: function () {
            return SelectionController.get('extractedStylesInSelection').colorUsageModels;
        },

        getStylesForLayer: function (layer) {
            // return an array of style usageModels.
            return layer.getUsageModels().colorUsageModels;
        }

    });

    return InspectSolidColorView;
});
