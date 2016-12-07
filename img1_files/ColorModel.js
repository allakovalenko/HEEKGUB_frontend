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
    var ColorModel = Backbone.Model.extend({

        defaults: {
            red: '',
            green: '',
            blue: '',
            alpha: 1.0
        },

        parse: function (response) {
            var result = {};
            result.red = Math.round(response.red);
            result.green = Math.round(response.green);
            result.blue = Math.round(response.blue);

            return result;
        },

        isEqual: function (color, compareAlpha) {
            var equal = color && color instanceof ColorModel &&
                this.get('red') === color.get('red') &&
                this.get('green') === color.get('green') &&
                this.get('blue') === color.get('blue');

            // by default don't compare alpha
            if (compareAlpha) {
                equal = equal && this.get('alpha') === color.get('alpha');
            }

            return equal;
        },

        toRGBString: function (alpha) {
            var rgb = '(' + this.get('red') + ', ' + this.get('green') + ', ' + this.get('blue');
            var colorString = '';
            if (alpha === 1 || alpha === null || alpha === undefined) {
                colorString = 'rgb' + rgb + ')';
            } else {
                colorString = 'rgba' + rgb + ', ' + parseFloat(alpha) + ')';
            }
            return colorString;
        },

        toHEXString: function (alpha) {
            if (alpha === null || alpha === undefined) {
                alpha = 1;
            }

            var hex = CSSUtil.rgbToHEX(this.get('red'), this.get('green'), this.get('blue'));
            var opacity = '';

            if (!(alpha === 1 || alpha === null || alpha === undefined)) {
                opacity = '; opacity: ' + alpha + ';';
            }

            return hex + opacity;
        },


        toHSLString: function (alpha) {
            var hsl = CSSUtil.rgbaToHSL(this.get('red'), this.get('green'), this.get('blue'), alpha);
            return hsl;
        }

    });

    return ColorModel;
});
