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
/*global graphite*/

define([
    'jquery',
    'underscore',
    'backbone',
    './BasePopupView',
    '../../controllers/SelectionController',
    '../../models/ColorUsageModel',
    '../../utils/StyleUtil',
    '../../utils/TemplateUtil',
    '../inspect/ContextMenuView',
    'text!../templates/colorChipPopupTemplate.html',
    'text!../templates/alphaListPopupTemplate.html',
    '../../Constants'
], function ($, _, Backbone, BasePopupView, SelectionController, ColorUsageModel,
    StyleUtil, TemplateUtil, ContextMenuView, ColorChipPopupTemplate, AlphaListPopupTemplate, Constants) {
    'use strict';

    var ColorChipPopupView = BasePopupView.extend({

        className: 'color-chip-popup popup',

        colorUsage: null,
        currentAlpha: 1,
        handleShowColorProxied: null,
        handleHideColorProxied: null,
        colorFormat: 'RGB',

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);
            this.addHandlers();
        },

        addHandlers: function () {
            graphite.events.on('show-color-popup', this.handleShowColor, this);
            graphite.events.on('hide-color-popup', this.handleHideColor, this);
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(TemplateUtil.createTemplate(ColorChipPopupTemplate, {colorFormat: Constants.ColorFormat[this.colorFormat]}));

            this.createColorFormatMenu();
            return this;
        },

        createColorFormatMenu: function () {
            var colorFormatItems = [],
                colorFormatLabels = {};

            _.each(Constants.ColorFormat, function (details, key) {
                    colorFormatLabels[key] = details;
                    colorFormatItems.unshift(key);
                });

            this.colorFormatMenu = new ContextMenuView({
                name : 'colorFormat-selector',
                $toggle : this.$('div.color-format'),
                $after : this.$('div.color-format'),
                items : colorFormatItems,
                position : Constants.MenuPosition.TOP
            });
            this.colorFormatMenu.labels = colorFormatLabels;
            this.$('.color-format').addClass('menu-active');
            this.colorFormatMenu.on('show', this.handleColorFormatMenuShow, this);
            this.colorFormatMenu.on('selection', this.handleColorFormatSelectionChange, this);
        },

        handleColorFormatMenuShow: function ($menu) {
            this.colorFormatMenu.checkItem(this.colorFormat);
        },

        handleColorFormatSelectionChange: function (colorFormat) {
            if (colorFormat !== this.colorFormat) {
                var formatStr = Constants.ColorFormat[colorFormat];
                this.handleColorFormatChange(formatStr);
                this.$('.color-format').text(formatStr);
                this.colorFormat = colorFormat;
            }
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleShowColor: function (params) {
            if (!this.colorUsage ||
                    !this.$el.is(':visible') ||
                    !StyleUtil.areUsageStylesEqual(params.style, this.colorUsage)) {
                this.colorUsage = params.style;
                this.currentAlpha = null;
                this.handleShow({sourceElement: params.sourceElement});
                this.updateColorString(Constants.ColorFormat[this.colorFormat]);
                this.initAlphaList();
            }
        },


        handleHideColor: function (hideColor) {
            if (this.colorUsage &&
                    (!hideColor || StyleUtil.areUsageStylesEqual(hideColor, this.colorUsage))) {
                this.closePopup();
            }
        },


        handleColorFormatChange: function (newColorFormat) {
            this.updateColorString(newColorFormat);
            graphite.events.trigger('color-format', {format: newColorFormat});
        },


        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        initAlphaList: function () {
            var self = this;
            this.$el.find('.alpha-list').remove();

            // only show alphas if we have more alpha values than 1.0
            var showAlphas = false,
                alphas = this.colorUsage.get('alphas'),
                colorAlphas;
            $.each(alphas, function (index, alpha) {
                if (alpha !== 1) {
                    showAlphas = true;
                }
            });

            if (showAlphas) {
                this.$el.append(TemplateUtil.createTemplate(AlphaListPopupTemplate, {alphas: alphas}));
                colorAlphas = this.$el.find('.color-alpha');
                colorAlphas.each(function (index) {
                    $(this).data('alpha', alphas[index]);
                    if (alphas[index] === self.currentAlpha) {
                        $(this).addClass('selected');
                    }
                });

                colorAlphas.mouseenter(function () {
                    graphite.events.trigger('show-alpha-usage',
                        {alpha: $(this).data('alpha')});

                });

                this.$el.find('.alpha-list ul').mouseleave(function () {
                    graphite.events.trigger('hide-alpha-usage');
                });

                colorAlphas.click(function () {
                    $.each(colorAlphas, function () {
                        $(this).removeClass('selected');
                    });

                    self.currentAlpha = $(this).data('alpha');
                    self.updateColorString(Constants.ColorFormat[self.colorFormat]);

                    $(this).addClass('selected');
                });
            }
        },


        updateColorString: function (newColorFormat) {
            var color,
                $textarea = this.$el.find('textarea');

            if (this.colorUsage instanceof ColorUsageModel) {
                color = this.colorUsage.get('style');
                if (newColorFormat === Constants.ColorFormat.RGB) {
                    $textarea.val(color.toRGBString(this.currentAlpha));
                } else if (newColorFormat === Constants.ColorFormat.HEX) {
                    $textarea.val(color.toHEXString(this.currentAlpha));
                } else {
                    $textarea.val(color.toHSLString(this.currentAlpha));
                }
            }

            $textarea.select();
        },

        remove: function () {
            this.removeEventListeners();
            BasePopupView.prototype.remove.call(this);
        }
    });

    return ColorChipPopupView;
});
