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
    '../../models/ColorModel',
    '../../models/UserSettingsModel',
    '../../controllers/SelectionController',
    '../inspect/CSSListItemView',
    '../../utils/CSSUtil',
    '../../utils/TemplateUtil',
    'text!../templates/cssColorItemTemplate.html',
    'text!../templates/messageSelectSingleItemTemplate.html'
], function ($, _, Backbone, ColorModel, UserSettingsModel, SelectionController, CSSListItemView, CSSUtil, TemplateUtil,
             CSSColorItemTemplate, MessageSelectSingleItemTemplate) {
    'use strict';
    var InspectCSSView = Backbone.View.extend({

        defaults: {
            cssListItemViews: [],
            $messageEl: null
        },

        initialize: function (options) {
            this.cssListItemViews = [];
            //story the message element
            this.$messageEl = TemplateUtil.createTemplate(MessageSelectSingleItemTemplate);
            this.render();
            this.addHandlers();

            graphite.events.on('designedAtMultiplierChanged', this.refreshCSS, this);
        },

        render: function () {
            this.handleSelectionChange();
        },

        addHandlers: function () {
            SelectionController.on('change:extractedStylesInSelection', this.handleSelectionChange, this);
            graphite.events.on('preprocessorChanged', this.refreshCSS, this);
            graphite.events.on('updateFontCSS', this.refreshCSS, this);
            graphite.events.on('commitDropperColor', this.handleNewDropperColor, this);
            graphite.events.on('preferredMeasurementUnitsChanged', this.refreshCSS, this);
        },

        removeEventListeners: function () {
            SelectionController.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        refreshCSS: function () {
            var selectedLayers = SelectionController.getSelectedLayers(),
                preProcessor = UserSettingsModel.get('preprocessor'),
                layerModel,
                cssProperties,
                i,
                listItemView;

            // only populate the list if one layer is selected
            if (selectedLayers.length === 1) {
                layerModel = selectedLayers[0];
                // If we are using a preprocessor, we don't need vendor prefixes
                cssProperties = layerModel.getCSSArray(preProcessor === 'css');

                //TODO: we may want to sort the properties in a certain order?

                this.clearCSSList();
                for (i = 0; i < cssProperties.length; i++) {
                    listItemView = new CSSListItemView({cssObj: cssProperties[i], preProcessor: preProcessor});
                    this.cssListItemViews.push(listItemView);
                    this.$el.append(listItemView.el);
                }
            } else {
                this.clearCSSList();
                this.displayMessages();
            }
        },

        handleNewDropperColor: function (extractedColor) {
            var colorModel = new ColorModel(extractedColor),
                alpha = extractedColor.alpha < 1 ? extractedColor.alpha.toFixed(2) : null,
                colorEl;
            this.$el.empty();
            colorEl = TemplateUtil.createTemplate(CSSColorItemTemplate, {value: colorModel.toHEXString()});
            this.$el.append(colorEl);
            colorEl = TemplateUtil.createTemplate(CSSColorItemTemplate, {value: colorModel.toRGBString(alpha)});
            this.$el.append(colorEl);
            colorEl = TemplateUtil.createTemplate(CSSColorItemTemplate, {value: colorModel.toHSLString(alpha)});
            this.$el.append(colorEl);
        },

        handleSelectionChange: function () {
            this.refreshCSS();
        },

        clearCSSList: function () {
            var i,
                listItem;

            for (i = this.cssListItemViews.length - 1; i !== -1; i--) {
                listItem = this.cssListItemViews.pop();
                listItem.remove();
            }

            //remove the message element
            this.$messageEl.remove();
            this.$el.empty();

            SelectionController.clearDOMSelection();
        },

        displayMessages: function () {
            var selectedLayers = SelectionController.getSelectedLayers();

            //if no layer is selected or more than one layer is selected display the same message
            if ((selectedLayers.length === 0) ||
                    (selectedLayers.length > 1)) {
                this.$el.append(this.$messageEl);
            }
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return InspectCSSView;
});
