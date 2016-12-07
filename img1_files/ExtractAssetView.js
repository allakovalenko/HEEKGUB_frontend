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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, regexp: true */
/*global define: true, graphite: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    'plugin-dependencies',
    '../../controllers/DerivedAssetController',
    '../../controllers/SelectionController',
    './BasePopupView',
    '../../utils/TemplateUtil',
    '../../utils/LayerNameParser',
    '../../models/UserSettingsModel',
    'text!../templates/extractAssetTemplate.html',
    '../../Constants'
], function ($, _, Backbone, deps, DerivedAssetController, SelectionController,
    BasePopupView, TemplateUtil, LayerNameParser, UserSettingsModel, ExtractAssetTemplate, Constants) {
    'use strict';

    var DEFAULT_JPEG_QUALITY = 80;

    // If you need to change the forbidden characters, change both this and
    // `REPLACE_RE`.
    var FORBIDDEN_CHARACTERS = '/\\\\:*?"<>|,';
    var FORBIDDEN_CHARACTERS_PLUS_WHITESPCE = FORBIDDEN_CHARACTERS + '\\s';
    // Used for the `pattern` attribute of the name input. Whitespace rules
    // ensure no no names that consist of *just* whitespace
    var VALIDATION_PATTERN = '^[^' + FORBIDDEN_CHARACTERS + ']*' +
        '[^' + FORBIDDEN_CHARACTERS_PLUS_WHITESPCE + '][^' + FORBIDDEN_CHARACTERS + ']*$';
    // Although it would be nice to generate this from FORBIDDEN_CHARACTERS,
    // several characters like `*` need extra escaping, making it a bit too
    // much of a pain
    var REPLACE_RE = /(\/|\\|:|\*|\?|"|<|>|\||\,|^\.\.\.)/g;

    var ExtractAssetView = BasePopupView.extend({

        className: 'extract-asset-popup popup',

        selectedLayers: null,
        qualityRange: null,
        qualityPercent: null,
        fileFormat: null,
        sizeSpan: null,
        extractSize: null,
        qualityLabel: null,
        qualityBox: null,
        formatDescription: null,
        description: {
            png8: deps.translate('256 colors. Lowest file size. Alpha transparency to be retained if present in element.'),
            png32: deps.translate('Lossless format so better quality.'),
            svg: deps.translate('We use the standard W3C SVG format which is supported by all viewers.')
        },
        baseName: null,

        events: {
            'click #downloadBtn': 'handleExportAsset',
            'click #saveBtn': 'handleExportAsset',
            'change .scale-enable': 'scaleEnabledChanged',
            'change .scale-factor': 'scaleFactorChanged'
        },

        selectedLayersContainLinkSmartObject: function () {
            //get a list of all the selected layers (what the user is about to create as an asset)
            //check if any of those are a linked smart object
            var result;
            var selectedLayers = SelectionController.getSelectedLayers();
            var smartObjInfo;
            result = selectedLayers.some(function(selectedLayer, layerIndex) {
                smartObjInfo = selectedLayer.get('smartObjectInfo');
                return (smartObjInfo ? smartObjInfo.linked : false);
            });
            return deps.utils.hasFeature('extract_batch') && result;
        },

        initialize: function () {
            BasePopupView.prototype.initialize.apply(this, arguments);
            this.onbeforeunload = this.handleClose;
        },

        updateQuality: function (quality) {
            quality = Math.min(100, quality);
            quality = Math.max(0, quality);

            this.$qualityPercent.val(quality);
            this.$qualityRange.val(quality);
            this.updateSizeAndDescription();

            // Only save the quality setting when creating a new asset, not
            // when updating an existing one
            if (!this.existingAsset) {
                UserSettingsModel.set('assetQuality', quality);
            }
        },

        updateSizeAndDescription: function () {
            var fileFormatSelected = this.getFileFormat();

            if (fileFormatSelected === 'jpeg') {
                this.$qualityLabel.html(deps.translate('Quality'));
                this.$qualityBox.removeClass('quality-description');
                this.$qualityRange.css('display', 'block');
                this.$qualityPercent.css('display', 'block');
                this.$formatDescription.css('display', 'none');
            } else {
                this.$qualityLabel.html(deps.translate('Description'));
                this.$qualityBox.addClass('quality-description');
                this.$qualityRange.css('display', 'none');
                this.$qualityPercent.css('display', 'none');
                this.$formatDescription.css('display', 'block');
                // Update the description
                this.$formatDescription.html(this.description[fileFormatSelected]);
            }

            if (fileFormatSelected === 'svg' && this.bitmap) {
                this.$svgWarning.show();
                this.$notWarning.hide();
            } else {
                this.$svgWarning.hide();
                this.$notWarning.show();
            }
            if (this.baseName) {
                var fileName = DerivedAssetController.generateUniqueAssetName(this.baseName, fileFormatSelected);
                this.$fileName.val(fileName);
            }
        },

        updateFileNameValidity: function () {
            if (this.$fileName[0].validity.valid) {
                this.$saveButton.prop('disabled', false);
                this.$downloadButton.prop('disabled', false);
            } else {
                this.$saveButton.prop('disabled', true);
                this.$downloadButton.prop('disabled', true);
            }
        },

        render: function () {
            BasePopupView.prototype.render.apply(this, arguments);

            this.$el.find('.popup-contents').html(TemplateUtil.createTemplate(ExtractAssetTemplate, {settings: UserSettingsModel}));

            this.$fileName = this.$el.find('.file-name');
            this.$qualityRange = this.$el.find('.quality-range');
            this.$qualityPercent = this.$el.find('.quality-percentage');
            this.$fileFormat = this.$el.find('.options');
            this.$qualityLabel = this.$el.find('.subtitle');
            this.$qualityBox = this.$el.find('.quality');
            this.$formatDescription = this.$el.find('.format-description');
            this.$scale = this.$el.find('.scale');
            this.$scaleEnabled = this.$el.find('.scale-enable');
            this.$scaleFactor = this.$el.find('.scale-factor');
            this.$svgWarning = this.$el.find('.svg-warning');
            this.$lsoWarning = this.$el.find('.lso-warning');
            this.$notWarning = this.$el.find('.not-warning');
            this.$downloadButton = this.$el.find('#downloadBtn');
            this.$saveButton = this.$el.find('#saveBtn');

            this.$lsoWarning.html(deps.translate('{0}http://www.adobe.com/go/smart_objects{1}Linked Smart Objects{2} will render poorly when scaled. {3}http://www.adobe.com/go/extract_help#linked_smart_objects{4}Help{5}',
                                  '<a id="smart_obj_link" href="',
                                  '" target="_blank">',
                                  '</a>',
                                  '<a id="help_link" href="',
                                  '" target="_blank">',
                                  '</a>'));

            this.$fileName.attr('title', deps.translate(
                'Cannot include any of the characters {0}',
                // variable has an extra backslash which the user shouldn't see
                FORBIDDEN_CHARACTERS.replace("\\\\", "\\")
            ));
            this.$fileName.attr('pattern', VALIDATION_PATTERN);

            this.$downloadButton.toggle(deps.utils.hasFeature('extract_batch') === true && !graphite.inPublicOneUp());

            // Only enable if feature is enabled for now.
            this.$scale.toggle(true);

            return this;
        },

        addHandlers: function () {
            var self = this;
            BasePopupView.prototype.addHandlers.apply(this, arguments);

            graphite.events.on('show-extract-asset-popup', this.handleShow, this);
            graphite.events.on('hide-extract-asset-popup', this.handleHide, this);

            this.$el.mousedown(function (event) {
                event.stopPropagation();
            });

            this.$fileFormat.change(function () {
                self.updateSizeAndDescription();
            });

            this.$qualityRange.change(function () {
                self.updateQuality(this.value);
            });

            this.$qualityPercent.change(function () {
                self.updateQuality(this.value);
            });

            //swallow key up events
            var fileNameInput = this.$fileName;
            fileNameInput.keyup(function (event) {
                self.handleKeyUp(event);
                event.stopImmediatePropagation();
            });

            fileNameInput.keypress(function (event) {
                if (event.which === 13) {
                    self.handleExportAsset(event);
                }
            });

            fileNameInput.change(function () {
                self.baseName = null;
            });
        },

        removeEventListeners: function () {
            graphite.events.off(null, null, this);
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleShow: function (params) {
            var title = this.$el.find('.title');
            this.existingAsset = null;

            if (params.type === "new") {
                // If we're not logged in, don't allow extraction of multiple layers at once
                // Using deps.user() for now, assuming that will be the gate for multi extraction
                var selectedLayers = deps.utils.getCurrentPage() ? SelectionController.getSelectedLayers() :
                        SelectionController.getSelectedLayers().slice(0, 1);

                this.bitmap = false;
                for (var i = 0, ii = selectedLayers.length; i < ii; i++) {
                    var layer = selectedLayers[i],
                        isVector = layer.get('type') === Constants.Type.LAYER_TEXT || layer.get('properties').get('shape');
                    this.bitmap = this.bitmap || !isVector;
                }

                var layerModel = selectedLayers[0];
                this.selectedVisibleLayerIds = SelectionController.expandSelection(selectedLayers).map(function (layer) {
                    return layer.get("layerId");
                });

                if (layerModel && this.selectedVisibleLayerIds.length) {
                    this.deriveAssetDetailsFromLayer(layerModel);

                    if (this.selectedVisibleLayerIds.length === 1) {
                        title.html(deps.translate('Save as Image...'));
                    } else {
                        title.html(deps.translate('Save {0} Layers as Image...', this.selectedVisibleLayerIds.length));
                    }

                    this.updateSizeAndDescription();
                    this.updateFileNameValidity();
                }
            } else if (params.type === "edit") {
                title.html(deps.translate('Edit Image Properties'));

                this.existingAsset = params.model;
                var metadata = DerivedAssetController.getMetadataForAsset(this.existingAsset);

                this.selectedVisibleLayerIds = metadata.get("originatingLayers");

                this.deriveAssetDetailsFromAsset(metadata);
                this.updateSizeAndDescription();
                this.updateFileNameValidity();
                BasePopupView.prototype.handleShow.apply(this, arguments);
            }

            this.showHideLSOWarning();

            BasePopupView.prototype.handleShow.apply(this, arguments);
        },

        handleHide: function () {
            // Reset scale UI since our generator derived name might have
            // overridden the user provided scale.
            var scaleEnabled = UserSettingsModel.get('scaleExtractedAssets');
            this.$scaleEnabled.prop('checked', scaleEnabled);
            this.$scaleFactor.val(UserSettingsModel.get('assetScaleFactor') + 'x');
            this.$scale.toggleClass('disabled', !scaleEnabled);

            BasePopupView.prototype.closePopup.call(this);
        },

        closePopup: function () {
            graphite.events.trigger("hide-extract-asset-popup");
        },

        handleKeyUp: function (event) {
            BasePopupView.prototype.handleKeyUp.apply(this, arguments);
            this.updateFileNameValidity();
        },

        handleExportAsset: function (event) {
            if (!this.$fileName[0].validity.valid) {
                return;
            }

            var directDownload = graphite.inPublicOneUp() || $(event.target).is(this.$downloadButton);

            //default image quality
            var imageQuality = -1,
                scaleFactor = this.$scaleEnabled.prop('checked') && !this.$scale.hasClass('incompatible') ?
                        parseFloat(this.$scaleFactor.val()) : null,
                fileName;

            var fileFormatSelected = this.getFileFormat();
            if (fileFormatSelected === 'jpeg') {
                //image quality slider for jpeg format
                imageQuality = this.$qualityPercent.val();
            }

            fileName = this.normalizeFileName(this.$fileName.val());

            if (this.existingAsset) {
                DerivedAssetController.updateAsset(
                    this.existingAsset,
                    this.selectedVisibleLayerIds,
                    directDownload,
                    fileName,
                    this.getFileFormat(),
                    imageQuality,
                    scaleFactor,
                    this.model,
                    this.handleExportAssetComplete,
                    this.handleExportAssetError,
                    this
                );
            } else {
                DerivedAssetController.exportAsset(
                    this.selectedVisibleLayerIds,
                    directDownload,
                    fileName,
                    this.getFileFormat(),
                    imageQuality,
                    scaleFactor,
                    this.model,
                    false,
                    this.handleExportAssetComplete,
                    this.handleExportAssetError,
                    this
                );

                if (deps.utils.hasFeature('extract_batch')) {
                    if (directDownload) {
                        graphite.events.trigger('extract-asset-direct-download', {fileFormatSelected: fileFormatSelected});
                    } else {
                        graphite.events.trigger('extract-asset-download-init', {fileFormatSelected: fileFormatSelected});
                        graphite.events.trigger('add-asset-to-catalog', {fileFormatSelected: fileFormatSelected});
                    }
                } else {
                    graphite.events.trigger('extract-asset-download-init', {fileFormatSelected: fileFormatSelected});
                }

                if (scaleFactor && scaleFactor !== 1) {
                    graphite.events.trigger('asset-extracted-scaled', {scaleFactor: scaleFactor});
                }
            }

            this.closePopup();
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------
        handleExportAssetComplete: function () {
        },

        handleExportAssetError: function (result) {
            if (result.status === 401) {
                graphite.events.trigger('reauthenticate');
            } else if (result.status === 507) {
                deps.notifyUser(deps.translate("Error extracting asset. You've possibly exceeded your storage limit."));
            } else {
                deps.notifyUser(deps.translate('Error extracting asset.'));
            }
        },

        scaleEnabledChanged: function () {
            var enabled = this.$scaleEnabled.prop('checked');
            this.$scale.toggleClass('disabled', !enabled);
            UserSettingsModel.set('scaleExtractedAssets', enabled);

            this.showHideLSOWarning();
        },

        scaleFactorChanged: function () {
            var factor = parseFloat(this.$scaleFactor.val()),
                newFactor = UserSettingsModel.get('assetScaleFactor');
            if (!isNaN(factor) && factor >= 0.1 && factor <= 5) {
                newFactor = parseFloat(factor.toFixed(1));
            } else if (!isNaN(factor) && factor > 5) {
                newFactor = 5;
            } else if (!isNaN(factor) && factor < 0.1) {
                newFactor = 0.1;
            }
            UserSettingsModel.set('assetScaleFactor', newFactor);
            this.$scaleFactor.val(newFactor + 'x');
        },

        showHideLSOWarning: function () {
            var enabled = this.$scaleEnabled.prop('checked');
            this.$lsoWarning.hide();
            if (enabled && deps.utils.hasFeature('extract_batch')) {
                if (this.existingAsset && this.existingAsset.hasLinkedSmartObject()) {
                    this.$lsoWarning.show();
                } else if (this.selectedLayersContainLinkSmartObject()) {
                    this.$lsoWarning.show();
                }
            }
        },

        //------------------------------------------------
        // Helpers
        //------------------------------------------------

        getFileFormat: function () {
            return this.$fileFormat.find('input[name=imagetype]:checked').val();
        },

        setFileFormat: function (value) {
            this.$fileFormat.find('input[value=' + value + ']').prop('checked', true);
        },

        remove: function () {
            this.removeEventListeners();
            BasePopupView.prototype.remove.call(this);
        },

        /**
         * Sanitize the extracted file name. For now we nix any invalid
         * characters and remove the extension (as one will already be
         * applied during extraction matching the appropriate format).
         * @param name
         */
        normalizeFileName: function (name) {
            name = $.trim(name);
            name = name.substr(0, name.lastIndexOf('.')) || name;
            name = name.replace(REPLACE_RE, '_');
            return name;
        },

        /**
         * Leverages the generator parser to infer extracted asset details
         * such as file name, encoding, optimization, etc. As we move forward,
         * Extract will be able to honor more and more of these hints.
         */
        deriveAssetDetailsFromLayer: function (layerModel) {
            var fileName = layerModel.get('layerName'),
                format = 'png32',
                extractInfo,
                assetDetails,
                quality,
                multiplier,
                scale,
                extension;

            // Remove leading chars
            fileName = fileName.replace(/^(\/|\\|\.)+/, '');

            var jpegQuality = UserSettingsModel.get('assetQuality');
            if (typeof jpegQuality === 'undefined') {
                jpegQuality = DEFAULT_JPEG_QUALITY;
            }

            try {
                extractInfo = LayerNameParser.parse(fileName);
                if (extractInfo && extractInfo.length > 0) {
                    assetDetails = extractInfo[0];
                    fileName = assetDetails.file || fileName;
                    quality = assetDetails.quality;
                    scale = assetDetails.scale;
                    extension = assetDetails.extension || 'png';

                    switch (extension.toLowerCase()) {
                    case 'jpg':
                    case 'jpeg':
                    case 'gif':
                        format = 'jpeg';
                        if (quality) {
                            multiplier = quality.indexOf('%') !== -1 ? 1 : 10;
                            jpegQuality = parseInt(quality, 10) * multiplier;
                        }
                        break;
                    case 'png':
                        format = quality === '8' ? 'png8' : 'png32';
                        break;
                    case 'svg':
                        format = 'svg';
                        break;
                    }
                }
            } catch (e) {}

            this.updateQuality(jpegQuality);

            if (scale && scale !== 1 && scale >= 0.1 && scale <= 5) {
                this.$scaleEnabled.prop('checked', true);
                this.$scale.toggleClass('disabled', false);
                this.$scaleFactor.val(parseFloat(scale.toFixed(1)) + 'x');
            }

            this.setFileFormat(format);
            fileName = this.normalizeFileName(fileName);
            if (deps.utils.hasFeature('extract_batch')) {
                this.baseName = fileName;
            } else {
                this.$fileName.val(fileName);
            }
        },
        /**
         * Unpacks the asset details into the dialog
         */
        deriveAssetDetailsFromAsset: function (assetDetails) {
            // Remove extension from filename
            var fileName = this.normalizeFileName(assetDetails.get('name'));
            var quality = assetDetails.get('encodingQualityFactor') || DEFAULT_JPEG_QUALITY;
            var scale = assetDetails.get('scale') || 1;
            var format = assetDetails.get('encodingType') || "png32";

            if (format === "jpg" || format === "jpeg") {
                this.updateQuality(quality);
            }

            if (scale && scale !== 1 && scale >= 0.1 && scale <= 5) {
                this.$scaleEnabled.prop('checked', true);
                this.$scale.toggleClass('disabled', false);
                this.$scaleFactor.val(parseFloat(scale.toFixed(1)) + 'x');
            }

            this.setFileFormat(format);
            this.baseName = null;
            this.$el.find('.file-name').val(fileName);
        }
    });

    return ExtractAssetView;
});
