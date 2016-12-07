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
    '../../utils/TemplateUtil',
    '../modal/BaseModalView',
    'text!../templates/extractForDeviceDlgTemplate.html',
    'text!../templates/extractSettingsItemTemplate.html',
    '../../controllers/DerivedAssetController',
    '../../models/PSDSettingsModel'
], function ($, _, Backbone, deps, TemplateUtil, BaseModalView, ExtractForDeviceDlgTemplate, ExtractSettingsItemTemplate,
             DerivedAssetController, PSDSettingsModel) {
    'use strict';

    var ExtractForDeviceDlg = BaseModalView.extend({
        visible: false,

        events: {
            'click #cancel_dialog': 'handleHide',
            'click #apply_settings': 'handleApply',
            'blur .extract-folder': 'handleFolderChange',
            'blur .extract-suffix': 'handleSuffixChange'
        },

        initialize: function () {
            this.settings = DerivedAssetController.loadDeviceExtractionSettings(this.model);
            this.settings.on('reset', this.handleExtractionSettingsReset, this);

            this.render();
            graphite.events.on('show-extractForDevice-dialog', this.handleShow, this);
            graphite.events.on('hide-extractForDevice-dialog', this.handleHide, this);
            this.lastAppliedDesignedAt = PSDSettingsModel.get('designedAtMultiplier');
        },

        render: function () {
            this.setElement(TemplateUtil.createTemplate(ExtractForDeviceDlgTemplate));
            //now add the settings
            this.addSettingsListItems();

            var $lsoWarning = this.$el.find('#lsoWarningMessage');
            $lsoWarning.html(deps.translate('Your assets contain a {0}http://www.adobe.com/go/smart_objects{1}Linked Smart Object{2} that will render poorly when scaled. {3}http://www.adobe.com/go/extract_help#linked_smart_objects{4}Help{5}',
                '<a id="smart_obj_link" href="',
                '" target="_blank">',
                '</a>',
                '<a id="help_link" href="',
                '" target="_blank">',
                '</a>'));

            return this;
        },

        addSettingsListItems: function () {
            var deviceList = this.$el.find('.device-list'),
                i;
            for (i = 0; i < this.settings.length; i++) {
                deviceList.append(TemplateUtil.createTemplate(ExtractSettingsItemTemplate, this.settings.at(i)));
            }
        },

        //------------------------------------------------
        // Handlers
        //------------------------------------------------

        handleHide: function () {
            BaseModalView.prototype.handleHide.apply(this, arguments);

            this.$el.hide();
            this.visible = false;
        },

        handleShow: function () {
            if (DerivedAssetController.containsALinkedSmartObjectAsset()) {
                this.$el.find('div.linked-smart-object-warning').show();
            }
            else {
                this.$el.find('div.linked-smart-object-warning').hide();
            }

            BaseModalView.prototype.handleShow.apply(this, arguments);

            this.updateUI();
            this.$el.show();
            this.visible = true;
        },

        handleApply: function () {
            //push changes to model
            var items = this.$el.find('.extract-settings-item'),
                itemModel,
                $item,
                suffix,
                i;

            for (i = 0; i < items.length; i++) {
                $item = items.eq(i);
                itemModel = this.findModel($item);
                suffix = $item.find('.extract-suffix')[0].value;

                itemModel.set('checked', $item.find('.extract-setting-type')[0].checked);
                itemModel.set('suffix', suffix !== deps.translate('none') ? suffix : '');
                itemModel.set('folder', $item.find('.extract-folder')[0].value);
            }

            DerivedAssetController.saveDeviceExtractionSettings();
            this.lastAppliedDesignedAt = PSDSettingsModel.get('designedAtMultiplier');

            this.handleHide();
        },

        updateUI: function () {
            var items = this.$el.find('.extract-settings-item'),
                itemModel,
                $item,
                suffix,
                folder,
                i;

            for (i = 0; i < items.length; i++) {
                $item = items.eq(i);
                itemModel = this.findModel($item);
                suffix = itemModel.get('suffix');
                folder = itemModel.get('folder');
                $item.find('.extract-setting-type')[0].checked = itemModel.get('checked');
                $item.find('.extract-suffix')[0].value = suffix === '' ? deps.translate('none') : suffix;
                $item.find('.extract-folder')[0].value = this.normalizeFolderString(folder);
                $item.find('.extract-folder').removeClass('validation-error');
                $item.find('.extract-suffix').removeClass('validation-error');
            }

            this.updateApplyButton();

            // Update designedAt description.
            var designedAtText = deps.translate('This PSD was designed at '),
                infoText = designedAtText + PSDSettingsModel.get('designedAtMultiplier') + 'x',
                infoLink = deps.translate("what's this?");
            this.$el.find('.info').html(infoText + ' (<a href="http://www.adobe.com/go/extract_faq_assets" target="_blank">' + infoLink +  '</a>)');
        },

        findModel: function ($elem) {
            var itemModel,
                id = $elem.closest('.extract-settings-item')[0].id,
                index = id.lastIndexOf('-');

            id = id.substring(index + 1);
            itemModel = this.settings.get(id);
            return itemModel;
        },

        updateApplyButton: function () {
            var $validationErrors = this.$el.find('.validation-error');
            this.$el.find('#apply_settings').prop('disabled', $validationErrors.length !== 0);
        },

        handleFolderChange: function (event) {
            var valid = true,
                target = event.target,
                value = $.trim(target.value);

            //check for sub sub folders
            if (value.length === 0) {
                valid = false;
                target.title = deps.translate('The destination folder cannot be empty.');
            }

            //check for bad characters
            if (value.match(/(\|\\|:|\*|\?|"|<|>|\||\,|^\.\.\.)/g)) {
                valid = false;
                target.title =  deps.translate('The folder name contains invalid characters.');
            }

            //check for sub sub folders
            if (value.match(/.\/./)) {
                valid = false;
                target.title = deps.translate('The destination folder cannot be a nested subfolder.');
            }

            //check for sub sub folders
            if (value.length === 0) {
                valid = false;
                target.title = deps.translate('The destination folder must not be empty.');
            }

            //check that folder name ends with '/'
            if (valid) {
                target.value = this.normalizeFolderString(value);
            }

            $(target).toggleClass('validation-error', !valid);
            if (valid) {
                target.title = '';
            }

            this.updateApplyButton();
        },

        handleSuffixChange: function (event) {
            var valid = true,
                target = event.target,
                value = $.trim(target.value);

            //check for sub sub folders
            if (value.length === 0) {
                valid = false;
                target.title = deps.translate('The suffix cannot be empty.');
            }

            //check for bad characters
            if (value.match(/(\|\\|\/|:|\*|\?|"|<|>|\||\,|^\.\.\.)/g)) {
                valid = false;
                target.title =  deps.translate('The suffix contains invalid characters.');
            }

            $(target).toggleClass('validation-error', !valid);

            if (valid) {
                target.title = '';
            }

            // Restore default label if empty
            if (valid && value.length === 0) {
                target.value = deps.translate('none');
            }

            this.updateApplyButton();
        },

        normalizeFolderString: function (folderStr) {
            if (folderStr.charAt(folderStr.length - 1) !== '/') {
                folderStr += '/';
            }
            return folderStr;
        },

        remove: function () {
            this.settings.off(null, null, this);
            graphite.events.off(null, null, this);
            return Backbone.View.prototype.remove.call(this);
        },

        handleExtractionSettingsReset: function () {
            this.updateUI();
        }
    });

    return ExtractForDeviceDlg;
});
