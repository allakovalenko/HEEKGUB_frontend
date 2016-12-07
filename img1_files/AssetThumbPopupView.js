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
/*global define: true, graphite: true, Image:true */

define([
    'underscore',
    'backbone',
    './BasePopupView',
    'plugin-dependencies',
    '../../utils/ImageUtil',
    '../../utils/TemplateUtil',
    '../../utils/SpriteSheetUtils',
    'text!../templates/assetThumbPopupTemplate.html'
], function (_, Backbone, BasePopupView, deps, ImageUtil, TemplateUtil, SpriteSheetUtils, AssetThumbPopupTemplate) {
    'use strict';
    var AssetThumbPopupView = BasePopupView.extend({

        className: 'asset-thumb-popup popup',

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);

            // events
            graphite.events.on('load-asset-thumb-popup', this.handleLoadAssetThumb, this);
            graphite.events.on('show-asset-thumb-popup', this.handleShow, this);
            graphite.events.on('hide-asset-thumb-popup', this.closePopup, this);
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);
            this.$el.find('.popup-contents').html(
                TemplateUtil.createTemplate(AssetThumbPopupTemplate)
            );

            return this;
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleLoadAssetThumb: function (model) {
            var url = (model.get('mimeType') === 'image/svg+xml') ?
                        graphite.getServerAPI().getDerivedDownloadURL(model.get('guid'), model.get('name')) :
                        graphite.getServerAPI().getDerivedRenditionURL(model.get('guid')),
                image = new Image(),
                $preview = this.$el.find('.sprite_preview'),
                $lsoWarningMessage = this.$el.find('#lsoWarningMessage');

            if (deps.utils.hasFeature('extract_batch') && model.hasLinkedSmartObject()) {
                $lsoWarningMessage.show();
            }
            else {
                $lsoWarningMessage.hide();
            }

            image.addEventListener('load', function () {
                if (model.get('mimeType') === 'image/svg+xml') {
                    var imgWidth = image.width,
                        imgHeight = image.height;
                    if (imgWidth > imgHeight) {
                        if (imgWidth > 240) {
                            imgHeight = imgHeight * 240 / imgWidth;
                            imgWidth = 240;
                        }
                    } else if (imgHeight > 240) {
                        imgWidth = imgWidth * 240 / imgHeight;
                        imgHeight = 240;
                    }
                    $preview[0].width = imgWidth;
                    $preview[0].height = imgHeight;
                } else {
                    $preview[0].width = image.width;
                    $preview[0].height = image.height;
                }
                $lsoWarningMessage.width($preview[0].width + 2);
                var context = $preview[0].getContext('2d');
                context.drawImage(image, 0, 0, $preview[0].width, $preview[0].height);
                image.removeEventListener('load');
            });
            graphite.getServerAPI().loadCrossDomainImage(image, url);
        },

        handleShow: function () {
            BasePopupView.prototype.handleShow.apply(this, arguments);
        },

        closePopup: function () {
            BasePopupView.prototype.closePopup.apply(this, arguments);
            this.$el.find('.preview').attr('src', '');
        },

        remove: function () {
            this.removeEventListeners();
            BasePopupView.prototype.remove.call(this);
        }

    });

    return AssetThumbPopupView;
});
