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
/*global graphite */

define([
    'underscore',
    '../Constants',
    'backbone'
], function (_, Constants, Backbone) {
    'use strict';

    var PSDSettingsModel = Backbone.Model.extend({

        initialize: function (attributes) {
            Backbone.Model.prototype.initialize.apply(this, arguments);
            this.on('change', this.save, this);
        },

        defaults: {
            baseFontSizeValue: Constants.BaseFontDefaultSize,
            baseFontSizeUnits: Constants.FontUnitType.PX,
            designedAtMultiplier: Constants.DesignedAtMultiplier.OneX
        },

        setup: function (psdGuid) {
            this.psdGuid = psdGuid;
            this.reset();
            var self = this;
            if (window.graphite.getServerAPI().updateGenericData) {
                window.graphite.getServerAPI().loadGenericData(psdGuid, 'extract_psd_settings',
                    function (result) {
                        if (result.data) {
                            self.set(result.data, {silent: true});
                            window.graphite.events.trigger('psdSettingsChanged', this);
                        }
                    },
                    function () {});
            }
        },

        save: function () {
            var self = this,
                updatedData;

            if (graphite.getServerAPI().updateGenericData) {
                graphite.getServerAPI().updateGenericData(this.psdGuid,
                    'extract_psd_settings',
                    function (data) {
                        var changeSet = self.changedAttributes(),
                            prop;

                        updatedData = data || self.toJSON();

                        for (prop in changeSet) {
                            if (changeSet.hasOwnProperty(prop)) {
                                updatedData[prop] = self.get(prop);
                            }
                        }
                        return updatedData;
                    },
                    function (response) {
                        if (response.needsRefresh) {
                            self.set(updatedData, {silent: true});
                            window.graphite.events.trigger('psdSettingsChanged', this);
                        }
                    },
                    function () {},
                    null);
            }
        },

        reset: function () {
            this.clear({silent: true}).set(this.defaults, {silent: true});
            if (window.graphite) {
                window.graphite.events.trigger('psdSettingsChanged', this);
            }
        }
    });

    return new PSDSettingsModel();
});
