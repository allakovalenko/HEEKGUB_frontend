/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013-2014 Adobe Systems Incorporated. All rights reserved.
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
/*global graphite*/

define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    'use strict';

    var BaseModalView = Backbone.View.extend({
        visible: false,

        blurTargets: '.psd-preview-view, #detail-panel, .selection-controlbar, .psd-header',

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleHide: function () {
            $(this.blurTargets).removeClass('blur-background');
            $('div.modal-window-overlay').hide();

        },

        handleShow: function () {

            $(this.blurTargets).addClass('blur-background');
            $('div.modal-window-overlay').show();

        }
    });

    return BaseModalView;
});
