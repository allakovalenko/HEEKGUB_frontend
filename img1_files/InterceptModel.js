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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*global define: true */

define([
    'jquery',
    'underscore',
    'backbone',
    '../views/popup/InterceptPopupView',
    './UserSettingsModel'
], function ($, _, Backbone, InterceptPopupView, UserSettingsModel) {
    'use strict';
    var InterceptModel = Backbone.Model.extend({

        defaults: {
        },

        configurations: [
            {
                segment     : 'layer-comp-binary',  // We use this to segment our metrics. Each one should be unique
                behavior    : function () {
                    var that = this,
                        intercepts = UserSettingsModel.get('shownIntercepts');

                    if (intercepts[that.segment]) {
                        return;
                    }

                    function yesHandler() {
                        window.graphite.events.trigger('catchIntercept', {segment: that.segment, result: 'yes'});
                    }

                    function noHandler() {
                        window.graphite.events.trigger('catchIntercept', {segment: that.segment, result: 'no'});
                    }

                    function closeHandler() {
                        window.graphite.events.trigger('catchIntercept', {segment: that.segment, result: 'close'});
                    }

                    window.graphite.events.on('layerCompChanged', function () {
                        var intercepts = _.clone(UserSettingsModel.get('shownIntercepts'));

                        if (!intercepts[that.segment]) {
                            window.graphite.events.trigger('load-intercept-binary', {style: 'top: 33px', handlers: {yes: yesHandler, no: noHandler, close: closeHandler}});
                            intercepts[that.segment] = true;
                            UserSettingsModel.set('shownIntercepts', intercepts);
                        }
                    });
                }
            }
        ],

        attachListeners: function () {
            window.graphite.events.on('load-intercept-binary', function (params) {
                _.delay(function () {
                    var interceptPopup = new InterceptPopupView();
                    interceptPopup.setHandlers(params.handlers);
                    $(interceptPopup.el).addClass('bottom');
                    if (params.style) {
                        $(interceptPopup.el).attr('style', params.style);
                    }
                    $('#results').find('.layer-comp-controls').append(interceptPopup.el);
                    $(interceptPopup.el).show();
                }, 500);
            }, this);
        },

        applyBehaviors: function () {
            this.attachListeners();
            var intercepts = UserSettingsModel.get('shownIntercepts'),
                i;

            for (i in this.configurations) {
                if (this.configurations.hasOwnProperty(i) && !intercepts[this.configurations[i].segment]) {
                    this.configurations[i].behavior();
                }
            }
        }


    });

    return new InterceptModel();
});
