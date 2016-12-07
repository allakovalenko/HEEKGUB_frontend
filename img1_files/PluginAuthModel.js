/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */

define([
    'underscore',
    'backbone',
    'plugin-dependencies'
], function (_, Backbone, deps) {
    'use strict';

    var PluginAuthModel = Backbone.Model.extend({

        defaults: {
            access_token: null,
            expires_in: null,
            user_data: null,
            adobeID: null
        },

        initialize: function () {
        },

        isValid: function () {
            // in the plugin we are always logged in.
            return true;
        },

        isValidWithUserFeature: function (feature) {
            return true;
        },

        isAnalyticsOptIn: function () {
            return true;
        },

        isAdobeInternalUser: function () {
            var bAdobeInternal = false,
                emailAddress = deps.user.get('email');

            if (emailAddress) {
                var domainIndex = emailAddress.lastIndexOf('@');
                if (domainIndex !== -1) {
                    var domainName = emailAddress.substr(domainIndex + 1);
                    domainName = domainName.toLowerCase();
                    if ((domainName === 'adobe.com') || (domainName === 'adobetest.com') || (domainName === '601t.com') || (domainName === 'adobecc.com')) {
                        bAdobeInternal = true;
                    }
                }
            }
            return bAdobeInternal;
        },

        setAnalyticsOptIn: function (bAnalyticsOptIn) {
        },

        getAdobeId: function () {
            var userId = deps.user.profile().userId || '';
            return userId;
        },

        getRegisterDate: function () {
            return '';
        }
    });

    return PluginAuthModel;
});