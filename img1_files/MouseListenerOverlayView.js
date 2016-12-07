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
    'backbone',
    'plugin-dependencies',
    '../../Constants',
    '../../controllers/SelectionController',
    '../../models/UserSettingsModel',
    '../../utils/TemplateUtil',
    'text!../templates/mouseListenerOverlayTemplate.html'
], function ($, _, Backbone, deps, Constants, SelectionController,
             UserSettingsModel, TemplateUtil, MouseListenerOverlayTemplate) {

    'use strict';
    var MouseListenerOverlayView = Backbone.View.extend({

        initialize: function () {
            _.bindAll(this, 'handleMouseMove', 'handleMouseLeave');
            this.render();
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(MouseListenerOverlayTemplate));
        },

        addHandlers: function () {
            this.$el.on('mousemove', this.handleMouseMove);
            this.$el.on('mouseleave', this.handleMouseLeave);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleMouseMove: function (event) {
            var itemMousedOver,
                itemArray,
                curX = event.clientX + $(document).scrollLeft(),
                curY = event.clientY + $(document).scrollTop();

            //Don't do anything if the active tool is the eyedropper, etc
            if (graphite.getDetailsController().get('activeTool') !== Constants.Tool.SELECT_DIRECT) {
                return;
            }

            var point = this.previewView.convertClientPtToPSDPt(curX, curY);
            itemMousedOver = SelectionController.itemAtPoint(point.x, point.y);
            itemArray = (itemMousedOver && !this.isItemSelected(itemMousedOver)) ? [itemMousedOver] : [];
            graphite.events.trigger('item-hovered-over', itemArray, true);

            graphite.events.trigger('mouseMoved', {x: curX, y: curY, itemMousedOver: itemMousedOver}, true);
        },

        handleMouseLeave: function (event) {
            graphite.events.trigger('item-hovered-over', [], true);

            graphite.events.trigger('mouseMoved', null, true);
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        remove: function () {
            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------
        isItemSelected: function (item) {
            if (item) {
                return item.get('selected');
            }
            return false;
        }

    });

    return MouseListenerOverlayView;

});
