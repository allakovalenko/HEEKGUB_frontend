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
    'underscore',
    'backbone',
    '../popup/BasePopupView',
    'plugin-dependencies',
    '../../Constants',
    '../../utils/ImageUtil',
    '../../utils/TemplateUtil',
    '../../utils/SpriteSheetUtils',
    'text!../templates/layerThumbPopupTemplate.html'
], function (_, Backbone, BasePopupView, deps, Constants, ImageUtil, TemplateUtil, SpriteSheetUtils, LayerThumbPopupTemplate) {
    'use strict';
    var LayerThumbPopupView = BasePopupView.extend({

        className: 'layer-thumb-popup popup',

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);

            // events
            graphite.events.on('load-layer-thumb-popup', this.handleLoadThumb, this);
            graphite.events.on('show-layer-thumb-popup', this.handleShow, this);
            graphite.events.on('hide-layer-thumb-popup', this.closePopup, this);
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);
            this.$el.find('.popup-contents').html(
                TemplateUtil.createTemplate(LayerThumbPopupTemplate)
            );

            return this;
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleLoadThumb: function (model) {
            var props = model.get('properties'),
                blendOptions = props ? props.get('blendOptions') : null;

            SpriteSheetUtils.renderSpriteModel(this, model, '.layer-thumb', '.sprite_preview', true);

            var warningMsgElem = this.$el.find('#layerWarningMessage');
            var warningMessages = [];

            // Check for blend modes rendered incorrectly
            if (blendOptions &&
                    blendOptions.mode &&
                    blendOptions.mode !== 'passThrough' &&
                    !model.get('isFlattened') &&
                    model.get('visible')) {
                warningMessages.push(deps.translate('This layer contains blend modes that may not be rendered correctly with the current combination of visible layers.'));
            }

            // Check for font substitution
            if (model.isFontSubstitution()) {
                warningMessages.push(deps.translate('This layer contains font substitutions so the font-size CSS reported is approximate.'));
            }

            // Check if we need to show multiple layer styles warning
            if (model.isMultipleLayerStylesCSSWarning()) {
                warningMessages.push(deps.translate(Constants.LayerWarnings.MULTI_LAYER_STYLES_WARNING));
            }

            if (warningMessages.length > 0) {
                warningMsgElem.show();
                warningMsgElem.html(warningMessages.join('<br><br>'));
            } else {
                warningMsgElem.hide();
            }
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

    return LayerThumbPopupView;
});
