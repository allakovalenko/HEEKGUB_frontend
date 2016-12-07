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
    '../../controllers/SelectionController',
    './LayerItemView',
    './LayersListItemView',
    '../../utils/ImageUtil',
    '../../utils/SpriteSheetUtils',
    '../../utils/TemplateUtil',
    'text!../templates/layerGroupListItemTemplate.html',
    'text!../templates/layerGroupListItemSpritesheetTemplate.html',
    'text!../templates/layerGroupListItemNoChildrenTemplate.html',
    '../../Constants'
], function ($, _, SelectionController, LayerItemView,
             LayersListItemView, ImageUtil, SpriteSheetUtils, TemplateUtil,
             LayerGroupListItemTemplate, LayerGroupListItemSpritesheetTemplate,
             LayerGroupListItemNoChildrenTemplate, Constants) {
    'use strict';
    var LayerGroupItemView = LayersListItemView.extend({

        hoverTimer: null,
        events: {
            'change': 'handleImageLoad'
        },

        initialize: function (options) {
            _.bindAll(this,
                'handleImageLoad',
                'handleLayerSelect',
                'handleToggleOpen',
                'handleVisibilityToggleClick',
                'handleExtractAssetClick',
                'handleExtractCodeClick',
                'handleMouseEnter',
                'handleMouseLeave',
                'handleThumbMouseEnter',
                'handleThumbMouseLeave'
                );
            this.model.set('psdGuid', options.psdGuid);
            this.model.set('toplevel', options.toplevel);
            this.childrenRendered = false;
            this.parentView = options.parentView;
            this.subItems = [];
            this.render();

            // Initial state
            this.handleVisibilityChange();
        },

        render: function () {
            var tmplId;

            if (this.model.get('layerCollection') !== undefined &&
                    this.model.get('layerCollection').length === 0) {
                tmplId = LayerGroupListItemNoChildrenTemplate;
            } else {
                tmplId = LayerGroupListItemSpritesheetTemplate;
            }

            this.$previewWarning = this.$el.find('div.preview-warning');
            this.$el.html(TemplateUtil.createTemplate(tmplId, this.model.toJSON()));

            this.handleFlattenedChange();

            this.drawSpriteSheet();
            this.renderChildren();

            this.processLayerWarning();

            this.addHandlers();

            if (this.model.get('type') === Constants.Type.LAYER_ARTBOARD) {
                this.$el.find('.layer-group-item').first().addClass('artboard');
                this.$el.find('.folder').first().addClass('artboard');
            }

            return this;
        },

        addHandlers: function () {
            LayersListItemView.prototype.addHandlers.apply(this, arguments);

            this.model.on('change:selected', this.handleSelectionChange, this);
            this.model.on('change:isFlattened', this.handleFlattenedChange, this);

            this.$el.find('.image-wrapper img').load(this.handleImageLoad);
            this.$el.find('.image-wrapper').first().click(this.handleLayerSelect);
            this.$el.find('.layer-group-label').first().click(this.handleLayerSelect);
            this.$el.find('.folder').first().click(this.handleToggleOpen);

            // hook up buttons
            this.$el.find('.visible-button.layer-group').first().click(this.handleVisibilityToggleClick);
            this.$el.find('.asset-button').first().click(this.handleExtractAssetClick);
            this.$el.find('.code-button').first().click(this.handleExtractCodeClick);

            // Mouse events
            this.$el.find('.layer-group-header').first().mouseenter(this.handleMouseEnter);
            this.$el.find('.layer-group-header').first().mouseleave(this.handleMouseLeave);
            this.$el.find('.image-wrapper').first().mouseenter(this.handleThumbMouseEnter);
            this.$el.find('.image-wrapper').first().mouseleave(this.handleThumbMouseLeave);

            this.addHandlersToChildren(this.model);
        },

        addHandlersToChildren: function (model) {
            var layerCollection = model.get('layerCollection') || [],
                i,
                layerModel;

            for (i = 0; i < layerCollection.length; i++) {
                layerModel = layerCollection.at(i);
                if (layerModel.get('type') !== Constants.Type.LAYER_ADJUSTMENT) {
                    layerModel.on('change:visible', this.handleVisibilityChange, this);
                    if ((layerModel.get('type') === Constants.Type.LAYER_GROUP) || (layerModel.get('type') === Constants.Type.LAYER_ARTBOARD)) {
                        this.addHandlersToChildren(layerModel);
                    }
                }
            }
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        drawSpriteSheet: function () {
            SpriteSheetUtils.renderSpriteModel(this, this.model, '.image-wrapper', '#sprite_preview', false);
        },

        renderChildren: function () {
            if (this.childrenRendered === true) {
                return;
            }

            // TODO: Actually render list item sub items usefully
            if (this.model.attributes.layerCollection !== undefined) {
                var layerCollection = this.model.attributes.layerCollection,
                    layerModel,
                    subLayerListItemView,
                    i;
                for (i = layerCollection.length - 1; i > -1; i--) {
                    layerModel = layerCollection.at(i);

                    if ((layerModel.get('type') !== Constants.Type.LAYER_GROUP) && (layerModel.get('type') !== Constants.Type.LAYER_ARTBOARD)) {
                        subLayerListItemView = graphite.getLayerItemView({model: layerModel, parentView: this, psdGuid: SelectionController.getPSDModel().get('id')});
                    } else {
                        subLayerListItemView = new LayerGroupItemView({model: layerModel, parentView: this, psdGuid: SelectionController.getPSDModel().get('id')});
                    }
                    this.subItems.push(subLayerListItemView);

                    this.$el.find('.children-list-list').first().append(subLayerListItemView.el);
                }
            }
            this.childrenRendered = true;
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleFlattenedChange: function () {
            var props = this.model.get('properties'),
                isFlattened = this.model.get('isFlattened'),
                isVisible = this.model.get('visible'),
                blendOptions = props ? props.get('blendOptions') : null;
            if (blendOptions && !isFlattened && isVisible) {
                if (blendOptions.mode && (blendOptions.mode !== 'passThrough')) {
                    this.blendOptionsWarning = true;
                    return;
                }
                this.blendOptionsWarning = false;
            } else {
                this.blendOptionsWarning = false;
            }

            this.processLayerWarning();
        },

        processLayerWarning: function () {
            if (this.blendOptionsWarning || this.model.isFontSubstitution() || this.model.isMultipleLayerStylesCSSWarning()) {
                this.$previewWarning.show();
            } else {
                this.$previewWarning.hide();
            }
        },

        handleImageLoad: function () {
            var imageWidth = parseInt(this.$el.find('.image-wrapper').width(), 10);
            if (imageWidth) {
                ImageUtil.sizeAndCenterImage(this.$el.find('.image-wrapper img')[0],
                    imageWidth,
                    parseInt(this.$el.find('.image-wrapper').height(), 10),
                    ImageUtil.ImageScaleType.FIT,
                    false);
            }

        },

        centerChildThumbs: function () {
            var childList = this.$el.find('.children-list-list'),
                children = childList ? childList.first()[0].children : null;
            $.each(children, function (index, childElem) {
                var image = $(childElem).find('.image-wrapper img')[0];
                if (image) {
                    ImageUtil.sizeAndCenterImage($(childElem).find('.image-wrapper img')[0],
                        parseInt($(childElem).find('.image-wrapper').width(), 10),
                        parseInt($(childElem).find('.image-wrapper').height(), 10),
                        ImageUtil.ImageScaleType.FIT,
                        false);
                }
            });

            $.each(this.subItems, function (index, childView) {
                childView.drawSpriteSheet();
            });
        },

        handleThumbMouseEnter: function () {
            var self = this;
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
            }

            graphite.events.trigger('load-layer-thumb-popup', self.model);

            this.hoverTimer = setTimeout(function () {
                graphite.events.trigger('show-layer-thumb-popup',
                    {sourceElement: self.$el.find('#sprite_preview').first(), model: self.model});
            }, 500);
        },

        handleThumbMouseLeave: function () {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }

            graphite.events.trigger('hide-layer-thumb-popup',
                {sourceElement: this.$el.find('#sprite_preview').first(), model: this.model});
        },

        handleMouseEnter: function () {
            this.$el.find('.layer-group-header').first().toggleClass('show-export', this.model.canBeExtracted());
            graphite.events.trigger('item-hovered-over', [this.model], true);
        },

        handleMouseLeave: function () {
            if (!this.model.get('selected')) {
                this.$el.find('.layer-group-header').first().removeClass('show-export');
            }
            graphite.events.trigger('item-hovered-over', [], true);
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

        handleExtractCodeClick: function (event) {
            if (!this.model.get('selected')) {
                SelectionController.changeSelection([this.model], false);
            }
            graphite.events.trigger('show-extract-code-popup',
                {sourceElement: $(event.target), model: this.model});
        },

        handleToggleOpen: function () {
            this.renderChildren();

            var bHasChildren = (this.model.get('layerCollection').length > 0),
                childrenList = this.$el.find('.children-list').first();
            if (this.$el.find('.layer-group-item').first().hasClass('closed')) {

                if (bHasChildren) {
                    childrenList.slideDown(50);
                }
                SelectionController.groupExpanded(this.model);
                this.centerChildThumbs();
                this.$el.find('.layer-group-item').first().removeClass('closed');
            } else {
                childrenList.slideUp(50);
                this.$el.find('.layer-group-item').first().addClass('closed');
            }
        },

        childSelected: function (childSelected) {
            if (childSelected) {
                this.$el.addClass('parent-of-selected');
            } else {
                this.$el.removeClass('parent-of-selected');
            }
        },

        expand: function () {
            var childrenList = this.$el.find('.children-list').first();
            if (childrenList.is(':hidden')) {
                childrenList.slideDown(50);
                SelectionController.groupExpanded(this.model);
                this.centerChildThumbs();
            }
            if (this.parentView instanceof LayerGroupItemView) {
                this.parentView.expand();
            }

            this.$el.find('.layer-group-item').first().removeClass('closed');
        },

        remove: function () {
            this.removeEventListeners();
            _.each(this.subItems, function (subItem) {
                subItem.remove();
            });
            this.subItems.length = 0;

            LayersListItemView.prototype.remove.call(this);
        }
    });

    return LayerGroupItemView;
});
