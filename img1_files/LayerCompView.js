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
    'jquery',
    'underscore',
    'backbone',
    '../../utils/TemplateUtil',
    '../../controllers/SelectionController',
    '../../controllers/AssetController',
    'text!../templates/layerCompsTemplate.html',
    'plugin-dependencies'
], function ($, _, Backbone, TemplateUtil, SelectionController, AssetController,
             LayerCompsTemplate, deps) {
    'use strict';
    var LayerCompView = Backbone.View.extend({

        className: 'layer-comp-controls',
        previouslySelectedTab: '',

        events: {
            'click #layerCompDropdown': 'handleActivate',
            'click a': 'handleSelectOption'
        },

        initialize: function () {
            _.bindAll(this, 'handleMouseDown', 'requestLayerComp');
            graphite.events.on('layerCompsLoaded', this.handleLayerCompsLoaded, this);
            graphite.events.on('drawPreviewFinish', this.handleDrawPreviewFinish(), this);
            $(document).off('mousedown.layerComps');
            this.render();
        },

        render: function () {
            this.handleLayerCompsLoaded();
            return this;
        },

        remove: function () {
            if (this.$el) {
                graphite.events.off(null, null, this);
                this.$el.empty();
                return Backbone.View.prototype.remove.call(this);
            }
        },

        handleDrawPreviewFinish: function() {
            var currTab = SelectionController.getPSDModel().get('imgdata').layerCompSelectedTab;
            if (currTab) {
                graphite.getDetailsController().setSelectedTab(currTab);
            }
        },

        handleLayerCompsLoaded: function () {
            var psdModel = SelectionController.getPSDModel(),
                layerComps = SelectionController.getPSDModel().get('layerComps'),
                appliedComp = psdModel.get('imgdata').appliedLayerCompId || 0,
                lastDocLabel = deps.translate('Last Document State'),
                currentLayerComp,
                currentCompIndex;

            this.$el.empty();
            if (layerComps && (layerComps.length > 0)) {
                // Append pseudo layer item (Last Document State).
                if (layerComps[0].get('name') !== lastDocLabel) {
                    layerComps.unshift(new Backbone.Model({name: lastDocLabel, id: 0}));
                }

                // Setup template data.
                currentLayerComp = _.find(layerComps, function (item) {
                    return item.id === appliedComp;
                });
                currentLayerComp = currentLayerComp || layerComps[0];
                currentCompIndex = layerComps.indexOf(currentLayerComp);

                this.$el.html(TemplateUtil.createTemplate(LayerCompsTemplate,
                    {layerComps: layerComps, currentIndex: currentCompIndex}));
                graphite.events.trigger('layerCompChangeComplete');
            }
        },

        handleActivate: function (event) {
            this.$el.find('#layerCompDropdown').addClass('active');
            $(document).on('mousedown.layerComps', this.handleMouseDown);
            return false;
        },

        handleMouseDown: function (event) {
            var $target = $(event.target);
            if (!$target.is(this.$el) && this.$el.find($target).length === 0) {
                this.$el.find('#layerCompDropdown').removeClass('active');
                $(document).off('mousedown.layerComps');
            }
        },

        handleSelectOption: function (event) {
            var psdModel = SelectionController.getPSDModel(),
                appliedComp = psdModel.get('imgdata').appliedLayerCompId,
                $selection = $(event.target),
                selectedId = parseInt($selection.attr('id'), 10);

            if (selectedId !== appliedComp) {
                psdModel.get('imgdata').layerCompSelectedTab = graphite.getDetailsController().get('selectedTab');
                this.handleLayerCompsLoaded();
                _.defer(this.requestLayerComp, selectedId);
            }

            this.$el.find('#layerCompDropdown').removeClass('active');
            $(document).off('mousedown.layerComps');
            event.stopPropagation();
            event.preventDefault();
        },

        requestLayerComp: function (selectedId) {
            var oldModel = SelectionController.getPSDModel(),
                psdModel;
            graphite.events.trigger('layerCompChanging');
            this.$el.find('#layerCompDropdown').addClass('disabled');
            psdModel = graphite.getAssetController().getAsset(oldModel.id, selectedId,
                function () {
                    // Notify, while giving animated progress indicator a chance
                    // to reflect a fully complete status.
                    _.delay(function () {
                        graphite.events.trigger('layerCompChanged', psdModel);
                    }, 500);
                },
                function () {}, this, oldModel.get("path"));
        }

    });

    return LayerCompView;
});
