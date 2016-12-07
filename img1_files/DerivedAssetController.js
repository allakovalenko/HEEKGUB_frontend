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
    'jquery',
    'underscore',
    'backbone',
    'plugin-dependencies',
    '../collections/DerivedAssetCollection',
    '../models/DerivedAssetModel',
    '../models/ExtractSettingsModel',
    '../models/LayerModelMap',
    '../models/PSDSettingsModel'
], function ($, _, Backbone, deps, DerivedAssetCollection, DerivedAssetModel, ExtractSettingsModel, LayerModelMap, PSDSettingsModel) {
    'use strict';

    function deriveScaleFromSettings(type, designedAtMultiplier) {
        var scales = {
            LDPI: 0.75,
            MDPI: 1,
            TVDPI: 1.33,
            HDPI: 1.5,
            XHDPI: 2,
            XXHDPI: 3,
            XXXHDPI: 4
        };

        // This shouldn't happen
        if (!scales.hasOwnProperty(type)) {
            return 1;
        }

        return scales[type] / designedAtMultiplier;
    }

    function deriveNameFromSettings(name, suffix) {
        var extIndex = name.lastIndexOf('.');

        suffix = suffix || '';

        if (extIndex !== -1) {
            return name.substr(0, extIndex) + suffix;
        } else {
            return name + suffix;
        }
    }

    var DerivedAssetController = Backbone.Model.extend({

        downloadFrames: [],
        maxDownloads: 3,
        fileExtMap : {
            'svg': '.svg',
            'jpg': '.jpg',
            'jpeg': '.jpg',
            'png8': '.png',
            'png32': '.png'
        },

        // Reflects our catalog of extraction data living as metadata on the PSD.
        assetCatalog: new DerivedAssetCollection(),

        // // The previous collection filtered to include only those items that are also in the PSD's sidecar -assets folder.
        derivedAssetCollection: new DerivedAssetCollection(),

        _filterAssets: function (collection) {
            var filteredResults = this.assetCatalog.filter(function (asset) {
                var collectionAsset = collection.findWhere({name: asset.get('name')});
                if (collectionAsset === undefined) {
                    return false;
                }
                asset.set('guid', collectionAsset.get('guid'));
                asset.set('mimeType', collectionAsset.get('mimeType'));
                return true;
            });
            collection.reset();
            this.derivedAssetCollection.reset(filteredResults);
        },

        _loadCataloguedAssets: function (psdModel, successCallback, errorCallback, context) {
            var self = this;

            // STEP 1: Obtain master asset catalog from PSD metadata first as this is our 'source of truth'.
            graphite.getServerAPI().loadAssetData(this.psdGuid,
                'extract_asset_catalog',
                function (response) {

                    self.assetCatalog.reset(response.data);
                    self.assetCatalogVersion = response.etag;

                    var derivedAssets = new DerivedAssetCollection();

                    // STEP 2: Obtain the set of top level assets from our PSD's -assets folder.
                    graphite.getServerAPI().loadDerivedAssetCollection(derivedAssets,
                        psdModel,
                        function (data) {
                            // STEP 3: Return only those assets that exist in our master asset catalog.
                            self._filterAssets(derivedAssets);
                            successCallback.apply(context, [data]);
                        },
                        function (response) {
                            errorCallback.apply(context, [response]);
                        });
                }, function (response) {
                    errorCallback.apply(context, [response]);
                });
        },

        _checkForRefresh: function (response) {
            if (response.needRefresh) {
                graphite.events.trigger('refreshAssetsView');
            }
        },

        _registerDerivedAsset: function (psdModel, assetModel, descriptor, successCallback, errorCallback) {
            var self = this,
                fileName = assetModel.get('name'),
                asset = new DerivedAssetModel({
                    name: fileName,
                    guid: assetModel.get('id'),
                    scale: descriptor.scale,
                    layerCompId: descriptor.layerCompId,
                    originatingLayers: descriptor.layerIds,
                    encodingType: descriptor.encodingType,
                    encodingQualityFactor: descriptor.encodingQualityFactor,
                    psdModified: psdModel.get('modified')
                });

            graphite.getServerAPI().updateAssetData(this.psdGuid,
                'extract_asset_catalog',
                function (dataList) {
                    self.assetCatalog.reset(dataList);
                    var dups = self.assetCatalog.where({name: fileName});
                    self.assetCatalog.remove(dups);
                    self.assetCatalog.push(asset);
                    return self.assetCatalog.toJSON();
                },
                function (response) {
                    self.assetCatalogVersion = response.etag;
                    self.assetCatalog.reset(response.data);
                    self._checkForRefresh(response);
                    graphite.events.trigger('batch_extract_start');
                    self.applyExportSettings(asset);
                    if (successCallback) {
                        successCallback();
                    }
                },
                function (response) {
                    // recover from error
                    console.log('Failure updating derived asset metadata');
                    if (errorCallback) {
                        errorCallback();
                    }
                },
                null);
        },

        _unregisterDerivedAsset: function (asset, successCallback, errorCallback) {
            var self = this;
            graphite.getServerAPI().updateAssetData(this.psdGuid,
                'extract_asset_catalog',
                function (dataList) {
                    self.assetCatalog.reset(dataList);
                    var models = self.assetCatalog.where({name: asset.get('name')});
                    _.each(models, function (model) {
                        self.assetCatalog.remove(model);
                    });
                    return self.assetCatalog.toJSON();
                },
                function (response) {
                    self.assetCatalogVersion = response.etag;
                    self.assetCatalog.reset(response.data);
                    self._checkForRefresh(response);
                    if (successCallback) {
                        successCallback();
                    }
                },
                function (response) {
                    // recover from error
                    console.log('Failure updating derived asset metadata (remove).');
                    if (errorCallback) {
                        errorCallback();
                    }
                },
                null);
        },

        containsALinkedSmartObjectAsset: function () {
            var result = false;
            if (deps.utils.hasFeature('extract_batch') && this.derivedAssetCollection) {
                result = this.derivedAssetCollection.models.some(function (asset, assetIndex) {
                    return asset.hasLinkedSmartObject();
                });
            }
            return result;
        },

        getMetadataForAsset: function (assetModel) {
            return this.assetCatalog.findWhere({name: assetModel.get('name')});
        },

        getDerivedAssets: function (psdModel, successCallback, errorCallback, context) {
            if (!this.derivedAssetCollection) {
                this.derivedAssetCollection = new DerivedAssetCollection();
            } else if (this.psdGuid !== psdModel.get('id')) {
                this.derivedAssetCollection.reset();
            }

            this.psdGuid = psdModel.get('id');

            if (deps.utils.hasFeature('extract_batch')) {
                this._loadCataloguedAssets(psdModel, successCallback, errorCallback, context);
            } else {
                graphite.getServerAPI().loadDerivedAssetCollection(this.derivedAssetCollection, psdModel,
                    successCallback, errorCallback, context);
            }

            return this.derivedAssetCollection;
        },

        exportAsset: function (layerIds, directDownload, assetName, imageFormat, quality, scaleFactor, psdModel, update,
                               completeCallback, errorCallback, context) {
            var psdGuid,
                iImageQuality = parseInt(quality, 10),
                queryString = '',
                joiner = '?',
                localContent = psdModel.get('localContent');

            // Handle request to extract from marketing PSD.
            if (localContent) {
                queryString = '';
                psdGuid = psdModel.get('id');
                queryString = queryString + joiner + 'layerIds=' + layerIds.join(',');
                joiner = '&';
                queryString = queryString + joiner + 'encodingType=' + imageFormat;
                queryString = queryString + joiner + 'encodingQualityFactor=' + iImageQuality;
                queryString = queryString + joiner + 'assetName=' + encodeURIComponent(assetName);

                //create a iframe to download the asset
                if (localContent) {
                    this.queueDownload('/api/v1/localcontent/' + psdGuid + '/derived' + queryString);
                } else {
                    this.queueDownload('/api/v1/psd/' + psdGuid + '/asset/derived' + queryString);
                }
                return;
            }

            iImageQuality = parseInt(quality, 10);

            //generate unique asset name
            if (!deps.utils.hasFeature('extract_batch')) {
                assetName = this.generateUniqueAssetName(assetName, imageFormat);
            }

            var jsonPostObject = {
                layerIds: layerIds,
                encodingType: imageFormat,
                encodingQualityFactor: iImageQuality,
                psdGuid: psdModel.get('id'),
                scale: scaleFactor,
                layerCompId: psdModel.get('layerCompId'),
                noCache: $.now(),
                assetName: assetName,
                update: update
            };

            var that = this;

            function onSuccess(data) {
                var response = JSON.parse(data.responseText);

                if (directDownload) {
                    that.queueDownload(graphite.getServerAPI().getDerivedDownloadURL(response.id, response.name));
                } else {
                    /**** HACK start ****/
                    var model = new DerivedAssetModel();

                    if (response.metadata && response.metadata.asset) {
                        response.name = response.metadata.asset.fileName;
                    }

                    model.attributes = model.parse(response);
                    model.attributes.originatingLayers = layerIds; //Add the originating layers so we can tell if this asset contains any linked smart objects

                    // Replace if duplicate
                    var origModels = that.derivedAssetCollection.where({name: model.get('name')});
                    if (origModels && origModels.length) {
                        that.derivedAssetCollection.remove(origModels);
                    }

                    that.derivedAssetCollection.add(model);

                    if (deps.utils.hasFeature('extract_batch')) {
                        // Register the extracted asset with our asset catalog.
                        that._registerDerivedAsset(psdModel, model, jsonPostObject, function () {
                            if (completeCallback) {
                                completeCallback.apply(context, [data]);
                            }
                        }, errorCallback && errorCallback.bind(context));
                    }

                    /**** HACK end ****/
                }
            }

            function onError(errMsg) {
                graphite.events.trigger('assetExtractionFailure', {});
                if (errorCallback) {
                    errorCallback.apply(context, [errMsg]);
                }
            }

            graphite.getServerAPI().createDerivedAsset(jsonPostObject, directDownload, onSuccess, onError, this);
        },

        updateAsset: function (existingAssetModel, layerIds, directDownload, assetName, imageFormat, quality, scaleFactor, psdModel,
                               completeCallback, errorCallback, context) {

            var fileName = assetName + this.fileExtMap[imageFormat];
            // If the fileName is different the we need to remove the asset with
            // the previous name
            if (!directDownload && existingAssetModel.get("name") !== fileName) {
                var self = this;
                var oldCompleteCallback = completeCallback;

                // Update the name now so that the user doesn't see a duplicate
                // assets with the old and new name.
                var originalName = existingAssetModel.get("name");
                existingAssetModel.set("name", fileName);

                completeCallback = function () {
                    // HACK: Reset the name back to the original so that
                    // deleteDerivedAsset works.
                    // We should probably be using the GUIDs for identifying the
                    // assets, instead of the filename
                    existingAssetModel.set("name", originalName);
                    self.deleteDerivedAsset(existingAssetModel, oldCompleteCallback, errorCallback, context);
                };
            }

            return this.exportAsset(layerIds, directDownload, assetName, imageFormat, quality, scaleFactor, psdModel, true, completeCallback, errorCallback, context);
        },

        deleteDerivedAsset: function (model, successHandler, errorHandler, context) {
            var self = this;
            if (deps.utils.hasFeature('extract_batch')) {
                self._unregisterDerivedAsset(
                    model,
                    successHandler.bind(context, [model]),
                    errorHandler.bind(context)
                );
            } else {
                graphite.getServerAPI().deleteDerivedAsset(
                    model.get('guid'),
                    function (data) {
                        successHandler.apply(context, [data]);
                    },
                    function (jqXHR) {
                        errorHandler.apply(context, [jqXHR]);
                    }
                );
            }
        },

        queueDownload: function (url) {
            var $frameEl = $('<iframe style="display:none;" class="downloader">').appendTo($('body'));
            $frameEl.attr('src', url);
            this.downloadFrames.unshift($frameEl);

            // Clean up least recently used frames beyond our max.
            if (this.downloadFrames.length > this.maxDownloads) {
                this.downloadFrames[this.maxDownloads].remove();
                this.downloadFrames.length = this.maxDownloads;
            }
        },

        generateUniqueAssetName: function (assetName, imageFormat) {
            var fileExt = this.fileExtMap[imageFormat];
            var lookUpAssetName = assetName + fileExt;
            var bFileExists = true;
            var suffix = 0;
            var newAssetName = assetName;
            while (bFileExists) {
                var origModels = this.derivedAssetCollection.where({name: lookUpAssetName});
                if (origModels && origModels.length) {
                    //increment the suffix if found.
                    suffix++;
                    newAssetName = assetName + ' (' + suffix + ')';
                    lookUpAssetName = newAssetName + fileExt;
                    continue; //continue looking
                }
                bFileExists = false;
            }
            return newAssetName;
        },

        initDeviceExtractionSettings: function () {
            this.deviceExtractSettings = new Backbone.Collection();
            var settingsArray = ['LDPI', 'MDPI', 'TVDPI', 'HDPI', 'XHDPI', 'XXHDPI', 'XXXHDPI'],
                i;

            for (i = 0; i < settingsArray.length; i++) {
                this.deviceExtractSettings.push(new ExtractSettingsModel({type: settingsArray[i]}));
            }
        },

        loadDeviceExtractionSettings: function (psdModel) {
            var self = this;
            this.initDeviceExtractionSettings();

            // public one up doesn't show assets pane there is no need to try and get this stuff
            if (graphite.getServerAPI().loadAssetData && !graphite.inPublicOneUp()) {
                graphite.getServerAPI().loadAssetData(psdModel.get('id'),
                    'extract_batch_settings',
                    function (response) {
                        if (response && response.data) {
                            self.deviceExtractSettings.reset(response.data);
                        }
                    }, function (response) {});
            }
            return this.deviceExtractSettings;
        },

        saveDeviceExtractionSettings: function () {
            var self = this;

            graphite.events.trigger('batch_extract_start');
            graphite.getServerAPI().updateAssetData(this.psdGuid,
                'extract_batch_settings',
                function (data) {
                    return self.deviceExtractSettings.toJSON();
                },
                function (response) {
                    self.applyExportSettings();
                },
                function (response) {
                    graphite.events.trigger('batch_extract_complete');
                },
                null);
        },

        applyExportSettings: function (assetEntry) {
            var self = this,
                theCatalog = assetEntry ? new Backbone.Collection([assetEntry]) : self.assetCatalog,
                batchJobData = {
                    psdGuid: this.psdGuid,
                    jobs: []
                };

            self.deviceExtractSettings.each(function (settingValue) {
                if (settingValue.get('checked')) {
                    var jobMap = {},
                        jobData,
                        propertyName;
                    
                    theCatalog.each(function (catalogValue) {
                        var layerComp = catalogValue.get('layerCompId') || 'default',
                            assetData = {
                                layerIds: catalogValue.get('originatingLayers'),
                                encodingType: catalogValue.get('encodingType'),
                                encodingQualityFactor: catalogValue.get('encodingQualityFactor'),
                                assetName: deriveNameFromSettings(catalogValue.get('name'), settingValue.get('suffix'))
                            };
                        
                        jobData = jobMap[layerComp];
                
                        if (!jobData) {
                            jobData = {
                                outputTarget: settingValue.get('folder'),
                                scale: deriveScaleFromSettings(settingValue.get('type'), PSDSettingsModel.get('designedAtMultiplier')),
                                assets: []
                            };
                            if (layerComp !== 'default') {
                                jobData.layerCompId = layerComp;
                            }
                            jobMap[layerComp] = jobData;
                        }

                        jobData.assets.push(assetData);
                    });
                    
                    for (propertyName in jobMap) {
                        if (jobMap.hasOwnProperty(propertyName)) {
                            batchJobData.jobs.push(jobMap[propertyName]);
                        }
                    }
                }
            });

            if (batchJobData.jobs.length) {
                graphite.getServerAPI().batchCreateDerivedAssets(
                    batchJobData,
                    function (goodStatus) {
                        graphite.events.trigger('batch_extract_complete');
                    },
                    function (badStatus) {
                        graphite.events.trigger('batch_extract_complete_error');
                    },
                    this
                );
            } else {
                graphite.events.trigger('batch_extract_cancelled');
            }

        }
    });

    return new DerivedAssetController();

});
