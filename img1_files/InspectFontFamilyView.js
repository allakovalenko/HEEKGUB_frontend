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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, bitwise: true */
/*global graphite*/

define([
    'underscore',
    'backbone',
    '../../controllers/SelectionController',
    '../inspect/InspectFontFaceView',
    '../../utils/TemplateUtil',
    '../../utils/FontUtil',
    'text!../templates/fontFamilyListItemTemplate.html',
    'plugin-dependencies'
], function (_, Backbone, SelectionController, InspectFontFaceView, TemplateUtil, FontUtil,
             FontFamilyListItemTemplate, deps) {
    'use strict';

    var InspectFontFamilyView = Backbone.View.extend({
        fontFaceViews: [],

        events: {
            'click .font-family-name': 'handleClick',
            'click .typekit-anchor': 'handleTypeKitLink'
        },

        initialize: function (data) {
            this.ppi = data.ppi;
            this.render();
            this.addHandlers();
        },

        render: function () {
            var self = this,
                faces = this.model.get('faces'),
                fontFace,
                fontFaceObj,
                isInteger,
                $typekitAnchor,
                $familyName,
                count = 0;

            this.setElement(TemplateUtil.createTemplate(FontFamilyListItemTemplate, this.model));
            this.$el[0].id = 'fontFamilyListItem_' + this.model.get('name').replace(/\s+/g, ''); //Give the element a unique ID so it's easy to select in automation
            this.$el.addClass('closed');
            this.$el.find('.font-face-list').hide();
            $typekitAnchor = this.$el.find('.typekit-anchor');
            $familyName = this.$el.find('.font-family-name');

            // Configure TypeKit URL
            FontUtil.getTypeKitURL(this.model.get('friendlyName')).done(function (success, result) {
                if (success) {
                    $typekitAnchor.removeClass('typekit-anchor-disabled');
                } else {
                    $typekitAnchor.addClass('typekit-anchor-disabled');
                }
                $typekitAnchor.attr('href', result);
            }).fail(function (searchString) {
                $typekitAnchor.addClass('typekit-anchor-disabled');
            });

            var keys = _.keys(faces);
            if (keys) {
                keys.sort(this.sortFaces);
            }

            _.each(keys, function (faceName) {
                var styles = faces[faceName];
                styles.sort(self.sortTextSizeFunction);
                isInteger = faceName >>> 0 === parseFloat(faceName);
                faceName = isInteger ? 'font-weight ' + faceName : faceName;
                fontFaceObj = {fontFace: faceName, styles: styles};
                fontFace = new InspectFontFaceView({model: fontFaceObj, ppi: self.ppi});
                self.fontFaceViews.push(fontFace);

                self.$el.find('.font-face-list').append(fontFace.el);
                self.$el.find('.font-face-list').append('<div style="clear:both;"></div>');
                count++;
            });

            this.$el.find('.font-face-list').append('<div class="list-bottom-padding"></div>');
            this.$el.find('.font-face-count p').text(count);

        },

        sortFaces: function (a, b) {
            var faceValues = ['regular', 'thin', 'extralight', 'ultralight', 'light', 'normal',
                'medium', 'semibold', 'demibold', 'bold', 'extrabold', 'ultrabold',
                'black', 'heavy', 'italic', 'bolditalic'];
            return faceValues.indexOf(a.toLowerCase().replace(/ /g, '')) - faceValues.indexOf(b.toLowerCase().replace(/ /g, ''));
        },

        updateClosedStatus: function () {
            if (this.$el.hasClass('closed')) {
                this.$el.find('.font-face-list').slideUp(50);
                this.$el.find('.font-face-count').fadeIn(100);
            } else {
                this.$el.find('.font-face-list').slideDown(50);
                this.$el.find('.font-face-count').fadeOut(100);
            }
        },

        addHandlers: function () {
            SelectionController.on('change:extractedStylesInSelection', this.handleSelectionChange, this);
        },

        handleClick: function () {
            this.$el.toggleClass('closed');
            this.updateClosedStatus();
        },

        handleTypeKitLink: function () {
            graphite.events.trigger('typekitSearch');
        },

        removeEventListeners: function () {
            SelectionController.off(null, null, this);
        },

        handleSelectionChange: function () {
            var self = this,
                textStylesInSelection = SelectionController.get('extractedStylesInSelection').textStyleUsageModels,
                selectedLayers = SelectionController.getSelectedLayers();

            _.each(textStylesInSelection, function (textStyle, textStyleIndex) {
                if (textStyle.get('style').get('fontName') === self.model.get('name')) {
                    // Only open font-family sections if we have something selected, otherwise with nothing selected, all styles will open
                    if (selectedLayers.length > 0) {
                        self.$el.removeClass('closed');
                        self.updateClosedStatus();
                    }
                }
            });
        },

        remove: function () {
            // remove font face views
            _.each(this.fontFaceViews, function (fontFaceView) {
                fontFaceView.remove();
            });
            this.fontFaceViews.length = 0;

            this.removeEventListeners();
            return Backbone.View.prototype.remove.call(this);
        }
    });

    return InspectFontFamilyView;
});
