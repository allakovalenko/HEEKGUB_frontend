define([
    'jquery',
    '../utils/ScrollUtils'
], function ($, ScrollUtils) {
    'use strict';
    var ScrollableItem = {

        scrollIntoView: function (options) {
            var element = this.$el[0],
                parent = this.findScrollableParent(element),
                elementBox = element.getBoundingClientRect(),
                elementRect = {top: elementBox.top, bottom: elementBox.bottom,
                               left: elementBox.left, right: elementBox.right,
                               width: elementBox.width, height: elementBox.height};

            if (options && options.itemHeight) {
                elementRect.bottom = elementRect.top + options.itemHeight;
            }

            ScrollUtils.scrollRectIntoView($(parent), elementRect);
        },

        findScrollableParent: function (element) {
            var style;
            var parent = element;
            do {
                parent = parent.parentElement;
                style = getComputedStyle(parent);
            } while (parent !== document.body && style.overflow !== "auto" && style.overflow !== "scroll");

            return parent;
        }

    };

    return ScrollableItem;
});
