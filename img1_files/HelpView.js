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
    '../../utils/TemplateUtil',
    '../modal/BaseModalView',
    'text!../templates/helpDialogTemplate.html',
    '../../utils/KeyboardUtils'
], function (_, Backbone, TemplateUtil, BaseModalView, HelpDialogTemplate, KeyboardUtils) {
    'use strict';

    var HelpView = BaseModalView.extend({
        visible: false,

        events: {
            'click': 'handleHide'
        },

        blurTargets: '.psd-preview-view, #detail-panel, .selection-controlbar, .psd-header',

        initialize: function () {
            _.bindAll(this, 'handleToggle', 'handleHide');
            this.render();

            graphite.events.on('toggle-help-dialog', this.handleToggle, this);
            graphite.events.on('hide-help-dialog', this.handleHide, this);

        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(HelpDialogTemplate, {
                ctrl: KeyboardUtils.getMetaKeyName('ctrl'),
                alt: KeyboardUtils.getMetaKeyName('alt'),
                shift: KeyboardUtils.getMetaKeyName('shift')
            }));
            return this;
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleToggle: function (params) {
            if (this.visible) {
                this.handleHide();
            } else {
                this.handleShow();
                if (params && params.from === 'keyboard') {
                    graphite.events.trigger('help-dialog-shortcut');
                }
            }
        },

        handleHide: function () {
            BaseModalView.prototype.handleHide.apply(this, arguments);

            this.$el.hide();
            this.visible = false;
        },

        handleShow: function () {
            BaseModalView.prototype.handleShow.apply(this, arguments);

            this.$el.show();
            this.visible = true;
            // for metrics fire this event when the help dialog is shown
            graphite.events.trigger('help-dialog');
        }
    });

    return HelpView;
});
