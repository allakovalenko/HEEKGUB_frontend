/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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
    '../Constants',
    '../utils/CSSUtil'
], function (Constants, CSSUtil) {
    'use strict';

    var ZoomController = {

        level: 1.0,
        prevLevel: null,
        isTransitioning: false,

        /* Sets the currrent zoom level and triggers an event to let others know it's happened. The event includes a
           a rect object that contains the bounds of the unzoomed PSD that should be shown in the viewport when the zoom
           animation is finished.
         */
        setZoomLevel: function (newLevel, rect) {
            newLevel = newLevel > 32 ? 32 : newLevel;

            this.prevLevel = this.level;
            this.level = newLevel;
            graphite.events.trigger('zoomChanged', rect);
        },

        getZoomLevel: function () {
            return this.level;
        },

        getZoomPercent: function () {
            return parseFloat((100.0 * this.level).toFixed(2)) + '%';
        },

        isZooming: function() {
            return this.isTransitioning;
        },

        /* Translates a point to or from the current zoom level
         */
        zoomPoint: function (point, invert) {
            var factor = invert ? 1 / this.level : this.level;
            return {
                x: point.x * factor,
                y: point.y * factor
            };
        },

        /* Translates a size object to or from the current zoom level
         */
        zoomSize: function (size, invert) {
            var factor = invert ? 1 / this.level : this.level;
            return this._calcZoomSizeForFactor(size, factor);
        },

        /* Translates a rect object to or from the current zoom level
         */
        zoomRect: function (bounds, invert) {
            var factor = invert ? 1 / this.level : this.level;
            return this.zoomRectToLevel(bounds, factor);
        },

        /* Translates a rect object to coordinates at a different zoom level
         */
        zoomRectToLevel: function (rect, factor) {
            return {
                top: Math.round(rect.top * factor),
                left: Math.round(rect.left * factor),
                bottom: Math.round(rect.bottom * factor),
                right: Math.round(rect.right * factor),
                width: Math.round((rect.right - rect.left) * factor),
                height: Math.round((rect.bottom - rect.top) * factor)
            };
        },

        /* Takes in a rect that contains the coordinates the user is currently looking at in the viewport at oldZoomLevel
           and returns a rect at the newZoomLevel that is centered on the same point as the oldRect.
         */
        getCenterZoomRect: function (oldRect, actualViewportSize, newZoomLevel, oldZoomLevel) {
            var midPointX,
                midPointY,
                scaledWidth,
                scaledHeight,
                zoomedRect;

            //Calc the center point of the incoming rect. We'll build a new scaled rect around that point
            if (oldRect.left >= 0) {
                midPointX = oldRect.left + (oldRect.right - oldRect.left)/2;
            } else {
                //If we have a negative left value, it means the left side of the PSD preview is indented in the viewport. We
                // need to calc the midpoint by determining how far off the midpoint of the rect is off from the center of the viewport
                var xViewCenter = actualViewportSize.width/2;
                midPointX = xViewCenter + oldRect.left;
            }
            if (oldRect.top >= 0) {
                midPointY = oldRect.top + (oldRect.bottom - oldRect.top)/2;
            } else {
                //If we have a negative left value, it means the left side of the PSD preview is indented in the viewport. We
                // need to calc the midpoint by determining how far off the midpoint of the rect is off from the center of the viewport
                var yViewCenter = actualViewportSize.height/2;
                midPointY = yViewCenter + oldRect.top;
            }

            //Now convert the midpoint to the coordinates at the unscaled size
            midPointX = midPointX / oldZoomLevel;
            midPointY = midPointY / oldZoomLevel;

            //Calc the amount of the scaled PSD we'll be able to show in the viewport
            scaledWidth = actualViewportSize.width / newZoomLevel;
            scaledHeight = actualViewportSize.height / newZoomLevel;

            //And now build a new rect that defines the portion of the PSD we want to show
            zoomedRect = {
                top: Math.round(midPointY - scaledHeight/2),
                left: Math.round(midPointX - scaledWidth/2),
                bottom: Math.round(midPointY + scaledHeight/2),
                right: Math.round(midPointX + scaledWidth/2)
            };

            return zoomedRect;
        },

        /* This is the biggie. This function simultaneously scrolls, scales, and sizes the jQuery element parameters.
           To make this happen there are 5 properties on 3 different elements that must all remain in sync. We do this
           by creating a simple animation function and updating all the properties on all the elements in the progress
           function.
         */
        zoomAndScrollElements: function ($zoomElem, $scrollElem, scrollRect, $sizeElem, $backgroundElem, psdSize, isArtboardPSD) {
            var self = this,
                scaleDiff = this.level - this.prevLevel,
                startSize = this._calcZoomSizeForFactor(psdSize, this.prevLevel),
                endSize = this._calcZoomSizeForFactor(psdSize, this.level),
                widthDiff = endSize.width - startSize.width,
                heightDiff = endSize.height - startSize.height,
                leftPosDiff,
                leftPosPadding, //Pad the left if the new rect isn't wide enough
                topPosDiff,
                topPosPadding, //Pad the top if the new rect isn't tall enough
                startLeftPos = $sizeElem.position().left,
                startTopPos = $sizeElem.position().top,
                viewWidth = $scrollElem.outerWidth() - Constants.PREVIEW_SCROLLBAR_SPACING,  //Account for scrollbar width
                viewHeight = $scrollElem.outerHeight() - Constants.PREVIEW_SCROLLBAR_SPACING;//and scrollbar height

            //The scroll rect comes in unscaled. Scale it to the new zoom size
            scrollRect = this.zoomRect(scrollRect);
            scrollRect.width = scrollRect.right - scrollRect.left;
            scrollRect.height = scrollRect.bottom - scrollRect.top;

            //Now compare the height & width to the view area width & height and determine how much padding to add
            leftPosPadding = Math.round((scrollRect.width - viewWidth)/2);
            topPosPadding = Math.round((scrollRect.height - viewHeight)/2);
            if (!isArtboardPSD) {
                //Fixes issue #2368. ZoomToFit for non-artboard PSDs does not vertically center when fitting the whole PSD.
                topPosPadding = 0;
            }

            //We don't want to deal with scroll position while animating, so first translate the scroll position into
            //top and left positions of the size element. We'll translate back into scroll positions in the zoomComplete
            //function.
            if (startLeftPos < 0) {
                $scrollElem.scrollLeft(0);
                $sizeElem.css({
                    left: startLeftPos
                });
            }
            if (startTopPos < 0) {
                startTopPos = -$scrollElem.scrollTop();
                $scrollElem.scrollTop(0);
            }
            $scrollElem.css('overflow', 'hidden'); //Turn off scroll bars while we're animating
            this._setElementTopLeft($sizeElem, startTopPos, startLeftPos);
            startLeftPos = $sizeElem.position().left;
            startTopPos = $sizeElem.position().top;

            //Figure out how much we need to change the left & top positions during the animation (to substitute for scrolling)
            leftPosDiff = startLeftPos + scrollRect.left + leftPosPadding;
            topPosDiff = startTopPos + scrollRect.top + topPosPadding;

            var zoomAndScrollProgressFunc = function(progress) {
                //Calculate all the property values for this step of the animation
                var scaleStepValue = self.prevLevel + (scaleDiff * progress),
                    sizeStepValue = {width: startSize.width + (widthDiff * progress),
                                     height: startSize.height + (heightDiff * progress)},
                    topStepValue = startTopPos - (topPosDiff * progress),
                    leftStepValue = startLeftPos - (leftPosDiff * progress);

                CSSUtil.applyPrefixedStyle($zoomElem, 'transform', 'scale(' + scaleStepValue + ', ' + scaleStepValue + ')');
                CSSUtil.applyPrefixedStyle($zoomElem, 'transform', 'scale3d(' + scaleStepValue + ', ' + scaleStepValue + ', 1)');
                CSSUtil.applyPrefixedStyle($zoomElem, 'transform-origin', '0 0');

                //Set the width and height of $sizeElem & $backgroundElem based on the progress percent
                self._setElementSize($sizeElem, sizeStepValue);
                self._setElementSize($backgroundElem, sizeStepValue);

                //Only deal with the top and left position of the element during the animation. We will set the
                //scroll position in the complete function.
                self._setElementTopLeft($sizeElem, topStepValue, leftStepValue);
            };

            var zoomAndScrollCompleteFunc = function() {
                $scrollElem.css('overflow', 'scroll'); //Turn the scrollbars back on

                var maxVertScrollPos,
                    maxHorzScrollPos,
                    topPos = $sizeElem.position().top,
                    leftPos = $sizeElem.position().left;

                if (topPos < 0) {
                    //Translate the top position back into a scroll position
                    $sizeElem.css({
                        top: 0
                    });
                    maxVertScrollPos = $scrollElem.prop('scrollHeight') - $scrollElem.innerHeight();

                    if (Math.abs(topPos) > maxVertScrollPos ) {
                        //There is not enough height to be able to scroll to the bottom where we need to,
                        //so create more height that will allow us to do that
                        $sizeElem.height($sizeElem.height() + (Math.abs(topPos) - maxVertScrollPos));
                    }
                    $scrollElem.scrollTop(Math.abs(topPos));
                }
                if (leftPos < 0) {
                    //Translate the left position back into a scroll position
                    $sizeElem.css({
                        left: 0
                    });
                    maxHorzScrollPos = Math.max(0, $sizeElem.outerWidth() - $scrollElem.innerWidth());

                    if (Math.abs(leftPos) > maxHorzScrollPos ) {
                        //There is not enough width to be able to scroll to the right where we need to,
                        //so create more width that will allow us to do that
                        $sizeElem.width($sizeElem.width() + (Math.abs(leftPos) - maxHorzScrollPos));
                    }
                    $scrollElem.scrollLeft(Math.abs(leftPos));
                }

                self.isTransitioning = false;
                graphite.events.trigger('zoomCompleted');
            };

            if ($scrollElem && scrollRect && $sizeElem && psdSize) {
                this.isTransitioning = true;
                this._animate(450, zoomAndScrollProgressFunc, zoomAndScrollCompleteFunc);
            } else {
                if ($zoomElem) {
                    this.zoomElementScale($zoomElem);
                }
                if ($sizeElem && psdSize) {
                    this.zoomElementSize($sizeElem, psdSize);
                }
                if ($backgroundElem && psdSize) {
                    this.zoomElementSize($backgroundElem, psdSize);
                }
            }
        },

        /* Simple animation function
         */
        _animate: function (duration, progress, done) {
            var startTime;
            function tick(timestamp) {
                if (typeof startTime === "undefined") {
                    startTime = timestamp;
                }

                var time = timestamp - startTime;
                if (time < duration) {
                    progress(time / duration);
                    window.requestAnimationFrame(tick);
                } else {
                    // Make sure the progress function finishes with a value of 1
                    progress(1.0);
                    done();
                }
            }
            window.requestAnimationFrame(tick);
        },

        /* Scales the jQuery element parameter to the current zoom level with no animation
         */
        zoomElementScale: function ($elem) {
            CSSUtil.applyPrefixedStyle($elem, 'transform', 'scale(' + this.level + ')');
            CSSUtil.applyPrefixedStyle($elem, 'transform', 'scale3d(' + this.level + ')');
            CSSUtil.applyPrefixedStyle($elem, 'transform-origin', '0 0');
        },

        /* Resizes the jQuery element parameter to the specified size with no animation
         */
        zoomElementSize: function ($elem, size) {
            var scaledSize = this.zoomSize(size);
            this._setElementSize($elem, scaledSize);
        },

        /*
         Calculate the zoom level that is needed to fit the zoomRect into the previewRect. If the rect is an artboard
         then the entire rect is fitted, otherwise only the width is used.

         After the correct zoom level is calculated, the zoom level of the controller is set to that value and the rect
         is sent so it will be scrolled to while zooming
         */
        zoomToFitRect: function (zoomRect, previewRect, isArtboard) {
            var imageWidth = zoomRect.right - zoomRect.left,
                imageHeight  = zoomRect.bottom - zoomRect.top,
                zoomLevel = isArtboard ? Math.min((previewRect.width - Constants.PREVIEW_SCROLLBAR_SPACING*2)/imageWidth, (previewRect.height - Constants.PREVIEW_SCROLLBAR_SPACING*2)/imageHeight) :
                                         (previewRect.width  - Constants.PREVIEW_SCROLLBAR_SPACING*2)/imageWidth;

            if (!isArtboard) {
                //Limit the zoom level to a max of 1 if not an artboard
                zoomLevel =  (zoomLevel > 1.0) || (previewRect.width <= 0) ? 1.0 : zoomLevel;
                //Always Zoom to Fit to the top of the PSD for non-artboards
                zoomRect.bottom = zoomRect.bottom - zoomRect.top;
                zoomRect.top = 0;
            }
            this.setZoomLevel(zoomLevel, zoomRect);
        },

        reset: function () {
            this.level = 1.0;
        },

        /********************/
        /* Internal methods */
        /********************/
        /* Translates a size object with width and height to a new zoom factor. This internal method is used to zoom
           or unzoom a size object.
         */
        _calcZoomSizeForFactor: function (size, factor) {
            return {
                width: size.width * factor,
                height: size.height * factor
            };
        },

        /* Sets the jQuery element's size
         */
        _setElementSize: function($elem, size) {
            $elem.css({
                width: size.width + 'px',
                height: size.height + 'px'
            });
        },

        /* Sets the jQuery element's position
         */
        _setElementTopLeft: function($elem, top, left) {
            $elem.css({
                top: top,
                left: left
            });
        }


    };

    return ZoomController;
});
