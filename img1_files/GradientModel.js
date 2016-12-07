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
    var GradientModel = Backbone.Model.extend({

        compiledColorStops: [],

        defaults: {
            enabled: true,
            reverse: false,
            align: true,
            opacity: 100,
            angle: 0,
            mode: 'normal',
            type: 'linear',
            gradient: null
        },

        initialize: function () {
            this.set('layers', []);
            var angle = this.get('angle'),
                type = this.get('type'),
                bounds = this.get('layerModel').get('bounds'),
                height = bounds.bottom - bounds.top,
                width = bounds.right - bounds.left,
                gradientLineLengthPhotoshop = this.getGradientLineLengthPhotoshop(bounds),
                gradientLineLengthCSS = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle)),
                percentageOfOriginalDimension = angle % 45 === 0 || type !== 'linear' ? 1 : Math.min(gradientLineLengthPhotoshop / gradientLineLengthCSS, 1);

            this.set('percentageOfOriginalDimension', percentageOfOriginalDimension);

            this.generateColorStops();

        },

        isEqual: function (gradient) {
            // 'align', 'mode'???
            return gradient &&
                this.get('reverse') === gradient.get('reverse') &&
                this.get('angle') === gradient.get('angle') &&
                this.get('type') === gradient.get('type') &&
                this.get('percentageOfOriginalDimension') === gradient.get('percentageOfOriginalDimension') &&
                JSON.stringify(this.get('gradient')) === JSON.stringify(gradient.get('gradient'));  // :Ming: may need more complete compare in the future
        },

        toString: function() {
            return JSON.stringify(this.get('gradient')) + ',' + this.get('reverse') + ',' + this.get('angle') + ',' + this.get('type') + ',' + this.get('percentageOfOriginalDimension');
        },


        /**
         * Linearly interpolate between two values
         * @param {float} t Value between 0 and 1, indicating how far to go in the range a to b
         * @param {number} a First value
         * @param {number} b Second value
         * @returns {number} Calculated value 't'th of the way from a to b
         */
        linearInterp: function (t, a, b) {
            return Math.round(t * (b - a) + a);  // Same as (1-t)*a + t*b
        },

        /**
         * Take colors array, find the color value at the given location.
         * If found, return the matching color object.
         * If not found, interpolate between available values in the array.
         * @param {Array} colors
         * @param {Integer} location
         * @returns {Object} color object
         */
        getColorForLocation: function (colorStops, location) {
            if (colorStops) {
                var len = colorStops.length,
                    last = len - 1,
                    i,
                    colorStop,
                    prevColorStop,
                    t,
                    newVal;

                if (location <= colorStops[0].location) {
                    // If color location is before or at the first color location,
                    // use the first colorStop
                    return _.clone(colorStops[0].color);
                }
                if (location >= colorStops[last].location) {
                    // If color location is at or past the last color location,
                    // use the last colorStop.
                    return _.clone(colorStops[last].color);
                }
                // otherwise look through the colorStop array
                for (i = 1; i < len; i++) {
                    colorStop = colorStops[i];
                    if (colorStop.location === location) {
                        return _.clone(colorStop.color);
                    }
                    if (colorStop.location > location) {
                        // This color location is too far, so interpolate between previous one and this one.
                        prevColorStop = colorStops[i - 1];
                        t = (location - prevColorStop.location) / (colorStop.location - prevColorStop.location);
                        newVal = {
                            red: this.linearInterp(t, prevColorStop.color.red, colorStop.color.red),
                            green: this.linearInterp(t, prevColorStop.color.green, colorStop.color.green),
                            blue: this.linearInterp(t, prevColorStop.color.blue, colorStop.color.blue),
                            alpha: this.linearInterp(t, prevColorStop.color.alpha, colorStop.color.alpha)
                        };
                        return newVal;
                    }
                }
            }
            // If we fall through everything above, we fail...
            return {};
        },

        /**
         * Take transparency array, find the transparency value at the given location.
         * If found, return the matching opacity object.
         * If not found, interpolate between available values in the array.
         * @param {Array} transparency
         * @param {Integer} location
         * @returns {Object} opacity
         */
        getOpacityForLocation: function (transparency, location) {
            if (transparency) {
                var len = transparency.length,
                    last = len - 1,
                    i,
                    transp,
                    prevTransp,
                    t,
                    newVal;

                if (location <= transparency[0].location) {
                    // If color location is before or at the first transparency location,
                    // use the first transparency opacity.
                    return transparency[0].opacity;
                }
                if (location >= transparency[last].location) {
                    // If color location is at or past the last transparency location,
                    // use the last transparency opacity.
                    return transparency[last].opacity;
                }
                // otherwise look through the transparency array
                for (i = 1; i < len; i++) {
                    transp = transparency[i];
                    if (transp.location === location) {
                        return transp.opacity;
                    }
                    if (transp.location > location) {
                        // This transp location is too far, so interpolate between previous one and this one.
                        // Make sure they both use the same units though.
                        prevTransp = transparency[i - 1];
                        t = (location - prevTransp.location) / (transp.location - prevTransp.location);
                        newVal = this.linearInterp(t, prevTransp.opacity, transp.opacity);
                        return newVal;
                    }
                }
            }
            // If we fall through everything above, return 100%
            return 100;
        },

        generateColorStopString: function (colorStop, percentage, alpha) {
            if (alpha === null || alpha === undefined) {
                alpha = 1;
            }
            var colorStopString = CSSUtil.getDefaultColorString(colorStop.color.red, colorStop.color.green, colorStop.color.blue, colorStop.color.alpha * alpha) + ' ',
                locationAsPercentage = (Math.floor(colorStop.location / 4096 * 100)),
                scaledLocationAsPercentage = Math.round((locationAsPercentage * percentage) + (((1 - percentage) * 100) / 2));

            colorStopString += scaledLocationAsPercentage + '%';
            return colorStopString;
        },

        generateColorStops: function () {
            var transparency = this.get('gradient').transparency,
                transLen = transparency ? transparency.length : 0,
                skipTransparency,
                colors = this.get('gradient').colors,
                processedLocations = {},
                previousColorStop,
                midpoint,
                i;

            if (!colors) {
                return [];
            }

            // create intermediate color stops based on midpoint or transparency
            this.compiledColorStops = [];

            // get all color stops first
            for (i = 0; i < colors.length; i++) {
                var colorStop = _.clone(colors[i]);
                // if midpoint not 50%, create previous interpolated color stop based on midpoint location
                if (colorStop.midpoint !== 50 && i > 0) {
                    midpoint = colorStop.midpoint / 100; // midpoint is a percentage, convert it to decimal
                    previousColorStop = colors[i - 1];
                    // create new stop and interpolate the colors
                    var midpointColorStop = {};
                    midpointColorStop.location = this.linearInterp(midpoint, previousColorStop.location, colorStop.location);
                    midpointColorStop.color = {
                        red: this.linearInterp(midpointColorStop.location / 4096, previousColorStop.color.red, colorStop.color.red),
                        green: this.linearInterp(midpointColorStop.location / 4096, previousColorStop.color.green, colorStop.color.green),
                        blue: this.linearInterp(midpointColorStop.location / 4096, previousColorStop.color.blue, colorStop.color.blue),
                        alpha: this.getOpacityForLocation(transparency, midpointColorStop.location) / 100
                    };
                    this.compiledColorStops.push(midpointColorStop);
                    processedLocations[midpointColorStop.location] = true;
                }
                colorStop.color.alpha = this.getOpacityForLocation(transparency, colorStop.location) / 100;
                this.compiledColorStops.push(colorStop);
                processedLocations[colorStop.location] = true;
            }

            // then figure out if we need to create more stops from opacity stops
            for (i = 0; i < transLen; i++) {
                // If the current location does not have a CSS color stop yet
                if (!processedLocations[transparency[i].location]) {
                    skipTransparency = false;
                    // Check to see if the opacity is actually different on either side, otherwise, no need to process this stop
                    if (transLen > 1) {
                        if (i === 0) {
                            if (transparency[0].opacity === transparency[1].opacity) {
                                skipTransparency = true;
                            }
                        } else if (i === transLen - 1) {
                            if (transparency[transLen - 2].opacity === transparency[transLen - 1].opacity) {
                                skipTransparency = true;
                            }
                        } else if (transLen > 2) {
                            if (transparency[i].opacity === transparency[i - 1].opacity && transparency[i].opacity === transparency[i + 1].opacity) {
                                skipTransparency = true;
                            }
                        }
                    }

                    if (!skipTransparency) {
                        var transparencyStop = {};
                        transparencyStop.location = transparency[i].location;
                        transparencyStop.color = this.getColorForLocation(this.compiledColorStops, transparencyStop.location);
                        // override the alpha with the alpha provided
                        transparencyStop.color.alpha = transparency[i].opacity / 100;

                        this.compiledColorStops.push(transparencyStop);
                    }
                }
            }

            // sort color stops by location
            this.compiledColorStops.sort(function (a, b) {
                if (a.location < b.location) {
                    return -1;
                }
                if (a.location > b.location) {
                    return 1;
                }
                return 0;
            });

            if (this.get('reverse')) {
                var len = this.compiledColorStops.length,
                    lastIndex = len - 1,
                    tempLocation,
                    stopA,
                    stopB;

                this.compiledColorStops.reverse();

                // flip all the locations
                for (i = 0; i < Math.floor(len / 2); i++) {
                    stopA = this.compiledColorStops[i];
                    stopB = this.compiledColorStops[lastIndex - i];
                    tempLocation = stopA.location;
                    stopA.location = stopB.location;
                    stopB.location = tempLocation;
                }
            }
        },

        getCSS: function (showVendorPrefixes, alpha) {
            var style = '',
                prefixedStyle,
                i;

            for (i = 0; i < this.compiledColorStops.length; i++) {
                style += this.generateColorStopString(this.compiledColorStops[i], this.get('percentageOfOriginalDimension'), alpha) + ', ';
            }

            style = style.substring(0, style.length - 2) + ')';

            switch (this.get('type')) {
            case 'linear':
                prefixedStyle = 'linear-gradient(' + this.get('angle') + 'deg, ' + style;
                style = 'linear-gradient(' + (90 - this.get('angle')) + 'deg, ' + style;
                break;
            case 'radial':
                var shape = 'circle ',
                    angle = Math.abs(this.get('angle')),
                    scale = (this.get('scale') || 100) / 100,
                    bounds = this.get('layerModel').get('bounds'),
                    height = bounds.bottom - bounds.top,
                    width = bounds.right - bounds.left;
                if (angle === 0 || angle === 180) {
                    if (height < width) {
                        shape += 'farthest-side';
                    } else {
                        shape += 'closest-side';
                    }
                } else if (angle === 90 || angle === 270) {
                    if (height > width) {
                        shape += 'farthest-side';
                    } else {
                        shape += 'closest-side';
                    }
                } else {
                    shape += Math.round(scale * this.getGradientLineLengthPhotoshop(bounds)) + 'px';
                }

                style = 'radial-gradient(' + shape + ' at 50%, ' + style;
                prefixedStyle = style;
                break;
            default:
                console.warn('Unknown gradient type: ', this.get('type'));
                return [];
            }

            return showVendorPrefixes ? [
                {property: 'background', value: '-webkit-' + prefixedStyle},
                {property: 'background', value: '-moz-' + prefixedStyle},
                {property: 'background', value: '-o-' + prefixedStyle},
                {property: 'background', value: '-ms-' + prefixedStyle},
                {property: 'background', value: style}
            ] : [{property: 'background', value: style}];
        },

        getGradientLineLengthPhotoshop: function (bounds) {
            // find the center
            var centerX = (bounds.left + bounds.right) * 0.5;
            var centerY = (bounds.top + bounds.bottom) * 0.5;
            var realAngle = this.get('angle');
            var isNeg = realAngle < 0;
            if (isNeg) {
                realAngle = -realAngle;
            }
            // Copied comment from Photoshop... UGradientTool.cpp
            ////////////////////////////////////////////////////////////////////
            // Create a square which represents a tight bounding
            // square of the bounds.
            // Locate the pt on the squares boudary that is the
            // intersection of a line at the given angle
            // that originates at the center of the square.
            // This is easily done via linear interpolation
            // from the corners.

            // Then if the pt lies outside the bounds, clip it
            // to find a pt that is on it's boundary

            // While it is a long routine it is very simple math
            // with no trig functions or sqrts required.  The code path
            // for a given angle is short.
            // jgh 4/21/00
            var startPt = {}, endPt = {};
            var startX, startY, anglescale, deltaX, deltaY;
            var halfWidth = (bounds.right - bounds.left) * 0.5;
            var halfHeight = (bounds.bottom - bounds.top) * 0.5;

            if (realAngle === 90) {
                startX = centerX;
                if (!isNeg) {
                    startY = bounds.top;
                } else {
                    startY = bounds.bottom;
                }
            } else {
                var radius = halfWidth >= halfHeight ? halfWidth : halfHeight;
                if (radius === 0) {
                    startY = centerY;
                    startX = centerX;
                } else {
                    var squareBounds = {
                        top: centerY - radius,
                        left: centerX - radius,
                        bottom: centerY + radius,
                        right: centerX + radius
                    };

                    if (realAngle <= 45) {
                        anglescale = realAngle / 45;
                        deltaY = radius * anglescale;
                        if (halfHeight <= halfWidth) {
                            startY = centerY + deltaY;
                            if (startY > bounds.bottom) {
                                // we need to scale x and pin y
                                startX = centerX + ((radius / deltaY) * halfHeight);
                                startY = bounds.bottom;
                            } else {
                                startX = squareBounds.right;
                            }
                        } else {
                            // we need to scale y and pin x
                            startY = centerY + ((deltaY / radius) * halfWidth);
                            startX = bounds.right;
                        }
                    } else if (realAngle <= 90) {
                        realAngle -= 45;
                        anglescale = 1.0 - (realAngle / 45);
                        deltaX = radius * anglescale;
                        if (halfWidth <= halfHeight) {
                            startX = centerX + deltaX;
                            if (startX > bounds.right) {
                                // we need to scale y and pin x
                                if (deltaX !== 0) {
                                    startY = centerY + ((radius / deltaX) * halfWidth);
                                } else {
                                    startY = centerY;
                                }
                                startX = bounds.right;
                            } else {
                                startY = squareBounds.bottom;
                            }
                        } else {
                            // we need to scale x and pin y
                            startX = centerX + ((deltaX / radius) * halfHeight);
                            startY = bounds.bottom;
                        }
                    } else if (realAngle <= 135) {
                        realAngle -= 90;
                        anglescale = (realAngle / 45);
                        deltaX = radius * anglescale;
                        if (halfWidth <= halfHeight) {
                            startX = centerX - deltaX;
                            if (startX < bounds.left) {
                                // we need to scale y and pin x
                                if (deltaX !== 0) {
                                    startY = centerY + ((radius / deltaX) * halfWidth);
                                } else {
                                    startY = centerY;
                                }
                                startX = bounds.left;
                            } else {
                                startY = squareBounds.bottom;
                            }
                        } else {
                            // we need to scale x and pin y
                            startX = centerX - ((deltaX / radius) * halfHeight);
                            startY = bounds.bottom;
                        }
                    } else {
                        realAngle -= 135;
                        anglescale = 1 - (realAngle / 45);
                        deltaY = radius * anglescale;

                        if (halfHeight <= halfWidth) {
                            startY = centerY + deltaY;
                            if (startY > bounds.bottom) {
                                // we need to scale x and pin y
                                if (deltaY !== 0) {
                                    startX = centerX - ((radius / deltaY) * halfHeight);
                                } else {
                                    startX = centerX;
                                }
                                startY = bounds.bottom;
                            } else {
                                startX = squareBounds.left;
                            }
                        } else {
                            // we need to scale y and pin x
                            startY = centerY + ((deltaY / radius) * halfWidth);
                            startX = bounds.left;
                        }
                    }
                    // reflect across the center if positive
                    if (!isNeg) {
                        startY = centerY - (startY - centerY);
                    }
                }
            }

            var offsetX = 0;
            var offsetY = 0;

            if (this.get('type') === 'linear') {
                endPt.h = Math.round((startX + offsetX));
                endPt.v = Math.round((startY + offsetY));

                // now reflect for the endpts

                startPt.h = Math.round((centerX + (centerX - startX) + offsetX));
                startPt.v = Math.round((centerY + (centerY - startY) + offsetY));
            } else {
                startPt.h = Math.round((centerX + offsetX));
                startPt.v = Math.round((centerY + offsetY));

                endPt.h = Math.round((startX + offsetX));
                endPt.v = Math.round((startY + offsetY));
            }

            // return the length
            var xLength = Math.abs(startPt.h - endPt.h);
            var yLength = Math.abs(startPt.v - endPt.v);
            return Math.sqrt(xLength * xLength + yLength * yLength);
        }
    });

    return GradientModel;
});
