/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013-2014 Adobe Systems Incorporated. All rights reserved.
 *
 * NOTICE: All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any. The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4 */
/*global define: true, graphite: true, setTimeout: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    '../../Constants',
    '../popup/BasePreviewPopupView',
    'plugin-dependencies',
    '../../controllers/ClipboardController',
    '../../controllers/ZoomController',
    '../../controllers/SelectionController',
    '../../models/LayerModelMap',
    '../../models/PSDSettingsModel',
    '../../models/UserSettingsModel',
    '../../utils/TemplateUtil',
    '../../utils/MeasurementUtil',
    '../../utils/UTF8',
    './ShiftClickNotificationView',
    'text!../templates/measurementPopupTemplate.html'
], function ($, _, Backbone, Constants, BasePreviewPopupView, deps,
        ClipboardController, ZoomController, SelectionController, LayerModelMap, PSDSettingsModel,
        UserSettingsModel, TemplateUtil, MeasurementUtil, UTF8, ShiftClickNotificationView, MeasurementPopupTemplate) {

    'use strict';

    var MeasurementPopupView = BasePreviewPopupView.extend({

        className: 'measurementPopup popup blueHUD',

        sourceElement: null,
        layerModel: null,
        layerList: null,
        displayWidth: null,
        displayHeight: null,
        displayX: null,
        displayY: null,
        // This is used by PopupOverlayView to tell if the popup is being shown:
        extractAssetPopup: null,

        events: {
            'click #preferredUnitPx': 'handlePreferredMeasurementUnitChange',
            'mousedown #preferredUnitPx': 'handleMouseDown',
            'click #preferredUnitPct': 'handlePreferredMeasurementUnitChange',
            'mousedown #preferredUnitPct': 'handleMouseDown',
            'click #copyCSSLink': 'handleCopyableClick',
            'mousedown #copyCSSLink': 'handleMouseDown',
            'click #copyTextLink': 'handleCopyableClick',
            'click .copyable': 'handleCopyableClick',
            'mousedown #copyTextLink': 'handleMouseDown'
        },

        initialize: function () {
            BasePreviewPopupView.prototype.initialize.apply(this, arguments);
            this.initCopyToClipboard();

            graphite.events.on('layerVisiblityChanged', this.layerVisiblityChanged, this);
            graphite.events.on('designedAtMultiplierChanged', this.designedAtMultiplierChanged, this);
        },

        show: function () {
            this.$el.show();
        },

        hide: function () {
            this.$el.hide();
        },

        render: function () {
            BasePreviewPopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(
                TemplateUtil.createTemplate(MeasurementPopupTemplate)
            );

            var copyCssLink = this.$el.find('#copyCSSLink'),
                copyTextLink = this.$el.find('#copyTextLink'),
                extractIcon = this.$el.find('.measurementElementAssetExtract'),
                copyables = this.$el.find('.copyable');

            if (UserSettingsModel.get('preferredMeasurementUnits') !== Constants.MeasurementUnitType.PX) {
                this.$el.find('#measurementPreferredUnits span').toggleClass('selectedUnit');
            }

            copyCssLink.html(deps.translate('Copy CSS'));
            copyTextLink.html(deps.translate('Copy Text'));

            copyables.attr('title', deps.translate('Click to copy'));
            copyables.hover(this.highlightLabel, this.unhighlightLabel);

            var self = this;

            extractIcon.click(function (event) {
                // add click handler for the measurement popup extract button
                graphite.events.trigger('show-extract-asset-popup', {
                    type: "new",
                    sourceElement: extractIcon,
                    origin: 'measurementPopup'
                });

                // Selecting element globally? This is bad.
                self.extractAssetPopup = $('.extract-asset-popup');
                self.$el.parent().append(self.extractAssetPopup);

                graphite.events.once("hide-extract-asset-popup", function () {
                    if (self.extractAssetPopup) {
                        // Stash the extract popup somewhere else so it won't get lost
                        $('div.vanilla-extract').append(self.extractAssetPopup);
                        delete self.extractAssetPopup;
                    }
                });

                var extractPopup = new BasePreviewPopupView();
                extractPopup.$el = self.extractAssetPopup;
                extractPopup.source = extractIcon;
                extractPopup.positionPopup();

                event.stopPropagation();
            });
            this.layerVisiblityChanged();

            return this;
        },

        layerVisiblityChanged: function (params) {
            if (SelectionController.canExtractAsset()) {
                this.$el.find('.measurementElementAssetExtract').css('display', 'inline-block');
            } else {
                this.$el.find('.measurementElementAssetExtract').css('display', 'none');
            }
        },

        initCopyToClipboard: function () {
            var self = this,
                clipboard = ClipboardController.getClipboard(),
                copyables = this.$el.find('.copyable');

            //copy text link
            var copyTextBtn = this.$el.find('#copyTextLink');

            //copy css button
            var copyCSSBtn = this.$el.find('#copyCSSLink');

            _.each(copyables, function (elem) {
                clipboard.clip(elem);
            });

            graphite.events.on('clipboard-data-requested', function (elem) {
                if (elem === copyTextBtn[0]) {
                    if (self.layerModel && self.layerModel.get('type') === Constants.Type.LAYER_TEXT) {
                        // pre-1.0.100 workers generated bad escape sequences that were fixed by UTF8.decodeCharacters, but now
                        // validly-escaped values get mangled by it. Only do it if we spot the telltale signature:
                        // TODO we should be able to remove this after 1.0.101 hits and updates the JSON version so that
                        // we regenerate
                        var rawText = $.trim(self.layerModel.get('properties').get('rawText'));
                        if (rawText.indexOf('\uffffff') >= 0) {
                            rawText = UTF8.decodeCharacters(rawText);
                        }
                        clipboard.setText(rawText);
                        //copy text event
                        graphite.events.trigger('copy-text');
                        self.showSuccessTooltip(deps.translate('Text copied to clipboard'));
                        graphite.events.trigger('clipboard-text-set', rawText);
                    }
                } else if (elem === copyCSSBtn[0]) {
                    if (self.layerModel) {
                        var cssStr = self.layerModel.getCSSAsString(true, UserSettingsModel.get('preprocessor'));
                        clipboard.setText(cssStr);
                        //copy css event
                        graphite.events.trigger('copy-css', {origin: 'HUD'});
                        self.showSuccessTooltip(deps.translate('CSS copied to clipboard'));
                        graphite.events.trigger('clipboard-text-set', cssStr);
                    }
                } else if ($(elem).hasClass('copyable')) {
                    this.handleCopyableElement($(elem));
                }
            }, this);
        },

        // Handles special case copyable values that are specific to MeasurementPopupView, otherwise
        // just adds the element's value as 'px' value to clipboard.
        handleCopyableElement: function ($elem) {
            var clipboard = ClipboardController.getClipboard(),
                copyMsg = deps.translate('Value copied to clipboard'),
                clipValue;

            if ($elem.hasClass('width') || $elem.hasClass('height')) {
                clipValue = 'width: ' + this.displayWidth +
                            ';\nheight: ' + this.displayHeight + ';';
                copyMsg = deps.translate('Size copied to clipboard');
            } else if ($elem.hasClass('x') || $elem.hasClass('y')) {
                clipValue = 'top: ' + this.displayY + 'px;\nleft: ' + this.displayX + 'px;';
                copyMsg = deps.translate('Position copied to clipboard');
            } else {
                clipValue = $elem.text();
            }

            clipboard.setText(clipValue);
            graphite.events.trigger('copy-value', {origin: 'HUD'});
            this.showSuccessTooltip(copyMsg);
            graphite.events.trigger('clipboard-text-set', clipValue);
        },

        showSuccessTooltip: function (message) {
            var parent = this.$el.parent().get(0);
            $(parent).append('<div id="notificationTooltip" style="display:none"><span>' + message + '</span></div>');
            var tooltip = $('#notificationTooltip');
            var tipWidth = tooltip.width();
            var tipHeight = tooltip.height();
            var elementBounds = this.layerModel ? this.layerModel.attributes.bounds : this.layerGroupBounds;
            var tipPosLeft = ((elementBounds.left + (elementBounds.right - elementBounds.left) / 2) * ZoomController.getZoomLevel()) - tipWidth / 2;
            var tipPosTop = ((elementBounds.top + (elementBounds.bottom - elementBounds.top) / 2) * ZoomController.getZoomLevel()) - tipHeight / 2;
            tooltip.css({top: tipPosTop, left: tipPosLeft});
            tooltip.fadeIn(250);
            setTimeout(function () {
                tooltip.remove();
            }, Constants.toolTipTimeout);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        designedAtMultiplierChanged: function () {
            this.handleShowMeasurementInfo((this.layerList) ? {layerList: this.layerList} : {layerModel: this.layerModel});
        },

        handleCopyableClick: function (event) {
            event.stopPropagation();
        },

        highlightLabel: function () {
            $(this).addClass('zeroclipboard-is-hover');
        },

        unhighlightLabel: function () {
            $(this).removeClass('zeroclipboard-is-hover');
        },

        handlePreferredMeasurementUnitChange: function (event) {
            var newPreferredUnits = (event.target.id === 'preferredUnitPx') ? Constants.MeasurementUnitType.PX : Constants.MeasurementUnitType.PCT;
            if (newPreferredUnits !== UserSettingsModel.get('preferredMeasurementUnits')) {
                UserSettingsModel.set('preferredMeasurementUnits', newPreferredUnits);
                this.$el.find('#measurementPreferredUnits span').toggleClass('selectedUnit');
                this.sourceElement = null;
                this.handleShowMeasurementInfo((this.layerList) ? {layerList: this.layerList} : {layerModel: this.layerModel});
                graphite.events.trigger('preferredMeasurementUnitsChanged', {preferredMeasurementUnits: newPreferredUnits});
            }
            event.stopPropagation();
        },

        handleShowMeasurementInfo: function (params) {
            var dimensionDiv = this.$el.find('.measurementElementInfoDim'),
                positionDiv = this.$el.find('.measurementElementInfoPos'),
                psdModel = SelectionController.getPSDModel(),
                designedAtMultiplier = PSDSettingsModel.get('designedAtMultiplier'),
                containingLayerBounds,
                containingLayerIsArtboard = false,
                bounds,
                layer1Artboard,
                layer2Artboard,
                rect1,
                rect2;
            this.layerModel = null;
            this.layerList = null;
            this.layerGroupBounds = null;

            //By default use the whole PSD as the container for percent measurements
            containingLayerBounds = psdModel.get('imgdata').bounds;
            //Now figure out the bounds of whichever layers are selected and calculate the dimensions
            if (params.layerList instanceof Array) {
                bounds = MeasurementUtil.calcLayerGroupBounds(params.layerList, psdModel);
                if ((params.layerList.length === 2) && (UserSettingsModel.get('preferredMeasurementUnits') === Constants.MeasurementUnitType.PCT)) {
                    //If there are exactly two layers selected, check to see if one layer completely contains the other.
                    //If it does, then we have the special case of showing percentage measurements of the smaller to the larger.
                    rect1 = MeasurementUtil.getVisibleBounds(params.layerList[0], psdModel);
                    rect2 = MeasurementUtil.getVisibleBounds(params.layerList[1], psdModel);

                    layer1Artboard = params.layerList[0].getArtboardParent();
                    layer2Artboard = params.layerList[1].getArtboardParent();
                    if (psdModel.get('isArtboardPSD') && layer1Artboard && (layer1Artboard === layer2Artboard)) {
                        //If both layers are in the same artboard, use that as the container bounds instead of the PSD
                        containingLayerBounds = layer1Artboard.get('bounds');
                    } else if (MeasurementUtil.rect1ContainsRect2(rect1, rect2)) {
                        bounds = rect2;
                        containingLayerBounds = rect1;
                    } else if (MeasurementUtil.rect1ContainsRect2(rect2, rect1)) {
                        bounds = rect1;
                        containingLayerBounds = rect2;
                    }
                }
            } else {
                layer1Artboard = params.layerModel.getArtboardParent();
                if (psdModel.get('isArtboardPSD') && layer1Artboard && (layer1Artboard !== params.layerModel)) {
                    //If the layer is in an artboard use that artboard as the container bounds for percentages
                    containingLayerBounds = layer1Artboard.get('bounds');
                    containingLayerIsArtboard = true;
                }
                bounds = MeasurementUtil.getVisibleBounds(params.layerModel, psdModel);
            }
            var calculatedMeasurements = MeasurementUtil.getMeasurementsOfRectInsideRect(bounds, containingLayerBounds, containingLayerIsArtboard);
            if (psdModel.get('isArtboardPSD') && layer1Artboard && (layer1Artboard !== params.layerModel)) {
                this.displayX = Math.round(calculatedMeasurements.displayLeft/designedAtMultiplier);
                this.displayY = Math.round(calculatedMeasurements.displayTop/designedAtMultiplier);
            } else {
                this.displayX = calculatedMeasurements.displayLeft;
                this.displayY = calculatedMeasurements.displayTop;
            }
            this.displayWidth = calculatedMeasurements.displayWidth;
            this.displayHeight = calculatedMeasurements.displayHeight;

            positionDiv.find('.x').text(this.displayX + 'px');
            positionDiv.find('.y').text(this.displayY + 'px');

            dimensionDiv.find('.width').text(calculatedMeasurements.displayWidth);
            dimensionDiv.find('.height').text(calculatedMeasurements.displayHeight);

            if (params.layerList instanceof Array) {
                this.layerList = params.layerList;
                this.lastMeasuredBounds = _.clone(bounds);
                this.layerGroupBounds = params.layerList[0].attributes.bounds;

                this.placePopupOutOfTheWay(params.layerList);
            } else {
                this.layerModel = params.layerModel;
                this.placePopupRelativeToLayerElement(params.layerModel);
            }
        },

        placePopupRelativeToLayerElement: function (layerElement) {
            var notchElement = this.$el.find('.notch'),
                copyTextLink = this.$el.find('#copyTextLink'),
                positionDiv = this.$el.find('.measurementElementInfoPos'),
                psdModel = SelectionController.getPSDModel(),
                bounds;

            notchElement.show();
            positionDiv.show();
            if (!layerElement || (layerElement.get('type') !== Constants.Type.LAYER_TEXT)) {
                copyTextLink.addClass('disabled');
            } else {
                copyTextLink.removeClass('disabled');
            }

            if (layerElement) {
                var newSourceElement = LayerModelMap.getLayerInfoForId(layerElement.attributes.layerId).item;
                if (this.sourceElement !== newSourceElement) {
                    this.sourceElement = newSourceElement;
                    bounds = MeasurementUtil.getVisibleBounds(layerElement, psdModel);
                    this.lastMeasuredBounds = _.clone(bounds);
                    this.layerBounds = ZoomController.zoomRect(bounds);

                    var shiftClickNotification = null;
                    var shiftClickNotificationElement = this.$el.find('#shiftClickMeasurementNotification');

                    if (shiftClickNotificationElement.length === 0 &&
                        UserSettingsModel.shouldInterceptBeShown(Constants.InterceptNames.SHIFT_CLICK_MEASUREMENT)) {
                        shiftClickNotification = new ShiftClickNotificationView();
                        this.$el.append(shiftClickNotification.$el);
                        //The -9 offsets the difference between the -26 pixels of margin and the +35 pixels of padding to make the total difference 0
                        //so the width of this notification will match the width of the parent.
                        this.$el.find('#shiftClickMeasurementNotification').css({'width': Math.floor(this.$el.width()-9)});
                    }


                    this.handleShow({sourceElement: $(this.sourceElement)});
                    if (shiftClickNotification && this.$el.hasClass('top')) {
                        this.$el.prepend(shiftClickNotification.$el);
                    }
                }
            } else {
                this.closePopup();
                this.sourceElement = null;
            }
        },

        placePopupOutOfTheWay: function (layerList) {
            var notchElement = this.$el.find('.notch'),
                positionDiv = this.$el.find('.measurementElementInfoPos'),
                copyCSSLink = this.$el.find('#copyCSSLink'),
                copyTextLink = this.$el.find('#copyTextLink'),
                $popupOverlay = $('#popupOverlay'),
                $previewView = $('div.psd-preview-view'),
                hScrollPos =  $previewView.scrollLeft(),
                vScrollPos =  $previewView.scrollTop(),
                previewAreaHeight = $previewView.height(),
                previewAreaWidth = $previewView.width() - 10,
                maxX = Math.min(previewAreaWidth, this.$el.parent().width()),
                maxY = Math.min(previewAreaHeight, this.$el.parent().height()),
                verticalPadding = Math.min(Math.floor(maxY/10), 90), //Use less vertical padding when we have less vertical space
                $bannerElements,
                $bannerElement1,
                $bannerElement2;

            notchElement.hide();
            positionDiv.hide();
            copyCSSLink.addClass('disabled');
            copyTextLink.addClass('disabled');

            //Figure the bounds for our popup. Start by assuming we're going to place it in the middle, centered horizontally
            var popupBounds = {left: (maxX - this.$el.outerWidth()) / 2 + hScrollPos,
                top: (maxY - this.$el.outerHeight())/2 + vScrollPos,
                right: (maxX + this.$el.outerWidth()) / 2 + hScrollPos,
                bottom: (maxY + this.$el.outerHeight())/2 + vScrollPos};

            if (layerList.length === 2) {
                $bannerElements = $popupOverlay.find('div.measurementOffsetsBanner');
                $bannerElement1 = $bannerElements.first();
                $bannerElement2 = $bannerElements.slice(1).first();
                //We need to figure out what the banner's actual bounds will be, but that's difficult because
                //it's currently animating and is contained in a parent that's also animating. So we figure
                //where the banner will end up after the animations by inferring from the current CSS values.
                var bannerLeft = parseInt($bannerElement1.css('left'), 10),
                    bannerParentLeft = parseInt($bannerElement1.parent().css('left'), 10),
                    bannerParentParentOffsetLeft = $bannerElement1.parent().parent().offset().left,
                    bannerTop = parseInt($bannerElement1.css('top'), 10),
                    bannerParentTop = parseInt($bannerElement1.parent().css('top'), 10),
                    bannerParentParentOffsetTop = $bannerElement1.parent().parent().offset().top,
                    pendingBannerX = bannerLeft + bannerParentLeft + bannerParentParentOffsetLeft - $popupOverlay.offset().left,
                    pendingBannerY = bannerTop + bannerParentTop + bannerParentParentOffsetTop - $popupOverlay.offset().top;

                //Now that we've computed the position of the first banner, figure out it's bounds
                var banner1Bounds = {left: pendingBannerX, top: pendingBannerY, right: pendingBannerX + $bannerElement1.outerWidth(), bottom: pendingBannerY + $bannerElement1.outerHeight()};
                var banner2Bounds = {left: 0, top: 0, right: 0, bottom: 0};

                //Now determine if there is a second banner and it's bounds
                if ($bannerElement2.length === 1) {
                    bannerLeft = parseInt($bannerElement2.css('left'), 10);
                    bannerParentLeft = parseInt($bannerElement2.parent().css('left'), 10);
                    bannerParentParentOffsetLeft = $bannerElement2.parent().parent().offset().left;
                    bannerTop = parseInt($bannerElement2.css('top'), 10);
                    bannerParentTop = parseInt($bannerElement2.parent().css('top'), 10);
                    bannerParentParentOffsetTop = $bannerElement2.parent().parent().offset().top;
                    pendingBannerX = bannerLeft + bannerParentLeft + bannerParentParentOffsetLeft - $popupOverlay.offset().left;
                    pendingBannerY = bannerTop + bannerParentTop + bannerParentParentOffsetTop - $popupOverlay.offset().top;
                    banner2Bounds = {left: pendingBannerX, top: pendingBannerY, right: pendingBannerX + $bannerElement2.outerWidth(), bottom: pendingBannerY + $bannerElement2.outerHeight()};
                }

                //And then figure out if the popup intersects with either banner so we know if we need to move it to the top
                if (MeasurementUtil.boundsIntersect(banner1Bounds, popupBounds) || MeasurementUtil.boundsIntersect(banner2Bounds, popupBounds)) {
                    //The bounds intersect, so place the popup near the top
                    popupBounds.top = verticalPadding + $previewView.scrollTop();
                    popupBounds.bottom = popupBounds.top + this.$el.outerHeight();

                    //Can we put it at the top?
                    if (MeasurementUtil.boundsIntersect(banner1Bounds, popupBounds) || MeasurementUtil.boundsIntersect(banner2Bounds, popupBounds)) {
                        //The bounds intersect, so place the popup near the bottom
                        popupBounds.top = maxY - this.$el.outerHeight() - verticalPadding + $('div.psd-preview-view').scrollTop();
                        popupBounds.bottom = popupBounds.top + this.$el.outerHeight();
                    }

                    //TODO - If the bounds intersect at the bottom as well we will need to search for an open space to put the popup
                }
            }
            this.$el.show();
            this.$el.css({left: popupBounds.left, top: popupBounds.top});
        },

        getSourceXOffset: function () {
            return this.layerBounds.left;
        },

        getSourceYOffset: function () {
            return this.layerBounds.top;
        },

        getSourceOuterWidth: function () {
            return this.layerBounds.right - this.layerBounds.left;
        },

        getSourceOuterHeight: function () {
            return this.layerBounds.bottom - this.layerBounds.top;
        },

        destroy: function () {
            if (this.extractAssetPopup) {
                graphite.events.trigger('hide-extract-asset-popup');
            }
            graphite.events.off(null, null, this);
        }

    });

    return MeasurementPopupView;
});
