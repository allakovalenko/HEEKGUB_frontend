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
/*global define: true, graphite: true, document: true, mixpanel: true, window: true*/

define([
    'jquery',
    'underscore',
    'backbone'/*,
    '../config/environment'*/
], function ($, _, Backbone /*, environment*/) {
    'use strict';

    // serverAPI - ccweb should handle authentication
    var IMS_REDIRECT_URI = window.location.protocol + '//' + window.location.host,
        AuthController = Backbone.Model.extend({
            authModel: null,

            getLoginURL: function () {
                var loginURL = graphite.getEnvironment().getImsAuthEndpoint_Login() + '?client_id=' + graphite.getEnvironment().IMS_CLIENT_ID + '&redirect_uri=' + IMS_REDIRECT_URI + '/api/v1/login&scope=openid,AdobeID,creative_cloud&dc=' + !!window.graphite.isFeatureEnabled('aug21');
                return loginURL;
            },

            getLogoutURL: function () {
                return graphite.getEnvironment().getImsAuthEndpoint_Logout() + '?redirect_uri=' + IMS_REDIRECT_URI + '/api/v1/logout&client_id=' + graphite.getEnvironment().IMS_CLIENT_ID + '&access_token=null';
            },

            setAuthModel: function (model) {
                this.authModel = model;
            },

            getAuthModel: function () {
                return this.authModel;
            },

            setCookie: function (name, value, hours) {
                var expires = '';

                if (hours) {
                    var date = new Date();
                    date.setTime(date.getTime() + (hours * 60 * 60 * 1000));
                    expires = '; expires=' + date.toGMTString();
                }
                document.cookie = name + '=' + value + expires + '; path=/';
            },

            getCookie: function (name) {
                var cookies = document.cookie.split(';'),
                    i,
                    cookie;
                for (i in cookies) {
                    if (cookies.hasOwnProperty(i)) {
                        cookie = cookies[i].trim().split('=');
                        cookie[0].trim();
                        if (cookie[0] === name) {
                            return cookie[1];
                        }
                    }
                }
                return;
            },

            login: function () {
                if (this.authModel.isValid()) {
                    return;
                }

                graphite.events.trigger('load-login-page', this.getLoginURL());
            },

            logout: function () {
                if (!this.authModel.isValid()) {
                    return;
                }

                document.location = this.getLogoutURL();
            },

            reauthenticate: function () {
                this.authModel.invalidate();
                this.login();
            },

            isLoggedIn: function () {
                return this.authModel && this.authModel.isValid();
            }

        });

    return new AuthController();
});
