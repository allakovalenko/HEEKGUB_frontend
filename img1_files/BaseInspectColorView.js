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
    'underscore',
    'backbone',
    '../../controllers/SelectionController',
    '../../models/ColorUsageModel',
    '../../utils/StyleUtil',
    '../../utils/TemplateUtil',
    'text!../templates/colorListItemTemplate.html'
], function (_, Backbone, SelectionController,
        ColorUsageModel, StyleUtil, TemplateUtil, ColorListItemTemplate) {
    'use strict';

    var BaseInspectColorView = Backbone.View.extend({
        events: {
            'click': 'handleClick'
        },

        initialize: function () {
            this.render();
            this.addHandlers();
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(ColorListItemTemplate));
        },


        addHandlers: function () {
            graphite.getDetailsController().on('change:selectedInspectItem', this.handleSelectedInspectItemChange, this);
            SelectionController.on('change:extractedStylesInSelection', this.handleSelectionChange, this);
        },

        removeEventListeners: function () {
            graphite.getDetailsController().off(null, null, this);
            SelectionController.off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleClick: function () {
            if (this.model === graphite.getDetailsController().get('selectedInspectItem')) {
                graphite.getDetailsController().setSelectedInspectItem(null);
            } else {
                graphite.getDetailsController().setSelectedInspectItem(this.model);

                if (this.model instanceof ColorUsageModel) {
                    this.showInfo();
                }
            }
        },


        handleSelectedInspectItemChange: function () {
            if (this.model === graphite.getDetailsController().get('selectedInspectItem')) {
                this.$el.addClass('selected');
            } else {
                this.$el.removeClass('selected');
            }

            if (!graphite.getDetailsController().get('selectedInspectItem')) {
                graphite.events.trigger('hide-color-popup', null);
            }
        },

        handleSelectionChange: function () {
            var stylesInSelection = this.getStylesForSelection(),
                colorUsage = this.model,
                found = false,
                selectedLayers = SelectionController.getSelectedLayers();

            _.each(stylesInSelection, function (value, index) {
                if (StyleUtil.areUsageStylesEqual(colorUsage, value)) {
                    found = true;
                }
            });

            this.$el.removeClass('layer-over');

            if (found && selectedLayers.length > 0) {
                this.$el.addClass('selected');
            } else {
                this.$el.removeClass('selected');
            }
        },

        // override please
        getStylesForSelection: function () {
            // return an array of style models
        },

        // override please
        getStylesForLayer: function (layer) {
            // return an array of style usageModels.
        },

        showInfo: function () {
            graphite.events.trigger('show-color-popup', { style: this.model, sourceElement: this.$el.find('.color-chip')});
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return BaseInspectColorView;
});
