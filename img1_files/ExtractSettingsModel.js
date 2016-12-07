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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */

define([
    'underscore',
    'plugin-dependencies',
    '../Constants',
    'backbone'
], function (_, deps, Constants, Backbone) {
    'use strict';

    var ExtractSettingsModel = Backbone.Model.extend({

        initialize: function (prop) {
            var setting = {};
            switch(prop.type) {
                case 'LDPI':
                    setting = {id: prop.type, label: prop.type, suffix: '', folder: '_ldpi'};
                    break;
                case 'MDPI':
                    setting = {id: prop.type, label: 'MDPI/1x', suffix: '', folder: '_mdpi'};
                    break;
                case 'TVDPI':
                    setting = {id: prop.type, label: prop.type, suffix: '', folder: '_tvdpi'};
                    break;
                case 'HDPI':
                    setting = {id: prop.type, label: prop.type, suffix: '', folder: '_hdpi'};
                    break;
                case 'XHDPI':
                    setting = {id: prop.type, label: 'XHDPI/Retina 2x', suffix: '@2x', folder: '_xhdpi-2x'};
                    break;
                case 'XXHDPI':
                    setting = {id: prop.type, label: 'XXHDPI/Retina 3x', suffix: '@3x', folder: '_xhdpi-3x'};
                    break;
                case 'XXXHDPI':
                    setting = {id: prop.type, label: prop.type, suffix: '', folder: '_xxxhdpi'};
                    break;
            }

            setting['checked'] = false;

            this.defaults = setting;
            this.set(this.defaults);
        },

        reset: function () {
            this.clear().set(this.defaults);
        }

    });

    return ExtractSettingsModel;
});
