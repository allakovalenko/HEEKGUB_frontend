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
/*global graphite*/

define([
    'underscore',
    'backbone',
    '../external/ZeroClipboard/ZeroClipboard'
], function (_, Backbone, ZeroClipboard) {
    'use strict';

    var ClipboardController = Backbone.Model.extend({
        clipboard: null,
        loaded: false,

        getClipboard: function () {
            if (!this.clipboard) {
                this.initController();
            }

            return this.clipboard;
        },

        initController: function () {
            try {
                this.clipboard = graphite.getClipboard();

                // change state to 'copy-able' if swf successfully loads
                this.clipboard.on('load', function () {
                    graphite.events.trigger('clipboard-loaded');
                });

                this.clipboard.on('dataRequested', function () {
                    graphite.events.trigger('clipboard-data-requested', this);
                });

                this.clipboard.on('complete', function () {
                    graphite.events.trigger('clipboard-complete', this);
                });

                this.clipboard.on('mouseover', function () {
                    graphite.events.trigger('clipboard-mouseover', this);
                });
            } catch (err) {
                console.log(err);
            }

        }

    });

    return new ClipboardController();
});
