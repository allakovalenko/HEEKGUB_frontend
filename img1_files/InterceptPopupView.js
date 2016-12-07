/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013-2014 Adobe Systems Incorporated. All rights reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any. The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */

define([
    'underscore',
    'backbone',
    '../../Constants',
    '../popup/BasePreviewPopupView',
    'plugin-dependencies',
    '../../utils/TemplateUtil',
    'text!../templates/interceptBinaryTemplate.html'
], function (_, Backbone, Constants, BasePreviewPopupView, deps, TemplateUtil, InterceptBinaryTemplate) {

    'use strict';

    var InterceptPopupView = BasePreviewPopupView.extend({

        className: 'interceptBinary measurementTooltip popup',
        events: {
            'click #interceptYesLink': 'handleYesClick',
            'click #interceptNoLink': 'handleNoClick',
            'click #interceptCloseLink': 'handleCloseClick'
        },

        initialize: function () {
            BasePreviewPopupView.prototype.initialize.apply(this, arguments);
        },

        render: function () {
            BasePreviewPopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(
                TemplateUtil.createTemplate(InterceptBinaryTemplate)
            );

            var $yesLink = this.$el.find('#interceptYesLink'),
                $noLink = this.$el.find('#interceptNoLink');
            $yesLink.html(deps.translate('Yes'));
            $yesLink.hover(this.highlightLabel, this.unhighlightLabel);

            $noLink.html(deps.translate('No'));
            $noLink.hover(this.highlightLabel, this.unhighlightLabel);

            return this;
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleYesClick: function (event) {
            this.tryHandler(event, 'yes');
        },

        handleNoClick: function (event) {
            this.tryHandler(event, 'no');
        },

        handleCloseClick: function (event) {
            this.tryHandler(event, 'close');
        },

        tryHandler: function (event, handlerName) {
            event.stopPropagation();
            if (this.handlers && this.handlers[handlerName]) {
                this.handlers[handlerName]();
            }
            this.closePopup();
            this.remove();
        },

        setHandlers: function (callbacks) {
            this.handlers = callbacks;
        }

    });

    return InterceptPopupView;
});
