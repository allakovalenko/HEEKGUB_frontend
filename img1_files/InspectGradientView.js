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
    'underscore',
    '../inspect/BaseInspectColorView',
    '../../controllers/SelectionController',
    '../../utils/CSSUtil'
], function (_, BaseInspectColorView, SelectionController, CSSUtil) {
    'use strict';
    var InspectGradientView = BaseInspectColorView.extend({
        render: function () {
            BaseInspectColorView.prototype.render.apply(this, arguments);
            CSSUtil.applyCSS(this.$el.find('.color-chip'), this.model.get('style'), true);
        },

        handleClick: function () {
            if (this.model === graphite.getDetailsController().get('selectedInspectItem')) {
                graphite.events.trigger('hide-extract-code-popup');
            } else {
                graphite.events.trigger('show-extract-code-popup',
                    {sourceElement: this.$el.find('.color-chip'), model: this.model});
            }
            BaseInspectColorView.prototype.handleClick.apply(this, arguments);
        },

        getStylesForSelection: function () {
            return SelectionController.get('extractedStylesInSelection').gradientUsageModels;
        },

        getStylesForLayer: function (layer) {
            // return an array of style usageModels.
            return layer.getUsageModels().gradientUsageModels;
        }
    });

    return InspectGradientView;
});
