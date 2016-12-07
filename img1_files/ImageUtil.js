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

define(['jquery'], function ($) {
    'use strict';

    var ImageUtil = {

        ImageScaleType: {
            FIT: 'fit',
            FILL: 'fill'
        },

        // TO DO:  consolidate these 2 functions
        calcImageSizeToFit: function (image, targetWidth, targetHeight) {
            var ratio = image.naturalWidth / image.naturalHeight;
            var w, h;
            if (ratio * targetHeight > targetWidth) {
                w = targetWidth;
                h = targetWidth / ratio;
            } else {
                h = targetHeight;
                w = targetHeight * ratio;
            }

            var x = (targetWidth - w) / 2;
            var y = (targetHeight - h) / 2;

            return {width: w, height: h, x: x, y: y};
        },


        calcImageSizeToFill: function (image, targetWidth, targetHeight) {
            var ratio = image.naturalWidth / image.naturalHeight;

            var w, h;
            if (ratio * targetHeight < targetWidth) {
                w = targetWidth;
                h = targetWidth / ratio;
            } else {
                h = targetHeight;
                w = targetHeight * ratio;
            }

            return {width: w, height: h};
        },

        // Please pass in an image element, not a jquery object
        sizeAndCenterImage: function (image, targetWidth, targetHeight, scaleType, scaleUp) {
            var info, nw, nh;
            if (scaleType === this.ImageScaleType.FIT) {
                info = this.calcImageSizeToFit(image, targetWidth, targetHeight);
            } else {
                info = this.calcImageSizeToFill(image, targetWidth, targetHeight);
            }

            nw = info.width;
            nh = info.height;

            if (!scaleUp) {
                var imageWidth = image.naturalWidth;
                var imageHeight = image.naturalHeight;

                nw = imageWidth !== 0 ? Math.min(info.width, imageWidth) : info.width;
                nh = imageHeight !== 0 ? Math.min(info.height, imageHeight) : info.height;
            }

            $(image).width(nw + 'px');
            $(image).height(nh + 'px');

            $(image).css('margin-left', (targetWidth - nw) / 2 + 'px');
            $(image).css('margin-top', (targetHeight - nh) / 2 + 'px');
        }

    };

    return ImageUtil;
});
