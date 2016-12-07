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
    '../inspect/InspectCSSView',
    '../inspect/InspectFontFamilyView',
    '../inspect/InspectSolidColorView',
    '../inspect/DropperColorView',
    '../inspect/InspectGradientView',
    '../inspect/ContextMenuView',
    '../../models/FontFamilyModel',
    '../../controllers/ClipboardController',
    '../../controllers/SelectionController',
    '../../models/ColorModel',
    '../../models/ColorUsageModel',
    '../../models/PSDSettingsModel',
    '../../models/UserSettingsModel',
    'plugin-dependencies',
    '../../utils/TemplateUtil',
    '../../Constants',
    '../../utils/CSSUtil',
    'text!../templates/autoExtractedItemsTemplate.html'
], function ($, _, Backbone, InspectCSSView, InspectFontFamilyView, InspectSolidColorView, DropperColorView,
             InspectGradientView, ContextMenuView, FontFamilyModel, ClipboardController,
             SelectionController, ColorModel, ColorUsageModel, PSDSettingsModel, UserSettingsModel,
             deps, TemplateUtil, Constants, CSSUtil, AutoExtractedItemsTemplate) {
    'use strict';

    var PSDInspectView = Backbone.View.extend({
        colorChips: [],
        gradientChips: [],
        fontFamilyViews: [],

        events: {
            'dblclick .css-properties': 'handleDoubleClickEvent',
            'change #baseFontInput': 'handleBaseFontSizeChanged'
        },

        initialize: function () {
            this.render();
            this.model.on('change:extractedStyles', this.handleModelExtractedStylesChange, this);
            graphite.getDetailsController().on('change:selectedInspectItem', this.handleSelectedInspectItemChange, this);

            if (this.model.get('extractedStyles')) {
                this.handleModelExtractedStylesChange();
            }
            this.initCopyToClipboard();
            graphite.events.on('commitDropperColor', this.handleNewDropperColor, this);
            graphite.events.on('psdSettingsChanged', this.handlePSDSettingsChanged, this);
        },

        render: function () {

            this.setElement(TemplateUtil.createTemplate(AutoExtractedItemsTemplate,
                { preprocessors: CSSUtil.cssPreprocessors, currentPreprocessor: UserSettingsModel.get('preprocessor'),
                    currentUnitType: UserSettingsModel.get('preferredFontUnits')}));

            this.createCSSView();

            this.createFontUnitMenu();
            this.createPreprocessorMenu();

            if (deps.parfait && window.graphite.isFeatureEnabled('aug21')) {
                this.$el.find('#aug21FilesHeader').addClass('aug21');
            }

            return this;
        },

        createPreprocessorMenu: function () {
            var preprocessorItems = [],
                preprocessorLabels = {};

            _.each(CSSUtil.cssPreprocessors, function (details, key) {
                if (details.enabled !== false) {
                    preprocessorLabels[key] = details.displayName;
                    preprocessorItems.unshift(key);
                }
            });

            this.preprocessorMenu = new ContextMenuView({
                name : 'preprocessor-selector',
                $toggle : this.$('div.preprocessor'),
                $after : this.$('div.preprocessor'),
                items : preprocessorItems,
                position : Constants.MenuPosition.BELOW
            });
            this.preprocessorMenu.labels = preprocessorLabels;
            this.$('.preprocessor').addClass('menu-active');
            this.preprocessorMenu.on('show', this.handlePreprocessorMenuShow, this);
            this.preprocessorMenu.on('selection', this.handlePreprocessorSelectionChange, this);
        },

        createFontUnitMenu: function () {
            var fontUnitItems = ['PX', 'REMS', 'EMS'];

            this.fontUnitMenu = new ContextMenuView({
                name : 'fontUnit-selector',
                $toggle : this.$('div.fontUnit'),
                $after : this.$('div.fontUnit'),
                items : fontUnitItems,
                position : Constants.MenuPosition.TOP
            });
            this.fontUnitMenu.labels = Constants.FontUnitType;
            this.$('.fontUnit').addClass('menu-active');
            this.fontUnitMenu.on('show', this.handleFontUnitMenuShow, this);
            this.fontUnitMenu.on('selection', this.handleFontUnitSelectionChange, this);
        },

        handleFontUnitMenuShow: function ($menu) {
            var currentItem = UserSettingsModel.get('preferredFontUnits');
            var key = (_.invert(Constants.FontUnitType))[currentItem];
            this.fontUnitMenu.checkItem(key);
        },

        handleFontUnitSelectionChange: function (fontUnit) {
            var unit = Constants.FontUnitType[fontUnit];
            if (unit !== UserSettingsModel.get('preferredFontUnits')) {
                this.handlePreferredUnitTypeChanged(unit);
                UserSettingsModel.set('preferredFontUnits', unit);
                this.$('.fontUnit').text(unit);
            }
        },

        handlePreprocessorMenuShow: function ($menu) {
            var currentPreprocessor = UserSettingsModel.get('preprocessor');
            this.preprocessorMenu.checkItem(currentPreprocessor);
        },

        handlePreprocessorSelectionChange: function (preprocessor) {
            if (preprocessor !== UserSettingsModel.get('preprocessor')) {
                UserSettingsModel.set('preprocessor', preprocessor);
                this.$('.preprocessor b').text(CSSUtil.cssPreprocessors[preprocessor].displayName);
                graphite.events.trigger('preprocessorChanged', {preprocessor: preprocessor});
            }
        },

        handleModelExtractedStylesChange: function () {
            this.createTextStyleExamples();
            this.createSolidColorChips();
            this.createGradientChips();
        },

        initCopyToClipboard: function () {
            var clipboard = ClipboardController.getClipboard();

            //copy css button
            var $copyAllBtn = this.$el.find('button.cssInspectorCopyAllButton');
            clipboard.clip($copyAllBtn);

            var self = this;
            graphite.events.on('clipboard-data-requested', function (elem) {
                if ($(elem).is($copyAllBtn)) {
                    $copyAllBtn.html(deps.translate('Copied'));
                    setTimeout(function () {
                        $copyAllBtn.html(deps.translate('Copy All'));
                    }, 1500);
                    var layerModel = SelectionController.getSelectedLayers(),
                        cssStr;
                    if (layerModel.length !== 0) {
                        if (layerModel.length === 1) {
                            layerModel = layerModel[0];
                            cssStr = layerModel.getCSSAsString(true, UserSettingsModel.get('preprocessor'));
                            //copy css metrics event
                            graphite.events.trigger('copy-css', {origin: 'CSSInspectorCopyAll'});
                        } else {
                            //We don't display any CSS for multiple selected layers
                            cssStr = '';
                        }
                        clipboard.setText(cssStr);
                        graphite.events.trigger('clipboard-text-set', cssStr);
                    } else {
                        var cssProperties = self.$el.find('.css-properties')[0];
                        var text = cssProperties.innerText || cssProperties.textContent;
                        clipboard.setText(text);
                    }
                }
            });

        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
            this.model.off(null, null, this);
            graphite.getDetailsController().off(null, null, this);
        },

        //------------------------------------------------
        // Creation helpers
        //------------------------------------------------

        createCSSView: function () {
            var cssList = this.$el.find('.css-properties'),
                preferredFontUnits = UserSettingsModel.get('preferredFontUnits');

            if (!preferredFontUnits) {
                preferredFontUnits = Constants.FontUnitType.PX;
            }
            this.$el.find('.fontUnit').text(preferredFontUnits);
            this.handlePreferredUnitTypeChanged(preferredFontUnits);

            this.cssView = new InspectCSSView({el: cssList[0]});
        },

        createTextStyleExamples: function () {
            var list = this.$el.find('.font-list'),
                fontExample,
                fonts = this.processTextStyles(),
                self = this,
                ppi = CSSUtil.findModelResolution(self.model);

            list.empty();
            $.each(fonts, function (index, value) {
                fontExample = new InspectFontFamilyView({model: value, ppi: ppi});
                list.append(fontExample.el);
                self.fontFamilyViews.push(fontExample);
            });

            list.append($('<div style="clear:both;"></div>'));
        },


        processTextStyles: function () {
            var extractedStyles = this.model.get('extractedStyles'),
                textStyleUsageModels = extractedStyles ? extractedStyles.textStyleUsageModels : {},
                fontFamilies = [],
                fontFamily,
                textStyle;

            _.each(textStyleUsageModels, function (textStyleUsage) {
                fontFamily = null;
                textStyle = textStyleUsage.get('style');
                // try to find font family for text style
                _.each(fontFamilies, function (family) {
                    if (textStyle.get('fontName') === family.get('name')) {
                        fontFamily = family;
                        return false;
                    }
                    return true;
                });

                if (!fontFamily) {
                    fontFamily = new FontFamilyModel({
                        name: textStyle.get('fontName'),
                        friendlyName: textStyle.get('friendlyName')
                    });
                    fontFamilies.push(fontFamily);
                }

                // add text style to font family
                fontFamily.addTextStyle(textStyleUsage);
            });

            return fontFamilies;
        },

        createSolidColorChips: function () {
            var list = this.$el.find('.solid-color-list'),
                colorChip,
                dropper,
                colorUsageModels = this.model.get('extractedStyles').colorUsageModels,
                self = this;

            colorUsageModels.sort(this.sortColorFunction);

            list.empty();
            _.each(colorUsageModels, function (value) {
                colorChip = new InspectSolidColorView({model: value});
                list.append(colorChip.el);
                self.colorChips.push(colorChip);
            });

            // Append dropper chip
            dropper = new DropperColorView({model: new Backbone.Model()});
            list.prepend(dropper.el);
            list.append($('<div style="clear:both;"></div>'));
        },

        handleNewDropperColor: function (lastColor) {
            var $dropperChip = this.$el.find('.dropper-item .color-chip');

            if (lastColor) {
                var usageModel = new ColorUsageModel(),
                    colorModel = new ColorModel(lastColor),
                    $dropperItem = this.$el.find('.dropper-item');

                usageModel.set('style', colorModel);
                if (lastColor.alpha !== 1) {
                    usageModel.set('alphas', [lastColor.alpha.toFixed(2)]);
                }
                this.model.get('extractedStyles').colorUsageModels.push(usageModel);
                var colorChip = new InspectSolidColorView({model: usageModel});
                colorChip.$el.insertAfter($dropperItem);
                this.colorChips.push(colorChip);
            }

            $dropperChip.css('background-color', '');
        },


        createGradientChips: function () {
            var list = this.$el.find('.gradient-list'),
                gradientChip,
                gradientUsageModels = this.model.get('extractedStyles').gradientUsageModels,
                self = this;

            gradientUsageModels.sort(this.sortColorFunction);

            list.empty();
            _.each(gradientUsageModels, function (value) {
                gradientChip = new InspectGradientView({model: value});
                list.append(gradientChip.el);
                self.gradientChips.push(gradientChip);
            });

            list.append($('<div style="clear:both;"></div>'));
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleBaseFontSizeChanged: function () {
            var $baseFontSizeInput = this.$el.find('#baseFontInput'),
                newBaseFontSizeStr = $baseFontSizeInput.val(),
                regEx = /(\d+)\s*(.*)/,
                matches = regEx.exec(newBaseFontSizeStr),
                baseFontSizeValue = PSDSettingsModel.get('baseFontSizeValue'), //Stored on the model b/c this may change per PSD
                baseFontSizeUnits = PSDSettingsModel.get('baseFontSizeUnits'),
                origValue = baseFontSizeValue + baseFontSizeUnits,
                parsedValue;

            //Figure out what number the user put in and what units they chose
            if (matches && matches.length >= 1) {
                parsedValue = parseFloat(matches[1]);
                if ((parsedValue > 0) && (parsedValue < 1000)) {
                    baseFontSizeValue = parseFloat(matches[1]); //Get the value, check later for units
                }
                if (matches.length >= 2) {
                    // NOTE: If you change this to allow units other than PX then
                    // also update convertUnits in CSSUtil
                    switch (matches[2].trim().toLowerCase()) {
                        case 'px':
                            baseFontSizeUnits = Constants.FontUnitType.PX;
                            break;
                        default:
                            baseFontSizeUnits = Constants.FontUnitType.PX;
                            break;
                    }
                }
            } else {
                //User cleared the field, reset to default values
                baseFontSizeValue = Constants.BaseFontDefaultSize;
                baseFontSizeUnits = Constants.FontUnitType.PX;
            }
            if (baseFontSizeValue) {
                PSDSettingsModel.set('baseFontSizeValue', baseFontSizeValue);
                if (baseFontSizeUnits) {
                    $baseFontSizeInput.val(baseFontSizeValue + baseFontSizeUnits);
                    PSDSettingsModel.set('baseFontSizeUnits', baseFontSizeUnits);
                } else {
                    $baseFontSizeInput.val(baseFontSizeValue.toString() + baseFontSizeUnits);
                }
            } else {
                $baseFontSizeInput.val(baseFontSizeValue + baseFontSizeUnits);
            }
            if (origValue !== baseFontSizeValue + baseFontSizeUnits) {
                graphite.events.trigger('updateFontCSS');
                graphite.events.trigger('baseFontSizeChanged', {newBaseUnits: baseFontSizeValue + baseFontSizeUnits});
                this.createTextStyleExamples();
            }
        },

        handlePreferredUnitTypeChanged: function (preferredFontUnits) {
            var baseFontSizeValue = PSDSettingsModel.get('baseFontSizeValue'),
                baseFontSizeUnits = PSDSettingsModel.get('baseFontSizeUnits');

            if (preferredFontUnits && preferredFontUnits !== Constants.FontUnitType.PX) {
                if (!baseFontSizeValue) {
                    baseFontSizeValue = 16;
                    PSDSettingsModel.set('baseFontSizeValue', baseFontSizeValue);
                }
                if (!baseFontSizeUnits) {
                    baseFontSizeUnits = Constants.FontUnitType.PX;
                    PSDSettingsModel.set('baseFontSizeUnits', baseFontSizeUnits);
                }
                this.$el.find('#baseFontInputLabel').removeClass('disabledLabel');
                this.$el.find('#baseFontInput').prop('disabled', false);
                this.$el.find('#baseFontInput').val(baseFontSizeValue + baseFontSizeUnits);
            } else {
                this.$el.find('#baseFontInputLabel').addClass('disabledLabel');
                this.$el.find('#baseFontInput').prop('disabled', true);
                this.$el.find('#baseFontInput').val('');
            }

            if (preferredFontUnits && preferredFontUnits !== UserSettingsModel.get('preferredFontUnits')) {
                UserSettingsModel.set('preferredFontUnits', preferredFontUnits);
                graphite.events.trigger('updateFontCSS');
                graphite.events.trigger('preferredFontUnitsChanged', {preferredUnits: preferredFontUnits});
                this.createTextStyleExamples();
            }
        },

        handlePSDSettingsChanged: function () {
            this.handlePreferredUnitTypeChanged(UserSettingsModel.get('preferredFontUnits'));
        },

        handleSelectedInspectItemChange: function () {
            if (!graphite.getDetailsController().get('selectedInspectItem')) {
                graphite.events.trigger('hide-extract-code-popup');
            }
        },

        handleDoubleClickEvent: function () {
            graphite.events.trigger('cssDoublClick');
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------

        sortColorFunction: function (a, b) {
            return b.get('layers').length - a.get('layers').length;
        },

        remove: function () {
            this.cssView.remove();
            this.cssView = null;

            this.removeEventListeners();

            // Remove color chip views
            _.each(this.colorChips, function (colorChip) {
                colorChip.remove();
            });
            this.colorChips.length = 0;

            // Remove gradient chip views
            _.each(this.gradientChips, function (gradientChip) {
                gradientChip.remove();
            });
            this.gradientChips.length = 0;

            // Remove font family views
            _.each(this.fontFamilyViews, function (fontFamily) {
                fontFamily.remove();
            });
            this.fontFamilyViews.length = 0;

            Backbone.View.prototype.remove.call(this);
        }

    });

    return PSDInspectView;
});
