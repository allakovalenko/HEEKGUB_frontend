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
/*global define: true, graphite: true, jsonPostObject: true, jsonPostData: true*/

define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    'use strict';
    // serverAPI - ccweb should handle authentication
    var AuthModel = Backbone.Model.extend({

        defaults: {
            access_token: null,
            expires_in: null,
            user_data: null,
            adobeID: null
        },

        initialize: function () {
            var that = this;

            $.ajax({
                url: '/api/v1/user/data',
                type: 'GET',
                async: false,
                success: function (data) {
                    that.user_data = data.user_data;
                    that.adobeID = data.adobeID;
                }
            });
        },

        invalidate: function () {
            this.user_data = null;
        },

        isValid: function () {
            return this.user_data;
        },

        isValidWithUserFeature: function (feature) {
            if (this.isValid()) {
                if (this.user_data.accountEnabled) {
                    if (feature) {
                        return (this.user_data[feature] || false);
                    }
                    return true;
                }
            }
            return false;
        },

        isAnalyticsOptIn: function () {
            var isAnalyticsOptIn = true; //by default.

            if (this.user_data) {
                if (!this.user_data.analyticsOptIn) {
                    isAnalyticsOptIn = false;
                }
            }
            return isAnalyticsOptIn;
        },

        isAdobeInternalUser: function () {
            var bAdobeInternal = false;
            if (this.user_data) {
                var emailAddress = this.user_data.email;
                var domainIndex = emailAddress.lastIndexOf('@');
                if (domainIndex !== -1) {
                    var domainName = emailAddress.substr(domainIndex + 1);
                    domainName = domainName.toLowerCase();
                    if ((domainName === 'adobe.com') ||
                            (domainName === 'adobetest.com') ||
                            (domainName === '601t.com')) {
                        bAdobeInternal = true;
                    }
                }
            }
            return bAdobeInternal;
        },

        setAnalyticsOptIn: function (bAnalyticsOptIn) {

            //post data
            var jsonPostObject = {};
            jsonPostObject.analyticsOptIn = bAnalyticsOptIn;
            var jsonPostData = JSON.stringify(jsonPostObject);

            var that = this;
            $.ajax({
                type: 'POST',
                url: '/api/v1/user/analyticsOptIn',
                data: jsonPostData,
                contentType: 'application/json; charset=utf-8',
                dataType: 'json',
                success: function () {
                    that.user_data.analyticsOptIn = bAnalyticsOptIn;
                },
                error: function (errMsg) {
                    // we currently do nothing here
                }
            });
        },

        getAdobeId: function () {
            return this.adobeID;
        },

        getRegisterDate: function () {
            return this.user_data.registerDate;
        },

        getAccessToken: function () {
            // Does not apply to ccweb or parfait where the window location
            // will redirect completely to a full page sign-in form.
            // Used only for E4B to asynchronously get access token for 
            // scenarios where the access token was expired and the user has
            // to log in again to complete an action that is already in-progress.

            // Synchronously resolve promise
            var accessToken = this.attributes.access_token;
            return new $.Deferred().resolve(accessToken).promise();
        }
    });

    return AuthModel;
});