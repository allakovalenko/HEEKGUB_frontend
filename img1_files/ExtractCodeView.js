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
    '../../controllers/ClipboardController',
    '../../models/TextStyleUsageModel',
    '../../models/UserSettingsModel',
    '../../models/GradientUsageModel',
    '../popup/BasePopupView',
    '../../utils/CSSUtil',
    '../../utils/TemplateUtil',
    'text!../templates/extractCodeTemplate.html',
    'plugin-dependencies'
], function (_, Backbone, ClipboardController, TextStyleUsageModel,
             UserSettingsModel, GradientUsageModel, BasePopupView, CSSUtil, TemplateUtil,
             ExtractCodeTemplate, deps) {
    'use strict';

    var ExtractCodeView = BasePopupView.extend({

        className: 'extract-code-popup popup',

        copyString: deps.translate('Copy'),
        copiedString: deps.translate('Copied'),
        viewMoreString: deps.translate('View more'),
        viewLessString: deps.translate('View less'),

        events: {
            'click .all-code': 'handleViewMoreClick',
            'click .action-button': 'handleSelectClick',
            'dblclick .topcoat-textarea': 'handleDoubleClickEvent'
        },

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);

            this.initCopyToClipboard();

            // events
            graphite.events.on('show-extract-code-popup', this.handleShow, this);
            graphite.events.on('hide-extract-code-popup', this.closePopup, this);
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(TemplateUtil.createTemplate(ExtractCodeTemplate));

            this.$actionButton = this.$el.find('.action-button');
            this.$actionButton.html(this.copyString);
            return this;
        },

        initCopyToClipboard: function () {
            ClipboardController.getClipboard().clip(this.$actionButton);
            graphite.events.on('clipboard-loaded', this.handleClipboardLoaded, this);
            graphite.events.on('clipboard-data-requested', this.handleClipboardDataRequest, this);
            graphite.events.on('clipboard-complete', this.handleClipboardComplete, this);
            graphite.events.on('clipboard-mouseover', this.handleClipboardMouseOver, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleClipboardLoaded: function () {
            this.$actionButton.addClass('clipboard-enabled');
        },

        handleClipboardDataRequest: function (elem) {
            var clip = ClipboardController.getClipboard();
            if (elem === this.$actionButton[0]) {
                clip.setText(this.$el.find('textarea').text());
                graphite.events.trigger('copy-css', {origin: 'StylesPopup'});
                graphite.events.trigger('clipboard-text-set', this.$el.find('textarea').text());
            }
        },

        handleClipboardComplete: function () {
            var view = this;
            view.$actionButton.html(view.copiedString);
            if (view.timeout) {
                clearTimeout(view.timeout);
            }
            view.timeout = setTimeout(function () {
                view.$actionButton.html(view.copyString);
            }, 1500);
        },

        handleClipboardMouseOver: function () {
            this.isMouseOver = true;
        },

        handleShow: function (params) {
            this.reset();
            BasePopupView.prototype.handleShow.apply(this, arguments);

            this.setCSS(params.model, params.ppi);
        },

        handleSelectClick: function () {
            this.$el.find('textarea').select();
        },

        handleDoubleClickEvent: function () {
            graphite.events.trigger('cssDoublClick');
        },

        handleViewMoreClick: function () {
            var textArea = this.$el.find('textarea'),
                allCode = this.$el.find('.all-code');

            if (this.$el.hasClass('expanded')) {
                this.reset(true);
            } else {
                this.$el.addClass('expanded');
                allCode.html(this.viewLessString);
                textArea.height(textArea[0].scrollHeight - parseInt(textArea.css('padding-top'), 10) - parseInt(textArea.css('padding-bottom'), 10));
            }

            this.positionPopup();
        },


        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        setCSS: function (model, ppi) {
            var textArea = this.$el.find('textarea'),
                preProcessor = UserSettingsModel.get('preprocessor'),
                cssProperties = model.get('style').getCSS(preProcessor === 'css', ppi),
                cssStringArray = [],
                cssString;

            if (model instanceof TextStyleUsageModel ||
                    model instanceof GradientUsageModel) {
                _.each(cssProperties, function (property) {
                    cssString = CSSUtil.formatCSSString(property, preProcessor);
                    // Sometimes getCSSString can return a null string if it's a prefixed value.
                    if (cssString) {
                        cssStringArray.push(cssString);
                    }
                });
                textArea.text(cssStringArray.join('\n'));
            } else {
                // empty for now
                textArea.text('Useful CSS here');
            }

            this.updateViewMoreButton();
        },


        updateViewMoreButton: function () {
            var viewMoreButton, textArea;
            viewMoreButton = this.$el.find('.all-code');
            textArea = this.$el.find('textarea');

            if (textArea[0].scrollHeight - parseInt(textArea.css('padding-top'), 10) - parseInt(textArea.css('padding-bottom'), 10) >
                    parseInt(textArea.height(), 10)) {
                viewMoreButton.html(this.viewMoreString);
                viewMoreButton.show();
            } else {
                viewMoreButton.hide();
            }
        },

        reset: function (preserveCopied) {
            this.$el.removeClass('expanded');
            this.$el.find('.all-code').html(this.viewMoreString);

            if (!preserveCopied) {
                this.$el.find('.action-button').html(this.copyString);
            }
            this.$el.find('textarea').height('60px');
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }

    });

    return ExtractCodeView;
});
