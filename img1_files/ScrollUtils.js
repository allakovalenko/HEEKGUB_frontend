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
/*global graphite */

define([
    'underscore'
], function ( _ ) {
    'use strict';
    var ScrollUtils = {

        isScrollNeeded: false,

        scrollRectIntoView: function ($parent, childRect) {
            /* For this function to work properly, the childRect coordinates MUST be relative to the viewport
               rather than relative to the parent because this function gets the $parent coordinates using
               getBoundingClientRect() which returns values relative to the top-left of the viewport.
             */
            var parentElement = $parent[0],
                boundingRect = parentElement.getBoundingClientRect(),
                parentRect = {top: boundingRect.top, bottom: boundingRect.bottom,
                              left: boundingRect.left, right: boundingRect.right,
                              width: boundingRect.width, height: boundingRect.height},
                vScrollDiff = 0,
                hScrollDiff = 0;

            //Try to account for scrollbars
            if (parentRect.height < parentElement.scrollHeight) {
                parentRect.right -= 17;
            }
            if (parentRect.width < parentElement.scrollWidth) {
                parentRect.bottom -= 25;
            } else {
                parentRect.bottom -= 10;
            }

            // check if the layer element is out of view above or below
            if ((childRect.top < parentRect.top) && (childRect.bottom < parentRect.bottom)) {
                //Scroll it into view at the topmost position
                vScrollDiff = (childRect.top - parentRect.top);
            } else if ((childRect.bottom > parentRect.bottom) && (childRect.top > parentRect.top)) {
                //Scroll it into view at the bottom-most position but make sure it doesn't go above the top
                vScrollDiff = childRect.bottom - parentRect.bottom;
                if ((childRect.top - vScrollDiff) < parentRect.top) {
                    vScrollDiff = childRect.top - parentRect.top;
                }
            }

            // check if the layer element is out of view left or right
            if (childRect.left < parentRect.left) {
                //Scroll it into view at the topmost position
                hScrollDiff = (childRect.left - parentRect.left);
            } else if (childRect.right > parentRect.right) {
                //Scroll it into view at the right-most position
                hScrollDiff = childRect.right - parentRect.right;
                if ($parent.scrollLeft() > 0) {
                    //but make sure it doesn't go too far left
                    if ((childRect.left - hScrollDiff) < parentRect.left) {
                        hScrollDiff = childRect.left - parentRect.left;
                    }
                }
            }

            if ((vScrollDiff !== 0) || (hScrollDiff !== 0)) {
                this.isScrollNeeded = true;
                $parent.animate({scrollTop: parentElement.scrollTop + vScrollDiff, scrollLeft: parentElement.scrollLeft + hScrollDiff},
                                400,
                                null,
                                this.onScrollComplete);
            } else {
                this.isScrollNeeded= false;
            }
        },

        onScrollComplete: function() {
            if (ScrollUtils.isScrollNeeded) {
                graphite.events.trigger('preview-scroll-end');
                ScrollUtils.isScrollNeeded = false;
            }
        }

    };

    return ScrollUtils;
});
