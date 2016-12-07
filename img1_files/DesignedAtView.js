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
    '../../models/PSDSettingsModel',
    '../../utils/TemplateUtil',
    '../../controllers/SelectionController',
    '../../controllers/AssetController',
    'text!../templates/designedAtTemplate.html'
], function ($, _, Backbone, PSDSettingsModel, TemplateUtil, SelectionController, AssetController, DesignedAtTemplate) {
    'use strict';
    var DesignedAtView = Backbone.View.extend({

        className: 'designed-at-controls',

        events: {
            'click #designedAtDropdown': 'handleActivate',
            'click a': 'handleSelectOption'
        },

        initialize: function () {
            _.bindAll(this, 'handleMouseDown');
            this.render();

            this.updateDropdownValue();
            graphite.events.on('psdSettingsChanged', this.updateDropdownValue, this);
        },

        render: function () {
            this.$el.html(TemplateUtil.createTemplate(DesignedAtTemplate));
            return this;
        },

        remove: function () {
            if (this.$el) {
                graphite.events.off(null, null, this);
                this.$el.empty();
                return Backbone.View.prototype.remove.call(this);
            }
        },

        handleActivate: function (event) {
            this.$el.find('#designedAtDropdown').toggleClass('active');
            $(document).on('mousedown.designedAt', this.handleMouseDown);
            return false;
        },

        handleMouseDown: function (event) {
            var $target = $(event.target);
            if (!$target.is(this.$el) && this.$el.find($target).length === 0) {
                this.$el.find('#designedAtDropdown').removeClass('active');
                $(document).off('mousedown.designedAt');
            }
        },

        handleSelectOption: function (event) {
            var oldMultiplier = PSDSettingsModel.get('designedAtMultiplier'),
                $selectedItem = $(event.target),
                newMultiplier = parseInt($selectedItem.attr('id'), 10);

            if (oldMultiplier !== newMultiplier) {
                PSDSettingsModel.set('designedAtMultiplier', newMultiplier);
                this.$el.find('#designedAtDropdown .label').text($selectedItem.text());
                graphite.events.trigger('designedAtMultiplierChanged', newMultiplier);
            }

            this.$el.find('#designedAtDropdown').removeClass('active');
            $(document).off('mousedown.designedAt');
            event.stopPropagation();
            event.preventDefault();
        },

        updateDropdownValue: function () {
            this.$el.find('#designedAtDropdown .label').text(PSDSettingsModel.get('designedAtMultiplier') + 'x');
        }

    });

    return DesignedAtView;
});
