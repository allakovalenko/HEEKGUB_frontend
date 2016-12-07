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

define([
    'underscore',
    'backbone',
    '../../controllers/SelectionController',
    '../../utils/TemplateUtil',
    'text!../templates/dropperItemTemplate.html'
], function (_, Backbone, SelectionController, TemplateUtil, DropperItemTemplate) {
    'use strict';

    var DropperColorView = Backbone.View.extend({

        events: {
            'click': 'handleClick'
        },

        initialize: function () {
            this.render();
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(DropperItemTemplate));
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleClick: function (event) {
            SelectionController.enableDropperTool();
            event.stopPropagation();
        },

        remove: function () {
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return DropperColorView;
});
