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
// This is a temporary inclusion until CCweb.view_context_menu() gets rearchitected
// https://git.corp.adobe.com/Stormcloud/sonar/issues/3119
define([
    'jquery',
    'underscore',
    'backbone',
    '../../Constants'
], function ($, _, Backbone, Constants) {
    'use strict';

    var ContextMenuView = Backbone.View.extend({

        className : 'context-menu',

        enabled : true,

        initialize: function (options) {

            _.bindAll(this,
                'open',
                'close',
                'setItems',
                'handleSelect'
                );

            this.menuName = options.name;
            this.$el.addClass(options.name);
            if (options.enabled === false) {
                this.enabled = false;
            }
            this.items = options.items || [];
            this.$toggle = options.$toggle || $('<div>');
            this.$after = options.$after || this.$toggle;
            this.position = options.position;
            // this.labels = CCweb.view_context_menu_labels();
            // this.toggleEvent = CCweb.util.isMobileSafari ? 'touchend' : 'click';
            // this.itemEvent = CCweb.util.isMobileSafari ? 'touchend' : 'click';
            // this.blurEvent = CCweb.util.isMobileSafari ? 'touchstart' : 'mousedown';
            this.toggleEvent = 'click';
            this.itemEvent = 'click';
            this.blurEvent = 'mousedown';
            this.isOpen = false;
            this.isRendered = false;
            this.setItems(this.items);

            this.$toggle.bind(this.toggleEvent, this.open);

        },

        rebindToggle: function () {
            var self = this;
            this.close();
            _.delay(function () {
                self.$toggle.unbind(self.toggleEvent, self.open);
                self.$toggle.bind(self.toggleEvent, self.open);
            }, 300);
        },

        setItems: function (items) {

            this.close();
            this.items = items;
            this.isRendered = false;
            if (items.length === 0) {
                this.$toggle.addClass('context-menu-empty');
            } else {
                this.$toggle.removeClass('context-menu-empty');
            }

            return this;
        },

        checkItem: function (itemToCheck) {
            this.$el.find('a').removeClass('active');
            this.$el.find('a').each(function () {
                if ($(this).attr('data') === itemToCheck) {
                    $(this).addClass('active');
                }
            });
        },

        placeMenu: function () {
            var togglePos = this.$toggle.position();
            var offsetParent = this.$toggle.offsetParent();
            var scrollTop = offsetParent ? offsetParent.scrollTop() : 0;

            if (this.position === Constants.MenuPosition.TOP) {
                this.$el.css('top', togglePos.top + scrollTop);
            } else if (this.position === Constants.MenuPosition.BELOW) {
                this.$el.css('top', togglePos.top + this.$toggle.outerHeight() + scrollTop);
            }

            this.$el.css('left', togglePos.left);
        },

        open: function () {

            if (!this.enabled) { return false; }

            this.placeMenu();
            this.$toggle.addClass('menu-open');
            this.$toggle.unbind(this.toggleEvent, this.open);
            this.$el.css('opacity', 0);
            this.render();
            this.$after.after(this.$el);
            this.trigger('show', this.$el, this.$toggle);
            this.$el.find('a').bind(this.itemEvent, this.handleSelect);
            this.$el.bind(this.blurEvent, this.stopClickProp);
            $(document.body).bind(this.blurEvent, this.close);
            this.isOpen = true;

            this.$el.animate({ opacity: 1 }, 150);

            return false;

        },

        close: function () {

            if (this.isOpen === false) { return; }

            this.$toggle.removeClass('menu-open');
            this.$el.remove();
            this.trigger('hide');
            this.$el.find('a').unbind(this.itemEvent, this.handleSelect);
            this.$el.unbind(this.blurEvent, this.stopClickProp);
            $(document.body).unbind(this.blurEvent, this.close);
            this.isOpen = false;

            var self = this;
            _.delay(function () { self.$toggle.bind(self.toggleEvent, self.open); }, 200);

            return false;

        },

        handleSelect: function (ev) {
            var selection = $(ev.currentTarget).attr('data');
            this.trigger('selection', selection);
            _.defer(this.close);
            return false;
        },

        enable: function () {
            this.enabled = true;
        },

        disable: function () {
            this.enabled = false;
        },

        render: function () {

            if (this.isRendered) { return this; }

            var key,
                markup = '',
                i;

            for (i = this.items.length - 1; i >= 0; i--) {
                key = this.items[i];
                markup += '<a data="' + key + '"><i class="icon-btn ' + key + '"></i>' + this.labels[key] + '</a>';
            }

            this.$el.html(markup);
            this.isRendered = true;

            return this;
        },

        stopClickProp: function (e) {
            if (e && e.stopImmediatePropagation) {
                e.stopImmediatePropagation();
            }
        }
    });

    return ContextMenuView;
});
