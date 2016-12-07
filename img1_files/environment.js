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
/*global define: true, graphite: true, console: true, brackets*/


define([
    'jquery'
], function ($) {
    "use strict";
    
    var environment = {
        IMS_HOST : "ims-na1-stg1.adobelogin.com",
        LOGOUT_HOST : "adobeid-na1-stg1.services.adobe.com",
        IMS_CLIENT_ID : "webpagraphics",
        ENVIRONMENT : "stage",

        ASSETS_HOST: "assets-stage.adobecc.com",
        IMAGE_SERVICE_HOST : "https://cc-api-image-stage.adobe.io",
        IMAGE_SERVICE_PORT: 443,
        FILESTORAGE_HOST: "https://cc-api-storage-stage.adobe.io",
        API_KEY: "webpagraphics",
        proxies: {},

        getImsAuthEndpoint_Login: function () {
            return 'https://' + environment.IMS_HOST + '/ims/authorize/v1';
        },
        getImsAuthEndpoint_Logout: function () {
            return "https://" + environment.LOGOUT_HOST + "/ims/logout/v1";
        },
        url: function (pathname, service) {
            service = service || environment.IMAGE_SERVICE_HOST;

            return service + pathname;
        },
        setProxyURL: function (proxy, target) {
            environment.proxies[target] = proxy;
        }
    };

    return environment;
});
