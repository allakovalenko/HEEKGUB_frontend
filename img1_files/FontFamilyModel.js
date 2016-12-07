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

define([
    'underscore',
    'backbone'
], function (_, Backbone) {
    'use strict';
    var FontFamilyModel = Backbone.Model.extend({

        defaults: {
            name: '',
            faces: null
        },

        initialize: function () {
            this.set('faces', {});
        },

        addTextStyle: function (textStyleUsage) {
            var textStyle = textStyleUsage.get('style');

            var faceObj;
            var faces = this.get('faces');
            var face;

            for (face in faces) {
                if (faces.hasOwnProperty(face)) {
                    if (face === textStyle.get('fontFace')) {
                        faceObj = faces[face];
                        break;
                    }
                }
            }

            if (!faceObj) {
                faceObj = [];
                faces[textStyle.get('fontFace')] = faceObj;
            }

            faceObj.push(textStyleUsage);
        }

    });

    return FontFamilyModel;

});
