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
    '../popup/BasePopupView',
    'plugin-dependencies',
    '../../utils/ImageUtil',
    '../../utils/TemplateUtil',
    '../../utils/SpriteSheetUtils',
    'text!../templates/layerThumbPopupTemplate.html'
], function (_, Backbone, BasePopupView, deps, ImageUtil, TemplateUtil, SpriteSheetUtils, LayerThumbPopupTemplate) {
    'use strict';
    var ZoomInHintPopupView = BasePopupView.extend({

        className: 'zoom-in-hint-popup popup',

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);

            // events
            graphite.events.on('show-zoom-in-hint-popup', this.handleShow, this);
            graphite.events.on('hide-zoom-in-hint-popup', this.closePopup, this);
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);
            this.$el.find('.popup-contents').text(deps.translate('Zoom to 100% for greater color picker accuracy.'));
            // People may need to pick colours underneath the popup, so close it
            // when the mouse goes over
            this.$el.on('mouseover', this.closePopup);

            return this;
        },

        positionPopup: function () {
            BasePopupView.prototype.positionPopup.apply(this, arguments);
            this.$el.find('.notch').show();
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            BasePopupView.prototype.remove.call(this);
        }

    });

    return ZoomInHintPopupView;
});
