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
    '../utils/CSSUtil'
], function (_, Backbone, CSSUtil) {
    'use strict';
    var TextStyleModel = Backbone.Model.extend({

        defaults: {
            fontName: '',
            fontFace: '',
            size: '',
            sizeUnits: ''
        },

        parse: function (response) {
            return CSSUtil.getFontInfo(response);
        },


        isEqual: function (style) {
            return style && style instanceof TextStyleModel &&
                this.get('fontName') === style.get('fontName') &&
                this.get('fontFace') === style.get('fontFace') &&
                this.get('size') === style.get('size');
        },


        toString: function() {
            return this.get('fontName') + ',' + this.get('fontFace') + ',' + this.get('size');
        },

        getCSS: function (showVendorPrefixes, ppi) {
            var cssArray = [
                    {property: 'font-family', value: this.get('fontName')},
                    {property: 'font-size', value: (CSSUtil.convertPSDUnitsToPreferredUnits(this.get('size'), true)) }
                ],
                fontStyleArray = CSSUtil.fontStyleNameToCSS(this.get('fontFace'));

            if (fontStyleArray.length > 0) {
                cssArray = cssArray.concat(fontStyleArray);
            }
            return cssArray;
        }
    });

    return TextStyleModel;
});
