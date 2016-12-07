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
    '../Constants',
    'backbone'
], function (_, Constants, Backbone) {
    'use strict';

    var UserSettingsModel = Backbone.Model.extend({

        defaults: {
            preferredFontUnits: Constants.FontUnitType.PX,
            preferredMeasurementUnits: Constants.MeasurementUnitType.PX,
            preprocessor: 'css',
            scaleExtractedAssets: false,
            assetScaleFactor: 2,
            shownIntercepts: {
                shiftClickMeasurement: true
            }
        },

        initialize: function () {
            this.off('change', this.save, this);
            var setting,
                savedSettings,
                serializedSettings = localStorage.getItem('extractUserSettings');
            if (serializedSettings) {
                savedSettings = JSON.parse(serializedSettings);
                for (setting in savedSettings) {
                    if (savedSettings.hasOwnProperty(setting)) {
                        this.set(setting, savedSettings[setting]);
                    }
                }
            } else {
                this.reset();
            }
            this.on('change', this.save, this);

        },

        reset: function () {
            this.off('change', this.save, this);
            this.clear().set(this.defaults);
            this.save();
            this.on('change', this.save, this);
        },

        save: function () {
            localStorage.setItem('extractUserSettings', JSON.stringify(this.attributes));
        },

        setInterceptShown: function (interceptName, value) {
            var intercepts = this.get('shownIntercepts');

            intercepts[interceptName] = value;
            this.set('shownIntercepts', intercepts);
            this.save();
        },

        shouldInterceptBeShown: function (interceptName) {
            var intercepts = this.get('shownIntercepts');

            return intercepts[interceptName];
        }

    });

    return new UserSettingsModel();
});
