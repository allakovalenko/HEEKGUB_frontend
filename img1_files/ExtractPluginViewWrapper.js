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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */
/*global define: true, graphite: true, window: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    'plugin-dependencies',
    './views/CCWebPSDDetailsView',
    './vanilla-extract/public/js/core/VanillaExtractMain',
    './vanilla-extract/public/js/core/models/PSDSettingsModel',
    './vanilla-extract/public/js/core/controllers/InterceptController',
    './models/PluginConfigModel',
    './models/PluginAuthModel',
    './models/MetricsProxyModel',
    './utils/AutomationTestUtils',
    './PSDExtractServerAPI'
    ],
    function($, _, Backbone, deps, CCWebPSDDetailsView, VanillaExtractMain, PSDSettingsModel, InterceptController,
        PluginConfigModel, PluginAuthModel, MetricsProxyModel, AutomationTestUtils, PSDExtractServerAPI){
        graphite.configModel = new PluginConfigModel();
        graphite.authModel = new PluginAuthModel();
        graphite.metricsProxyModel = new MetricsProxyModel();


        if (graphite.metricsProxyModel) {
            graphite.metricsProxyModel.setAuthModel(graphite.authModel);
            graphite.metricsProxyModel.setConfigModel(graphite.configModel);
        }

        if (!window.__extractAutomation) {
            window.__extractAutomation = AutomationTestUtils;
            AutomationTestUtils.initialize();
        }

        graphite.events.trigger('register-defaults');

        graphite.inPublicOneUp = function () {
            return deps.utils.getCurrentBasePath() === 'link';
        };

        /*
         * overrides
         */
        graphite.getPSDDetailsView = function(psdModel) {
            return new CCWebPSDDetailsView({model: psdModel});
        };

        var _serverAPI = PSDExtractServerAPI;

        graphite.getServerAPI = function() {
            return _serverAPI;
        };

        return function(model){
            var vanillaExtract = new VanillaExtractMain(model);

            return vanillaExtract;
        };

    });
