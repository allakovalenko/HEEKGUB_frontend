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
    '../../controllers/SelectionController',
    '../../utils/StyleUtil',
    '../../utils/TemplateUtil',
    '../../utils/CSSUtil',
    'text!../templates/fontFaceListItemTemplate.html'
], function ($, _, Backbone, SelectionController, StyleUtil, TemplateUtil, CSSUtil,
    FontFaceListItemTemplate) {
    'use strict';

    var InspectFontFaceView = Backbone.View.extend({
        initialize: function (data) {
            this.ppi = data.ppi;
            this.render();
            this.addHandlers();
        },

        render: function () {
            var sizes = this.model.styles.reduce(function (styles, styleModel) {
                var layers = styleModel.get('layers');
                var fontSize = CSSUtil.parseCSSMeasure(styleModel.get('style').get('size'));

                for (var i = 0; i < layers.length; i++) {
                    var layer = layers[i];
                    var fontScale = CSSUtil.getTransformedFontScale(layer.get('properties'));
                    var size = CSSUtil.convertPSDUnitsToPreferredUnits({
                        val: (fontSize.val * fontScale).toFixed(2),
                        units: fontSize.units
                    }, true);

                    if (!styles[size]) {
                        // Clone the styleModel and make layers empty
                        styles[size] = styleModel.clone();
                        styles[size].set('layers', []);
                    }
                    styles[size].get('layers').push(layer);
                }

                return styles;
            }, {});

            // Turn the map into an array and sort by size, [0] is the size, [1]
            // is the styleModel
            sizes = _.pairs(sizes).sort(this.sortTextSizeFunction);

            var context = _.extend({sizes: sizes}, this.model);
            this.setElement(TemplateUtil.createTemplate(FontFaceListItemTemplate, context));

            this.$el.find('.text-style-size').each(function (index) {
                $(this).data('model', sizes[index][1]);
            });
        },

        addHandlers: function () {
            var self = this;
            this.$el.find('.text-style-size').click(function () {
                if ($(this).data('model') === graphite.getDetailsController().get('selectedInspectItem')) {
                    graphite.getDetailsController().setSelectedInspectItem(null);
                    graphite.events.trigger('hide-extract-code-popup');
                } else {
                    graphite.getDetailsController().setSelectedInspectItem($(this).data('model'));
                    graphite.events.trigger('show-extract-code-popup',
                        {sourceElement: $(this), model: $(this).data('model'), ppi: self.ppi});

                }
            });

            graphite.getDetailsController().on('change:selectedInspectItem', this.handleSelectedInspectItemChange, this);
            SelectionController.on('change:extractedStylesInSelection', this.handleSelectionChange, this);
        },

        removeEventListeners: function () {
            graphite.getDetailsController().off(null, null, this);
            SelectionController.off(null, null, this);
        },

        sortTextSizeFunction: function (a, b) {
            return parseFloat(a[0]) - parseFloat(b[0]);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleSelectedInspectItemChange: function () {
            var selectedInspectItem = graphite.getDetailsController().get('selectedInspectItem');
            this.$el.find('.text-style-size').each(function (index, value) {
                if ($(value).data('model') === selectedInspectItem) {
                    $(value).addClass('selected');
                } else {
                    $(value).removeClass('selected');
                }
            });
        },


        handleSelectionChange: function () {
            var selectedLayers = SelectionController.getSelectedLayers();

            this.$el.find('.text-style-size').each(function (index, value) {
                var model = $(value).data('model');
                if (!model) {
                    return;
                }
                var modelLayers = model.get('layers');
                if (modelLayers.some(function (modelLayer) {
                    return selectedLayers.indexOf(modelLayer) !== -1;
                })) {
                    $(this).addClass('selected');
                } else {
                    $(this).removeClass('selected');
                }
            });
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return InspectFontFaceView;
});
