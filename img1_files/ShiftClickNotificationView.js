/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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

/*jslint indent: 4 */

define([
    'underscore',
    'backbone',
    '../../Constants',
    '../../models/UserSettingsModel',
    '../popup/BasePreviewPopupView',
    '../../utils/TemplateUtil',
    'text!../templates/shiftClickMeasurementNotificationTemplate.html'
], function (_, Backbone, Constants, UserSettingsModel, BasePreviewPopupView, TemplateUtil,
             ShiftClickMeasurementNotificationTemplate) {
    'use strict';

    var ShiftClickNotificationView = Backbone.View.extend({
        events: {
            'click .closeButton': 'handleCloseClick'
        },

        initialize: function () {
            this.render();
            window.graphite.events.trigger('measurement-notification-shown');
        },

        render: function () {
            this.$el.html(TemplateUtil.createTemplate(ShiftClickMeasurementNotificationTemplate));
            return this;
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleCloseClick: function (event) {
            event.stopPropagation();
            var $parent = this.$el.parent(),
                notificationHeight = this.$el.outerHeight(),
                parentTop = $parent.position().top;

            this.$el.remove();

            if ($parent.hasClass('top')) {
                $parent.css({'top': parentTop + notificationHeight});
            }

            // User closed this, so that means, no need to show it next time.
            UserSettingsModel.setInterceptShown(Constants.InterceptNames.SHIFT_CLICK_MEASUREMENT, false);

            window.graphite.events.trigger('measurement-notification-closed');
        }

    });
    return ShiftClickNotificationView;
});
