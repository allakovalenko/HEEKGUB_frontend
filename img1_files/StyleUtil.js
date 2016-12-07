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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */

define([
    '../models/BaseStyleUsageModel',
    '../models/ColorModel',
    '../models/GradientModel',
    '../models/TextStyleModel'
], function (BaseStyleUsageModel, ColorModel, GradientModel, TextStyleModel) {
    'use strict';
    var StyleUtil = {

        areUsageStylesEqual: function (styleUsage1, styleUsage2) {
            var isEqual = false;
            if (styleUsage1 && styleUsage2 &&
                    (styleUsage1 instanceof BaseStyleUsageModel) &&
                    (styleUsage2 instanceof BaseStyleUsageModel)) {
                var style1 = styleUsage1.get('style');
                var style2 = styleUsage2.get('style');

                if ((style1 instanceof ColorModel && style2 instanceof ColorModel) ||
                        (style1 instanceof GradientModel && style2 instanceof GradientModel) ||
                        (style1 instanceof TextStyleModel && style2 instanceof TextStyleModel)) {
                    isEqual = style1.isEqual(style2);
                }
            }

            return isEqual;
        }

    };

    return StyleUtil;

});
