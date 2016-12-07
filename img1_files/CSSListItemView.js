/*jslint nomen: true, devel: true*/

define([
    'underscore',
    'backbone',
    '../../utils/TemplateUtil',
    '../../utils/CSSUtil'
], function (_, Backbone, TemplateUtil, CSSUtil) {
    'use strict';
    var colorProperties = {
        'background-color': 1,
        'border-color': 1,
        'color': 1
    },
        CSSListItemView = Backbone.View.extend({

            defaults: {
                cssObj : null,
                clip : null
            },

            initialize: function (options) {
                this.cssObj = options.cssObj;
                this.preProcessor = options.preProcessor;
                this.render();
            },

            render: function () {
                var listItem = CSSUtil.cssPreprocessors[this.preProcessor].listItem(this.cssObj);
                // Interpolating HTML is ok here because dangerous strings
                // should have been escaped in `listItem`
                this.setElement('<li>' + listItem + '</li>');

                return this;
            },

            isColorProperty: function () {
                return this.cssObj && (colorProperties.hasOwnProperty(this.cssObj.property));
            },

            isSpacer: function () {
                return this.cssObj && this.cssObj.spacer;
            }
        });

    return CSSListItemView;
});
