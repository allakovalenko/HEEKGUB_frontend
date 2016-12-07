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
/*global graphite*/

define([
    'underscore',
    'backbone',
    'plugin-dependencies',
    '../models/PSDModel',
    '../Constants'
], function (_, Backbone, deps, PSDModel, Constants) {
    'use strict';
    var AssetController = Backbone.Model.extend({
        getAsset: function (assetId, layerCompId, successCallback, errorCallback, context) {
            var localContent = context ? context.localContent : false,
                psdModel = new PSDModel({id: assetId, assetId: assetId, layerCompId: layerCompId, localContent: localContent}),
                errorCallbackWrapper = function (response, err, failurePart) {
                    if (failurePart === 'JSON') {
                        var status = response.status;
                        if (err) {
                            if (err.errorCode === Constants.WorkerErrorCodes.GRAPHITE_REJECTED) {
                                status = 422; // 'Unprocessable entity' was the nearest I could find :-)
                            }
                            if (err.errorCode === Constants.WorkerErrorCodes.GRAPHITE_PROCESSING) {
                                status = 500;
                            }
                        }
                        if (status >= 300) {
                            psdModel.set('errorInfo', err);
                            psdModel.set('status', status);
                        }
                    } else {
                        deps.notifyUser(deps.translate("Uh oh, The rendering step failed.  Some functionality may be disabled."));
                        graphite.events.trigger('errorNotificationShown');
                    }
                    errorCallback.apply(context, [response, err, failurePart]);
                };

            if (localContent) {
                graphite.getServerAPI().loadPsdModelFromUrl(psdModel, context.localContent.directory + '/graphite.json', successCallback, errorCallbackWrapper, context);
            } else {
                graphite.getServerAPI().loadPsdModel2(psdModel, successCallback, errorCallbackWrapper, context);
            }

            return psdModel;
        }

    });

    return new AssetController();
});
