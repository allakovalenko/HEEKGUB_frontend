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
    './LayerItemView',
    './LayerGroupItemView',
    '../../Constants',
    'plugin-dependencies'
], function (_, Backbone, LayerItemView, LayerGroupItemView, Constants, deps) {
    'use strict';
    function isDefaultVisibility(items) {
        for (var i = 0, ii = items.length; i < ii; i++) {
            var layer = items[i];
            if (layer.model.get('visible') !== layer.model.get('psdVisible')) {
                return false;
            }
            if (layer.subItems && !isDefaultVisibility(layer.subItems)) {
                return false;
            }
        }
        return true;
    }
    var LayersListView = Backbone.View.extend({
        template: '<div class="section-wrapper"><button disabled class="topcoat-button" id="resetLayers">' + deps.translate('Reset Layers') + '</button></div><div class="layers-list" tabindex="0"></div>',
        $layersList: null,
        layerItems: [],

        events: {
            'click #resetLayers': 'handleResetLayers'
        },

        initialize: function () {
            this.render();
            this.model.on('change:layerCollection', this.handleModelLayerCollectionChanged, this);
            this.handleModelLayerCollectionChanged();
        },

        render: function () {
            var tmpl = _.template(this.template),
                self = this;

            this.$el.html(tmpl);
            this.$layersList = this.$el.find('.layers-list');
            var $resetButton = this.$el.find('#resetLayers');

            graphite.events.on('layerVisiblityChanged', function () {
                $resetButton.attr({
                    disabled: isDefaultVisibility(self.layerItems)
                });
            }, this);
            graphite.events.on('reset-layers-visibility', function () {
                $resetButton.attr({
                    disabled: true
                });
            }, this);

            this.$el.keydown(function (e) {
                switch (e.keyCode) {
                    case Constants.Shortcut.LEFT_ARROW:
                    case Constants.Shortcut.RIGHT_ARROW:
                    case Constants.Shortcut.UP_ARROW:
                    case Constants.Shortcut.DOWN_ARROW:
                        e.stopPropagation();
                        e.preventDefault();
                        break;
                }
            });

            return this;
        },

        handleModelLayerCollectionChanged: function () {
            var self,
                layerCollection,
                i,
                layerModel,
                type,
                listItem;

            this.layerItems.length = 0;
            this.$layersList.empty();
            //if (this.model.get('layerCollection') !== null) {
            if (this.model.get('layerCollection')) {
                self = this;
                layerCollection = this.model.get('layerCollection');
                for (i = layerCollection.length - 1; i > -1; i--) {
                    layerModel = layerCollection.at(i);
                    type = layerModel.get('type');
                    if ((type === Constants.Type.LAYER_GROUP) || (type === Constants.Type.LAYER_ARTBOARD)) {
                        listItem = new LayerGroupItemView({model: layerModel,
                                                           psdGuid: self.model.get('id'),
                                                           toplevel: true});
                        this.layerItems.push(listItem);
                    } else {
                        listItem = graphite.getLayerItemView({model: layerModel,
                                                      psdGuid: self.model.get('id'),
                                                      toplevel: true});
                        this.layerItems.push(listItem);
                    }
                    this.$layersList.append(listItem.el);
                }

            }
        },

        removeEventListeners: function () {
            this.model.off(null, null, this);
            graphite.events.off(null, null, this);
        },

        remove: function () {
            if (this.$layersList) {
                this.$layersList.remove();
                this.$layersList = null;
            }
            _.each(this.layerItems, function (layerItem) {
                layerItem.remove();
            });
            this.layerItems.length = 0;

            this.removeEventListeners();
            Backbone.View.prototype.remove.call(this);
        },

        handleResetLayers: function () {
            graphite.events.trigger('reset-layers-visibility', {});
        }
    });

    return LayersListView;
});
