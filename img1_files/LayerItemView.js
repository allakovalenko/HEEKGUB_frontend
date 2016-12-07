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
    '../../mixins/ScrollableItem',
    '../../utils/SpriteSheetUtils',
    '../../utils/KeyboardUtils',
    '../../utils/TemplateUtil',
    'text!../templates/layerListItemTemplate.html',
    '../../Constants'
], function ($, _, Backbone, SelectionController, ScrollableItem,
    SpriteSheetUtils, KeyboardUtils, TemplateUtil, LayerListItemTemplate, Constants) {
    'use strict';
    var LayerItemView = Backbone.View.extend({

        className: 'layer-item-row',

        events: {
            'click': 'handleLayerSelect',
            'mouseenter': 'handleMouseEnter',
            'mouseleave': 'handleMouseLeave',
            'click .asset-button': 'handleExtractAssetClick'
        },

        adjLayerTypeToCSS: {
            'brightnessContrast': 'brightness-contrast',
            'levels': 'levels',
            'curves': 'curves',
            'exposure': 'exposure',
            'vibrance': 'vibrance',
            'hueSaturation': 'hue-saturation',
            'colorBalance': 'color-balance',
            'blackAndWhite': 'black-and-white',
            'photoFilter': 'photo-filter',
            'channelMixer': 'channel-mixer',
            'colorLookup': 'color-lookup',
            'gradientMapClass': 'gradient-map',
            'selectiveColor': 'selective-color',
            'thresholdClassEvent': 'threshold',
            'posterization': 'posterize',
            'invert': 'invert'
        },

        initialize: function (options) {
            _.bindAll(this,
                'handleVisibilityToggleClick',
                'handleThumbMouseEnter',
                'handleThumbMouseLeave');

            this.model.set('psdGuid', options.psdGuid);
            this.model.set('toplevel', options.toplevel);
            this.parentView = options.parentView;
            this.render();

            this.$el.find('.image-wrapper').first().on('mouseenter', this.handleThumbMouseEnter);
            this.$el.find('.image-wrapper').first().on('mouseleave', this.handleThumbMouseLeave);
            this.$el.find('.visible-button').first().on('click', this.handleVisibilityToggleClick);
            this.addHandlers();
        },

        render: function () {
            var json = this.model.toJSON();
            this.$el.html(TemplateUtil.createTemplate(LayerListItemTemplate, json));

            this.$previewWarning = this.$el.find('div.preview-warning');
            var icon = this.$el.find('div.layer-icon');

            if (json.properties.attributes.shape) {
                icon.addClass('vector');
            } else if (json.type === Constants.Type.LAYER_TEXT) {
                icon.addClass('text');
            } else if (json.type === Constants.Type.LAYER_SMARTOBJ) {
                icon.addClass('smart-' + json.smartObjectType);
            } else {
                icon.addClass('none');
            }

            if (json.type === Constants.Type.LAYER_ADJUSTMENT) {
                if (json.adjustmentLayerType && this.adjLayerTypeToCSS.hasOwnProperty(json.adjustmentLayerType)) {
                    this.$el.find('.image-wrapper').addClass(this.adjLayerTypeToCSS[json.adjustmentLayerType]);
                } else {
                    this.$el.find('.image-wrapper').addClass('adjustment-layer');
                }
            }

            // Initial state
            this.handleFlattenedChange();
            this.handleVisibilityChange();
            this.drawSpriteSheet();

            this.processLayerWarning();

            return this;
        },

        addHandlers: function () {
            this.model.on('change:visible', this.handleVisibilityChange, this);
            this.model.on('change:selected', this.handleSelectionChange, this);
            this.model.on('change:isFlattened', this.handleFlattenedChange, this);
            graphite.events.on('selectedTab', this.handleSelectedTab, this);
            graphite.events.on('reset-layers-visibility', this.handleVisibilityReset, this);
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        drawSpriteSheet: function () {
            SpriteSheetUtils.renderSpriteModel(this, this.model, '.image-wrapper', '#sprite_preview', false);
        },

        handleExtractAssetClick: function (event) {
            if (!this.model.get('selected')) {
                SelectionController.changeSelection([this.model], false);
            }
            graphite.events.trigger('show-extract-asset-popup', {
                type: "new",
                sourceElement: $(event.target),
                origin: 'layerPanel'
            });
            event.stopPropagation();
        },

        handleMouseEnter: function () {
            this.$el.find('.layer-item').toggleClass('show-export', this.model.canBeExtracted());
            graphite.events.trigger('item-hovered-over', [this.model], true);
        },

        handleMouseLeave: function () {
            if (!this.model.get('selected')) {
                this.$el.find('.layer-item').removeClass('show-export');
            }
        },

        handleThumbMouseEnter: function () {
            var self = this;
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
            }
            if (this.model.toJSON().type !== 'adjustmentLayer') {
                graphite.events.trigger('load-layer-thumb-popup', self.model);

                this.hoverTimer = setTimeout(function () {
                    graphite.events.trigger('show-layer-thumb-popup',
                        {sourceElement: self.$el.find('#sprite_preview').first(), model: self.model});
                }, 500);
            }
        },

        handleThumbMouseLeave: function () {
            var self = this;
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }

            graphite.events.trigger('hide-layer-thumb-popup',
                {sourceElement: self.$el.find('#sprite_preview').first(), model: self.model});
        },

        handleLayerSelect: function (event) {
            SelectionController.changeSelection([this.model], KeyboardUtils.isMultiSelectKey(event));
        },

        handleSelectionChange: function () {
            if (this.$el.hasClass('selected')) {
                this.$el.removeClass('selected');
                if (this.parentView) {
                    this.parentView.childSelected(false);
                }
            }
            if (this.model.get('selected') === true) {
                this.$el.addClass('selected');
                if (this.model.canBeExtracted()) {
                    this.$el.find('.layer-item').addClass('show-export');
                }
                if (this.parentView) {
                    this.parentView.childSelected(true);
                    this.parentView.expand();
                }
                if (graphite.getDetailsController().get('selectedTab') === 'psdLayersTab') {
                    this.scrollIntoView();
                }
            } else {
                this.$el.find('.layer-item').removeClass('show-export');
            }
        },

        handleFlattenedChange: function () {
            var props = this.model.get('properties'),
                isFlattened = this.model.get('isFlattened'),
                isVisible = this.model.get('visible'),
                blendOptions = props ? props.get('blendOptions') : null,
                showWarning = false;

            if (blendOptions && !isFlattened && isVisible) {
                if (blendOptions.mode && (blendOptions.mode !== 'passThrough')) {
                    showWarning = true;
                }
            }

            this.processLayerWarning(showWarning);
        },

        processLayerWarning: function (show) {
            if (show || this.model.isFontSubstitution() || this.model.isMultipleLayerStylesCSSWarning()) {
                this.$previewWarning.show();
            } else {
                this.$previewWarning.hide();
            }
        },

        handleSelectedTab: function (params) {
            if (params.selectedTab === 'Layers') {
                if (this.model.get('selected') === true) {
                    if (this.parentView) {
                        this.parentView.expand();
                        this.parentView.scrollIntoView();
                    }
                }
            }
        },

        handleVisibilityChange: function () {
            var $visibleButton = this.$el.find('.visible-button').first();
            $visibleButton.toggleClass('off-state', !this.model.get('visible'));
            this.$el.find('.layer-item').toggleClass('show-export', this.model.get('selected') === true && this.model.canBeExtracted());
            this.handleFlattenedChange();
        },

        handleVisibilityToggleClick: function (event) {
            var visible = this.model.get('visible');
            this.model.set('visible', !visible);
            graphite.events.trigger('layerVisiblityChanged', { layer: this.model });
            event.stopPropagation();
        },

        handleVisibilityReset: function () {
            this.model.set('visible', this.model.get('psdVisible'));
        },

        remove: function () {
            this.removeEventListeners();
            Backbone.View.prototype.remove.call(this);
        }
    });

    _.extend(LayerItemView.prototype, ScrollableItem);

    return LayerItemView;

});

