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
    '../../Constants',
    '../layers/LayersListView',
    '../inspect/PSDInspectView',
    '../assets/PSDAssetsView',
    'plugin-dependencies',
    '../../utils/TemplateUtil',
    'text!../templates/detailPanelTemplate.html'
], function ($, _, Backbone, Constants, LayersListView, PSDInspectView,
    PSDAssetsView, deps, TemplateUtil, DetailPanelTemplate) {
    'use strict';

    var DetailPanelView = Backbone.View.extend({
        layersListView: null,
        psdInspectView: null,
        events: {
            'click .details-tab': 'handleTabClick',
            'click .upload-button': 'handleUploadPSD'
        },

        initialize: function () {
            this.render();
            graphite.getDetailsController().on('change:selectedTab', this.handleSelectedTabChange, this);
            graphite.events.on('drawPreviewFinish', this.handleDrawPreviewFinish, this);
            graphite.events.on('assetExtracted', this.handleAssetExtracted, this);
            graphite.events.on('JSONPreviewReady', this.handleDrawPreviewFinish, this);

            this.model.on('change:extractedStyles', this.enableExtraTabs, this);
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(DetailPanelTemplate,
                {
                    loggedIn: deps.utils.getCurrentPage()
                }));

            if (this.model !== null) {
                var $psdInspectSection = this.$el.find('#psdInspectSection'),
                    $psdInfoSection = this.$el.find('#psdInfoSection'),
                    $psdAssetsSection = this.$el.find('#psdAssetsSection'),
                    localContent = this.model.get('localContent');

                this.psdInspectView = new PSDInspectView({model: this.model});
                this.layersListView =  graphite.getLayersListView(this.model);

                $psdInspectSection.empty();
                $psdInspectSection.append(this.layersListView.el);

                $psdInfoSection.empty();
                $psdInfoSection.append(this.psdInspectView.el);

                if (!localContent && !graphite.inPublicOneUp()) {
                    this.assetsListView = new PSDAssetsView({model: this.model});
                    $psdAssetsSection.empty();
                    $psdAssetsSection.append(this.assetsListView.el);
                }

                this.$el.find('section').scroll(function () {
                    graphite.events.trigger('hide-extract-asset-popup');
                    graphite.events.trigger('hide-extract-code-popup');
                    graphite.events.trigger('hide-color-popup');
                });
            }

            this.enableExtraTabs();

            return this;
        },

        handleTabClick: function (event) {
            graphite.getDetailsController().setSelectedTab($(event.target).attr('id'));
        },

        handleUploadPSD: function (event) {
            graphite.events.trigger('upload-psd-public-one-up');
            window.location.href = '/files';
        },

        handleSelectedTabChange: function () {
            var selectedTab = graphite.getDetailsController().get('selectedTab'),
                sections = this.$el.find('section');

            this.$el.find('a').each(function (index) {
                if ($(this).attr('id') === selectedTab) {
                    $(this).addClass('active');
                    $(sections[index]).addClass('active');
                    $(sections[index]).children().first().trigger('activate');
                } else {
                    $(this).removeClass('active');
                    $(sections[index]).removeClass('active');
                }
            });

            if (selectedTab === 'psdAssetsTab') {
                this.$el.find('#assetCounter').removeClass('new_asset');
            }

            //trigger selected-tab event
            graphite.events.trigger('selectedTab', {selectedTab: selectedTab});
        },

        handleDrawPreviewFinish: function () {
            var selectedTab = graphite.getDetailsController().getSelectedTab();
            graphite.getDetailsController().setSelectedTab('', {silent: true});
            graphite.getDetailsController().setSelectedTab(selectedTab || 'psdInspectTab');
        },

        enableExtraTabs: function () {
            this.$el.find('#psdLayersTab').removeClass('disabled');
            this.$el.find('#psdAssetsTab').removeClass('disabled');
        },

        handleAssetExtracted: function (params) {
            var assetsTabIsActive = this.$el.find('#psdAssetsTab').hasClass('active');
            //find the asset counter and update its value
            if (params) {
                if (params.numExtractedAssets > 0) {
                    this.$el.find('#assetCounter').show();
                    this.$el.find('#assetCounter').text(params.numExtractedAssets);

                    if (params.flash) {
                        var self = this;
                        this.$el.find('#assetCounter').addClass('new_asset');
                        if (assetsTabIsActive) {
                            //Only flash the counter for a short time since we're on that tab
                            setTimeout(function () {
                                self.$el.find('#assetCounter').removeClass('new_asset');
                            }, Constants.flashTimeout);
                        }
                    }
                } else {
                    this.$el.find('#assetCounter').hide();
                }
            }
        },

        removeEventListeners: function () {
            graphite.getDetailsController().off(null, null, this);
            graphite.events.off(null, null, this);
            this.model.off(null, null, this);
        },

        destroyViews: function (views) {
            var self = this;
            _.each(views, function (view) {
                if (self.hasOwnProperty(view)) {
                    self[view].remove();
                    delete self[view];
                }
            });
        },

        remove: function () {
            this.removeEventListeners();
            this.destroyViews(['psdInspectView', 'layersListView', 'assetsListView']);
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return DetailPanelView;
});
