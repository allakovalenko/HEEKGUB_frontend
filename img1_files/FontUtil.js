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
    'jquery',
    'underscore'
], function ($, _) {
    'use strict';
    var FontUtil = {

        TYPEKIT_LOOKUP: 'https://typekit.com/api/v1/json/families/',
        TYPEKIT_SEARCH_URL: 'http://typekit.com/search/fonts/?q=',
        cache: {},

        /**
         *
         * @param fontFamily
         * @returns Promise
         */
        getTypeKitURL: function (fontFamily) {
            var slug = fontFamily.replace(/\s+/g, '-').toLowerCase(),
                cachedResult = this.cache[slug],
                self = this;
            return $.Deferred (function (defer) {
                if (cachedResult === undefined) {
                    $.ajax({
                        url: self.TYPEKIT_LOOKUP + slug,
                        dataType: 'jsonp',
                        error: function () {
                            defer.reject(new Error('TypeKit family lookup request failed'));
                        }
                    }).done(function (resp) {
                        var webLink = resp && resp.family && resp.family.web_link,
                            result = webLink || null;
                        self.cache[slug] = result;
                        if (result) {
                            defer.resolve(true, result);
                        } else {
                            defer.resolve(false, self.TYPEKIT_SEARCH_URL + encodeURIComponent(fontFamily));
                        }
                    });
                } else if (cachedResult) {
                    defer.resolve(cachedResult);
                }
            });
        }
    };
    return FontUtil;
});
