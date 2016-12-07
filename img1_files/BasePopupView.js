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
/*global define: true, window: true, document: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    '../../utils/TemplateUtil',
    'text!../templates/popupTemplate.html'
], function ($, _, Backbone, TemplateUtil, PopupTemplate) {
    'use strict';
    var BasePopupView = Backbone.View.extend({
        source: null,

        events: {
            'click .close-button': 'handleCloseClick'
        },

        initialize: function () {
            _.bindAll(this,
                'handleShow',
                'closePopup');
            this.source = null;
            this.render();
            this.$el.hide();
            this.addHandlers();
        },

        render: function () {
            this.$el.html(TemplateUtil.createTemplate(PopupTemplate));
            // this.$el.addClass('popup');
            return this;
        },


        addHandlers: function () {
        },


        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleShow: function (params) {
            if ((this.$el.parent().offset() === undefined) || (params.sourceElement.offset() === undefined)) {
                return;
            }
            this.source = params.sourceElement;

            this.$el.show();

            this.positionPopup();

            this.isMouseOver = false;

            var popup = this,
                mdHandler = this.handleMouseDown.bind(this),
                meHandler = this.handleMouseEnter.bind(this),
                mlHandler = this.handleMouseLeave.bind(this),
                kuHandler = this.handleKeyUp.bind(this);

            // listeners
            if (popup.dontListen) {
                popup.dontListen();
            }

            $(window).on('mousedown', mdHandler);
            popup.$el.on('mouseenter', meHandler);
            popup.$el.on('mouseleave', mlHandler);
            $(document).on('keyup', kuHandler);
            this.dontListen = function () {
                $(window).off('mousedown', mdHandler);
                popup.$el.off('mouseenter', meHandler);
                popup.$el.off('mouseleave', mlHandler);
                $(document).off('keyup', kuHandler);
            };
        },


        positionPopup: function () {
            var $workArea = $('.vanilla-extract');
            if ($workArea.length === 0) {
                $workArea = $('#main');
            }
            var workAreaOffset = $workArea.offset().top + $workArea.outerHeight(true);

            var source = this.source;

            // find y offset
            var yOffset = this.$el.parent().offset().top;
            var sourceHeight = source.height() +
                parseInt(source.css('padding-top'), 10) +
                parseInt(source.css('padding-bottom'), 10);
            var popupHeight = parseInt(this.$el.height(), 10) +
                parseInt(this.$el.css('padding-top'), 10) +
                parseInt(this.$el.css('padding-bottom'), 10);
            var notch = this.$el.find('.notch');
            var $psdHeader = $('.psd-header');

            notch.show();
            var nY = this.getSourceYOffset() - yOffset + sourceHeight;
            if (nY + popupHeight + notch.height() > workAreaOffset - yOffset) {
                nY = source.offset().top - yOffset - this.$el.height() -
                    (2 * parseInt(this.$el.css('padding-top'), 10));

                this.$el.addClass('top');
                this.$el.removeClass('bottom');
            } else {
                nY += notch.height();
                this.$el.addClass('bottom');
                this.$el.removeClass('top');
            }

            // Constrain to not go into the header area.
            if ($psdHeader.length && $psdHeader.offset()) {
                var topmostY = $psdHeader.position().top + $psdHeader.outerHeight() + 13;
                if (nY < topmostY) {
                    //Set the top to the bottom of the header area
                    nY = topmostY;
                    notch.hide();
                }
            }
            this.$el.css('top', nY);

            //find x offset
            var sourceWidth = source.width() +
                parseInt(source.css('padding-left'), 10) +
                parseInt(source.css('padding-right'), 10);
            var popupWidth = parseInt(this.$el.width(), 10) +
                parseInt(this.$el.css('padding-left'), 10) +
                parseInt(this.$el.css('padding-right'), 10);
            var nX = this.getSourceXOffset() + ((sourceWidth - popupWidth) / 2);
            if (nX + popupWidth > $(window).width() - 5) {
                nX = $(window).width() - popupWidth - 5;
            }

            this.$el.css('left', nX);

            // center notch to source button
            var notchx = Math.round(this.getSourceXOffset() - (nX + parseInt(this.$el.css('border-left-width'), 10)) +
                parseInt(source.css('margin-left'), 10) + ((sourceWidth - notch.width()) / 2));

            notch.css('left', notchx);
        },


        handleCloseClick: function () {
            this.closePopup();
        },

        handleMouseEnter: function () {
            this.isMouseOver = true;
        },

        handleMouseLeave: function () {
            this.isMouseOver = false;
        },

        handleMouseDown: function () {
            if (!this.isMouseOver) {
                this.closePopup();
            }
        },

        handleKeyUp: function (event) {
            if (event.keyCode === 27) { // esc key
                this.closePopup();
            }
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------

        getSourceXOffset: function () {
            return this.source.offset() ? this.source.offset().left : 0;
        },

        getSourceYOffset: function () {
            return this.source.offset() ? this.source.offset().top : 0;
        },

        closePopup: function () {
            if (this.$el.css('display') !== 'none') {
                this.$el.hide();
                if (this.dontListen) {
                    this.dontListen();
                }
            }
        }

    });

    return BasePopupView;
});
