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

// Used for popups that appear in the preview area
define([
    'jquery',
    'underscore',
    'backbone',
    './BasePopupView'
], function ($, _, Backbone, BasePopupView) {
    'use strict';
    var BasePreviewPopupView = BasePopupView.extend({
        events: {
            'mouseenter': 'handleMouseEnter',
            'mouseleave': 'handleMouseLeave'
        },

        handleMouseDown: function (event) {
            event.stopPropagation();
        },

        handleShow: function (params) {
            if (this.$el.parent().offset() === undefined) {
                return;
            }
            this.source = params.sourceElement;
            if (!this.source) {
                this.source = null;
            }
            this.$el.show();
            this.positionPopup();
            this.isMouseOver = false;

            // listeners
            $(window).on('mousedown', $.proxy(this.handleMouseDown, this));
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        //Finds the position we'd like to place the popup relative to the source element
        positionPopup: function () {
            var $previewView = $('div.psd-preview-view'),
                $previewContainer = $('div.preview-container'),
                $notch = this.$el.find('.notch'),
                parentWidth = this.$el.parent().width(),
                sourceHeight = this.getSourceOuterHeight(),
                sourceWidth = this.getSourceOuterWidth() || parentWidth,
                popupHeight = this.$el.outerHeight(),
                popupWidth = this.$el.outerWidth(),
                // - 10 so the popup doesn't butt right up against the edge
                previewAreaWidth = $previewView.width() - 10,
                previewAreaHeight = $previewView.height(),
                marginLeft = parseFloat($previewContainer.css("margin-left")),
                hScrollPos =  $previewView.scrollLeft(),
                vScrollPos =  $previewView.scrollTop(),
                notchHeight = $notch.height(),
                notchWidth = $notch.width(),
                notchAdjustment = 0,
                nY = this.getSourceYOffset() + sourceHeight + notchHeight - 4,
                nX = this.getSourceXOffset() + ((sourceWidth - popupWidth) / 2),
                // true if the popup is on top with the notch pointing down,
                // false if the notch is pointing up
                isTop = false;

            // the center helper pushes smaller PSDs into the middle of
            // the preview
            var $centerHelper = $('div.center-helper');
            var marginTop = $centerHelper.outerHeight(true);
            // There is only a top margin if the preview is smaller than preview
            // area, i.e. it can't be scrolled
            if (Math.abs(parseInt($centerHelper.css("margin-bottom"), 10)) > marginTop) {
                marginTop = 0;
            }

            this.$el.removeClass('top bottom');

            // Start vertical placement

            // Popup is placed below source by default. If popup is not visible
            // in current viewport then we place above the source.
            if (nY + popupHeight + notchHeight > previewAreaHeight + vScrollPos - marginTop) {
                isTop = true;
                nY = this.getSourceYOffset() - popupHeight + 4;
            }

            // If we've placed the popup outside of our parent bounds, then we
            // place popup interior to the source at the bottom
            if (nY < vScrollPos - marginTop) {
                isTop = true;
                nY = (this.getSourceYOffset() + sourceHeight) - popupHeight + 3;
                //Fix for #2236. Made sure this only modifies the position if we're trying to make sure the popup is in view
                //If the popup is still out of view then we place interior to the source at the top.
                if (nY + popupHeight + notchHeight > previewAreaHeight + vScrollPos - marginTop) {
                    isTop = false;
                    nY = this.getSourceYOffset() + notchHeight - 4;
                }
            }

            // Assign final orientation for styling purposes.
            this.$el.addClass(isTop ? 'top' : 'bottom');

            // Start horizontal placement

            // Initial placement of notch.
            $notch.css('left', Math.round((popupWidth - notchWidth) / 2));

            //Adjust horizontally to ensure fully within our parent bounds and adjust the notch position
            if (nX < hScrollPos) {
                notchAdjustment = Math.min(hScrollPos - nX, (popupWidth-notchWidth)/2);
                $notch.css('left', ((popupWidth - notchWidth) / 2) - notchAdjustment);
                nX = hScrollPos;
            }
            if (nX + popupWidth > previewAreaWidth + hScrollPos - marginLeft) {
                notchAdjustment = Math.min(nX - (previewAreaWidth + hScrollPos - marginLeft - popupWidth), (popupWidth-notchWidth)/2);
                $notch.css('left', (popupWidth - notchWidth) / 2 + notchAdjustment);
                nX = previewAreaWidth + hScrollPos - marginLeft - popupWidth;
            }

            // Final placement of popup.
            this.$el.css({top: nY, left: Math.round(nX)});
        },

        getSourceXOffset: function () {
            return Math.max(0, this.source.offset().left - this.$el.parent().offset().left);
        },

        getSourceYOffset: function () {
            return Math.max(0, this.source.offset().top - this.$el.parent().offset().top);
        },

        getSourceOuterWidth: function () {
            return this.source.outerWidth();
        },

        getSourceOuterHeight: function () {
            return this.source.outerHeight();
        }

    });

    return BasePreviewPopupView;
});
