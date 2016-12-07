/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
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
/*jshint bitwise: false*/
/*global graphite*/

define([
    'jquery',
    'underscore',
    'plugin-dependencies',
    './vanilla-extract/public/js/core/models/DerivedAssetModel',
    './vanilla-extract/public/js/core/collections/DerivedAssetCollection'
], function ($, _, deps, DerivedAssetModel, DerivedAssetCollection) {
    'use strict';

    var encodingTypes = {
            'png8' : {
                fileExtension: '.png',
                encodingType: 'png8'
            },
            'png32': {
                fileExtension: '.png',
                encodingType: 'png'
            },
            'svg': {
                fileExtension: '.svg',
                encodingType: 'svg'
            },
            'jpeg': {
                fileExtension: '.jpg',
                encodingType: 'jpeg'
            }
        };

    var spriteSheetCacheBuster = {},
        genericMetaDataMap = {},
        genericAssetDataMap = {},
        metaDataRetries = 1,
        workerVersionPromise,
        maxLayersLimit = 1500;

    // Worker name is bottlenecked here so that you can provide an alternate worker, e.g. in order to cause cloudlabs
    // to connect to a locally-running worker by prefixing the worker name with your LDAP. (NB: Don't check it in :-))
    // More details in README.md
    var WORKER_NAME = /* 'your_ldap' + */ 'GraphiteJSONExtractionWorker';
    var COMPATIBLE_JSON_MAJOR_VERSION = '2';

    function setAJAXCallbacks(options, successCallback, errorCallback, context) {
        if (successCallback) {
            options.success = function (data, textStatus, response) {
                successCallback.apply(context, [response]);
            };
        }

        if (errorCallback) {
            options.error = function (response) {
                errorCallback.apply(context, [response]);
            };
        }
    }

    function constructProxyURL(url, baseIncluded) {
        var proxyDomain = deps.config.sharedcloud_proxy_url,
            headerToken = deps.auth.token,
            authToken = headerToken ? '&Authorization=' + encodeURIComponent(headerToken) : '',
            urlBase = baseIncluded ? '' : graphite.urlBase;

        return proxyDomain + '/api?X-Location=' + urlBase + url + authToken;
    }

    function constructProxyURL2(url, baseIncluded) {
        var proxyDomain = deps.config.sharedcloud_proxy_url,
            headerToken = deps.auth.token,
            authToken = headerToken ? '&Authorization=' + encodeURIComponent(headerToken) : '',
            urlBase = baseIncluded ? '' : graphite.urlBase;

        if (graphite.inPublicOneUp() && graphite.linkId) {
            return proxyDomain + '/api?link=' + graphite.linkId + '&X-Location=' + urlBase + url;
        }

        return proxyDomain + '/api?X-Location=' + urlBase + url + authToken;
    }

    function createAjaxOptions(type, location, baseURLIncluded) {
        baseURLIncluded = baseURLIncluded || false;
        var options = {
            'type': type,
            'url': deps.config.sharedcloud_proxy_url + '/api',
            'headers': {
                'x-location': baseURLIncluded ? location : graphite.urlBase + location,
                'authorization': deps.auth.token
            }
        };
        return options;
    }

    function createAjaxOptions2(type, location, baseURLIncluded, includeAuthorization) {
        baseURLIncluded = baseURLIncluded || false;
        includeAuthorization = includeAuthorization || false;
        var options = {
            'type': type,
            'url': deps.config.sharedcloud_proxy_url + '/api',
            'headers': {
                'x-location': baseURLIncluded ? location : graphite.urlBase + location
            }
        };

        if (!includeAuthorization && graphite.inPublicOneUp() && graphite.linkId) {
            options.data = {
                link: graphite.linkId
            };
        } else {
            options.headers.authorization = deps.auth.token;
        }
        return options;
    }

    function createAssetIdHref(assetId) {
        if (graphite.inPublicOneUp() && graphite.linkId) {
            return deps.config.sharedcloud_proxy_url + '/download?link=' + graphite.linkId + '&resource=' + encodeURIComponent(graphite.urlBase) + '%2Fapi%2Fv1%2Fassets%2F' + assetId + '&format=psd';
        }
        return 'vnd-adobe-sharedcloud.asset:' + assetId;
    }

    function waitForGraphiteWorker(location, callback, workerGuid) {
        $.ajax(createAjaxOptions('GET', location, true)).done(function (data, textStatus, jqXHR) {
            if (jqXHR.status === 200) {
                if (data.status === 'failed' || data.status === 'canceled') {
                    if (workerGuid) {
                        graphite.events.trigger('hideWorkerProgress', workerGuid);
                    }
                    callback(data, data, jqXHR);
                } else if (data.status === 'done') {
                    if (workerGuid) {
                        graphite.events.trigger('updateWorkerProgress', workerGuid, 'done', 100);
                    }
                    callback(null, data, jqXHR);
                } else {
                    // if we aren't finished wait a second and try again
                    // TODO handle the case where the worker failed for some reason
                    if (workerGuid) {
                        graphite.events.trigger('updateWorkerProgress', workerGuid, data.status, data.progress);
                    }
                    setTimeout(function () { waitForGraphiteWorker(location, callback, workerGuid); }, 500); // try again
                }
            }
        });
    }

    function extractIdFromUrl(href) {
        return href.split('/').pop().split(':').pop();
    }

    function findNamedCollection(parentCollection, collectionName, createIfNotFound) {
        var deferredFind = $.Deferred(),
            options = createAjaxOptions('GET', '/api/v1/collections/' + parentCollection);

        $.ajax(options).done(function (resp, textStatus, jqXHR) {
            if (!resp.hasOwnProperty('sub_collections')) {
                deferredFind.reject(textStatus, jqXHR);
            } else {
                var subCollection = _.find(resp.sub_collections, function(collection) {
                    return collection.name === collectionName;
                });

                if (subCollection) {
                    deferredFind.resolve(subCollection.id);
                } else if (createIfNotFound) {
                    var options = createAjaxOptions('POST', '/api/v1/collections'),
                        collectionInfo = {
                            parent_collection: parentCollection,
                            collection_name: collectionName
                        };
                    options.data = JSON.stringify(collectionInfo);
                    $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status === 409) {
                            // 409 is the name isn't unique so someone created the collection out from under us get it again
                            findNamedCollection(parentCollection, collectionName, false).then(
                                function (collectionId) {
                                    deferredFind.resolve(collectionId);
                                },
                                function (status, jqXHR) {
                                    deferredFind.reject(status, jqXHR);
                                }
                            );
                        } else {
                            deferredFind.reject(textStatus, jqXHR);
                        }
                    }).done(function (resp, textStatus, jqXHR) {
                        deferredFind.resolve(extractIdFromUrl(jqXHR.getResponseHeader('location')));
                    });
                } else {
                    deferredFind.resolve(null);
                }
            }
        });
        return deferredFind.promise();
    }

    function findAssetCollection(metadata, createCollection) {
        var deferredFind = $.Deferred(),
            collectionInfo = {
                collection_name : metadata._links.self.name || metadata.asset.fileName,
                parent_collection : metadata._links.parent.href
            },
            extIndex = collectionInfo.collection_name.lastIndexOf('.');

        if (extIndex !== -1) {
            collectionInfo.collection_name = collectionInfo.collection_name.substr(0, extIndex);
        }
        collectionInfo.collection_name += '-assets';

        findNamedCollection(extractIdFromUrl(collectionInfo.parent_collection), collectionInfo.collection_name, createCollection).then(
            function (collectionId) {
                collectionInfo.collectionId = collectionId;
                if (collectionId) {
                    deferredFind.resolve(collectionInfo);
                } else {
                    deferredFind.resolve(null);
                }
            },
            function (textStatus, jqXHR) {
                deferredFind.resolve(textStatus, jqXHR);
            }
        );

        return deferredFind.promise();
    }

    function getAssetCollection(psdGuid, createCollection) {
        var deferredCollection = $.Deferred(),
            options = createAjaxOptions('GET', '/api/v1/assets/' + psdGuid + '/metadata');

        options.headers.accept = 'application/hal+json';

        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
            deferredCollection.reject(textStatus, jqXHR);
        }).done(function (metadata, textStatus, jqXHR) {
            if (jqXHR.status === 200) {
                findAssetCollection(metadata, createCollection).then(
                    function (goodStatus) {
                        deferredCollection.resolve(goodStatus);
                    },
                    function (badStatus) {
                        deferredCollection.reject(badStatus);
                    }
                );
            } else {
                deferredCollection.reject(textStatus, jqXHR);
            }
        });

        return deferredCollection.promise();
    }

    function findNamedLeafCollection(collectionId, folderPath) {
        var deferredFind = $.Deferred(),
            topName = folderPath.shift();

        if (topName.length === 0) {
            deferredFind.resolve(collectionId);
        } else {
            findNamedCollection(collectionId, topName, true).then(
                function (subCollectionId) {
                    if (folderPath.length > 0) {
                        findNamedLeafCollection(subCollectionId, folderPath).then(
                            function (subCollectionId) {
                                deferredFind.resolve(subCollectionId);
                            },
                            function (textStatus, jqXHR) {
                                deferredFind.reject(textStatus, jqXHR);
                            }
                        );
                    } else {
                        deferredFind.resolve(subCollectionId);
                    }
                },
                function (textStatus, jqXHR) {
                    deferredFind.reject(textStatus, jqXHR);
                }
            );
        }
        return deferredFind.promise();

    }

    function getCollectionSubFolders(collectionId, jobs) {
        return _.map(jobs, function(job) {
            var deferred = $.Deferred();
            findNamedLeafCollection(collectionId, job.outputTarget.split('/')).then(
                function (collectionId) {
                    deferred.resolve({name: job.outputTarget, id: collectionId});
                },
                function (textStatus, jqXHR) {
                    deferred.reject(textStatus, jqXHR);
                }
            );
            return deferred.promise();
        });
    }

    function createDerivedAsset(jsonPostObject, outputMode) {
        var deferredCreation = $.Deferred(),
            options = createAjaxOptions('POST', '/api/v1/jobs/' + WORKER_NAME),
            postDataObj = {
                parameters: {
                    cmd: 'createAsset',
                    layerIds: jsonPostObject.layerIds,
                    assetId: jsonPostObject.psdGuid,
                    encodingType: encodingTypes[jsonPostObject.encodingType].encodingType,
                    encodingQualityFactor: jsonPostObject.encodingQualityFactor,
                    scale: jsonPostObject.scale,
                    assetName: jsonPostObject.assetName + encodingTypes[jsonPostObject.encodingType].fileExtension,
                    encoder: 'magick'
                },
                outputMode: outputMode,
                inputs: [ createAssetIdHref(jsonPostObject.psdGuid) ]
            };

        options.headers['Content-Type'] = 'application/json';

        if (deps.utils.hasFeature('temp_extract_use_layerrange')) {
            postDataObj.parameters.encoderHints = ["layerRangeComposite:on"];
        }

        if (jsonPostObject.layerCompId) {
            postDataObj.parameters.layerCompId = jsonPostObject.layerCompId;
        }
        if (outputMode === 'asset' && jsonPostObject.hasOwnProperty('outputTarget')) {
            postDataObj.outputTarget = 'vnd-adobe-sharedcloud.collection:' + jsonPostObject.outputTarget;
        }

        var workerDoneProc = function (err, data, jqXHR) {
            if (err) {
                deferredCreation.reject(err);
            } else {
                deferredCreation.resolve(data);
            }
        };

        options.data = JSON.stringify(postDataObj);

        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
            // We got an error trying to run the work not sure what to do here
            deferredCreation.reject(textStatus, jqXHR);
        }).done(function (resp, textStatus, jqXHR) {
            if (jqXHR.status === 201) {
                // the worker started so we just need to sit back and wait for it to finish
                waitForGraphiteWorker(jqXHR.getResponseHeader('location'), workerDoneProc);
            }
        });

        return deferredCreation.promise();
    }

    function buildWorkflowJobParams(jobData, collections) {
        var folderMap = {},
            result = {
                parameters: {
                    cmd: 'createAsset',
                    encoder: 'magick',
                    assetId: jobData.psdGuid
                },
                inputs: [ createAssetIdHref(jobData.psdGuid) ],
                outputMode: 'asset'
            },
            jobs = [];


        _.each(collections, function(val) {
            folderMap[val.name] = val.id;
        });
        _.each(jobData.jobs, function (job) {
            _.each(job.assets, function (asset) {
                var subJob = {
                    worker_id: WORKER_NAME,
                    parameters: {
                        layerIds: asset.layerIds,
                        encodingType: encodingTypes[asset.encodingType].encodingType,
                        encodingQualityFactor: asset.encodingQualityFactor,
                        scale: job.scale,
                        assetName: asset.assetName + encodingTypes[asset.encodingType].fileExtension,
                        outputTarget: folderMap[job.outputTarget]
                    }
                };

                if (job.layerCompId) {
                    subJob.parameters.layerCompId = job.layerCompId;
                }
                jobs.push(subJob);
            });
        });

        result.seq = jobs;
        return JSON.stringify(result);
    }

    function getWorkerVersionInfo() {
        if (workerVersionPromise) {
            return workerVersionPromise;
        }

        var deferredVersion = $.Deferred(),
            options = createAjaxOptions('POST', '/api/v1/jobs/' + WORKER_NAME),
            postDataObj = {
                parameters: {
                    cmd: 'workerInfo'
                },
                inputs: []
            },
            workerDoneProc = function (err, data, jqXHR) {
                if (err) {
                    deferredVersion.reject(err, jqXHR);
                    workerVersionPromise = null;
                } else {
                    // if there is json data we finished correctly
                    if (data.results && data.results.graphite_workerInfo) {
                        deferredVersion.resolve(JSON.parse(data.results.graphite_workerInfo));
                    } else {
                        deferredVersion.reject(data);
                        workerVersionPromise = null;
                    }
                }
            };

        options.headers['Content-Type'] = 'application/json';
        options.data = JSON.stringify(postDataObj);

        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
            // We got an error trying to run the work not sure what to do here
            deferredVersion.reject(textStatus);
            workerVersionPromise = null;
        }).done(function (resp, textStatus, jqXHR) {
            if (jqXHR.status === 201) {
                // the worker started so we just need to sit back and wait for it to finish
                waitForGraphiteWorker(jqXHR.getResponseHeader('location'), workerDoneProc);
            }
        });

        workerVersionPromise = deferredVersion.promise();
        return workerVersionPromise;
    }

    function versionStringIsGreater(lhsVersion, rhsVersion) {
        var lhsParts = lhsVersion.split('.'),
            rhsParts = rhsVersion.split('.');

        lhsParts[0] = parseInt(lhsParts[0], 10);
        lhsParts[1] = parseInt(lhsParts[1], 10);
        lhsParts[2] = parseInt(lhsParts[2], 10);

        rhsParts[0] = parseInt(rhsParts[0], 10);
        rhsParts[1] = parseInt(rhsParts[1], 10);
        rhsParts[2] = parseInt(rhsParts[2], 10);

        if ((lhsParts[0] > rhsParts[0]) || (lhsParts[0] === rhsParts[0] && lhsParts[1] > rhsParts[1]) ||
                (lhsParts[0] === rhsParts[0] && lhsParts[1] === rhsParts[1] && lhsParts[2] > rhsParts[2])) {
            return true;
        }

        return false;
    }

    // Framework routine for getting rendition data about an asset.  Here is the code flow
    // 1) GET the rendition from the asset.  If the data is there check the version against the current
    //          worker version.  If the data is out of date or there wasn't any rendition data
    // 2) Run the worker command to generate the data
    // 3) Wait for the worker to finish and finally return the data
    //
    // options is an object used to drive the frame work, it needs the following properties
    //      getOptions - ajax options for getting the rendition data (i.e. /api/v1/assets/assetid/renditions/...)
    //      workerOptions - ajax options that create the worker to generate the data
    //      prepareCacheInfo - function that filters the data returned by the worker into what the function is
    //                         expecting.  It can also be used to set up the cache for transient data.  It will
    //                         return an object with the data on the data property or AJAX options that can return
    //                         the data.
    //      workerID - id to use while waiting for the worker to finish.  If there is not worker id there won't
    //                 be a progress dialog
    //      versionProp - property in the worker version info that holds the version string to check
    function getRenditionData(options) {
        var deferredData = $.Deferred(),
            workerDoneProc = function (err, data, jqXHR) {
                if (err) {
                    deferredData.reject(err, jqXHR);
                } else {
                    if (data.results) {
                        // Process the data and cache it if necessary
                        if (data.results.hasOwnProperty(options.resultProp)) {
                            var results = data.results[options.resultProp];
                            if (typeof results === 'string') {
                                // No need to put in a try catch block.  We don't do it anywhere else for
                                // worker generated JSON and if the worker is generating bad JSON no one will
                                // be able to use extract because our code would pick up the worker change
                                // and regenerate bad JSON.
                                // The worker MUST generate valid JSON.
                                results = JSON.parse(results);
                            }
                            deferredData.resolve(results, jqXHR);
                        } else {
                            // we need to make a request to get the actual data
                            $.ajax(options.getOptions).done(function (resp, textStatus, jqXHR) {
                                if (jqXHR.status === 200) {
                                    if (typeof resp === 'string') {
                                        resp = JSON.parse(resp);
                                    }
                                    deferredData.resolve(resp, jqXHR);
                                } else {
                                    deferredData.reject(resp, jqXHR);
                                }
                            });
                        }
                    } else {
                        deferredData.reject(data, jqXHR);
                    }
                }
            },
            runWorker = function () {
                $.ajax(options.workerOptions).fail(function (jqXHR, textStatus, errorThrown) {
                    // we got an error trying to run the worker not sure what to do here
                    deferredData.reject(errorThrown, jqXHR);
                }).done(function (resp, textStatus, jqXHR) {
                    if (jqXHR.status === 201) {
                        // the worker started so we just need to sit back and wait for it to finish
                        if (options.workerID) {
                            graphite.events.trigger('showWorkerProgress', options.workerID);
                        }
                        waitForGraphiteWorker(jqXHR.getResponseHeader('location'), workerDoneProc, options.workerID);
                    } else {
                        // we did not get what we expected so error out
                        deferredData.reject(resp, jqXHR);
                    }
                });
            };

        // get the rendition data
        $.ajax(options.getOptions).fail(function (jqXHR, textStatus, errorThrown) {
            if (jqXHR.status === 404) {
                // no rendition data so we must not have run the worker on the asset before; do it now
                runWorker();
            } else {
                deferredData.reject(errorThrown, jqXHR);
            }
        }).done(function (resp, textStatus, jqXHR) {
            var renditionJSON = JSON.parse(resp);
            // Check the version number on the json against the workers version
            getWorkerVersionInfo().then(
                function (goodResult) {
                    if (goodResult[options.versionProp] && (!renditionJSON.info || versionStringIsGreater(goodResult[options.versionProp], renditionJSON.info.version))) {
                        // the data is stale regenerate it
                        runWorker();
                    } else {
                        // the data is OK use it
                        deferredData.resolve(renditionJSON, jqXHR);
                    }
                },
                function (badResult) {
                    // something happened so just use the old possibly stale data
                    deferredData.resolve(renditionJSON, jqXHR);
                }
            );
        });

        return deferredData.promise();
    }

    function getJSONData(psdModel) {
        var layerCompId = psdModel.get('layerCompId'),
            layerCompInfo = layerCompId ? '-lcid' + layerCompId : "",
            options = { },
            postDataObj = {
                parameters: {
                    cmd: 'default',
                    jsonVersion: COMPATIBLE_JSON_MAJOR_VERSION + '.x',
                    assetId: psdModel.id,
                    limits: {
                        maxLayers: maxLayersLimit
                    }
                }
            };

        postDataObj.outputMode = 'rendition';
        postDataObj.inputs = [ 'vnd-adobe-sharedcloud.asset:' + psdModel.id ];

        options.getOptions = createAjaxOptions2('GET', '/api/v1/assets/' + psdModel.id + '/renditions/graphite/default_json_data_v' + COMPATIBLE_JSON_MAJOR_VERSION + layerCompInfo);
        options.workerOptions = createAjaxOptions2('POST', '/api/v1/jobs/' + WORKER_NAME, false, (graphite.inPublicOneUp() && graphite.ownerId === deps.user.get('userId')));

        if (layerCompId) {
            postDataObj.parameters.layerCompId = layerCompId;
        }
        options.workerOptions.headers['Content-Type'] = 'application/json';
        options.workerOptions.data = JSON.stringify(_.extend({}, options.workerOptions.data, postDataObj));
        options.workerID = psdModel.id;
        options.versionProp = 'json_version';
        options.resultProp = 'graphite_json';

        return getRenditionData(options);
    }

    function getSpriteSheetDataFromWorkflow(psdModel, layerCount, renditionOptions) {
        var deferredData = $.Deferred(),
            ndx,
            jobCount = Math.floor(layerCount / 500) | 2,
            minSheetPerJob = Math.floor(6 / jobCount) !== 0 ?  Math.floor(6 / jobCount) : 1,
            options = createAjaxOptions2('POST', '/api/v1/jobs/workflow', false, (graphite.inPublicOneUp() && graphite.ownerId === deps.user.get('userId'))),
            postDataObj = {
                seq: [
                    {
                        parameters: {
                            cmd: 'spritesheet',
                            assetId: psdModel.id,
                            spriteSheet: {
                                minSheets: minSheetPerJob,
                                flattenLayers: true,
                                includeDrawable: false
                            }
                        },
                        par: [],
                        child_id: 'spritesheetSubJobs',
                        outputMode: 'transient'
                    },
                    {
                        worker_id: WORKER_NAME,
                        parameters: {
                            cmd: 'mergeSpriteSheets',
                            mergeOutputsOf: 'spritesheetSubJobs'
                        },
                        outputMode: 'rendition'
                    }
                ],
                inputs: [ 'vnd-adobe-sharedcloud.asset:' + psdModel.id ],
                outputMode: 'rendition'
            };


        if (psdModel.get('layerCompId')) {
            postDataObj.seq[0].parameters.layerCompId = psdModel.get('layerCompId');
            postDataObj.seq[1].parameters.layerCompId = psdModel.get('layerCompId');
        }

        for (ndx = 1; ndx <= jobCount; ndx++) {
            var subJob = {
                worker_id: WORKER_NAME,
                parameters: {
                    workflowParms: {
                        currentJobNumber: ndx,
                        totalJobNumber: jobCount
                    }
                }
            };

            postDataObj.seq[0].par.push(subJob);
        }

        options.data = JSON.stringify(_.extend({}, options.data, postDataObj));

        var mergeDoneProc = function (err, data, jqXHR) {
            if (err) {
                deferredData.reject(err, jqXHR);
            } else {
                if (data.results.graphite_spritesheet_json) {
                    deferredData.resolve(data.results.graphite_spritesheet_json, jqXHR);
                }
                else {
                    // we need to make a request to get the actual data
                    $.ajax(renditionOptions).done(function (resp, textStatus, jqXHR) {
                        if (jqXHR.status === 200) {
                            if (typeof resp === 'string') {
                                resp = JSON.parse(resp);
                            }
                            deferredData.resolve(resp, jqXHR);
                        } else {
                            deferredData.reject(resp, jqXHR);
                        }
                    });
                }
            }
        };

        var getMergeJob = function(location) {
            $.ajax(createAjaxOptions('GET', location, true)).done(function (data, textStatus, jqXHR) {
                if (jqXHR.status === 200 && data.children && data.children.childJobs && data.children.childJobs[1] && data.children.childJobs[1].job) {
                    waitForGraphiteWorker(data.children.childJobs[1].job, mergeDoneProc);
                } else {
                    setTimeout(function () { getMergeJob(location); }, 500); // try again
                }
            });
        };

        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
            deferredData.reject(errorThrown, jqXHR);
        }).done(function (resp, textStatus, jqXHR) {
            if (jqXHR.status === 201) {
                getMergeJob(jqXHR.getResponseHeader('location'));
            } else {
                // we did not get what we expected so error out
                deferredData.reject(resp, jqXHR);
            }
        });

        return deferredData.promise();
    }

    function getSpriteSheetData(psdModel) {
        var deferredData = $.Deferred(),
            layerCompId = psdModel.get('layerCompId'),
            layerCompInfo = layerCompId ? '-lcid' + layerCompId : "",
            options = { },
            postDataObj = {
                parameters: {
                    cmd: 'spritesheet',
                    assetId: psdModel.id,
                    spriteSheet: {
                        minSheets: 6,
                        flattenLayers: true,
                        includeDrawable: false
                    },
                    limits: {
                        maxLayers: maxLayersLimit
                    }
                }
            };

        postDataObj.outputMode = 'rendition';
        postDataObj.inputs = [ 'vnd-adobe-sharedcloud.asset:' + psdModel.id ];

        options.getOptions = createAjaxOptions2('GET', '/api/v1/assets/' + psdModel.id + '/renditions/graphite/spritesheet_json_data' + layerCompInfo);
        options.workerOptions = createAjaxOptions2('POST', '/api/v1/jobs/' + WORKER_NAME, false, (graphite.inPublicOneUp() && graphite.ownerId === deps.user.get('userId')));
        options.workerOptions.headers['Content-Type'] = 'application/json';

        if (layerCompId) {
            postDataObj.parameters.layerCompId = layerCompId;
        }

        options.versionProp = 'spritesheet_version';
        options.resultProp = 'graphite_json';

        var getTheRenditionData = function () {
            options.workerOptions.data = JSON.stringify(_.extend({}, options.workerOptions.data, postDataObj));
            getRenditionData(options).then(
                function(resp, jqXHR) {
                    deferredData.resolve(resp, jqXHR);
                },
                function(err, jqXHR) {
                    if (err.errorCode === 'use_workflow_job') {
                        var layerCount = err.errorMessage.split(':')[1];
                        getSpriteSheetDataFromWorkflow(psdModel, layerCount, options.getOptions).then(
                            function(resp, jqXHR) {
                                deferredData.resolve(resp, jqXHR);
                            },
                            function(err, jqXHR) {
                                deferredData.reject(err, jqXHR);
                            }
                        );
                    } else {
                        deferredData.reject(err, jqXHR);
                    }
                }
            );
        };

        getWorkerVersionInfo().then(
            function (goodResult) {
                if (goodResult.version && versionStringIsGreater(goodResult.version, '1.0.78')) {
                    postDataObj.parameters.workflowLayerLimit = 750;
                } else {
                    postDataObj.parameters.undoc = [ 'refreshVisibility' ];
                }
                getTheRenditionData();
            },
            function (badResult) {
                postDataObj.parameters.undoc = [ 'refreshVisibility' ];
                getTheRenditionData();
            }
        );

        return deferredData.promise();
    }

    function loadAssetCollection(collectionId, derivedAssetCollection, ignoreFailure, recurse) {
        var deferredLoad = $.Deferred(),
            options = createAjaxOptions('GET', '/api/v1/collections/' + collectionId),
            addModelToContents = function (rawData, contents) {
                var model = new DerivedAssetModel();
                model.set(model.parse(rawData));
                contents.push(model);
                return model;
            };

        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
            if (ignoreFailure) {
                deferredLoad.resolve(derivedAssetCollection);
            } else {
                deferredLoad.reject(textStatus);
            }
        }).done(function (response) {
            var i,
                model,
                contents = [],
                subCollection,
                promises = [];

            // Create derived asset models for every asset in the collection
            for (i in response.assets) {
                if (response.assets.hasOwnProperty(i)) {
                    addModelToContents(response.assets[i], contents);
                }
            }

            // Create asset models for every sub collection and load those collections as well
            if (recurse) {
                for (i in response.sub_collections) {
                    if (response.sub_collections.hasOwnProperty(i)) {
                        model = addModelToContents(response.sub_collections[i], contents);

                        subCollection = new DerivedAssetCollection();
                        model.set('childAssets', subCollection);

                        // for now we'll ignore if a sub collection fails to load
                        promises.push(loadAssetCollection(model.get('id'), subCollection, true, recurse));
                    }
                }
            }

            derivedAssetCollection.reset(contents);
            if (promises.length === 0) {
                deferredLoad.resolve(derivedAssetCollection);
            } else {
                $.when.apply($, promises).then(
                    function (goodStatus) {
                        deferredLoad.resolve(derivedAssetCollection);
                    }
                );
            }
        });

        return deferredLoad.promise();
    }

    function getAssetDataInstance(psdGuid) {
        var deferredInstance = $.Deferred();

        if (genericAssetDataMap.hasOwnProperty(psdGuid)) {
            deferredInstance.resolve(genericAssetDataMap[psdGuid]);
        } else {
            graphite.getServerAPI().loadAssetData(psdGuid,
                'dummyKey',
                function (response) {
                    deferredInstance.resolve(genericAssetDataMap[psdGuid]);
                },
                function (response) {
                    deferredInstance.reject(response);
                });
        }

        return deferredInstance.promise();
    }

    function getGenericDataInstance (psdGuid) {
        var deferredInstance = $.Deferred();

        if (genericMetaDataMap.hasOwnProperty(psdGuid)) {
            deferredInstance.resolve(genericMetaDataMap[psdGuid]);
        } else {
            graphite.getServerAPI().loadGenericData(psdGuid,
                'dummyKey',
                function (response) {
                    deferredInstance.resolve(genericMetaDataMap[psdGuid]);
                },
                function (response) {
                    deferredInstance.reject(response);
                });
        }
        return deferredInstance.promise();
    }

    function bustSpriteSheetCache(psdGuid) {
        // Get the last mod date so we can bust the cache if need b
        $.ajax(createAjaxOptions2('GET', '/api/v1/assets/' + psdGuid + '/metadata')).done(function (resp, textStatus, jqXHR) {
            if (jqXHR.status === 200) {
                spriteSheetCacheBuster[psdGuid] = resp.asset.updated;
            }
        });
    }

    function getDataManifestID (psdGuid, createAssetCollection) {
        var deferredManifestID = $.Deferred();

        getAssetCollection(psdGuid, createAssetCollection).then(
            function (collectionInfo ) {
                if (collectionInfo) {
                    var options = createAjaxOptions('GET', '/api/v1/collections/' + collectionInfo.collectionId);
                    $.ajax(options).then(
                        function (resp, textStatus, jqXHR) {
                            var i,
                            result = {
                                collectionID : collectionInfo.collectionId,
                                filename : '_extract.manifest'
                            };

                            // Find the manifest file
                            for (i = 0; i < resp.assets.length; i++) {
                                if (resp.assets[i].name === result.filename) {
                                    result.manifestID = resp.assets[i].id;
                                    break;
                                }
                            }

                            deferredManifestID.resolve(result);
                        },
                        function (jqXHR, textStatus) {
                            deferredManifestID.reject(textStatus, jqXHR);
                        }
                    );
                } else {
                    deferredManifestID.resolve({});
                }
            },
            function (textStatus, jqXHR) {
                deferredManifestID.reject(textStatus, jqXHR);
            }
        );

        return deferredManifestID.promise();
    }

    var serverAPI = {

        loadPsdModel: function (psdModel, successCallback, errorCallback, context) {
            var layerCompId = psdModel.get('layerCompId'),
                layerCompInfo = layerCompId ? '-lcid' + layerCompId : "",
                options = { },
                postDataObj = {
                    parameters: {
                        cmd: 'graphiteRenditions',
                        assetId: psdModel.id,
                        maxLayers: 1500,
                        spriteSheet: {
                            minSheets: 6,
                            includeDrawable: false,
                            flattenLayers: true
                        }
                    }
                },
                goodResult = function (data, jqXHR) {
                    data.dataType = 'complete';
                    psdModel.parse(data);
                    successCallback.apply(context, [jqXHR]);
                },
                badResult = function (error, jqXHR) {
                    errorCallback.apply(context, [jqXHR, error]);
                };

            postDataObj.outputMode = 'rendition';
            postDataObj.inputs = [ 'vnd-adobe-sharedcloud.asset:' + psdModel.id ];

            /*
            options.getOptions = createAjaxOptions2('GET', '/api/v1/assets/' + psdModel.id + '/renditions/graphite/json_data' + layerCompInfo);
            */
            options.getOptions = createAjaxOptions2('GET', '/api/v1/assets/' + psdModel.id + '/renditions/graphite/json_data_v' + COMPATIBLE_JSON_MAJOR_VERSION + layerCompInfo);
            options.workerOptions = createAjaxOptions2('POST', '/api/v1/jobs/' + WORKER_NAME, false, (graphite.inPublicOneUp() && graphite.ownerId === deps.user.get('userId')));
            options.workerOptions.headers['Content-Type'] = 'application/json';

            if (layerCompId) {
                postDataObj.parameters.layerCompId = layerCompId;
            }

            options.workerOptions.data = JSON.stringify(_.extend({}, options.workerOptions.data, postDataObj));

            options.workerID = psdModel.id;
            options.versionProp = 'json_version';
            options.resultProp = 'graphite_json';

            // get the last mod date so we can bust the cache if need be
            bustSpriteSheetCache(psdModel.id);
            getRenditionData(options).then(goodResult, badResult);
        },

        loadPsdModel2: function (psdModel, successCallback, errorCallback, context) {
            // First get the updated time for cache busting
            bustSpriteSheetCache(psdModel.id);

            getJSONData(psdModel).then(
                function (psdJson, jqXHR) {
                    psdJson.dataType = 'JSONOnly';
                    psdModel.parse(psdJson);
                    successCallback.apply(context, [jqXHR]);
                },
                function (error, jqXHR) {
                    var errObj = jqXHR.responseText;
                    try {
                        errObj = JSON.parse(jqXHR.responseText);
                    } catch (e) {
                    }
                    errorCallback.apply(context, [jqXHR, errObj, 'JSON']);
                }
            );
            getSpriteSheetData(psdModel).then(
                function (psdJson, jqXHR) {
                    psdJson.dataType = 'spriteSheetOnly';
                    psdModel.parse(psdJson);
                },
                function (error, jqXHR) {
                    errorCallback.apply(context, [jqXHR, error, 'spriteSheet']);
                }
            );
        },

        // APIs used by DerivedAssetController
        loadAssetData: function (psdGuid, key, successCallback, errorCallback, context) {
            getDataManifestID(psdGuid, false).then(
                function (manifestResult) {
                    if (manifestResult.manifestID) {
                        var options = createAjaxOptions('GET', '/api/v1/assets/' + manifestResult.manifestID);
                        $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                            errorCallback.apply(context, [jqXHR]);
                        }).done(function (resp, textStatus, jqXHR) {
                            if (typeof resp === 'string') {
                                resp = JSON.parse(resp);
                            }

                            var genericDataInstance = {
                                etag: jqXHR.getResponseHeader('etag'),
                                data: resp
                            };
                            genericAssetDataMap[psdGuid] = genericDataInstance;

                            var result = {
                                etag: jqXHR.getResponseHeader('etag')
                            };

                            if (resp) {
                                result.data = resp[key];
                            }
                            successCallback.apply(context, [result]);
                        });
                    } else {
                        genericAssetDataMap[psdGuid] = {};
                        successCallback.apply(context, [{}]);
                    }
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        updateAssetData: function (psdGuid, key, deltaResolver, successCallback, errorCallback, context, retry) {
            var self = this;
            retry = (retry === undefined) ? 1 : retry;
            $.when(getDataManifestID(psdGuid, true), getAssetDataInstance(psdGuid)).fail(function (manifestFailure, instanceFailure) {
                errorCallback.apply(context, [manifestFailure || instanceFailure]);
            }).done(function (manifestResult, instanceResult) {
                if (!instanceResult.data) {
                    instanceResult.data = {};
                }
                instanceResult.data[key] = deltaResolver.apply(context, [instanceResult.data[key]]);
                var options;
                if (manifestResult.manifestID) {
                    options = createAjaxOptions('PUT', '/api/v1/assets/' + manifestResult.manifestID);
                    options.headers['If-Match'] = instanceResult.etag;
                } else {
                    options = createAjaxOptions('POST', '/api/v1/collections/' + manifestResult.collectionID);
                }
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Disposition'] = 'inline; filename=' + encodeURIComponent(manifestResult.filename);
                options.data = JSON.stringify(instanceResult.data);
                options.dataType = 'text';
                $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                    if (retry) {
                        delete genericAssetDataMap[psdGuid];
                        self.updateAssetData(psdGuid, key, deltaResolver, successCallback, errorCallback, context, retry - 1);
                        return;
                    }
                    errorCallback.apply(context, [jqXHR]);
                }).done(function (resp, textStatus, jqXHR) {
                    var result = {
                        data: instanceResult.data[key],
                        etag: jqXHR.getResponseHeader('etag'),
                        needRefresh: retry !== metaDataRetries
                    };
                    instanceResult.etag = result.etag;
                    successCallback.apply(context, [result]);
                });
            });
        },

        loadGenericData: function (psdGuid, key, successCallback, errorCallback, context) {
            var options = createAjaxOptions2('GET', '/api/v1/assets/' + psdGuid + '/metadata/asset_custom_metadata');
            $.ajax(options).error(function (jqXHR, textStatus, errorThrown) {
                errorCallback.apply(context, [jqXHR]);
            }).done(function (resp, textStatus, jqXHR) {
                var genericDataInstance = {
                    etag: jqXHR.getResponseHeader('etag'),
                    data: resp
                };
                genericMetaDataMap[psdGuid] = genericDataInstance;

                var result = {
                    etag: jqXHR.getResponseHeader('etag')
                };

                if (resp && resp.custom && resp.custom[key]) {
                    result.data = resp.custom[key];
                }
                successCallback.apply(context, [result]);
            });
        },

        updateGenericData: function (psdGuid, key, deltaResolver, successCallback, errorCallback, context, retry) {
            var self = this;
            retry = retry === undefined ? metaDataRetries : retry;
            getGenericDataInstance(psdGuid).then(
                function (dataInstance) {
                    if (!dataInstance.data) {
                        dataInstance.data = {};
                    }
                    if (!dataInstance.data.custom) {
                        dataInstance.data.custom = {};
                    }

                    dataInstance.data.custom[key] = deltaResolver.apply(context, [dataInstance.data.custom[key]]);
                    var options = createAjaxOptions('PUT', '/api/v1/assets/' + psdGuid + '/metadata/asset_custom_metadata');

                    options.headers['If-Match'] = dataInstance.etag;
                    options.headers['Content-Type'] = 'application/json';
                    options.data = JSON.stringify(dataInstance.data);
                    options.dataType = 'text';
                    $.ajax(options).error(function (jqXHR, textStatus, errorThrown) {
                        if (retry && jqXHR.status === 412) {
                            delete genericMetaDataMap[psdGuid];
                            self.updateGenericData(psdGuid, key, deltaResolver, successCallback, errorCallback, context, retry - 1);
                            return;
                        }
                        errorCallback.apply(context, [jqXHR]);
                    }).done(function (resp, textStatus, jqXHR) {
                        var result = {
                            data: dataInstance.data.custom[key],
                            etag: jqXHR.getResponseHeader('etag'),
                            needRefresh: retry !== metaDataRetries
                        };
                        dataInstance.etag = result.etag;
                        successCallback.apply(context, [result]);
                    });
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        loadDerivedAssetCollection: function (derivedAssetCollection, psdModel, successCallback, errorCallback, context) {
            getAssetCollection(psdModel.get('id'), false).then(
                function (collection) {
                    if (collection) {
                        loadAssetCollection(collection.collectionId, derivedAssetCollection, false, false).then(
                            function (goodStatus) {
                                successCallback.apply(context, [{status: goodStatus, collectionId: collection.collectionId}]);
                            },
                            function (badStatus) {
                                errorCallback.apply(context, [badStatus]);
                            }
                        );
                    } else {
                        derivedAssetCollection.reset();
                        successCallback.apply(context, [{responseText: '', collectionId: ''}]);
                    }
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        getAssetCollectionID: function (psdGuid, createCollection, successCallback, errorCallback, context) {
            getAssetCollection(psdGuid, createCollection).then(
                function (collection) {
                    successCallback.apply(context, [collection.collectionId]);
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        createDerivedAsset: function (jsonPostObject, directDownload, successCallback, errorCallback, context) {
            if (directDownload) {
                createDerivedAsset(jsonPostObject, 'transient').then(
                    function (asset) {
                        var ret = {
                            id: extractIdFromUrl(asset.outputs[0]),
                            url: asset.outputs[0],
                            name: asset.results.graphite_asset.name
                        };
                        successCallback.apply(context, [{responseText: JSON.stringify(ret)}]);
                    },
                    function (badStatus) {
                        errorCallback.apply(context, [badStatus]);
                    }
                );
                return;
            }
            getAssetCollection(jsonPostObject.psdGuid, true).then(
                function (collection) {
                    jsonPostObject.outputTarget = collection.collectionId;
                    createDerivedAsset(jsonPostObject, 'asset').then(
                        function (asset) {
                            if (asset.outputs && asset.outputs.length > 0) {
                                successCallback.apply(context, [{responseText: JSON.stringify({
                                    id: extractIdFromUrl(asset.outputs[0]),
                                    url: asset.outputs[0],
                                    name: asset.results.graphite_asset.name
                                })}]);
                            } else {
                                // Fabricate error until our worker can correctly
                                // report insufficient space issues.
                                errorCallback.apply(context, [{status: 507}]);
                            }
                        },
                        function (badStatus) {
                            errorCallback.apply(context, [badStatus]);
                        }
                    );
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        _batchCreateDerivedAssets: function (jobData, successCallback, errorCallback, context) {
            var expectedAssets = jobData.jobs.length;
            var moveAsset = function (data) {
                var options = createAjaxOptions('POST', '/api/v1/collections/' + data.parameters.outputTarget + '?op=move'),
                    moveData = {
                        resources: [
                            {
                                href: data.outputs[0],
                                name: data.parameters.assetName,
                                'if-match': '"*"'
                            }
                        ]
                    };

                options.data = JSON.stringify(moveData);
                options.headers['If-Match'] = '*';
                options.headers['Content-Type'] = 'application/x-sharedcloud-resources+json';
                $.ajax(options).complete(function (jqXHR, textStatus) {
                    expectedAssets--;
                    // TODO add events to notify user when we are finished
                    //if (expectedAssets === 0) {
                    //}
                });
            };
            var subWorkerDoneProc = function (err, data, jqXHR) {
                if (!err) {
                    var options = createAjaxOptions('GET', '/api/v1/collections/' + data.parameters.outputTarget);
                    $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                        moveAsset(data);
                    }).done(function (resp, textStatus, jqXHR) {
                        if (!resp.assets) {
                            moveAsset(data);
                        } else {
                            var i,
                                move = true;

                            for (i = 0; i < resp.assets.length; i++) {
                                if (resp.assets[i].name === data.parameters.assetName) {
                                    move = false;
                                    break;
                                }
                            }

                            if (move) {
                                moveAsset(data);
                            } else {
                                var assetOptions = createAjaxOptions('HEAD', '/api/v1/assets/' + resp.assets[i].id);
                                $.ajax(assetOptions).done(function (resp, textStatus, jqXHR) {
                                    assetOptions.headers['If-Match'] = jqXHR.getResponseHeader('etag');
                                    assetOptions.type = 'DELETE';
                                    $.ajax(assetOptions).done(function (resp, textStatus, jqXHR) {
                                        moveAsset(data);
                                    });
                                });
                            }
                        }
                    });
                }
            };

            var workerDoneProc = function (err, data, jqXHR) {
                if (err) {
                    errorCallback.apply(context, [err]);
                } else {
                    // Wait for all the sub jobs to finish
                    var i,
                        doneProc = workerDoneProc;
                    if (data.children.mode === 'seq') {
                        doneProc = subWorkerDoneProc;
                    }
                    for (i = 0; i < data.children.childJobs.length; i++) {
                        waitForGraphiteWorker(data.children.childJobs[i].job, doneProc);
                    }
                    successCallback.apply(context, [data]);
                }
            };

            getAssetCollection(jobData.psdGuid, true).then(
                function (collection) {
                    $.when.apply($, getCollectionSubFolders(collection.collectionId, jobData.jobs)).then(
                        function () {
                            var options = createAjaxOptions('POST', '/api/v1/jobs/workflow');
                            options.data = buildWorkflowJobParams(jobData, arguments);

                            $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                                errorCallback.apply(context, [textStatus]);
                            }).done(function (resp, textStatus, jqXHR) {
                                if (jqXHR.status === 201) {
                                    // the worker started so we just need to sit back and wait for it to finish
                                    waitForGraphiteWorker(jqXHR.getResponseHeader('location'), workerDoneProc);
                                }
                            });
                        },
                        function (badStatus) {
                            errorCallback.apply(context, [badStatus]);
                        }
                    );
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        _batchCreateDerivedAssets2: function (jobData, successCallback, errorCallback, context) {
            var finishedJobs = 0,
                jobErrors = 0,
                workerDoneProc = function (err, data, jqXHR) {
                    finishedJobs++;
                    if (err) {
                        jobErrors++;
                    }
                    if (finishedJobs === jobData.jobs.length) {
                        if (jobErrors === finishedJobs) {
                            errorCallback.apply(context, [finishedJobs]);
                        } else {
                            successCallback.apply(context, [finishedJobs, jobErrors]);
                        }
                    }
                };

            getAssetCollection(jobData.psdGuid, true).then(
                function (collection) {
                    _.each(jobData.jobs, function(job) {
                        findNamedLeafCollection(collection.collectionId, job.outputTarget.split('/')).then(
                            function (subCollection) {
                                var options = createAjaxOptions('POST', '/api/v1/jobs/' + WORKER_NAME),
                                    postDataObj = {
                                        parameters: {
                                            cmd: 'batchCreateAssets',
                                            assetId: jobData.psdGuid,
                                            scale: job.scale,
                                            assets: []
                                        },
                                        outputMode: 'asset',
                                        inputs: [ createAssetIdHref(jobData.psdGuid) ],
                                        outputTarget: 'vnd-adobe-sharedcloud.collection:' + subCollection
                                    };

                                _.each(job.assets, function (asset) {
                                    var jobAsset = {
                                        layerIds: asset.layerIds,
                                        encodingType: encodingTypes[asset.encodingType].encodingType,
                                        encodingQualityFactor: asset.encodingQualityFactor,
                                        assetName: asset.assetName + encodingTypes[asset.encodingType].fileExtension
                                    };
                                    postDataObj.parameters.assets.push(jobAsset);
                                });

                                if (job.layerCompId) {
                                    postDataObj.parameters.layerCompId = job.layerCompId;
                                }

                                options.headers['Content-Type'] = 'application/json';
                                options.data = JSON.stringify(postDataObj);
                                $.ajax(options).fail(function (jqXHR, textStatus, errorThrown) {
                                    workerDoneProc(errorThrown, textStatus, jqXHR);
                                }).done(function (resp, textStatus, jqXHR) {
                                    if (jqXHR.status === 201) {
                                        // the worker started so we just need to sit back and wait for it to finish
                                        waitForGraphiteWorker(jqXHR.getResponseHeader('location'), workerDoneProc);
                                    }
                                });
                            },
                            function (badStatus) {
                                workerDoneProc(badStatus);
                            }
                        );
                    });
                },
                function (badStatus) {
                    errorCallback.apply(context, [badStatus]);
                }
            );
        },

        batchCreateDerivedAssets: function (jobData, successCallback, errorCallback, context) {
            var self = this;
            // Don't allow batch creation in public one up view
            if (graphite.inPublicOneUp()) {
                return;
            }

            getWorkerVersionInfo().then(
                function (goodResult) {
                    if (goodResult.version && versionStringIsGreater(goodResult.version, '1.0.73')) {
                        self._batchCreateDerivedAssets2(jobData, successCallback, errorCallback, context);
                    } else {
                        self._batchCreateDerivedAssets(jobData, successCallback, errorCallback, context);
                    }
                },
                function (badResult) {
                    self._batchCreateDerivedAssets(jobData, successCallback, errorCallback, context);
                }
            );
        },

        getWorkerStatus: function (workerGuid, successCallback, errorCallback, context) {
            var options = createAjaxOptions('GET', '/api/v1/jobs/' + workerGuid);

            setAJAXCallbacks(options, successCallback, errorCallback, context);
            $.ajax(options);
        },

        // API used by ThumbnailController - probably don't need for ccweb
        /*
        getAssetThumbnailUrl: function (assetID) {
            return '/api/v1/asset/' + assetID + '/thumbnail';
        },
        */

        // API used by LayerModel
        getSpriteSheetURL: function (psdGuid, layerCompId, spriteSheetId) {
            var layerCompInfo = layerCompId ? '-lcid' + layerCompId : '';
            return constructProxyURL2('/api/v1/assets/' + psdGuid + '/renditions/graphite/SpriteSheet-' + spriteSheetId + layerCompInfo) + (spriteSheetCacheBuster.hasOwnProperty(psdGuid) ?  '&time=' + spriteSheetCacheBuster[psdGuid] : '');
        },

        // ___________ metrics_________

        // manage the x-domain user hash
        getSharedUserID: function () {
            // first look for a cached hash
            var userID = null;

            if (deps.utils.hasCookiesEnabled()) {
                userID = deps.utils.getCookie('fid');

                // look for s_pers which is saved by other adobe.com sub-domains
                if (!userID) {
                    var s_pers = deps.utils.getCookie('s_pers');
                    if (s_pers) {
                        userID = this.extractfid(s_pers);
                    }
                }

                // TODO: remove this clause once creative.adobe.com moves over to the s_pers cookie
                // look for creative.adobe.com's cookie (this will be replaced by an s_pers cookie 'very soon')
                if (!userID) {
                    userID = deps.utils.getCookie('s_fid');
                }
            }

            // create our own if none of the above worked
            if (!userID) {
                userID = this.createfid();
            }

            return userID;
        },

        extractfid: function (cookie) {
            var decoded = decodeURIComponent(cookie);
            if (decoded) {
                var partsArray = decoded.split('s_fid=');
                if (partsArray.length > 1) {
                    var idArray = partsArray[1].split('|');
                    if (idArray.length > 0) {
                        return idArray[0];
                    }
                }
            }
            return null;
        },

        createfid: function () {
            return 'xxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0,
                    v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16).toUpperCase();
            });
        },

        // APIs called from MetricsProxyModel
        registerPersistentParameters: function (params) {
            // stubbed for Extract
        },

        trackEvent: function (params, successCallback, errorCallback, context) {
            // extract or create a unique user id separate from Adobe ID
            var userID = this.getSharedUserID();
            if (userID && deps.utils.hasCookiesEnabled()) {
                deps.utils.setCookie('fid', userID);
            }

            params.fid = userID;

            // Splunk
            var log = deps.log('ccweb.files.extract');
            log('metrics:', params);

            // ETS
            var options = {
                    code: 'EDGE_EXTRACT',
                    sub_code: 'INTERACTION',
                    ets: params.timestamp,
                    epd: params
                },
                promise = deps.utils.etsSendEvent(options);
            promise.then(successCallback, errorCallback);
            // there is no step 3
        },

        // ________end metrics_________

        // APIs used by ViewTemplates.html
        getDerivedRenditionURL: function (assetID) {
            return constructProxyURL('/api/v1/assets/' + assetID + '/renditions/png/240');
        },

        getDerivedDownloadURL: function (assetID, name) {
            //URL is placed into single-quote delimited string in css, so single quotes must be escaped
            return constructProxyURL('/api/v1/assets/' + assetID) + '&download=true&filename=' + encodeURIComponent(name).replace(/'/g, '%27');
        },

        deleteDerivedAsset: function (derivedAssetId, successCallback, errorCallback, context) {
            var getEtag = createAjaxOptions('HEAD', '/api/v1/assets/' + derivedAssetId);
            $.ajax(getEtag).done(function (resp, textStatus, jqXHR) {
                var options = createAjaxOptions('DELETE', '/api/v1/assets/' + derivedAssetId);
                options.headers['If-Match'] = jqXHR.getResponseHeader('etag');
                setAJAXCallbacks(options, successCallback, errorCallback, context);

                $.ajax(options);
            }).fail(function (jqXHR, textStatus, errorThrown) {
                errorCallback.apply(context, [jqXHR]);
            });
        },

        getDefaultRenditionURL: function (psdGuid) {
            return constructProxyURL('/api/v1/assets/' + psdGuid + '/renditions/jpeg/1200');
        },

        getDerivedSpriteImage: function (psdModel, layers, successCallback, errorCallback, context) {

            var image = new Image(),
                self = this,
                postData = {
                    layerIds: layers,
                    psdGuid: psdModel.id,
                    encodingType: 'png32',
                    encodingQualityFactor: 100
                };

            if (psdModel.get('layerCompId')) {
                postData.layerCompId = psdModel.get('layerCompId');
            }

            if (context) {
                image.addEventListener('load', function () {
                    successCallback.apply(context);
                });
                image.addEventListener('error', function () {
                    errorCallback.apply(context);
                });
            } else {
                image.addEventListener('load', successCallback);
                image.addEventListener('error', errorCallback);
            }

            createDerivedAsset(postData, 'transient').then(
                function (asset) {
                    self.loadCrossDomainImage(image, constructProxyURL(asset.outputs[0], true));
                },
                function (badStatus) {
                    errorCallback.apply(context);
                }
            );

            return image;
        },

        getAssetETag: function (assetId, successCallback, errorCallback, context) {
            var options = createAjaxOptions('HEAD', '/api/v1/assets/' + assetId);
            setAJAXCallbacks(options, successCallback, errorCallback, context);
            $.ajax(options);
        },

        loadCrossDomainImage: function (image, src) {

            // Apply crossOrigin policy.
            try {
                if (image) {
                    image.crossOrigin = 'Anonymous';
                }
            } catch (err) {
                // Ignored
            }

            // Workaround for IE10 for now, to ensure we can safely
            // interact with cross domain image data from canvas
            // instances.
            if (navigator.appVersion.indexOf('MSIE 10.') !== -1 &&
                    window.URL && window.URL.createObjectURL) {
                image.crossOrigin = 'anonymous';

                // Using XMLHttpRequest here as $.ajax does not support reponseType 'blob'.
                var req = new XMLHttpRequest();
                req.onreadystatechange = function () {
                    if (req.readyState === 4 && req.status === 200) {
                        image.src = window.URL.createObjectURL(req.response);
                    }
                };
                req.open('GET', src, true);
                req.responseType = 'blob';
                req.send();
            } else {
                image.src = src;
            }
        }
    };

    return serverAPI;

});
