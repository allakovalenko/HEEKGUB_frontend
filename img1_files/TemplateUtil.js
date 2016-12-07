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
/*global graphite*/

define([
    'jquery',
    'underscore',
    'plugin-dependencies'
], function ($, _, deps) {
    'use strict';
    var TemplateUtil = {

        createTemplate: function (srcHTML, data) {
            var normalizedHTML = srcHTML;

            if(graphite.isFeatureEnabled('ccweb')){
                var fnNormalize = graphite.fxnTemplateNormalize;
                normalizedHTML = srcHTML.replace(/\/images\//g, '/resource/extract/parfait/public/images/');
            } else if (graphite.fxnTemplateNormalize && typeof graphite.fxnTemplateNormalize === 'function') {
                normalizedHTML = graphite.fxnTemplateNormalize(srcHTML);
            }


            var context = _.extend({translate: deps.translate}, data),
                template = _.template(normalizedHTML);

            // .filter is used to strip out any comments in the template. This
            // makes it possible for people to use the return value directly as
            // a single value.
            return $(template(context).trim()).filter('*');
        }

    };

    return TemplateUtil;
});
