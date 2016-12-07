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
/*global define: true, graphite: true, unescape: true, localStorage: true, window: true, navigator: true*/

define([
    'jquery',
    './ImageUtil'
], function ($, ImageUtil) {
    'use strict';
    var SpriteSheetUtils = {

        drawSprite: function (view, selector, data, htmltag, constrainContainer) {
            var theBounds = data.bounds;
            return function (image) {
                var wrapperWidth,
                    wrapperHeight,
                    width,
                    height,
                    bnds,
                    info,
                    nw,
                    nh,
                    theCanvas = htmltag[0],
                    context = theCanvas.getContext('2d');

                width = theBounds.right - theBounds.left;
                height = theBounds.bottom - theBounds.top;

                if (constrainContainer) {
                    wrapperWidth = parseInt($(view.el).find(selector).css('max-width'), 10);
                    wrapperHeight = parseInt($(view.el).find(selector).css('max-height'), 10);

                    // Maintain aspect
                    if (wrapperHeight) {
                        wrapperHeight = Math.min(wrapperHeight, height);
                    }
                } else {
                    wrapperWidth = parseInt($(view.el).find(selector).css('width'), 10);
                    wrapperHeight = parseInt($(view.el).find(selector).css('height'), 10);
                    if (wrapperWidth === 0) {
                        wrapperWidth = 40;
                        wrapperHeight = 30;
                    }
                }

                bnds = { naturalWidth: width,
                    naturalHeight: height};
                info = ImageUtil.calcImageSizeToFit(bnds, wrapperWidth,
                            wrapperHeight || height);
                nw = info.width;
                nh = info.height;
                theCanvas = htmltag[0];

                if (constrainContainer) {
                    wrapperHeight = nh;
                }

                theCanvas.width = wrapperWidth;
                theCanvas.height = wrapperHeight;
                context.drawImage(image, theBounds.left, theBounds.top, width, height, (wrapperWidth - nw) / 2, (wrapperHeight - nh) / 2, nw, nh);
            };
        },

        drawSpriteRect: function (view, theBounds, data, selector, htmltag, constrainContainer) {
            var wrapperWidth,
                wrapperHeight,
                width,
                height,
                bnds,
                info,
                nw,
                nh,
                theCanvas = htmltag[0],
                context = theCanvas.getContext('2d');

            width = theBounds.right - theBounds.left;
            height = theBounds.bottom - theBounds.top;

            if (constrainContainer) {
                wrapperWidth = parseInt($(view.el).find(selector).css('max-width'), 10);
                wrapperHeight = parseInt($(view.el).find(selector).css('max-height'), 10);
                // Maintain aspect
                if (wrapperHeight) {
                    wrapperHeight = Math.min(wrapperHeight, height);
                }
            } else {
                wrapperWidth = parseInt($(view.el).find(selector).css('width'), 10);
                wrapperHeight = parseInt($(view.el).find(selector).css('height'), 10);
                if (wrapperWidth === 0 || wrapperHeight === 0) {
                    wrapperWidth = 40;
                    wrapperHeight = 30;
                }
            }

            bnds = { naturalWidth: width,
                naturalHeight: height};
            info = ImageUtil.calcImageSizeToFit(bnds, wrapperWidth,
                    wrapperHeight || height);
            nw = info.width;
            nh = info.height;
            theCanvas = htmltag[0];

            if (constrainContainer) {
                wrapperHeight = nh;
            }

            theCanvas.width = wrapperWidth;
            theCanvas.height = wrapperHeight;

            context.globalAlpha = data.opacity / 255;
            context.beginPath();
            context.rect((wrapperWidth - nw) / 2, (wrapperHeight - nh) / 2, nw, nh);
            context.fillStyle = 'rgb(' + data.color.red + ',' + data.color.green + ',' + data.color.blue + ')';
            context.fill();
        },

        renderSpriteModel: function (view, model, containerSelector, canvasSelector, constrainContainer) {
            var spriteSheet = model.get('spriteSheet');
            if (spriteSheet) {
                if (spriteSheet.sheetID) {
                    graphite.getDetailsController().drawSpriteSheet(spriteSheet.sheetID, this.drawSprite(view, containerSelector, spriteSheet, view.$el.find(canvasSelector), constrainContainer), this);
                } else if (spriteSheet.color) {
                    this.drawSpriteRect(view, model.get('bounds'), spriteSheet, containerSelector, view.$el.find(canvasSelector), constrainContainer);
                }
            } else {
                var data = {opacity: 0, color: {red: 0, green: 0, blue: 0}},
                    $canvas = view.$el.find(canvasSelector);
                if ($canvas.length) {
                    this.drawSpriteRect(view, model.get('bounds'), data, containerSelector, view.$el.find(canvasSelector));
                }
            }
        }

    };

    return SpriteSheetUtils;
});
