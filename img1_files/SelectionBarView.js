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
    '../../Constants',
    'plugin-dependencies',
    'text!../templates/toolbarTemplate.html',
    '../inspect/ContextMenuView',
    '../../utils/TemplateUtil',
    './DesignedAtView',
    './LayerCompView',
    './ZoomView'
], function (_, Backbone, Constants, deps, ToolbarTemplate, ContextMenuView, TemplateUtil,
             DesignedAtView, LayerCompView, ZoomView) {
    'use strict';

    var SelectionBarView = Backbone.View.extend({

        events: {
            'click .direct-select': 'handleDirectSelectToolChange',
            'click .firstuser-shortcut-guide': 'handleFirstUserExperienceShortcutGuideClick',
            'click .show-measurements-on-hover': 'handleMeasurementToggleClick'
        },

        defaults: {
            previewView: null
        },

        initialize: function (options) {
            this.bToggleMeasurementKeyDown = false;

            this.previewView = options.previewView;
            this.render();

            graphite.getDetailsController().on('change:toggleMeasurementOnHover', this.handleMeasurementToggleChange, this);
            graphite.events.on('drawPreviewFinish', this.hideRenderingBar, this);
            graphite.events.on('errorNotificationShown', this.hideRenderingBar, this);
        },

        render: function () {
            var labels = {
                regularSelect: deps.translate('Regular Select'),
                directSelect: deps.translate('Direct Select'),
                showMeasurementsOnHover: deps.translate('Toggle Show Info on hover')
            };

            this.setElement(TemplateUtil.createTemplate(ToolbarTemplate, labels));
            this.zoomControlsView = new ZoomView({previewView: this.previewView});
            this.$el.find('.selection-controlbar').append(this.zoomControlsView.$el);
            this.layerCompControlsView = new LayerCompView();
            this.$el.find('.selection-controlbar').append(this.layerCompControlsView.$el);
            if (!deps.parfait && deps.utils.hasFeature('extract_batch')) {
                this.designedAtView = new DesignedAtView();
                this.$el.find('.selection-controlbar').append(this.designedAtView.$el);
            }
            this.createHelpMenu();
            return this;
        },

        removeEventListeners: function () {
            graphite.getDetailsController().off(null, null, this);
        },

        handleFirstUserExperienceShortcutGuideClick: function () {
            graphite.events.trigger('toggle-first-user-overlay');
        },

        handleDirectSelectToolChange: function () {
            graphite.getDetailsController().changeActiveTool(Constants.Tool.SELECT_DIRECT);
        },

        handleMeasurementToggleClick: function () {
            if (!this.bToggleMeasurementKeyDown) {
                this.bToggleMeasurementKeyDown = true;
                this.$el.find('.show-measurements-on-hover').addClass('active');
            } else {
                this.bToggleMeasurementKeyDown = false;
                this.$el.find('.show-measurements-on-hover').removeClass('active');
            }

            //send the toggle event
            graphite.events.trigger('toggle-hover-measurement');
        },

        handleMeasurementToggleChange: function () {
            if (!this.bToggleMeasurementKeyDown) {
                this.bToggleMeasurementKeyDown = true;
                this.$el.find('.show-measurements-on-hover').addClass('active');
            } else {
                this.bToggleMeasurementKeyDown = false;
                this.$el.find('.show-measurements-on-hover').removeClass('active');
            }
        },

        handleActiveToolChange: function () {
            var newTool = graphite.getDetailsController().get('activeTool');
            this.$el.find('button').removeClass('active');

            switch (newTool) {
            case Constants.Tool.SELECT_DIRECT:
                this.$el.find('.direct-select ').addClass('active');
                graphite.events.trigger('activeTool', {activeTool: deps.translate('Direct Select')});
                break;
            default:
                console.log('Invalid Tool activated');
            }
        },

        hideRenderingBar: function () {
            this.$el.find('.rendering-controlbar').hide();
        },

        remove: function () {
            this.zoomControlsView.remove();
            this.zoomControlsView = null;
            this.layerCompControlsView.remove();
            this.layerCompControlsView = null;
            this.removeEventListeners();
            this.previewView = null;
            Backbone.View.prototype.remove.call(this);
            graphite.events.off(null, null, this);
        },

        createHelpMenu: function () {
            var preprocessorItems = ['Extract Help', 'Extract FAQ', 'Extract Forums', 'Keyboard Shortcuts'].reverse(),
                preprocessorLabels = {
                    'Extract Help': deps.translate('Extract Help'),
                    'Extract FAQ': deps.translate('Extract FAQ'),
                    'Extract Forums': deps.translate('Extract Forums'),
                    'Keyboard Shortcuts': deps.translate('Keyboard Shortcuts')
                },
                button = this.$('.keyboard-shortcut-guide');
            this.preprocessorMenu = new ContextMenuView({
                name : 'help-selector',
                $toggle : button,
                $after : button,
                items : preprocessorItems,
                position : Constants.MenuPosition.BELOW
            });
            this.preprocessorMenu.labels = preprocessorLabels;
            button.addClass('menu-active');

            this.preprocessorMenu.on('selection', function (menu) {
                if (menu === 'Keyboard Shortcuts') {
                    graphite.events.trigger('toggle-help-dialog');
                } else if (menu === 'Extract Help') {
                    window.open(deps.translate('http://adobe.com/go/extract_help'), '_blank');
                } else if (menu === 'Extract FAQ') {
                    window.open(deps.translate('http://adobe.com/go/extract_faq'), '_blank');
                } else if (menu === 'Extract Forums') {
                    window.open(deps.translate('http://www.adobe.com/go/extract_forums'), '_blank');
                }
            }, this);
        }

    });

    return SelectionBarView;
});
