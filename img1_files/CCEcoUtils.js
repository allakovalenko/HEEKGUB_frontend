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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true, sub: true  */
/*global define, graphite, XMLHttpRequest, FileReader*/

define([
    "jquery",
    "../controllers/AuthController"
], function ($, AuthController) {
    "use strict";
    
    var CCEcoUtils = {
        getAjaxHeaders: function (isAuthless) {
            var headers = {
                "x-api-key": graphite.getEnvironment().API_KEY
            };

            if (isAuthless) {
                return new $.Deferred().resolve(headers).promise();
            }

            return AuthController.getAuthModel().getAccessToken().then(function (accessToken) {
                headers["Authorization"] = "Bearer " + accessToken;
                
                return headers;
            });
        }
    };
    
    return CCEcoUtils;
});