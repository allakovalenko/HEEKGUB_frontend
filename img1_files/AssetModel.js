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
/*global define: true, graphite: true*/

define(['underscore', 'backbone'], function (_, Backbone) {
    'use strict';
    var AssetModel = Backbone.Model.extend({

        defaults: {
            id: null,
            etag: '',
            type: '',
            url: '',
            updated: '',
            created: '',
            md5: '',
            width: '',
            height: '',
            //fileName: '',
            mimeType: '',
            collaboration: ''
        },

        initialize: function () {
        }

    });

    return AssetModel;
});
