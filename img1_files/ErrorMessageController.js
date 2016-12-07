/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
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
/*global define: true, graphite: true*/

define([
    'jquery',
    'underscore',
    'backbone',
    '../Constants',
    'plugin-dependencies'
], function ($, _, Backbone, Constants, deps) {
    'use strict';

    var ErrorMessageController = Backbone.Model.extend({

        getErrorMessageForWorkerResult: function (inJSONResultsData, inAssetName) {

            var errCode = inJSONResultsData.errorCode,
                errMsg = inJSONResultsData.errorMessage;

            if (errCode === null || errCode === undefined) {
                return deps.translate('Unknown error generating Parfait data.');
            }

            if (errCode === Constants.WorkerErrorCodes.UNSUPPORTED_INPUTFMT) {
                return deps.translate('Could not process file {0}: unsupported image format', inAssetName);
            }

            if (errCode === Constants.WorkerErrorCodes.NOINPUTFILE) {
                return deps.translate('No files specified for processing');
            }

            if (errCode === Constants.WorkerErrorCodes.GRAPHITE_PROCESSING) {
                switch (errMsg) {
                case Constants.WorkerErrorMsgs.GR_JSONGENERATION:
                    return deps.translate('Error generating Parfait data for {0}', inAssetName);
                case Constants.WorkerErrorMsgs.GR_THUMBNAIL:
                    return deps.translate('Error generating thumbnail for {0}', inAssetName);
                case Constants.WorkerErrorMsgs.GR_SPRITESHEET:
                    return deps.translate('Error generating Parfait sprites for {0}', inAssetName);
                case Constants.WorkerErrorMsgs.GR_UNKNOWNENCODING:
                    return deps.translate('Error creating asset: unknown encoding');
                case Constants.WorkerErrorMsgs.GR_MISSINGLAYERSPEC:
                    return deps.translate('Error creating asset: missing layer specification');
                case Constants.WorkerErrorMsgs.GR_CREATINGASSET:
                    return deps.translate('Error creating asset: error encoding asset');
                default:
                    // fall through, but make lint happy
                }
            }

            if (errCode === Constants.WorkerErrorCodes.GRAPHITE_REJECTED) {
                var matches = errMsg.match(/File rejected - too many layers \((\d+)\/(\d+)\)/);
                if (matches) {
                    var layerCount = matches[1];
                    var layerLimit = matches[2];
                    return deps.translate('Currently, processing is limited to files with {0} layers or less. {1} contains {2} layers. Please reduce the numbers of layers in your file.', layerLimit, inAssetName, layerCount);
                }

                // fail of some sort. Be generic.
                return deps.translate('Your file exceeds the maximum number of layers supported. Please reduce the number of layers in your file and try again.');
            }

            return deps.translate('Unknown error generating Parfait data for {0}', inAssetName);
        }
    });

    return new ErrorMessageController();
});
