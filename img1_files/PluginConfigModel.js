/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 - 2014 Adobe Systems Incorporated. All rights reserved.
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
    var PluginConfigModel = Backbone.Model.extend({
        // MOST IMPORTANT NOTE: StormCloud will 'eventually' provide a way to grab the build number out of spec.json
        // in the meantime we just hard-code the buildSHA default. That's why we have abstracted out the configModel for the plugin
        defaults: {
            buildSHA: '994af8c42c77ea82614d716b3adcc767636484bc'
        },
        // TODO: Get the build number from ccWeb once the relevant API is available
        getBuildNumber: function () {
            return this.get('buildSHA');
        }
    });
    return PluginConfigModel;
});
